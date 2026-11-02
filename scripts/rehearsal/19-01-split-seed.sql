-- Phase 19-01 Task 6: split_slice() — the seed copy.
--
--   psql "$SCRATCH_DB_URL" -X -f scripts/rehearsal/19-01-split-seed.sql
--
-- Synthetic, geoid 9999030. Rolls back.
--
-- The parent holds five posts, chosen so each exclusion rule has exactly one row
-- that only it can remove:
--   p1  in window, live, active author          -> copied
--   p2  in window, live, active author, threaded -> copied, with its replies
--   p3  OUT of window                            -> not copied (window)
--   p4  in window, SOFT-DELETED                  -> not copied (is_deleted)
--   p5  in window, live, SUSPENDED author        -> not copied (account_standing)
--
-- 🔴 Every assertion is guarded on the copy having actually happened. Writing
-- these the obvious way makes most of them pass before the seed exists — an
-- empty new slice satisfies "the out-of-window post was not copied" perfectly.
-- Task 3 shipped six assertions with exactly that defect and only watching RED
-- caught it.

\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.try_bool(q text) RETURNS boolean
LANGUAGE plpgsql AS $try$
DECLARE r boolean;
BEGIN EXECUTE q INTO r; RETURN coalesce(r, false);
EXCEPTION WHEN others THEN RETURN false; END
$try$;

INSERT INTO civic_spaces.slices (id, slice_type, geoid, sibling_index) VALUES
  ('19010000-0000-4000-8000-000000000030'::uuid, 'city', '9999030', 1);

INSERT INTO civic_spaces.connected_profiles (user_id, display_name, account_standing) VALUES
  ('seed-active-author',    'ZZ Seed Active',    'active'),
  ('seed-suspended-author', 'ZZ Seed Suspended', 'suspended');

-- Two members, so ceil(2/2) = 1 moves and the split is a normal one.
INSERT INTO civic_spaces.slice_members (user_id, slice_id, joined_at) VALUES
  ('seed-m1', '19010000-0000-4000-8000-000000000030'::uuid, '2026-01-01'),
  ('seed-m2', '19010000-0000-4000-8000-000000000030'::uuid, '2026-01-02');

INSERT INTO civic_spaces.posts (id, slice_id, user_id, title, body, created_at, updated_at, is_deleted) VALUES
  ('19010000-1111-4000-8000-000000000001'::uuid, '19010000-0000-4000-8000-000000000030'::uuid,
   'seed-active-author', 'ZZ p1 in window', 'body one',
   now() - interval '2 days', now() - interval '2 days', false),
  ('19010000-1111-4000-8000-000000000002'::uuid, '19010000-0000-4000-8000-000000000030'::uuid,
   'seed-active-author', 'ZZ p2 threaded', 'body two',
   now() - interval '3 days', now() - interval '3 days', false),
  ('19010000-1111-4000-8000-000000000003'::uuid, '19010000-0000-4000-8000-000000000030'::uuid,
   'seed-active-author', 'ZZ p3 out of window', 'body three',
   now() - interval '400 days', now() - interval '400 days', false),
  ('19010000-1111-4000-8000-000000000004'::uuid, '19010000-0000-4000-8000-000000000030'::uuid,
   'seed-active-author', 'ZZ p4 soft deleted', 'body four',
   now() - interval '1 day', now() - interval '1 day', true),
  ('19010000-1111-4000-8000-000000000005'::uuid, '19010000-0000-4000-8000-000000000030'::uuid,
   'seed-suspended-author', 'ZZ p5 suspended author', 'body five',
   now() - interval '1 day', now() - interval '1 day', false);

-- A two-level thread on p2: r1 is a root reply, r2 is its child.
INSERT INTO civic_spaces.replies (id, post_id, parent_reply_id, user_id, body, created_at, is_deleted) VALUES
  ('19010000-2222-4000-8000-000000000001'::uuid, '19010000-1111-4000-8000-000000000002'::uuid,
   NULL, 'seed-active-author', 'root reply', now() - interval '3 days', false),
  ('19010000-2222-4000-8000-000000000002'::uuid, '19010000-1111-4000-8000-000000000002'::uuid,
   '19010000-2222-4000-8000-000000000001'::uuid, 'seed-active-author', 'child reply',
   now() - interval '3 days', false);

-- Call it ONCE, into a variable: split_slice is VOLATILE and mutates, so a call
-- in a WHERE clause is evaluated per row.
CREATE TEMP TABLE result AS
  SELECT civic_spaces.split_slice('19010000-0000-4000-8000-000000000030'::uuid,
                                  interval '14 days') AS child;

SELECT 'S1 exactly the 2 eligible posts are copied     : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r WHERE p.slice_id = r.child) = 2 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'S2 the OUT-OF-WINDOW post is not copied        : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r WHERE p.slice_id = r.child) = 2
       AND NOT EXISTS (SELECT 1 FROM civic_spaces.posts p, result r
                       WHERE p.slice_id = r.child
                         AND p.forked_from = '19010000-1111-4000-8000-000000000003'::uuid) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'S3 the SOFT-DELETED post is not copied         : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r WHERE p.slice_id = r.child) = 2
       AND NOT EXISTS (SELECT 1 FROM civic_spaces.posts p, result r
                       WHERE p.slice_id = r.child
                         AND p.forked_from = '19010000-1111-4000-8000-000000000004'::uuid) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'S4 the SUSPENDED author''s post is not copied   : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r WHERE p.slice_id = r.child) = 2
       AND NOT EXISTS (SELECT 1 FROM civic_spaces.posts p, result r
                       WHERE p.slice_id = r.child
                         AND p.forked_from = '19010000-1111-4000-8000-000000000005'::uuid) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'S5 copies keep the original author''s byline    : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r
            WHERE p.slice_id = r.child AND p.user_id = 'seed-active-author') = 2 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'S6 copies keep created_at to the microsecond   : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts c
            JOIN civic_spaces.posts o ON o.id = c.forked_from, result r
            WHERE c.slice_id = r.child AND c.created_at = o.created_at) = 2 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'S7 every copy points forked_from at its origin : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r
            WHERE p.slice_id = r.child AND p.forked_from IS NOT NULL) = 2 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'S8 the originals are untouched — parent keeps 5: ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r WHERE p.slice_id = r.child) = 2
       AND (SELECT count(*) FROM civic_spaces.posts
            WHERE slice_id = '19010000-0000-4000-8000-000000000030'::uuid) = 5 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 The remap. Copying parent_reply_id verbatim points a reply in the NEW slice
-- at a reply in the PARENT — silently stitching together two threads that are
-- supposed to have forked apart.
SELECT 'S9 a copied child points at the COPIED parent  : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT EXISTS (
      SELECT 1
      FROM civic_spaces.replies child
      JOIN civic_spaces.posts cp ON cp.id = child.post_id, result r
      WHERE cp.slice_id = r.child
        AND child.forked_from = '19010000-2222-4000-8000-000000000002'::uuid
        AND child.parent_reply_id = (
          SELECT c2.id FROM civic_spaces.replies c2
          JOIN civic_spaces.posts cp2 ON cp2.id = c2.post_id
          WHERE cp2.slice_id = r.child
            AND c2.forked_from = '19010000-2222-4000-8000-000000000001'::uuid)) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- S9 over the whole set, as a negation: S9 can pass on a fixture whose only
-- child happens to be remapped while another is not.
SELECT 'S10 NO copied reply points into the parent     : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.replies c
            JOIN civic_spaces.posts cp ON cp.id = c.post_id, result r
            WHERE cp.slice_id = r.child) = 2
       AND NOT EXISTS (
      SELECT 1
      FROM civic_spaces.replies c
      JOIN civic_spaces.posts cp ON cp.id = c.post_id, result r
      WHERE cp.slice_id = r.child
        AND c.parent_reply_id IS NOT NULL
        AND c.parent_reply_id IN (
          SELECT c2.id FROM civic_spaces.replies c2
          JOIN civic_spaces.posts cp2 ON cp2.id = c2.post_id
          WHERE cp2.slice_id = '19010000-0000-4000-8000-000000000030'::uuid)) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 CONTROL. Deliberately wrong, MUST print FAIL.
SELECT 'C  CONTROL, must read FAIL                     : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r WHERE p.slice_id = r.child) = 99 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

ROLLBACK;
