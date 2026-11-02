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
--
-- 🔴 r3 and r4 are the second thread on p2, and they exist to catch an orphan.
-- r3's author is SUSPENDED, so r3 is excluded. r4 is r3's child and its own
-- author is fine — so without a rule about parents it is copied anyway, finds
-- no parent to point at in the remap, and renders as a direct reply to the
-- post: an answer in front of an audience who never saw the question.
INSERT INTO civic_spaces.replies (id, post_id, parent_reply_id, user_id, body, created_at, updated_at, is_deleted) VALUES
  ('19010000-2222-4000-8000-000000000001'::uuid, '19010000-1111-4000-8000-000000000002'::uuid,
   NULL, 'seed-active-author', 'root reply',
   now() - interval '3 days', now() - interval '3 days', false),
  ('19010000-2222-4000-8000-000000000002'::uuid, '19010000-1111-4000-8000-000000000002'::uuid,
   '19010000-2222-4000-8000-000000000001'::uuid, 'seed-active-author', 'child reply',
   now() - interval '3 days', now() - interval '3 days', false),
  ('19010000-2222-4000-8000-000000000003'::uuid, '19010000-1111-4000-8000-000000000002'::uuid,
   NULL, 'seed-suspended-author', 'root reply by a suspended author',
   now() - interval '3 days', now() - interval '3 days', false),
  ('19010000-2222-4000-8000-000000000004'::uuid, '19010000-1111-4000-8000-000000000002'::uuid,
   '19010000-2222-4000-8000-000000000003'::uuid, 'seed-active-author',
   'child of the suspended author''s reply',
   now() - interval '3 days', now() - interval '3 days', false);

-- 🔴 PUT THE ORIGINALS BACK IN THE PAST. Inserting the originals' own replies
-- fires trg_reply_count, which UPDATEs posts.reply_count, which fires
-- set_updated_at() and stamps the ORIGINAL p2 with now(). Everything here runs
-- in one transaction, so that now() is the same now() the copies get — and S6b
-- then compares now() against now(), passes, and proves nothing. Measured:
-- without this block S6b stays PASS even with the whole reply copy mutated
-- away, which is the exact shape of assertion this repo keeps shipping.
--
-- Disabling the timestamp triggers is the only way to write a backdated row
-- here, and it is confined to fixture setup inside a transaction that rolls
-- back. In production the original was restamped months ago and this is simply
-- what the data looks like.
ALTER TABLE civic_spaces.posts   DISABLE TRIGGER trg_posts_updated_at;
ALTER TABLE civic_spaces.replies DISABLE TRIGGER trg_replies_updated_at;
UPDATE civic_spaces.posts   SET updated_at = now() - interval '3 days'
  WHERE slice_id = '19010000-0000-4000-8000-000000000030'::uuid;
UPDATE civic_spaces.replies SET updated_at = now() - interval '3 days'
  WHERE post_id = '19010000-1111-4000-8000-000000000002'::uuid;
ALTER TABLE civic_spaces.posts   ENABLE TRIGGER trg_posts_updated_at;
ALTER TABLE civic_spaces.replies ENABLE TRIGGER trg_replies_updated_at;

-- Call it ONCE, into a variable: split_slice is VOLATILE and mutates, so a call
-- in a WHERE clause is evaluated per row.
-- p_min_members => 1: two members, not six thousand. See 19-01-split-members.sql.
CREATE TEMP TABLE result AS
  SELECT civic_spaces.split_slice('19010000-0000-4000-8000-000000000030'::uuid,
                                  interval '14 days', 1) AS child;

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

-- 🔴 S11. The ONE NUMBER that decides whether the new slice reads as a
-- conversation or an archive. reply_count is maintained by trg_reply_count
-- firing on each copied reply, inside a data-modifying CTE — it works, but
-- nothing checked it, and if it ever stopped, every seeded thread would open
-- saying "0 replies" while containing them. Silent, and exactly the failure
-- this phase exists to avoid.
SELECT 'S11 the copied thread reports its 2 replies    : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r
            WHERE p.slice_id = r.child AND p.reply_count = 2) = 1
       AND (SELECT count(*) FROM civic_spaces.posts p, result r
            WHERE p.slice_id = r.child
              AND p.reply_count <> (SELECT count(*) FROM civic_spaces.replies c
                                    WHERE c.post_id = p.id)) = 0 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 S12. A reply whose parent was excluded must go with it. Copied alone, the
-- remap finds nothing to point at, so it stays NULL and is PROMOTED to a direct
-- reply on the post — out of the context it was written in. In the parent slice
-- it still nests under its (hidden) parent; only the fork loses that.
SELECT 'S12 a child of an EXCLUDED reply is not copied : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.replies c
            JOIN civic_spaces.posts cp ON cp.id = c.post_id, result r
            WHERE cp.slice_id = r.child) = 2
       AND NOT EXISTS (
         SELECT 1 FROM civic_spaces.replies c
         JOIN civic_spaces.posts cp ON cp.id = c.post_id, result r
         WHERE cp.slice_id = r.child
           AND c.forked_from = '19010000-2222-4000-8000-000000000004'::uuid) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 S6b. PINNING A KNOWN WART, deliberately, so it is a recorded fact rather
-- than an accident nobody has noticed. The migration carries updated_at into
-- the copy, and then trg_reply_count UPDATEs posts.reply_count for every copied
-- reply, which fires set_updated_at() and stamps now(). So a copy WITH replies
-- loses updated_at and a copy WITHOUT replies keeps it. p1 has none, p2 has
-- two, which is why they disagree. created_at is the ordering key and survives
-- both (S6); the "edited" marker reads edit_history, not this column. If anyone
-- ever fixes the trigger, this assertion is what tells them.
-- 🔴 Measured against now(), NOT against the original. Comparing the copy to
-- its original is the obvious way to write this and it is WRONG IN A FIXTURE:
-- everything here runs in one transaction, now() is the transaction timestamp,
-- and inserting the originals' own replies restamps the ORIGINALS to the same
-- now() the copies get. The two then match and the assertion reads PASS while
-- proving nothing. In production the original was restamped months ago, so they
-- would differ. now() is the only clock both sides can be held against.
SELECT 'S6b updated_at: kept on p1, restamped on p2    : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT c.updated_at = o.updated_at AND c.updated_at <> now()
            FROM civic_spaces.posts c
            JOIN civic_spaces.posts o ON o.id = c.forked_from, result r
            WHERE c.slice_id = r.child
              AND o.id = '19010000-1111-4000-8000-000000000001'::uuid)
       AND (SELECT c.updated_at = now()
            FROM civic_spaces.posts c, result r
            WHERE c.slice_id = r.child
              AND c.forked_from = '19010000-1111-4000-8000-000000000002'::uuid) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- The same wart on the replies side, and here it is the REMAP that causes it:
-- a root reply's copy is never UPDATEd and keeps its timestamp, while a nested
-- one is UPDATEd to point at the copied parent and gets restamped for it.
SELECT 'S6c updated_at: kept on a root reply copy      : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT c.updated_at <> now()
            FROM civic_spaces.replies c
            JOIN civic_spaces.posts cp ON cp.id = c.post_id, result r
            WHERE cp.slice_id = r.child
              AND c.forked_from = '19010000-2222-4000-8000-000000000001'::uuid)
       AND (SELECT c.updated_at = now()
            FROM civic_spaces.replies c
            JOIN civic_spaces.posts cp ON cp.id = c.post_id, result r
            WHERE cp.slice_id = r.child
              AND c.forked_from = '19010000-2222-4000-8000-000000000002'::uuid) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 CONTROL. Deliberately wrong, MUST print FAIL.
SELECT 'C  CONTROL, must read FAIL                     : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.posts p, result r WHERE p.slice_id = r.child) = 99 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

ROLLBACK;
