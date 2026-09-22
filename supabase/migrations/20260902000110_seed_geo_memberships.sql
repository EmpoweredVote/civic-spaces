-- Give every existing member the spaces the new taxonomy says they belong to.
--
-- 🔴 THIS REPLACES STEP 4 OF THE PLAN, WHICH CANNOT BE DONE.
--
-- The plan finishes the cut by re-running assignment for all seven members: "POST /assign
-- with a service call, or have each member load the app -- useEnsureSlices triggers
-- assignment for anyone with no spaces." Neither works here.
--
--   POST /assign  is behind verifyToken, which checks a per-user JWT against the accounts
--                 JWKS, and the handler then calls the accounts API with that same token
--                 to read the member's jurisdiction. There is no service-key path. You
--                 cannot run it for someone else without minting their token.
--
--   loading the app  fires useEnsureSlices only when hasAnySlices is FALSE. That hook is a
--                 self-heal for members who belong to nothing. After the taxonomy
--                 migration every member still holds federal/US, their state, their county
--                 and unified -- so hasAnySlices is true, the hook never fires, and the
--                 one level that is genuinely new never arrives.
--
-- Left alone, the cut would rename everything correctly and leave all seven members
-- permanently without a City space: the headline of the whole taxonomy change, missing.
--
-- So the levels are derived here from the same source the service reads -- the geoid
-- columns on connect.connected_profiles, which CC_0038/CC_0039 populate -- rather than
-- through the service. Same inputs, same result, no token required.
--
-- Idempotent: existing memberships are left alone, existing slices are reused, and a
-- re-run inserts nothing.

-- Only members who already use Civic Spaces. Assignment has always been a consequence of
-- someone turning up; this migration must not enrol the three connect profiles that have
-- never opened the app.
CREATE TEMP TABLE seed_want AS
SELECT DISTINCT
       mb.user_id,
       v.slice_type,
       v.geoid
FROM (SELECT DISTINCT user_id FROM civic_spaces.slice_members) mb
JOIN connect.connected_profiles p ON p.user_id::text = mb.user_id
CROSS JOIN LATERAL (VALUES
  ('city',    p.city_geo_id),
  ('county',  p.county_geo_id),
  ('state',   p.state_geo_id),
  ('federal', p.nation_geo_id)
) AS v(slice_type, geoid)
WHERE v.geoid IS NOT NULL
  AND p.deleted_at IS NULL;

-- A level the jurisdiction does not name is skipped, exactly as assignUserToSlices skips
-- it: two of the ten profiles are unincorporated and have no city_geo_id. That is an
-- answer, not a gap.

-- 1. Create any slice a member needs that nobody has needed before. sibling_index 1 is
--    the first room; the capacity split only matters at 6000 and the largest slice here
--    holds five.
INSERT INTO civic_spaces.slices (slice_type, geoid, sibling_index)
SELECT DISTINCT w.slice_type, w.geoid, 1
FROM seed_want w
WHERE NOT EXISTS (
  SELECT 1 FROM civic_spaces.slices s
  WHERE s.slice_type = w.slice_type AND s.geoid = w.geoid
);

-- 2. Seat each member in the lowest-numbered room that is not full -- the same rule as
--    findActiveSliceForGeoid. ON CONFLICT covers the memberships that already exist,
--    and is now safe: 20260902000050 moved the counter to an AFTER INSERT trigger, so a
--    skipped row no longer counts itself.
INSERT INTO civic_spaces.slice_members (user_id, slice_id)
SELECT w.user_id, s.id
FROM seed_want w
JOIN LATERAL (
  SELECT sl.id
  FROM civic_spaces.slices sl
  WHERE sl.slice_type = w.slice_type
    AND sl.geoid = w.geoid
    AND sl.current_member_count < 6000
  ORDER BY sl.sibling_index
  LIMIT 1
) s ON true
ON CONFLICT (user_id, slice_id) DO NOTHING;

DO $verify$
DECLARE
  v_missing integer;
  v_wrong   integer;
BEGIN
  -- Every level the jurisdiction named must now be a membership.
  SELECT count(*) INTO v_missing
  FROM seed_want w
  WHERE NOT EXISTS (
    SELECT 1
    FROM civic_spaces.slice_members m
    JOIN civic_spaces.slices s ON s.id = m.slice_id
    WHERE m.user_id = w.user_id
      AND s.slice_type = w.slice_type
      AND s.geoid = w.geoid
  );

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'seeding left % (member, level) pair(s) unseated', v_missing;
  END IF;

  -- And the counters must still tell the truth, which is the whole point of
  -- 20260902000050 having gone first.
  SELECT COUNT(*) INTO v_wrong FROM (
    SELECT sl.id
    FROM civic_spaces.slices sl
    LEFT JOIN civic_spaces.slice_members sm ON sm.slice_id = sl.id
    GROUP BY sl.id, sl.current_member_count
    HAVING sl.current_member_count <> COUNT(sm.user_id)
  ) bad;

  IF v_wrong > 0 THEN
    RAISE EXCEPTION '% slices disagree with their membership after seeding', v_wrong;
  END IF;
END $verify$;

DROP TABLE seed_want;
