-- 18-02 step 0b, part 3: D-48's SCOPE, after the 2026-11-01 widening.
--
--   psql "$SCRATCH_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/rehearsal/18-02-seed.sql
--   psql "$SCRATCH_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/rehearsal/18-02-behaviour.sql
--   psql "$SCRATCH_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/rehearsal/18-02-d48-scope.sql
--
-- Run as the OWNER after 20261030000100.
--
-- WHY THIS FILE EXISTS. 18-02-behaviour.sql's twenty assertions all read as anon,
-- where p_viewer IS NULL and the answer is always the narrow projection. They were
-- GREEN before the widening and GREEN after it, because not one of them puts a
-- MEMBER in the viewer seat. The rule that changed had no test.
--
-- public_author_is_visible's membership arm now matches on (slice_type, geoid)
-- rather than one slice_id. The risk of a widening is never the case you meant to
-- open -- it is the case you opened by accident. So D3, D4 and D6 below are the
-- point of this file: they pin the walls that must still stand.
--
-- Fixtures added here, on top of the seed:
--   city/3712000 shard 1            a DIFFERENT geoid, same type  -> D4's wall
--   V_SIB       44444444-...        member of city/3703000 shard 1
--   V_COUNTY    55555555-...        member of county/37021 only   -> D3's wall
--   V_OTHERCITY 66666666-...        member of city/3712000 only   -> D4's wall
--   V_FRIEND    33333333-...        member of nothing, FRIEND of Ada
--   V_STRANGER  77777777-...        member of nothing, no friendship
--
-- friendships stores the pair ordered (CHECK user_low < user_high), so Ada
-- (11111111-...) is user_low and V_FRIEND (33333333-...) is user_high.

INSERT INTO civic_spaces.connected_profiles (user_id, display_name, account_standing) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Friend Fixture',     'active'),
  ('44444444-4444-4444-4444-444444444444', 'Sibling Fixture',    'active'),
  ('55555555-5555-5555-5555-555555555555', 'County Fixture',     'active'),
  ('66666666-6666-6666-6666-666666666666', 'Other City Fixture', 'active'),
  ('77777777-7777-7777-7777-777777777777', 'Stranger Fixture',   'active');

INSERT INTO civic_spaces.slices (id, slice_type, geoid, sibling_index) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000005', 'city', '3712000', 1);

INSERT INTO civic_spaces.slice_members (user_id, slice_id) VALUES
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-0000-0000-0000-000000000004'),
  ('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-0000-0000-0000-000000000005');

INSERT INTO civic_spaces.friendships (user_low, user_high, status) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'FRIEND');

\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on

-- ---------------------------------------------------------------------------
-- The helper directly. p_slice_id is SHARD 2 throughout D1-D4: the viewer is
-- never a member of the slice being read, only of a sibling of it.
-- ---------------------------------------------------------------------------

SELECT 'D1 member of shard 1 SEES an author in shard 1   : ' ||
  CASE WHEN civic_spaces.public_author_is_visible(
         '44444444-4444-4444-4444-444444444444',
         '11111111-1111-1111-1111-111111111111',
         'aaaaaaaa-0000-0000-0000-000000000001')
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'D2 member of shard 1 SEES an author in shard 2   : ' ||
  CASE WHEN civic_spaces.public_author_is_visible(
         '44444444-4444-4444-4444-444444444444',
         '11111111-1111-1111-1111-111111111111',
         'aaaaaaaa-0000-0000-0000-000000000002')
       THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 THE WALLS. D2 is the widening; these three are what it must NOT have become.

SELECT 'D3 county member does NOT see a city author      : ' ||
  CASE WHEN NOT civic_spaces.public_author_is_visible(
         '55555555-5555-5555-5555-555555555555',
         '11111111-1111-1111-1111-111111111111',
         'aaaaaaaa-0000-0000-0000-000000000001')
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'D4 another city''s member does NOT see them      : ' ||
  CASE WHEN NOT civic_spaces.public_author_is_visible(
         '66666666-6666-6666-6666-666666666666',
         '11111111-1111-1111-1111-111111111111',
         'aaaaaaaa-0000-0000-0000-000000000001')
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'D5 a stranger does NOT see them                  : ' ||
  CASE WHEN NOT civic_spaces.public_author_is_visible(
         '77777777-7777-7777-7777-777777777777',
         '11111111-1111-1111-1111-111111111111',
         'aaaaaaaa-0000-0000-0000-000000000001')
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'D6 a FRIEND who is no member still sees them     : ' ||
  CASE WHEN civic_spaces.public_author_is_visible(
         '33333333-3333-3333-3333-333333333333',
         '11111111-1111-1111-1111-111111111111',
         'aaaaaaaa-0000-0000-0000-000000000001')
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'D7 a friend of X does NOT unlock author Y        : ' ||
  CASE WHEN NOT civic_spaces.public_author_is_visible(
         '33333333-3333-3333-3333-333333333333',
         '22222222-2222-2222-2222-222222222222',
         'aaaaaaaa-0000-0000-0000-000000000001')
       THEN 'PASS' ELSE 'FAIL' END;

-- ---------------------------------------------------------------------------
-- End to end, through the real RPC and a real JWT claim, because the helper
-- being right is not the same as the RPC passing the right viewer to it.
-- E2 reads the SHARD 2 post as a member of SHARD 1 -- the widening, over the
-- path production actually uses.
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';

SELECT 'E1 RPC: current_user_id() reads the claim        : ' ||
  CASE WHEN civic_spaces.current_user_id() = '44444444-4444-4444-4444-444444444444'
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'E2 RPC: shard-1 member gets shard-2 author id    : ' ||
  CASE WHEN (SELECT author_user_id FROM civic_spaces.get_public_post(
               'bbbbbbbb-0000-0000-0000-000000000002'))
            = '11111111-1111-1111-1111-111111111111'
       THEN 'PASS' ELSE 'FAIL' END;
COMMIT;

BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666"}';

SELECT 'E3 RPC: another city''s member gets NULL         : ' ||
  CASE WHEN (SELECT author_user_id IS NULL AND author_display_name = 'Ada Fixture'
               FROM civic_spaces.get_public_post('bbbbbbbb-0000-0000-0000-000000000002'))
       THEN 'PASS' ELSE 'FAIL' END;
COMMIT;

-- external_id must beat sub: the WorkOS path, which is how most members arrive.
BEGIN;
SET LOCAL request.jwt.claims =
  '{"sub":"user_01WORKOS","external_id":"44444444-4444-4444-4444-444444444444"}';

SELECT 'E4 RPC: external_id outranks sub                 : ' ||
  CASE WHEN (SELECT author_user_id FROM civic_spaces.get_public_post(
               'bbbbbbbb-0000-0000-0000-000000000002'))
            = '11111111-1111-1111-1111-111111111111'
       THEN 'PASS' ELSE 'FAIL' END;
COMMIT;

-- 🔴 CONTROL. Deliberately wrong, MUST print FAIL. Six of the nine assertions
-- above are negations, and a negation passes when the fixture is missing as
-- readily as when the rule is right -- so this file in particular has to show it
-- can fail at all.
SELECT 'C  CONTROL, must read FAIL                       : ' ||
  CASE WHEN civic_spaces.public_author_is_visible(
         '77777777-7777-7777-7777-777777777777',
         '11111111-1111-1111-1111-111111111111',
         'aaaaaaaa-0000-0000-0000-000000000001')
       THEN 'PASS' ELSE 'FAIL' END;
