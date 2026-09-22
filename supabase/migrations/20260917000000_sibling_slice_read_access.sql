-- =============================================================================
-- Civic Spaces: Sibling-slice read access (community "slice" view-only browsing)
-- Depends on: 20260327000002_rls.sql
-- =============================================================================
-- Large jurisdictions are sharded into multiple "sibling" slices (same
-- slice_type + geoid, different sibling_index) once a slice hits its member
-- cap — see findOrCreateSiblingSlice in the ev-accounts engine (the local
-- services/slice-assignment copy is FROZEN, ev-cto decision 0018). Until now,
-- RLS only let a user read posts/replies in slices they belong to, so there
-- was no way to browse a sibling slice at the same location read-only.
--
-- This migration ADDS permissive SELECT policies (Postgres OR's multiple
-- permissive policies together) granting read access to posts/replies in any
-- slice that shares (slice_type, geoid) with a slice the user already
-- belongs to. It does NOT touch INSERT/UPDATE policies — those remain
-- strictly membership-scoped (posts_insert_slice_member,
-- replies_insert_slice_member, *_update_own, all unchanged) — and it does
-- NOT touch slice_members at all, so there is still no client-writable path
-- to assign a user to a different slice.
-- =============================================================================

CREATE POLICY "posts_select_sibling_slice"
    ON civic_spaces.posts
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = false
        AND slice_id IN (
            SELECT sib.id
            FROM   civic_spaces.slice_members mine
            JOIN   civic_spaces.slices        mine_slice ON mine_slice.id = mine.slice_id
            JOIN   civic_spaces.slices        sib
                   ON sib.slice_type = mine_slice.slice_type
                  AND sib.geoid      = mine_slice.geoid
            WHERE  mine.user_id = civic_spaces.current_user_id()
        )
    );

CREATE POLICY "replies_select_sibling_slice"
    ON civic_spaces.replies
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = false
        AND post_id IN (
            SELECT p.id
            FROM   civic_spaces.posts         p
            JOIN   civic_spaces.slice_members mine       ON true
            JOIN   civic_spaces.slices        mine_slice ON mine_slice.id = mine.slice_id
            JOIN   civic_spaces.slices        sib
                   ON sib.slice_type = mine_slice.slice_type
                  AND sib.geoid      = mine_slice.geoid
                  AND sib.id         = p.slice_id
            WHERE  mine.user_id = civic_spaces.current_user_id()
              AND  p.is_deleted = false
        )
    );

NOTIFY pgrst, 'reload schema';
