-- Reconcile slices.current_member_count against actual membership.
--
-- The counter is maintained by triggers (enforce_slice_cap on INSERT,
-- decrement_slice_count on DELETE) and those are correct. The drift predates them:
-- measured 2026-09-01, federal/0636 claimed 42 members against 1 real,
-- local/06037 claimed 36 against 1, state/06028 claimed 34 against 1, and
-- neighborhood/0622710 claimed 23 against 0.
--
-- This matters beyond display. enforce_slice_cap reads this column, so sharding
-- decisions were being made on fiction: a slice holding three people could be
-- declared full at the 6000 cap and spawn a sibling, splitting a community that
-- never needed splitting — the opposite of the human-scale goal.

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

DO $$
DECLARE v_wrong integer;
BEGIN
  -- Count the disagreeing slices, not the rows within one group. A GROUP BY/HAVING
  -- with SELECT INTO assigns only the first group's count and leaves v_wrong NULL
  -- when every slice is correct, which reads as a pass for the wrong reason.
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
END $$;
