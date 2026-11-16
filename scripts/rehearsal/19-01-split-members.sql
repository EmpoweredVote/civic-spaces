-- Phase 19-01 Task 3: split_slice() — the membership move.
--
--   psql "$SCRATCH_DB_URL" -X -f scripts/rehearsal/19-01-split-members.sql
--
-- Synthetic. Owns geoids 9999020 (the main fixture), 9999021/9999022 (the tie
-- pair), 9999023 (the untouched neighbour) and 9999024 (volunteer). Rolls back.
--
-- 🔴 Seven members, not six and not 6000. Seven makes ceil(n/2) visible as 4 and
-- 3 — an even fixture cannot tell "half" from "half, rounded the other way" —
-- and a small number proves the rule without seeding the cap.

\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on

BEGIN;

-- Deferred parse + subtransaction, so one failure costs one assertion instead of
-- aborting the file. Same reason as 19-01-fork-provenance.sql.
CREATE OR REPLACE FUNCTION pg_temp.try_bool(q text) RETURNS boolean
LANGUAGE plpgsql AS $try$
DECLARE r boolean;
BEGIN EXECUTE q INTO r; RETURN coalesce(r, false);
EXCEPTION WHEN others THEN RETURN false; END
$try$;

-- Returns the new slice id, or NULL if the call was refused. Used by the
-- assertions that expect a REFUSAL, so a raise reads as a result rather than a
-- crash.
-- 🔴 p_min_members => 1. These fixtures hold seven members, not six thousand,
-- because split_slice halves whatever it is given and seeding the cap would buy
-- nothing but minutes. The threshold exists to stop a buggy caller dividing a
-- jurisdiction that was never full, so it is passed explicitly here and left at
-- its default in M11 below, which is where it is actually under test.
CREATE OR REPLACE FUNCTION pg_temp.try_split(p uuid) RETURNS uuid
LANGUAGE plpgsql AS $ts$
DECLARE r uuid;
BEGIN SELECT civic_spaces.split_slice(p, interval '14 days', 1) INTO r; RETURN r;
EXCEPTION WHEN others THEN RETURN NULL; END
$ts$;

-- The same call with the threshold left alone, for M11.
CREATE OR REPLACE FUNCTION pg_temp.try_split_default(p uuid) RETURNS uuid
LANGUAGE plpgsql AS $tsd$
DECLARE r uuid;
BEGIN SELECT civic_spaces.split_slice(p) INTO r; RETURN r;
EXCEPTION WHEN others THEN RETURN NULL; END
$tsd$;

-- ── fixture ────────────────────────────────────────────────────────────────
-- Main: one city slice, 7 members, distinct joined_at ascending m1..m7.
INSERT INTO civic_spaces.slices (id, slice_type, geoid, sibling_index) VALUES
  ('19010000-0000-4000-8000-000000000001'::uuid, 'city', '9999020', 1),
  ('19010000-0000-4000-8000-000000000023'::uuid, 'city', '9999023', 1),
  ('19010000-0000-4000-8000-000000000024'::uuid, 'volunteer', '9999024', 1),
  ('19010000-0000-4000-8000-000000000025'::uuid, 'city', '9999025', 1),
  -- the tie pair, seeded identically
  ('19010000-0000-4000-8000-000000000021'::uuid, 'city', '9999021', 1),
  ('19010000-0000-4000-8000-000000000022'::uuid, 'city', '9999022', 1);

INSERT INTO civic_spaces.slice_members (user_id, slice_id, joined_at)
SELECT 'm' || i || '-0000-4000-8000-00000000000' || i,
       '19010000-0000-4000-8000-000000000001'::uuid,
       timestamptz '2026-01-01 00:00:00+00' + (i || ' days')::interval
FROM generate_series(1, 7) AS i;

-- The neighbour that must not move.
INSERT INTO civic_spaces.slice_members (user_id, slice_id, joined_at) VALUES
  ('n1-0000-0000-4000-8000-00000000000n', '19010000-0000-4000-8000-000000000023'::uuid,
   timestamptz '2026-01-01 00:00:00+00');

-- Volunteer, with enough members that a split would be attempted if the type
-- gate were missing.
INSERT INTO civic_spaces.slice_members (user_id, slice_id, joined_at)
SELECT 'v' || i || '-0000-4000-8000-00000000000' || i,
       '19010000-0000-4000-8000-000000000024'::uuid,
       timestamptz '2026-01-01 00:00:00+00' + (i || ' days')::interval
FROM generate_series(1, 4) AS i;

-- 🔴 The tie fixture. Two jurisdictions seeded IDENTICALLY, each with four
-- members of which two share one joined_at. ceil(4/2) = 2 move, and the cut
-- lands exactly on the tie — so without a total order the two runs can disagree.
INSERT INTO civic_spaces.slice_members (user_id, slice_id, joined_at)
SELECT u, s, j FROM (VALUES
  ('taaa-0000-4000-8000-00000000000a', timestamptz '2026-02-01 00:00:00+00'),
  ('tbbb-0000-4000-8000-00000000000b', timestamptz '2026-02-02 00:00:00+00'),
  ('tccc-0000-4000-8000-00000000000c', timestamptz '2026-02-02 00:00:00+00'),
  ('tddd-0000-4000-8000-00000000000d', timestamptz '2026-02-03 00:00:00+00')
) AS v(u, j)
CROSS JOIN (VALUES
  ('19010000-0000-4000-8000-000000000021'::uuid),
  ('19010000-0000-4000-8000-000000000022'::uuid)
) AS t(s);

-- 🔴 M11's fixture: a city slice that IS the frontier, IS splittable, and is
-- nowhere near the cap. Every guard the function had before passes on it.
INSERT INTO civic_spaces.slice_members (user_id, slice_id, joined_at)
SELECT 'u' || i || '-0000-4000-8000-00000000000' || i,
       '19010000-0000-4000-8000-000000000025'::uuid,
       timestamptz '2026-03-01 00:00:00+00' + (i || ' days')::interval
FROM generate_series(1, 3) AS i;

-- Capture joined_at BEFORE the split, so M4 compares against recorded values
-- rather than against whatever the rows say afterwards.
CREATE TEMP TABLE before_join AS
  SELECT user_id, joined_at FROM civic_spaces.slice_members
  WHERE slice_id = '19010000-0000-4000-8000-000000000001'::uuid;

-- ── the splits under test ──────────────────────────────────────────────────
CREATE TEMP TABLE result AS SELECT
  pg_temp.try_split('19010000-0000-4000-8000-000000000001'::uuid) AS main,
  pg_temp.try_split('19010000-0000-4000-8000-000000000021'::uuid) AS tie_a,
  pg_temp.try_split('19010000-0000-4000-8000-000000000022'::uuid) AS tie_b,
  pg_temp.try_split('19010000-0000-4000-8000-000000000024'::uuid) AS volunteer;

-- ── assertions ─────────────────────────────────────────────────────────────

SELECT 'M1 returns a new sibling at index 2, same place : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT EXISTS (SELECT 1 FROM civic_spaces.slices s, result r
                   WHERE s.id = r.main AND s.sibling_index = 2
                     AND s.slice_type = 'city' AND s.geoid = '9999020') $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'M2 7 members split 3 kept / 4 moved (ceil)      : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.slice_members
            WHERE slice_id='19010000-0000-4000-8000-000000000001'::uuid) = 3
       AND (SELECT count(*) FROM civic_spaces.slice_members m, result r
            WHERE m.slice_id = r.main) = 4 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'M3 the four MOST RECENTLY joined are the movers : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT array_agg(left(m.user_id,2) ORDER BY m.user_id)
            FROM civic_spaces.slice_members m, result r WHERE m.slice_id = r.main)
           = ARRAY['m4','m5','m6','m7'] $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'M4 joined_at is CARRIED, never restamped        : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT main IS NOT NULL FROM result) AND NOT EXISTS (
      SELECT 1 FROM civic_spaces.slice_members m
      JOIN before_join b ON b.user_id = m.user_id
      WHERE m.joined_at IS DISTINCT FROM b.joined_at) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'M5 current_member_count matches reality on both : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT main IS NOT NULL FROM result) AND NOT EXISTS (
      SELECT 1 FROM civic_spaces.slices s
      WHERE s.geoid = '9999020'
        AND s.current_member_count <> (SELECT count(*) FROM civic_spaces.slice_members m
                                       WHERE m.slice_id = s.id)) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'M6 the neighbouring jurisdiction is untouched   : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT main IS NOT NULL FROM result) AND (SELECT count(*) FROM civic_spaces.slices WHERE geoid='9999023') = 1
       AND (SELECT count(*) FROM civic_spaces.slice_members
            WHERE slice_id='19010000-0000-4000-8000-000000000023'::uuid) = 1 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 The tie, asserted as an EXACT EXPECTED SET rather than as agreement between
-- two runs. The first draft compared tie_a against tie_b and was worthless: an
-- ORDER BY with no total order still returns the SAME arbitrary answer for two
-- identical fixtures in one session, so the comparison passed with the
-- tiebreaker deleted. Measured — movers are `tccc,tddd` with `user_id DESC` and
-- `tbbb,tddd` without it, and the old assertion could not tell those apart.
--
-- taaa/tbbb/tccc/tddd join on Feb 1 / 2 / 2 / 3. ceil(4/2) = 2 move, so the cut
-- lands exactly on the Feb-2 tie: tddd is unambiguous, and the second mover is
-- whichever of tbbb/tccc the tiebreaker picks. `user_id DESC` picks tccc.
SELECT 'M7 a joined_at tie breaks on user_id DESC (tccc): ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT array_agg(left(m.user_id,4) ORDER BY m.user_id)
            FROM civic_spaces.slice_members m, result r WHERE m.slice_id = r.tie_a)
           = ARRAY['tccc','tddd'] $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- The weaker claim the first draft made, kept because it is still worth having:
-- two identical jurisdictions must split identically. It cannot catch a missing
-- tiebreaker, and M7 above is what does.
SELECT 'M7b two identical jurisdictions split the same   : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT array_agg(left(m.user_id,4) ORDER BY m.user_id)
            FROM civic_spaces.slice_members m, result r WHERE m.slice_id = r.tie_a)
         = (SELECT array_agg(left(m.user_id,4) ORDER BY m.user_id)
            FROM civic_spaces.slice_members m, result r WHERE m.slice_id = r.tie_b) $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'M8 a volunteer slice is refused                 : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT main IS NOT NULL FROM result) AND (SELECT volunteer IS NULL FROM result)
       AND (SELECT count(*) FROM civic_spaces.slices WHERE geoid='9999024') = 1 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- A NON-FRONTIER slice at the cap closes; it does not split (design §4.4). After
-- the main split, slice 1 is no longer the frontier — slice 2 is.
SELECT 'M9 a non-frontier slice is refused (only the frontier splits) : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT main IS NOT NULL FROM result) AND pg_temp.try_split('19010000-0000-4000-8000-000000000001'::uuid) IS NULL $q$)
  THEN 'PASS' ELSE 'FAIL' END;

SELECT 'M10 the parent is left below the cap, joinable  : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT main IS NOT NULL FROM result) AND (SELECT current_member_count FROM civic_spaces.slices
            WHERE id='19010000-0000-4000-8000-000000000001'::uuid) < 6000 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 M11. Dividing is IRREVERSIBLE, and until the review the only guards were
-- "exists", "splittable" and "is the frontier" — all three of which the
-- function's OWN OUTPUT satisfies, since the slice it creates is splittable and
-- is the new frontier. A caller in a loop would have halved a jurisdiction
-- repeatedly, and a three-member slice would have divided as willingly as a
-- full one. This fixture passes every other guard, which is the whole point.
SELECT 'M11 a slice below the cap is refused by default : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT main IS NOT NULL FROM result)
       AND pg_temp.try_split_default('19010000-0000-4000-8000-000000000025'::uuid) IS NULL
       AND (SELECT count(*) FROM civic_spaces.slices WHERE geoid='9999025') = 1
       AND (SELECT count(*) FROM civic_spaces.slice_members
            WHERE slice_id='19010000-0000-4000-8000-000000000025'::uuid) = 3 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

-- 🔴 CONTROL. Deliberately wrong, MUST print FAIL.
SELECT 'C  CONTROL, must read FAIL                      : ' ||
  CASE WHEN pg_temp.try_bool($q$
    SELECT (SELECT count(*) FROM civic_spaces.slice_members
            WHERE slice_id='19010000-0000-4000-8000-000000000001'::uuid) = 99 $q$)
  THEN 'PASS' ELSE 'FAIL' END;

ROLLBACK;
