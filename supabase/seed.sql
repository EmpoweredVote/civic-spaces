-- =============================================================================
-- Civic Spaces: Seed Data
-- Phase 01 Plan 02 - Task 2
-- Uses real Monroe County, Indiana TIGER/Line GEOIDs
-- =============================================================================
-- GEOIDs used:
--   '1807'     — IN-07 Federal congressional district (4-digit: state_fips + district_num)
--   '18046'    — IN State Senate District 46 (5-digit: state_fips + zero-padded district)
--   '18097'    — Monroe County, IN (5-digit county FIPS)
--   '1804770'  — Monroe County Community School Corporation (7-digit NCES district)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Slices: one per jurisdiction type for Bloomington / Monroe County, IN
-- ---------------------------------------------------------------------------
INSERT INTO civic_spaces.slices (slice_type, geoid, sibling_index, current_member_count)
VALUES ('federal', '1807', 1, 0);

-- Bypass trigger to simulate a near-cap slice for testing enforcement
-- (Direct UPDATE skips enforce_slice_cap trigger which only fires on INSERT)
UPDATE civic_spaces.slices
SET    current_member_count = 5999
WHERE  geoid = '1807'
  AND  slice_type = 'federal'
  AND  sibling_index = 1;

INSERT INTO civic_spaces.slices (slice_type, geoid, sibling_index)
VALUES
    ('state',        '18046',   1),
    ('local',        '18097',   1),
    ('neighborhood', '1804770', 1);

-- ---------------------------------------------------------------------------
-- Test profiles
-- ---------------------------------------------------------------------------
INSERT INTO civic_spaces.connected_profiles (user_id, display_name)
VALUES
    ('test-user-001', 'BloomingtonVoter'),
    ('test-user-002', 'MonroeResident'),
    ('test-user-003', 'CivicParticipant');

-- ---------------------------------------------------------------------------
-- Membership: test-user-001 joins the federal slice (brings count to 6000)
-- ---------------------------------------------------------------------------
INSERT INTO civic_spaces.slice_members (user_id, slice_id)
SELECT 'test-user-001', id
FROM   civic_spaces.slices
WHERE  geoid = '1807'
  AND  slice_type = 'federal'
  AND  sibling_index = 1;

-- Verify count reached 6000
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT current_member_count INTO v_count
    FROM   civic_spaces.slices
    WHERE  geoid = '1807' AND slice_type = 'federal';

    IF v_count = 6000 THEN
        RAISE NOTICE 'OK: federal slice count = 6000 (at cap)';
    ELSE
        RAISE NOTICE 'UNEXPECTED: federal slice count = % (expected 6000)', v_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Cap enforcement test: 6001st insert must raise slice_full
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    INSERT INTO civic_spaces.slice_members (user_id, slice_id)
    SELECT 'test-user-002', id
    FROM   civic_spaces.slices
    WHERE  geoid = '1807'
      AND  slice_type = 'federal'
      AND  sibling_index = 1;

    RAISE NOTICE 'ERROR: cap not enforced — 6001st member was inserted';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE 'slice_full%' THEN
            RAISE NOTICE 'OK: slice_full raised as expected: %', SQLERRM;
        ELSE
            RAISE NOTICE 'UNEXPECTED exception: %', SQLERRM;
        END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Decrement test: removing test-user-001 should drop count back to 5999
-- ---------------------------------------------------------------------------
DELETE FROM civic_spaces.slice_members
WHERE  user_id = 'test-user-001'
  AND  slice_id = (
      SELECT id FROM civic_spaces.slices
      WHERE  geoid = '1807' AND slice_type = 'federal' AND sibling_index = 1
  );

DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT current_member_count INTO v_count
    FROM   civic_spaces.slices
    WHERE  geoid = '1807' AND slice_type = 'federal';

    IF v_count = 5999 THEN
        RAISE NOTICE 'OK: count decremented to 5999 after member removal';
    ELSE
        RAISE NOTICE 'UNEXPECTED: count = % after removal (expected 5999)', v_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Re-add test-user-001 as a legitimate member (count back to 6000)
-- ---------------------------------------------------------------------------
INSERT INTO civic_spaces.slice_members (user_id, slice_id)
SELECT 'test-user-001', id
FROM   civic_spaces.slices
WHERE  geoid = '1807'
  AND  slice_type = 'federal'
  AND  sibling_index = 1;

-- test-user-002 joins the state slice (no cap pressure)
INSERT INTO civic_spaces.slice_members (user_id, slice_id)
SELECT 'test-user-002', id
FROM   civic_spaces.slices
WHERE  geoid = '18046' AND slice_type = 'state';

-- test-user-003 joins the local (county) slice
INSERT INTO civic_spaces.slice_members (user_id, slice_id)
SELECT 'test-user-003', id
FROM   civic_spaces.slices
WHERE  geoid = '18097' AND slice_type = 'local';

-- ---------------------------------------------------------------------------
-- Test posts and replies
-- ---------------------------------------------------------------------------
INSERT INTO civic_spaces.posts (slice_id, user_id, title, body)
SELECT
    id,
    'test-user-001',
    'Welcome to Monroe County Federal Slice',
    'First post in our civic community. This is Congressional District IN-07, serving Bloomington and Monroe County.'
FROM civic_spaces.slices
WHERE geoid = '1807' AND slice_type = 'federal';

-- A reply to the first post
INSERT INTO civic_spaces.replies (post_id, user_id, body)
SELECT
    p.id,
    'test-user-001',
    'Glad to be here — looking forward to civic discussion with my neighbors.'
FROM civic_spaces.posts p
WHERE p.user_id = 'test-user-001'
  AND p.title   = 'Welcome to Monroe County Federal Slice';

-- A post in the state slice by test-user-002
INSERT INTO civic_spaces.posts (slice_id, user_id, title, body)
SELECT
    id,
    'test-user-002',
    'State Senate District 46',
    'Post from the Indiana State Senate District 46 slice.'
FROM civic_spaces.slices
WHERE geoid = '18046' AND slice_type = 'state';
