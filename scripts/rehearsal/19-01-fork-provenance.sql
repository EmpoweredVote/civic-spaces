-- Phase 19-01 Task 1: fork provenance on posts and replies.
--
--   psql "$SCRATCH_DB_URL" -X -f scripts/rehearsal/19-01-fork-provenance.sql
--
-- Wholly synthetic, on geoid 9999010, which is not a TIGER/Line GEOID. Each
-- rehearsal in this phase owns its own geoid so one scratch cluster can carry
-- all of them without their fixtures colliding. Rolls back at the end.
--
-- 🔴 The last line is a deliberately-wrong CONTROL and MUST print FAIL. Most of
-- what follows is existence checking, and that passes on a mistyped catalog
-- query as readily as on a correct schema.

\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on

BEGIN;

-- 🔴 Every assertion that names `forked_from` goes through this, and that is not
-- decoration. A bare reference to a column that does not exist yet is resolved at
-- PARSE time, so in the RED run it aborts the transaction and every later
-- assertion reports "current transaction is aborted" rather than FAIL — a run
-- that reads like a broken script instead of a missing feature. EXECUTE defers
-- the parse, and the EXCEPTION block is a subtransaction, so one genuine failure
-- costs exactly one assertion.
CREATE OR REPLACE FUNCTION pg_temp.try_bool(q text) RETURNS boolean
LANGUAGE plpgsql AS $try$
DECLARE r boolean;
BEGIN
  EXECUTE q INTO r;
  RETURN coalesce(r, false);
EXCEPTION WHEN others THEN
  RETURN false;
END
$try$;

INSERT INTO civic_spaces.slices (id, slice_type, geoid, sibling_index) VALUES
  ('f0f0f0f0-0000-4000-8000-000000000001', 'city', '9999010', 1);
INSERT INTO civic_spaces.connected_profiles (user_id, display_name, account_standing) VALUES
  ('f0f0f0f0-aaaa-4000-8000-00000000000a', 'ZZ Fork Author', 'active');
INSERT INTO civic_spaces.posts (id, slice_id, user_id, title, body) VALUES
  ('f0f0f0f0-1111-4000-8000-000000000001', 'f0f0f0f0-0000-4000-8000-000000000001',
   'f0f0f0f0-aaaa-4000-8000-00000000000a', 'ZZ original', 'original body');
INSERT INTO civic_spaces.replies (id, post_id, user_id, body) VALUES
  ('f0f0f0f0-2222-4000-8000-000000000001', 'f0f0f0f0-1111-4000-8000-000000000001',
   'f0f0f0f0-aaaa-4000-8000-00000000000a', 'original reply');

-- Make the forks. Same reason for the wrapper: in RED these cannot work.
DO $fork$
BEGIN
  INSERT INTO civic_spaces.posts (id, slice_id, user_id, title, body, forked_from) VALUES
    ('f0f0f0f0-1111-4000-8000-000000000002', 'f0f0f0f0-0000-4000-8000-000000000001',
     'f0f0f0f0-aaaa-4000-8000-00000000000a', 'ZZ original', 'original body',
     'f0f0f0f0-1111-4000-8000-000000000001');
  INSERT INTO civic_spaces.replies (id, post_id, user_id, body, forked_from) VALUES
    ('f0f0f0f0-2222-4000-8000-000000000002', 'f0f0f0f0-1111-4000-8000-000000000002',
     'f0f0f0f0-aaaa-4000-8000-00000000000a', 'original reply',
     'f0f0f0f0-2222-4000-8000-000000000001');
EXCEPTION WHEN others THEN NULL;
END
$fork$;

SELECT 'F1 posts.forked_from is a nullable uuid        : ' ||
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='civic_spaces' AND table_name='posts'
      AND column_name='forked_from' AND data_type='uuid' AND is_nullable='YES')
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'F2 replies.forked_from is a nullable uuid      : ' ||
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='civic_spaces' AND table_name='replies'
      AND column_name='forked_from' AND data_type='uuid' AND is_nullable='YES')
  THEN 'PASS' ELSE 'FAIL' END;

-- confdeltype: 'n' = SET NULL, 'c' = CASCADE, 'a' = NO ACTION.
-- 🔴 CASCADE would let a hard delete of a parent destroy a conversation the new
-- slice has been having underneath it. The product has no hard delete today —
-- is_deleted is a soft flag — so this is about what a future one must not do.
SELECT 'F3 both forked_from FKs are ON DELETE SET NULL : ' ||
  CASE WHEN (
    SELECT count(*) FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='civic_spaces' AND t.relname IN ('posts','replies')
      AND c.contype='f' AND c.confdeltype='n'
      AND EXISTS (SELECT 1 FROM unnest(c.conkey) k
                  JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k
                  WHERE a.attname='forked_from')
  ) = 2 THEN 'PASS' ELSE 'FAIL' END;

SELECT 'F4 an ordinary post has forked_from NULL       : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT count(*)=1 FROM civic_spaces.posts
    WHERE id='f0f0f0f0-1111-4000-8000-000000000001' AND forked_from IS NULL $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'F5 a post may point forked_from at a real post : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT count(*)=1 FROM civic_spaces.posts
    WHERE id='f0f0f0f0-1111-4000-8000-000000000002'
      AND forked_from='f0f0f0f0-1111-4000-8000-000000000001' $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'F6 a reply may point forked_from at a reply    : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT count(*)=1 FROM civic_spaces.replies
    WHERE id='f0f0f0f0-2222-4000-8000-000000000002'
      AND forked_from='f0f0f0f0-2222-4000-8000-000000000001' $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- Hard-delete the original post. Its own reply cascades away with it; the FORKS
-- must survive both, with their pointers NULLed rather than following the parent.
DO $del$
BEGIN
  DELETE FROM civic_spaces.posts WHERE id='f0f0f0f0-1111-4000-8000-000000000001';
EXCEPTION WHEN others THEN NULL;
END
$del$;

SELECT 'F7 the post fork survives its parent, NULLed   : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT count(*)=1 FROM civic_spaces.posts
    WHERE id='f0f0f0f0-1111-4000-8000-000000000002' AND forked_from IS NULL $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'F8 the reply fork survives its parent, NULLed  : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT count(*)=1 FROM civic_spaces.replies
    WHERE id='f0f0f0f0-2222-4000-8000-000000000002' AND forked_from IS NULL $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 CONTROL. Deliberately wrong, MUST print FAIL.
SELECT 'C  CONTROL, must read FAIL                     : ' ||
  CASE WHEN (SELECT count(*) FROM civic_spaces.slices WHERE geoid='9999010') = 99
  THEN 'PASS' ELSE 'FAIL' END;

ROLLBACK;
