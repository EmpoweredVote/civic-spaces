-- 18-02 step 0b, part 1 of 2: synthetic fixtures for the behavioural rehearsal.
--
-- WHOLLY SYNTHETIC. No real member, no real post, no real profile — forum content is
-- members-only by design and never leaves the database (see CLAUDE.md). Run this ONLY
-- against a local scratch database built per 18-02-APPLY.md, never against production.
--
-- The four slices are chosen to make the rehearsal in 18-02-behaviour.sql meaningful:
--   two CITY shards of the same geoid  -> proves get_public_slice returns shard 1 while
--                                         get_public_post keeps a shard-2 post's own slice_id
--   one VOLUNTEER slice, same geoid    -> the private type the allowlist must exclude.
--                                         Same geoid as the city on purpose: a gate that
--                                         filtered on place rather than type would pass a
--                                         different-geoid fixture and fail this one.
--   one COUNTY slice                   -> a second public type, so "city works" is not the
--                                         only evidence the allowlist admits anything.
-- is_suspended is GENERATED from account_standing; insert the standing, not the flag.

INSERT INTO civic_spaces.connected_profiles (user_id, display_name, account_standing) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ada Fixture',      'active'),
  ('22222222-2222-2222-2222-222222222222', 'Suspended Fixture', 'suspended');

INSERT INTO civic_spaces.slices (id, slice_type, geoid, sibling_index) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'city',      '3703000', 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'city',      '3703000', 2),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'volunteer', '3703000', 1),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'county',    '37021',   1);

INSERT INTO civic_spaces.posts (id, slice_id, user_id, title, body) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'City post',          'public city body'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'City shard-2 post',  'second shard body'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'VOLUNTEER post',     'must never be public'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Suspended post',     'author is suspended');

INSERT INTO civic_spaces.replies (id, post_id, user_id, body) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a visible reply'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'reply in volunteer');
