-- =============================================================================
-- Civic Spaces: Reconcile the public.* views and take anon's privileges off them
-- Depends on: the production public.* views (see below); civic_spaces schema
-- =============================================================================
-- Production's `public` schema holds 12 views that belong to this app, and five
-- of them (posts, replies, slices, slice_members, connected_profiles) exist in
-- production but in NO migration in this repo. They were created by hand, so a
-- fresh database built from supabase/migrations/ does not have them and nobody
-- reading the repo could tell what they expose.
--
-- On top of that, `anon` holds all seven privileges (SELECT, INSERT, UPDATE,
-- DELETE, TRUNCATE, REFERENCES, TRIGGER) on every one of the twelve. None of
-- that came from a GRANT written here: Supabase's default privileges on
-- `public` hand them to anon and authenticated for every object a role creates
-- there. Nothing in this repo ever asked for them, so nothing in this repo
-- could have noticed them.
--
-- This migration does two things, in this order:
--   1. Brings the five untracked views under version control, reproducing the
--      live column lists exactly (captured 2026-10-31, see
--      .planning/phases/18-the-public-square/18-01-BASELINE.md). CREATE OR
--      REPLACE VIEW cannot change a column list, so a mismatch errors rather
--      than silently altering production; it also preserves existing grants.
--      security_invoker is stated explicitly rather than inherited, so the
--      views keep evaluating RLS as the caller.
--   2. REVOKE ALL ... FROM anon on all twelve. ALL, not SELECT: a revoke that
--      handles only SELECT leaves INSERT/UPDATE/DELETE/TRUNCATE waiting for
--      any future permissive policy to switch them on.
--
-- `authenticated` is deliberately untouched: its privileges are unchanged, so
-- signed-in members see no behaviour change.
--
-- DELIBERATELY SKIPPED: public.users_public. It reads a `users` table Civic
-- Spaces does not own, so at least one other EV app shares this schema and
-- depends on its grants; revoking from anon here could break that app. This is
-- a decision, not an oversight. geography_columns and geometry_columns are
-- PostGIS views owned by supabase_admin and are likewise left alone.
-- =============================================================================

-- 1. The five views that existed in production and in no migration ------------

CREATE OR REPLACE VIEW public.connected_profiles
    WITH (security_invoker = on) AS
SELECT user_id,
       display_name,
       account_standing,
       created_at,
       updated_at,
       avatar_url,
       tier,
       is_suspended
FROM   civic_spaces.connected_profiles;

CREATE OR REPLACE VIEW public.posts
    WITH (security_invoker = on) AS
SELECT id,
       slice_id,
       user_id,
       title,
       body,
       created_at,
       updated_at,
       is_deleted,
       edit_history,
       reply_count
FROM   civic_spaces.posts;

CREATE OR REPLACE VIEW public.replies
    WITH (security_invoker = on) AS
SELECT id,
       post_id,
       parent_reply_id,
       user_id,
       body,
       created_at,
       updated_at,
       is_deleted
FROM   civic_spaces.replies;

CREATE OR REPLACE VIEW public.slice_members
    WITH (security_invoker = on) AS
SELECT id,
       user_id,
       slice_id,
       joined_at
FROM   civic_spaces.slice_members;

CREATE OR REPLACE VIEW public.slices
    WITH (security_invoker = on) AS
SELECT id,
       slice_type,
       geoid,
       sibling_index,
       current_member_count,
       created_at
FROM   civic_spaces.slices;

-- 2. Take every privilege away from anon on all twelve ------------------------

REVOKE ALL ON public.posts              FROM anon;
REVOKE ALL ON public.replies            FROM anon;
REVOKE ALL ON public.slices             FROM anon;
REVOKE ALL ON public.slice_members      FROM anon;
REVOKE ALL ON public.connected_profiles FROM anon;
REVOKE ALL ON public.friendships        FROM anon;
REVOKE ALL ON public.follows            FROM anon;
REVOKE ALL ON public.civic_notifications FROM anon;
REVOKE ALL ON public.flags              FROM anon;
REVOKE ALL ON public.blocks             FROM anon;
REVOKE ALL ON public.moderators         FROM anon;
REVOKE ALL ON public.action_log         FROM anon;

-- 3. Make PostgREST pick the change up ----------------------------------------

NOTIFY pgrst, 'reload schema';
