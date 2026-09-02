-- Slice taxonomy: governments, not constituencies.
-- See .planning/research/SLICE-TAXONOMY.md.
--
-- THIS MIGRATION DELETES SLICES, AND posts.slice_id IS ON DELETE CASCADE. Deleting a
-- slice silently takes its posts with it. Every DELETE below is therefore preceded by the
-- move that empties the slice, and by an assertion that it is empty. Snapshot first --
-- see Step 0 of the plan.
--
-- TWO CORRECTIONS TO THE PLANNED VERSION, both proven against production 2026-09-01:
--
-- 1. The planned step 3 was `UPDATE slices SET geoid = LEFT(geoid,2) WHERE slice_type =
--    'state'`, with a dedup step afterwards. It cannot reach the dedup: slices carries
--    UNIQUE (geoid, slice_type, sibling_index), and state/06026 and state/06028 both
--    collapse onto ('06','state',1). Probed in a rolled-back transaction: the UPDATE
--    raises unique_violation and aborts the migration whole. Duplicates must be merged
--    BEFORE the geoid is rewritten, not after.
--
-- 2. The planned federal merge and state merge were separate blocks with different
--    shapes. They are the same operation -- collapse a set of slices onto one target
--    geoid, keeping the one that already holds the conversation -- so they are one block
--    here, driven by a mapping table. Two shapes meant two places to get the post-move
--    ordering wrong.

-- What must still be true at the end. Captured before anything moves.
CREATE TEMP TABLE taxonomy_baseline AS
SELECT (SELECT count(*) FROM civic_spaces.posts)                        AS posts,
       (SELECT count(DISTINCT user_id) FROM civic_spaces.slice_members) AS members;

-- ---------------------------------------------------------------------------
-- 0. Widen the vocabulary before writing a word it does not yet contain.
--
--    slices_slice_type_check permits exactly federal/state/local/neighborhood/unified/
--    volunteer, so the very first UPDATE below fails with 23514 without this. The plan
--    did not mention the constraint; the rehearsal found it on the first statement.
--
--    Dropped now and re-added at the end rather than swapped in one statement, because
--    the intermediate states are legal under neither vocabulary: after step 1 the table
--    holds `county` while `neighborhood` rows still exist.
-- ---------------------------------------------------------------------------
ALTER TABLE civic_spaces.slices DROP CONSTRAINT slices_slice_type_check;

-- ---------------------------------------------------------------------------
-- 1. Rename the two mislabelled types.
--    `local` already holds county FIPS, so only the label is wrong. No geoid moves,
--    so no uniqueness risk.
-- ---------------------------------------------------------------------------
UPDATE civic_spaces.slices SET slice_type = 'county' WHERE slice_type = 'local';

-- ---------------------------------------------------------------------------
-- 2. Retire the old neighborhood slices.
--    They held school districts (180063000003) and a school-board district
--    (lausd-board-district-4). None of those is a city, none has a defensible city
--    geoid, and members are re-derived by re-running assignment afterwards.
-- ---------------------------------------------------------------------------
DO $guard$
DECLARE v_posts integer;
BEGIN
  SELECT count(*) INTO v_posts
  FROM civic_spaces.posts p
  JOIN civic_spaces.slices s ON s.id = p.slice_id
  WHERE s.slice_type = 'neighborhood';

  IF v_posts > 0 THEN
    RAISE EXCEPTION
      'refusing to retire neighborhood slices: % post(s) would be cascade-deleted with them',
      v_posts;
  END IF;
END $guard$;

-- slice_members cascades; posts are proven absent above.
DELETE FROM civic_spaces.slices WHERE slice_type = 'neighborhood';

-- ---------------------------------------------------------------------------
-- 3. Collapse federal and state onto the government they name.
--
--    federal was keyed on congressional districts (0634, 0636, 1807, 1809) and becomes
--    one nationwide space. state was keyed on senate districts (06028, 18040) and
--    becomes the state, whose FIPS is the first two characters.
--
--    The survivor is the slice already holding the most posts, so the busiest thread
--    never moves; created_at breaks the tie so the choice is deterministic.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE slice_retarget AS
SELECT s.id,
       s.slice_type,
       s.geoid AS old_geoid,
       CASE s.slice_type
         WHEN 'federal' THEN 'US'
         WHEN 'state'   THEN LEFT(s.geoid, 2)
       END AS new_geoid,
       s.created_at,
       (SELECT count(*) FROM civic_spaces.posts p WHERE p.slice_id = s.id) AS post_count
FROM civic_spaces.slices s
WHERE s.slice_type IN ('federal', 'state');

DO $guard$
DECLARE v_bad text;
BEGIN
  -- A state geoid that is not a 5-digit district would silently produce a nonsense
  -- two-character state. Refuse rather than guess.
  SELECT string_agg(old_geoid, ', ') INTO v_bad
  FROM slice_retarget
  WHERE slice_type = 'state' AND new_geoid !~ '^[0-9]{2}$';

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'state slice(s) whose geoid does not yield a state FIPS: %', v_bad;
  END IF;
END $guard$;

CREATE TEMP TABLE slice_survivor AS
SELECT DISTINCT ON (slice_type, new_geoid)
       slice_type, new_geoid, id AS survivor_id
FROM slice_retarget
ORDER BY slice_type, new_geoid, post_count DESC, created_at ASC;

-- 3a. Content first. Nothing is deleted while it still holds a post.
UPDATE civic_spaces.posts p
SET slice_id = sv.survivor_id
FROM slice_retarget r
JOIN slice_survivor sv ON sv.slice_type = r.slice_type AND sv.new_geoid = r.new_geoid
WHERE p.slice_id = r.id AND r.id <> sv.survivor_id;

-- 3b. Then members, but only those not already in the survivor -- the unique
--     (user_id, slice_id) would reject the rest. Those are dropped with their slice.
UPDATE civic_spaces.slice_members m
SET slice_id = sv.survivor_id
FROM slice_retarget r
JOIN slice_survivor sv ON sv.slice_type = r.slice_type AND sv.new_geoid = r.new_geoid
WHERE m.slice_id = r.id AND r.id <> sv.survivor_id
  AND NOT EXISTS (
    SELECT 1 FROM civic_spaces.slice_members m2
    WHERE m2.user_id = m.user_id AND m2.slice_id = sv.survivor_id
  );

-- 3c. The losers are now empty of posts. Assert it, then drop them.
DO $guard$
DECLARE v_posts integer;
BEGIN
  SELECT count(*) INTO v_posts
  FROM civic_spaces.posts p
  JOIN slice_retarget r ON r.id = p.slice_id
  JOIN slice_survivor sv ON sv.slice_type = r.slice_type AND sv.new_geoid = r.new_geoid
  WHERE r.id <> sv.survivor_id;

  IF v_posts > 0 THEN
    RAISE EXCEPTION 'post move incomplete: % post(s) still sit on a slice about to be deleted', v_posts;
  END IF;
END $guard$;

DELETE FROM civic_spaces.slices s
USING slice_retarget r
JOIN slice_survivor sv ON sv.slice_type = r.slice_type AND sv.new_geoid = r.new_geoid
WHERE s.id = r.id AND r.id <> sv.survivor_id;

-- 3d. Only now is the rewrite unique, because one row per target remains.
UPDATE civic_spaces.slices s
SET geoid = sv.new_geoid, sibling_index = 1
FROM slice_survivor sv
WHERE s.id = sv.survivor_id AND s.geoid IS DISTINCT FROM sv.new_geoid;

-- ---------------------------------------------------------------------------
-- 4. Re-reconcile. The moves above change slice_id with UPDATEs, which fire neither
--    the insert nor the delete trigger, so the counters are stale by construction.
--    20260902000050 must have run first, or this is undone by the next app load.
-- ---------------------------------------------------------------------------
UPDATE civic_spaces.slices s
SET current_member_count = COALESCE(m.n, 0)
FROM (SELECT sl.id, COUNT(sm.user_id) AS n
      FROM civic_spaces.slices sl
      LEFT JOIN civic_spaces.slice_members sm ON sm.slice_id = sl.id
      GROUP BY sl.id) m
WHERE m.id = s.id
  AND s.current_member_count IS DISTINCT FROM COALESCE(m.n, 0);

-- ---------------------------------------------------------------------------
-- 4b. Re-impose the vocabulary, now naming governments. Re-adding the constraint is
--     itself a check on the migration: it validates every existing row, so a slice_type
--     this migration failed to convert fails here rather than surviving unnoticed.
-- ---------------------------------------------------------------------------
ALTER TABLE civic_spaces.slices ADD CONSTRAINT slices_slice_type_check
  CHECK (slice_type = ANY (ARRAY['federal', 'state', 'county', 'city', 'unified', 'volunteer']));

-- ---------------------------------------------------------------------------
-- 5. Post-verify.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_bad   integer;
  v_posts integer;
  v_base  record;
BEGIN
  SELECT * INTO v_base FROM taxonomy_baseline;

  -- Not one post may be lost. This is the assertion the CASCADE makes necessary.
  SELECT count(*) INTO v_posts FROM civic_spaces.posts;
  IF v_posts <> v_base.posts THEN
    RAISE EXCEPTION 'post count changed: % before, % after', v_base.posts, v_posts;
  END IF;

  SELECT COUNT(*) INTO v_bad FROM civic_spaces.slices
   WHERE slice_type IN ('local', 'neighborhood');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'migration failed: % slices still use a retired slice_type', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad FROM civic_spaces.slices
   WHERE slice_type = 'federal' AND geoid <> 'US';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'migration failed: % federal slices are still districts', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad FROM civic_spaces.slices WHERE slice_type = 'federal';
  IF v_bad <> 1 THEN
    RAISE EXCEPTION 'expected exactly one federal slice, found %', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad FROM civic_spaces.slices
   WHERE slice_type = 'state' AND geoid !~ '^[0-9]{2}$';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'migration failed: % state slices are still districts', v_bad;
  END IF;

  -- No duplicate government anywhere.
  SELECT COUNT(*) INTO v_bad FROM (
    SELECT slice_type, geoid FROM civic_spaces.slices
    GROUP BY slice_type, geoid HAVING COUNT(*) > 1
  ) d;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '% (slice_type, geoid) pairs are duplicated', v_bad;
  END IF;

  SELECT COUNT(*) INTO v_bad FROM (
    SELECT sl.id FROM civic_spaces.slices sl
    LEFT JOIN civic_spaces.slice_members sm ON sm.slice_id = sl.id
    GROUP BY sl.id, sl.current_member_count
    HAVING sl.current_member_count <> COUNT(sm.user_id)
  ) bad;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '% slices disagree with their membership after reconcile', v_bad;
  END IF;
END $verify$;

DROP TABLE taxonomy_baseline;
DROP TABLE slice_retarget;
DROP TABLE slice_survivor;
