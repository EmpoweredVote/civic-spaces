-- check:anon-read section 4 — TEARDOWN. Written before the seed, on purpose.
--
-- 🔴 The seed puts rows in a PUBLIC slice type, so while they exist `get_public_feed`
-- serves them to the anonymous internet. That is the whole point (section 4 tests the
-- real HTTP path) and it is also exactly how nine synthetic demo posts came to be public
-- in federal:US for two days. Run this the moment the guard finishes. Never leave it.
--
-- Everything is keyed to the reserved prefix 'anonread-fx-' and geoid '9999999',
-- which belong to no real place and no real member.

BEGIN;

DELETE FROM civic_spaces.replies  WHERE user_id LIKE 'anonread-fx-%';
DELETE FROM civic_spaces.posts    WHERE user_id LIKE 'anonread-fx-%';
DELETE FROM civic_spaces.friendships
  WHERE user_low LIKE 'anonread-fx-%' OR user_high LIKE 'anonread-fx-%';
DELETE FROM civic_spaces.slice_members WHERE user_id LIKE 'anonread-fx-%';
DELETE FROM civic_spaces.slice_members
  WHERE slice_id IN (SELECT id FROM civic_spaces.slices WHERE geoid = '9999999');
DELETE FROM civic_spaces.posts
  WHERE slice_id IN (SELECT id FROM civic_spaces.slices WHERE geoid = '9999999');
DELETE FROM civic_spaces.slices  WHERE geoid = '9999999';
DELETE FROM civic_spaces.connected_profiles WHERE user_id LIKE 'anonread-fx-%';

-- Must all be zero, inside the transaction, before it commits.
SELECT 'profiles' AS leftover, count(*) FROM civic_spaces.connected_profiles WHERE user_id LIKE 'anonread-fx-%'
UNION ALL SELECT 'posts',     count(*) FROM civic_spaces.posts       WHERE user_id LIKE 'anonread-fx-%'
UNION ALL SELECT 'replies',   count(*) FROM civic_spaces.replies     WHERE user_id LIKE 'anonread-fx-%'
UNION ALL SELECT 'friends',   count(*) FROM civic_spaces.friendships WHERE user_low LIKE 'anonread-fx-%' OR user_high LIKE 'anonread-fx-%'
UNION ALL SELECT 'slices',    count(*) FROM civic_spaces.slices      WHERE geoid = '9999999';

COMMIT;
