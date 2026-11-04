-- check:anon-read section 4 — the four authenticated viewers. SEED.
--
-- 🔴 Run 18-02-section4-teardown.sql as soon as the guard finishes. These rows are in a
-- PUBLIC slice type and are served to the anonymous internet while they exist.
--
-- geoid '9999999' is not a real place, so nothing in the app routes to it; the only
-- reader is the guard, pointed there by ANON_READ_PUBLIC_PLACE=city:9999999.
--
-- Who each viewer is, and why:
--   author-a   writes a post; the FRIEND viewer is friends with them  -> id must be REVEALED to that viewer
--   author-b   writes a post; friends with nobody                     -> id must stay NULL for that viewer
--   v-member   a member of this slice      (D-48) -> sees EVERY author's id
--   v-friend   NOT a member, friend of author-a (D-49) -> sees a's id and ONLY a's
--   v-nonmem   Connected, not a member      (D-48) -> byte-identical to anon
--   v-inform   Inform tier, holds no rows   (D-04) -> byte-identical to anon
--
-- 🔴 v-friend must NOT be a slice member. public_author_is_visible returns true on
-- membership OR friendship, so a membership row would reveal BOTH authors and D-49
-- would pass having proved nothing.

BEGIN;

INSERT INTO civic_spaces.connected_profiles (user_id, display_name, account_standing, tier) VALUES
  ('anonread-fx-author-a', 'ANONREAD FIXTURE A delete me', 'active', 'connected'),
  ('anonread-fx-author-b', 'ANONREAD FIXTURE B delete me', 'active', 'connected'),
  ('anonread-fx-v-member', 'ANONREAD FIXTURE member',      'active', 'connected'),
  ('anonread-fx-v-friend', 'ANONREAD FIXTURE friend',      'active', 'connected'),
  ('anonread-fx-v-nonmem', 'ANONREAD FIXTURE nonmember',   'active', 'connected'),
  ('anonread-fx-v-inform', 'ANONREAD FIXTURE inform',      'active', 'inform');

INSERT INTO civic_spaces.slices (id, slice_type, geoid, sibling_index) VALUES
  ('dddddddd-0000-0000-0000-00000000f001', 'city', '9999999', 1);

INSERT INTO civic_spaces.posts (id, slice_id, user_id, title, body) VALUES
  ('dddddddd-0000-0000-0000-00000000f101', 'dddddddd-0000-0000-0000-00000000f001', 'anonread-fx-author-a',
   'ANONREAD FIXTURE post by A', 'Fixture body A. Delete with 18-02-section4-teardown.sql.'),
  ('dddddddd-0000-0000-0000-00000000f102', 'dddddddd-0000-0000-0000-00000000f001', 'anonread-fx-author-b',
   'ANONREAD FIXTURE post by B', 'Fixture body B. Delete with 18-02-section4-teardown.sql.');

-- Only the member viewer joins.
INSERT INTO civic_spaces.slice_members (user_id, slice_id) VALUES
  ('anonread-fx-v-member', 'dddddddd-0000-0000-0000-00000000f001');

-- user_low < user_high is a CHECK constraint; 'anonread-fx-author-a' < 'anonread-fx-v-friend'.
INSERT INTO civic_spaces.friendships (user_low, user_high, status) VALUES
  ('anonread-fx-author-a', 'anonread-fx-v-friend', 'FRIEND');

SELECT 'profiles' AS seeded, count(*) FROM civic_spaces.connected_profiles WHERE user_id LIKE 'anonread-fx-%'
UNION ALL SELECT 'posts',   count(*) FROM civic_spaces.posts       WHERE user_id LIKE 'anonread-fx-%'
UNION ALL SELECT 'friends', count(*) FROM civic_spaces.friendships WHERE user_low LIKE 'anonread-fx-%'
UNION ALL SELECT 'members', count(*) FROM civic_spaces.slice_members WHERE user_id LIKE 'anonread-fx-%';

COMMIT;
