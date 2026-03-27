-- =============================================================================
-- Civic Spaces: Row Level Security Policies
-- Phase 01 Plan 02 - Task 2
-- Depends on: 20260327000001_schema.sql
-- =============================================================================
-- All policies use civic_spaces.current_user_id() which reads auth.jwt() ->> 'sub'.
-- This is required because external JWTs do not populate auth.uid().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all civic_spaces tables
-- ---------------------------------------------------------------------------
ALTER TABLE civic_spaces.slices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.slice_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.connected_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.replies            ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- slices
-- Any authenticated user can read slices (needed to display available slices
-- and for the slice assignment flow). No direct insert/update/delete by users.
-- ---------------------------------------------------------------------------
CREATE POLICY "slices_select_authenticated"
    ON civic_spaces.slices
    FOR SELECT
    TO authenticated
    USING (true);

-- ---------------------------------------------------------------------------
-- slice_members
-- Users can only read their own membership rows.
-- Insert is handled by the slice assignment service (service_role), not RLS.
-- ---------------------------------------------------------------------------
CREATE POLICY "slice_members_select_own"
    ON civic_spaces.slice_members
    FOR SELECT
    TO authenticated
    USING (user_id = civic_spaces.current_user_id());

-- ---------------------------------------------------------------------------
-- connected_profiles
-- All authenticated users can read any profile (needed for displaying author
-- info on posts/replies). Users can only update their own profile.
-- ---------------------------------------------------------------------------
CREATE POLICY "connected_profiles_select_authenticated"
    ON civic_spaces.connected_profiles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "connected_profiles_update_own"
    ON civic_spaces.connected_profiles
    FOR UPDATE
    TO authenticated
    USING     (user_id = civic_spaces.current_user_id())
    WITH CHECK (user_id = civic_spaces.current_user_id());

-- ---------------------------------------------------------------------------
-- posts
-- SELECT: only posts in slices the user is a member of, and not soft-deleted.
-- INSERT: user may only post to their own slices, and must own the row.
-- UPDATE: user may only edit their own non-deleted posts.
-- DELETE: not permitted via RLS (soft-delete via UPDATE is_deleted = true).
-- ---------------------------------------------------------------------------

CREATE POLICY "posts_select_slice_member"
    ON civic_spaces.posts
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = false
        AND slice_id IN (
            SELECT slice_id
            FROM   civic_spaces.slice_members
            WHERE  user_id = civic_spaces.current_user_id()
        )
    );

CREATE POLICY "posts_insert_slice_member"
    ON civic_spaces.posts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = civic_spaces.current_user_id()
        AND slice_id IN (
            SELECT slice_id
            FROM   civic_spaces.slice_members
            WHERE  user_id = civic_spaces.current_user_id()
        )
    );

CREATE POLICY "posts_update_own"
    ON civic_spaces.posts
    FOR UPDATE
    TO authenticated
    USING     (user_id = civic_spaces.current_user_id() AND is_deleted = false)
    WITH CHECK (user_id = civic_spaces.current_user_id() AND is_deleted = false);

-- ---------------------------------------------------------------------------
-- replies
-- SELECT: only replies on posts in the user's slices, and not soft-deleted.
-- INSERT: user may only reply to posts in their slices, and must own the row.
-- UPDATE: user may only edit their own non-deleted replies.
-- ---------------------------------------------------------------------------

CREATE POLICY "replies_select_slice_member"
    ON civic_spaces.replies
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = false
        AND post_id IN (
            SELECT p.id
            FROM   civic_spaces.posts        p
            JOIN   civic_spaces.slice_members sm
                   ON sm.slice_id = p.slice_id
            WHERE  sm.user_id = civic_spaces.current_user_id()
              AND  p.is_deleted = false
        )
    );

CREATE POLICY "replies_insert_slice_member"
    ON civic_spaces.replies
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = civic_spaces.current_user_id()
        AND post_id IN (
            SELECT p.id
            FROM   civic_spaces.posts        p
            JOIN   civic_spaces.slice_members sm
                   ON sm.slice_id = p.slice_id
            WHERE  sm.user_id = civic_spaces.current_user_id()
              AND  p.is_deleted = false
        )
    );

CREATE POLICY "replies_update_own"
    ON civic_spaces.replies
    FOR UPDATE
    TO authenticated
    USING     (user_id = civic_spaces.current_user_id() AND is_deleted = false)
    WITH CHECK (user_id = civic_spaces.current_user_id() AND is_deleted = false);
