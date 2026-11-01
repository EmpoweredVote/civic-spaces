-- 18-02 step 0b, part 2 of 2: the behavioural rehearsal.
--
--   psql "$SCRATCH_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/rehearsal/18-02-seed.sql
--   psql "$SCRATCH_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/rehearsal/18-02-behaviour.sql
--
-- Run as the OWNER after 20261030000100 (T1-T11 exercise the function bodies), then run
-- the A-series block at the bottom after 20261030000200 to repeat the important half as
-- anon, through the grants.
--
-- 🔴 The last line is a deliberately-wrong CONTROL and MUST print FAIL. A suite of
-- CASE WHEN ... THEN 'PASS' assertions that has never printed FAIL has not been shown to
-- be able to; this repo has shipped exactly that shape before.

\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on

SELECT 'T1  city slice resolves to shard 1          : ' ||
  CASE WHEN (SELECT slice_id FROM civic_spaces.get_public_slice('city','3703000'))
            = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T2  VOLUNTEER slice returns nothing         : ' ||
  CASE WHEN (SELECT count(*) FROM civic_spaces.get_public_slice('volunteer','3703000')) = 0
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T3  city feed shows only the live city post : ' ||
  CASE WHEN (SELECT coalesce(string_agg(title, ','  ORDER BY title), '(none)')
               FROM civic_spaces.get_public_feed('city','3703000',20,NULL,NULL)) = 'City post'
       THEN 'PASS' ELSE 'FAIL -> ' || (SELECT coalesce(string_agg(title, ',' ORDER BY title),'(none)')
               FROM civic_spaces.get_public_feed('city','3703000',20,NULL,NULL)) END;

SELECT 'T4  VOLUNTEER feed returns nothing          : ' ||
  CASE WHEN (SELECT count(*) FROM civic_spaces.get_public_feed('volunteer','3703000',20,NULL,NULL)) = 0
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T5  VOLUNTEER post by id returns nothing    : ' ||
  CASE WHEN (SELECT count(*) FROM civic_spaces.get_public_post('bbbbbbbb-0000-0000-0000-000000000003')) = 0
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T6  shard-2 post keeps its OWN slice_id     : ' ||
  CASE WHEN (SELECT slice_id FROM civic_spaces.get_public_post('bbbbbbbb-0000-0000-0000-000000000002'))
            = 'aaaaaaaa-0000-0000-0000-000000000002'::uuid THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T7  suspended author''s post is absent       : ' ||
  CASE WHEN (SELECT count(*) FROM civic_spaces.get_public_post('bbbbbbbb-0000-0000-0000-000000000004')) = 0
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T8  replies on a VOLUNTEER post are absent  : ' ||
  CASE WHEN (SELECT count(*) FROM civic_spaces.get_public_replies('bbbbbbbb-0000-0000-0000-000000000003',20,NULL,NULL)) = 0
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T9  replies on a city post are returned     : ' ||
  CASE WHEN (SELECT count(*) FROM civic_spaces.get_public_replies('bbbbbbbb-0000-0000-0000-000000000001',20,NULL,NULL)) = 1
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T10 anon viewer gets NULL author_user_id    : ' ||
  CASE WHEN (SELECT author_user_id IS NULL AND author_display_name = 'Ada Fixture'
               FROM civic_spaces.get_public_post('bbbbbbbb-0000-0000-0000-000000000001'))
       THEN 'PASS' ELSE 'FAIL' END;

SELECT 'T11 reply_count on the city post is 1       : ' ||
  CASE WHEN (SELECT reply_count FROM civic_spaces.get_public_post('bbbbbbbb-0000-0000-0000-000000000001')) = 1
       THEN 'PASS' ELSE 'FAIL' END;

-- CONTROL: the harness must be able to report FAIL. This one is deliberately wrong.
SELECT 'C   CONTROL, must read FAIL                 : ' ||
  CASE WHEN (SELECT count(*) FROM civic_spaces.get_public_feed('city','3703000',20,NULL,NULL)) = 99
       THEN 'PASS' ELSE 'FAIL' END;


-- ---------------------------------------------------------------------------
-- After 20261030000200: the same claims as anon, through the grants rather than
-- as the owner. A5-A8 are the ones the phase rests on.
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE anon;
SELECT 'A1 anon reads the city slice              : ' || CASE WHEN count(*)=1 THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_slice('city','3703000');
SELECT 'A2 anon reads the city feed               : ' || CASE WHEN count(*)=1 THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_feed('city','3703000',20,NULL,NULL);
SELECT 'A3 anon reads a post                      : ' || CASE WHEN count(*)=1 THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_post('bbbbbbbb-0000-0000-0000-000000000001');
SELECT 'A4 anon reads its replies                 : ' || CASE WHEN count(*)=1 THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_replies('bbbbbbbb-0000-0000-0000-000000000001',20,NULL,NULL);
SELECT 'A5 anon CANNOT read the volunteer slice   : ' || CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_slice('volunteer','3703000');
SELECT 'A6 anon CANNOT read the volunteer feed    : ' || CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_feed('volunteer','3703000',20,NULL,NULL);
SELECT 'A7 anon CANNOT read the volunteer post    : ' || CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_post('bbbbbbbb-0000-0000-0000-000000000003');
SELECT 'A8 anon CANNOT read volunteer replies     : ' || CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_replies('bbbbbbbb-0000-0000-0000-000000000003',20,NULL,NULL);
SELECT 'A9 anon gets no author id (D-48/49)       : ' || CASE WHEN bool_and(author_user_id IS NULL) THEN 'PASS' ELSE 'FAIL' END FROM civic_spaces.get_public_feed('city','3703000',20,NULL,NULL);
ROLLBACK;
