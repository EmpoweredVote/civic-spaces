-- Pre-taxonomy snapshot. Applied to production 2026-09-01, BEFORE 20260902000050 and
-- 20260902000100, so these copies hold the state that predates both.
--
-- 20260902000100_slice_taxonomy.sql deletes slices, and posts.slice_id is ON DELETE
-- CASCADE. The 12 posts are the irreplaceable part of this database; everything else can
-- be re-derived by re-running assignment. The migration moves every post before it
-- deletes anything and asserts the total is unchanged, but an assertion protects against
-- the failure you predicted. This protects against the one you did not.
--
-- 🔴 THESE ARE NOT PLAIN `CREATE TABLE AS` COPIES, AND MUST NOT BE.
--
-- civic_spaces is exposed to PostgREST, and slices / slice_members / posts each grant
-- `authenticated` arwd with RLS policies deciding which rows a member may actually see.
-- A copy inherits the grants a new table gets in this schema but NONE of the policies, so
-- an unguarded backup would serve every post and every membership to any logged-in user
-- -- exactly the rows the originals' policies exist to filter. A copy anyone can read is
-- not a backup, it is a disclosure.
--
-- RLS is therefore enabled with zero policies, which is deny-all, and the grants are
-- revoked. `postgres` owns the tables and bypasses both, which is all a restore needs.

CREATE TABLE IF NOT EXISTS civic_spaces.slices_backup_20260902        AS SELECT * FROM civic_spaces.slices;
CREATE TABLE IF NOT EXISTS civic_spaces.slice_members_backup_20260902 AS SELECT * FROM civic_spaces.slice_members;
CREATE TABLE IF NOT EXISTS civic_spaces.posts_backup_20260902         AS SELECT * FROM civic_spaces.posts;

ALTER TABLE civic_spaces.slices_backup_20260902        ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.slice_members_backup_20260902 ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.posts_backup_20260902         ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON civic_spaces.slices_backup_20260902        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON civic_spaces.slice_members_backup_20260902 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON civic_spaces.posts_backup_20260902         FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE civic_spaces.slices_backup_20260902 IS
  'Pre-taxonomy-migration snapshot (20260902000100_slice_taxonomy.sql). Drop only once Task 8 has verified a real member end to end.';
COMMENT ON TABLE civic_spaces.slice_members_backup_20260902 IS
  'Pre-taxonomy-migration snapshot. Drop only once Task 8 has verified a real member end to end.';
COMMENT ON TABLE civic_spaces.posts_backup_20260902 IS
  'Pre-taxonomy-migration snapshot. The 12 posts are the irreplaceable part. Drop only once Task 8 has verified a real member end to end.';

DO $verify$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT 'slices' AS t,
           (SELECT count(*) FROM civic_spaces.slices) AS live,
           (SELECT count(*) FROM civic_spaces.slices_backup_20260902) AS backup
    UNION ALL
    SELECT 'slice_members',
           (SELECT count(*) FROM civic_spaces.slice_members),
           (SELECT count(*) FROM civic_spaces.slice_members_backup_20260902)
    UNION ALL
    SELECT 'posts',
           (SELECT count(*) FROM civic_spaces.posts),
           (SELECT count(*) FROM civic_spaces.posts_backup_20260902)
  LOOP
    -- backup = 0 is called out separately: an empty copy matches an empty source and
    -- would otherwise pass as a snapshot of nothing.
    IF r.live <> r.backup OR r.backup = 0 THEN
      RAISE EXCEPTION 'snapshot of % is wrong: % live vs % backed up', r.t, r.live, r.backup;
    END IF;
  END LOOP;

  FOR r IN
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'civic_spaces' AND c.relname LIKE '%_backup_20260902'
  LOOP
    IF NOT r.relrowsecurity THEN
      RAISE EXCEPTION 'backup table % has RLS disabled', r.relname;
    END IF;
    IF has_table_privilege('authenticated', 'civic_spaces.' || r.relname, 'SELECT') THEN
      RAISE EXCEPTION 'backup table % is still readable by authenticated', r.relname;
    END IF;
  END LOOP;
END $verify$;

-- Verified 2026-09-01: 16 slices, 24 slice_members, 12 posts, each matching live, and
-- each identical to its source by a two-way EXCEPT (row counts alone would not have
-- caught a column that copied wrong).
--
-- TO RESTORE, as postgres, before anything has re-run assignment:
--
--   BEGIN;
--   -- 🔴 FIRST. These rows say 'local' and 'neighborhood', and if the taxonomy
--   -- migration has run then the live constraint names the NEW vocabulary and rejects
--   -- every one of them. Restoring the data means restoring the constraint it was
--   -- written under.
--   ALTER TABLE civic_spaces.slices DROP CONSTRAINT slices_slice_type_check;
--
--   DELETE FROM civic_spaces.posts;
--   DELETE FROM civic_spaces.slice_members;
--   DELETE FROM civic_spaces.slices;
--
--   -- slices first: posts and slice_members both reference slices(id).
--   INSERT INTO civic_spaces.slices        SELECT * FROM civic_spaces.slices_backup_20260902;
--   INSERT INTO civic_spaces.slice_members SELECT * FROM civic_spaces.slice_members_backup_20260902;
--   INSERT INTO civic_spaces.posts         SELECT * FROM civic_spaces.posts_backup_20260902;
--
--   ALTER TABLE civic_spaces.slices ADD CONSTRAINT slices_slice_type_check
--     CHECK (slice_type = ANY (ARRAY['federal','state','local','neighborhood','unified','volunteer']));
--
--   -- The slice_members INSERTs fire the increment trigger, so the counters are now the
--   -- restored value plus one per row. Reconcile before committing.
--   UPDATE civic_spaces.slices s SET current_member_count = COALESCE(m.n, 0)
--   FROM (SELECT sl.id, COUNT(sm.user_id) AS n FROM civic_spaces.slices sl
--         LEFT JOIN civic_spaces.slice_members sm ON sm.slice_id = sl.id
--         GROUP BY sl.id) m
--   WHERE m.id = s.id AND s.current_member_count IS DISTINCT FROM COALESCE(m.n, 0);
--   COMMIT;
--
-- TO DROP, once Task 8 has verified a real member end to end:
--   DROP TABLE civic_spaces.posts_backup_20260902;
--   DROP TABLE civic_spaces.slice_members_backup_20260902;
--   DROP TABLE civic_spaces.slices_backup_20260902;
