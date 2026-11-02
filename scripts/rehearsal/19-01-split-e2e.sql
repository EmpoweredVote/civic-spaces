-- Phase 19-01 Task 7: two consecutive splits, end to end.
--
--   psql "$SCRATCH_DB_URL" -X -f scripts/rehearsal/19-01-split-e2e.sql
--
-- Synthetic, geoid 9999040. Rolls back.
--
-- 🔴 SCOPE. This file asserts what SQL OWNS: what a split does, and that the
-- frontier rule holds across two of them in a row. It does NOT assert the cap
-- or placement — "a slice fills to 6000" and "new members now land in slice 1"
-- are decided by sliceAssigner.ts in ev-accounts, and asserting them here would
-- mean re-implementing the placement rule in SQL, a second copy of the thing
-- Task 4 exists to make single. Those are vitest's (plan Ruling 1).
--
-- So the member counts below are small. split_slice does not care what the cap
-- is; it halves whatever it is given. The cap is a TRIGGER for a split, not a
-- precondition of one, and seeding 6000 rows to prove arithmetic that works at 8
-- would buy nothing but minutes.

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

CREATE OR REPLACE FUNCTION pg_temp.try_split(p uuid) RETURNS uuid
LANGUAGE plpgsql AS $ts$
DECLARE r uuid;
BEGIN SELECT civic_spaces.split_slice(p) INTO r; RETURN r;
EXCEPTION WHEN others THEN RETURN NULL; END
$ts$;

INSERT INTO civic_spaces.slices (id, slice_type, geoid, sibling_index) VALUES
  ('19010000-0000-4000-8000-000000000040'::uuid, 'city', '9999040', 1);
INSERT INTO civic_spaces.connected_profiles (user_id, display_name, account_standing)
VALUES ('e2e-author', 'ZZ E2E Author', 'active');

INSERT INTO civic_spaces.slice_members (user_id, slice_id, joined_at)
SELECT 'e2e-m' || i, '19010000-0000-4000-8000-000000000040'::uuid,
       timestamptz '2026-01-01 00:00:00+00' + (i || ' days')::interval
FROM generate_series(1, 8) AS i;

-- Slice 1's own conversation.
INSERT INTO civic_spaces.posts (slice_id, user_id, title, body, created_at, updated_at)
SELECT '19010000-0000-4000-8000-000000000040'::uuid, 'e2e-author',
       'ZZ slice1 post ' || i, 'body', now() - interval '1 day', now() - interval '1 day'
FROM generate_series(1, 3) AS i;

-- ── split one: the frontier divides ────────────────────────────────────────
CREATE TEMP TABLE s1 AS
  SELECT pg_temp.try_split('19010000-0000-4000-8000-000000000040'::uuid) AS two;

SELECT 'E1 the frontier splits: 8 -> 4 kept / 4 moved  : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT two IS NOT NULL FROM s1)
       AND (SELECT count(*) FROM civic_spaces.slice_members
            WHERE slice_id='19010000-0000-4000-8000-000000000040'::uuid) = 4
       AND (SELECT count(*) FROM civic_spaces.slice_members m, s1
            WHERE m.slice_id = s1.two) = 4 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 THE ASSERTION THIS PHASE TURNS ON. Slice 1 is now full again in the sense
-- that matters — it is at the cap, conceptually — but slice 2 exists and is
-- newer, so slice 1 CLOSES rather than dividing. Reaching the cap does two
-- different things depending on position, and this is the only assertion that
-- tells "only the frontier splits" apart from "anything full splits".
SELECT 'E3 slice 1 is no longer the frontier: refused  : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT two IS NOT NULL FROM s1)
       AND pg_temp.try_split('19010000-0000-4000-8000-000000000040'::uuid) IS NULL $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- Slice 2 has its own conversation now, distinct from the seeded copies.
INSERT INTO civic_spaces.posts (slice_id, user_id, title, body, created_at, updated_at)
SELECT s1.two, 'e2e-author', 'ZZ slice2 original ' || i, 'body',
       now() - interval '1 day', now() - interval '1 day'
FROM s1, generate_series(1, 2) AS i;

-- ── split two: the NEW frontier divides ────────────────────────────────────
CREATE TEMP TABLE s2 AS SELECT pg_temp.try_split((SELECT two FROM s1)) AS three;

SELECT 'E5 the new frontier splits in turn: 4 -> 2 / 2 : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT three IS NOT NULL FROM s2)
       AND (SELECT count(*) FROM civic_spaces.slice_members m, s1 WHERE m.slice_id = s1.two) = 2
       AND (SELECT count(*) FROM civic_spaces.slice_members m, s2 WHERE m.slice_id = s2.three) = 2
       AND (SELECT sibling_index FROM civic_spaces.slices s, s2 WHERE s.id = s2.three) = 3 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 The seed follows the PARENT, not the grandparent. Slice 3 is seeded from
-- slice 2's content — including slice 2's own copies of slice 1 — and never
-- directly from slice 1. A seed that reached back to the original jurisdiction
-- root would re-publish the same posts into every slice forever.
SELECT 'E6 slice 3 is seeded from slice 2, not slice 1 : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT three IS NOT NULL FROM s2)
       AND (SELECT count(*) FROM civic_spaces.posts p, s2 WHERE p.slice_id = s2.three) > 0
       AND NOT EXISTS (
         SELECT 1 FROM civic_spaces.posts c
         JOIN civic_spaces.posts o ON o.id = c.forked_from, s2
         WHERE c.slice_id = s2.three
           AND o.slice_id = '19010000-0000-4000-8000-000000000040'::uuid) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- Nobody is lost or double-counted across the whole lifecycle.
SELECT 'E7 counts match reality across all three slices: ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT three IS NOT NULL FROM s2)
       AND (SELECT count(*) FROM civic_spaces.slices WHERE geoid='9999040') = 3
       AND (SELECT sum(current_member_count) FROM civic_spaces.slices WHERE geoid='9999040') = 8
       AND NOT EXISTS (
         SELECT 1 FROM civic_spaces.slices s
         WHERE s.geoid='9999040'
           AND s.current_member_count <>
               (SELECT count(*) FROM civic_spaces.slice_members m WHERE m.slice_id = s.id)) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 CONTROL. Deliberately wrong, MUST print FAIL.
SELECT 'C  CONTROL, must read FAIL                     : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.slices WHERE geoid='9999040') = 99 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

ROLLBACK;
