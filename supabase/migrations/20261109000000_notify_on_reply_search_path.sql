-- Pin notify_on_reply's search_path (Supabase advisor function_search_path_mutable).
--
-- notify_on_reply is SECURITY DEFINER and was the last civic_spaces definer
-- function without a fixed search_path. A definer function that resolves names
-- through the caller's search_path can be steered to a look-alike table or
-- function placed earlier on that path. Every other definer function in this
-- schema already pins `search_path = ''`; this brings the reply trigger in line.
--
-- Safe with an empty path: the body names every table schema-qualified
-- (civic_spaces.posts, civic_spaces.replies, civic_spaces.notifications) and
-- calls only built-ins (LEFT, now, array_append, CURRENT_DATE), which resolve
-- from pg_catalog regardless of search_path.
--
-- ALTER, not CREATE OR REPLACE: the body stays exactly as
-- 20261102000300_no_notify_on_fork.sql left it.
--
-- Found by the 2026-11-09 anon-execute review (ev-cto task
-- 2026-11-09-anon-sweep-civic-spaces-public-read).

ALTER FUNCTION civic_spaces.notify_on_reply() SET search_path = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'civic_spaces' AND p.proname = 'notify_on_reply'
       AND p.proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'notify_on_reply search_path was not pinned';
  END IF;
END $$;
