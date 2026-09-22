-- Stop counting members who were never inserted.
--
-- 🔴 THE BUG. trg_enforce_slice_cap is a BEFORE INSERT trigger and it does two jobs in
-- one body: it rejects an insert into a full slice, and it increments
-- slices.current_member_count. The assignment service writes memberships with
--
--     .upsert({ user_id, slice_id }, { onConflict: 'user_id,slice_id',
--               ignoreDuplicates: true })
--
-- which is INSERT ... ON CONFLICT DO NOTHING. A BEFORE INSERT trigger fires BEFORE the
-- conflict is detected, so on a duplicate the trigger increments the counter and then the
-- row is silently skipped. The statement succeeds. The counter is now one higher for a
-- member who was already there.
--
-- Every re-assignment therefore inflates every one of that member's slices by one, and
-- assignment re-runs whenever the app loads (useEnsureSlices) or an address changes. That
-- is how federal/0636 came to claim 42 members against 1 real one.
--
-- Measured on production 2026-09-01, in a rolled-back transaction: re-issuing the
-- service's exact upsert for an existing (user_id, slice_id) took current_member_count
-- from 2 to 3 while the actual row count stayed at 2.
--
-- 20260902000000_reconcile_slice_counts.sql repaired the numbers on the assumption that
-- the triggers were correct and the drift was historical. It was neither: within a day
-- four slices had drifted again, by exactly the +1 this explains. A reconcile without
-- this fix is a snapshot, not a repair.
--
-- THE FIX. Split the two jobs along the grain of when each is knowable:
--   BEFORE INSERT  -- may this row go in? (raise, touch nothing)
--   AFTER INSERT   -- a row went in, so count it
-- AFTER INSERT does not fire for a row that ON CONFLICT skipped, which is precisely the
-- distinction the old trigger could not make. This also makes the pair symmetric:
-- decrement_slice_count is already AFTER DELETE.

-- 1. The gate. No longer touches the counter.
CREATE OR REPLACE FUNCTION civic_spaces.enforce_slice_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'civic_spaces'
AS $function$
DECLARE v_count integer;
BEGIN
    -- FOR UPDATE serialises concurrent joins to the same slice, so two members cannot
    -- both read 5999 and both be admitted.
    SELECT current_member_count INTO v_count
    FROM civic_spaces.slices WHERE id = NEW.slice_id FOR UPDATE;

    IF v_count >= 6000 THEN
        RAISE EXCEPTION 'slice_full: slice % has reached the 6000 member cap', NEW.slice_id
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. The counter. Fires only for rows that actually landed.
CREATE OR REPLACE FUNCTION civic_spaces.increment_slice_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'civic_spaces'
AS $function$
BEGIN
    UPDATE civic_spaces.slices
    SET current_member_count = current_member_count + 1
    WHERE id = NEW.slice_id;
    RETURN NULL;  -- AFTER trigger: return value is ignored
END;
$function$;

DROP TRIGGER IF EXISTS trg_increment_slice_count ON civic_spaces.slice_members;
CREATE TRIGGER trg_increment_slice_count
    AFTER INSERT ON civic_spaces.slice_members
    FOR EACH ROW EXECUTE FUNCTION civic_spaces.increment_slice_count();

-- 3. Reconcile again, now that the drift has somewhere to stop.
UPDATE civic_spaces.slices s
SET current_member_count = COALESCE(m.n, 0)
FROM (
  SELECT sl.id, COUNT(sm.user_id) AS n
  FROM civic_spaces.slices sl
  LEFT JOIN civic_spaces.slice_members sm ON sm.slice_id = sl.id
  GROUP BY sl.id
) m
WHERE m.id = s.id
  AND s.current_member_count IS DISTINCT FROM COALESCE(m.n, 0);

DO $verify$
DECLARE
  v_wrong  integer;
  v_before integer;
  v_after  integer;
  v_rows   integer;
  v_user   uuid;
  v_slice  uuid;
BEGIN
  -- (a) Every slice agrees with its membership right now.
  SELECT COUNT(*) INTO v_wrong FROM (
    SELECT sl.id
    FROM civic_spaces.slices sl
    LEFT JOIN civic_spaces.slice_members sm ON sm.slice_id = sl.id
    GROUP BY sl.id, sl.current_member_count
    HAVING sl.current_member_count <> COUNT(sm.user_id)
  ) bad;

  IF v_wrong > 0 THEN
    RAISE EXCEPTION 'reconcile failed: % slices still disagree with their membership', v_wrong;
  END IF;

  -- (b) And a no-op upsert no longer moves the number. This is the assertion that
  --     distinguishes this migration from the reconcile that preceded it: without the
  --     trigger split, (a) passes and the count drifts again on the next app load.
  SELECT m.user_id, m.slice_id INTO v_user, v_slice
  FROM civic_spaces.slice_members m LIMIT 1;

  IF v_user IS NOT NULL THEN
    SELECT current_member_count INTO v_before FROM civic_spaces.slices WHERE id = v_slice;

    INSERT INTO civic_spaces.slice_members (user_id, slice_id)
    VALUES (v_user, v_slice)
    ON CONFLICT (user_id, slice_id) DO NOTHING;

    SELECT current_member_count INTO v_after FROM civic_spaces.slices WHERE id = v_slice;
    SELECT COUNT(*) INTO v_rows FROM civic_spaces.slice_members WHERE slice_id = v_slice;

    IF v_after <> v_before THEN
      RAISE EXCEPTION
        'a duplicate upsert still moved the counter: % -> % against % real rows',
        v_before, v_after, v_rows;
    END IF;
  END IF;
END $verify$;
