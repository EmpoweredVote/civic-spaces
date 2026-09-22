-- =============================================================================
-- Civic Spaces: Table Schema DDL
-- Phase 01 Plan 02 - Task 1
-- Depends on: 20260327000000_current_user_id.sql (civic_spaces schema + current_user_id())
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. slices
-- Represents a geographic civic group. Each unique (geoid, slice_type) can
-- spawn multiple siblings (sibling_index >= 2) once the first hits 6k members.
-- ---------------------------------------------------------------------------
CREATE TABLE civic_spaces.slices (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    slice_type           text        NOT NULL
                                     CHECK (slice_type IN ('federal', 'state', 'local', 'neighborhood')),
    geoid                text        NOT NULL,
    sibling_index        integer     NOT NULL DEFAULT 1,
    current_member_count integer     NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT slices_geoid_type_sibling_key UNIQUE (geoid, slice_type, sibling_index),
    CONSTRAINT slices_count_max_check        CHECK (current_member_count <= 6000),
    CONSTRAINT slices_count_min_check        CHECK (current_member_count >= 0)
);

COMMENT ON TABLE  civic_spaces.slices                      IS 'Geographic civic groups keyed by TIGER/Line GEOID and jurisdiction type';
COMMENT ON COLUMN civic_spaces.slices.geoid                IS 'Raw TIGER/Line GEOID stored verbatim (e.g. "1807", "18046", "18097", "1804770")';
COMMENT ON COLUMN civic_spaces.slices.sibling_index        IS 'Overflow index: 1 = first 6k, 2 = second 6k, etc.';
COMMENT ON COLUMN civic_spaces.slices.current_member_count IS 'Maintained by triggers; never updated by application code directly';

-- ---------------------------------------------------------------------------
-- 2. slice_members
-- Join table between a user (text id from accounts JWT) and a slice.
-- ---------------------------------------------------------------------------
CREATE TABLE civic_spaces.slice_members (
    id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   text        NOT NULL,
    slice_id  uuid        NOT NULL REFERENCES civic_spaces.slices(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT slice_members_user_slice_key UNIQUE (user_id, slice_id)
);

COMMENT ON TABLE  civic_spaces.slice_members          IS 'Membership join table: one row per user per slice';
COMMENT ON COLUMN civic_spaces.slice_members.user_id  IS 'Accounts UUID stored as text (matches auth.jwt() ->> ''sub'')';

-- ---------------------------------------------------------------------------
-- 3. connected_profiles
-- Public profile for users who have connected their accounts account.
-- One row per user_id; created by application on first connection.
-- ---------------------------------------------------------------------------
CREATE TABLE civic_spaces.connected_profiles (
    user_id         text        PRIMARY KEY,
    display_name    text        NOT NULL,
    account_standing text       NOT NULL DEFAULT 'active'
                                CHECK (account_standing IN ('active', 'suspended')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  civic_spaces.connected_profiles                  IS 'Public profile created when a user first connects their accounts account';
COMMENT ON COLUMN civic_spaces.connected_profiles.user_id          IS 'Accounts UUID as text; matches auth.jwt() ->> ''sub''';
COMMENT ON COLUMN civic_spaces.connected_profiles.account_standing IS 'Suspended users are hidden from feeds but not deleted';

-- ---------------------------------------------------------------------------
-- 4. posts
-- Content posted within a slice. Soft-deleted via is_deleted flag.
-- ---------------------------------------------------------------------------
CREATE TABLE civic_spaces.posts (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    slice_id   uuid        NOT NULL REFERENCES civic_spaces.slices(id) ON DELETE CASCADE,
    user_id    text        NOT NULL,
    title      text,
    body       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean     NOT NULL DEFAULT false
);

COMMENT ON TABLE  civic_spaces.posts            IS 'Posts created by slice members; soft-deleted to preserve reply threads';
COMMENT ON COLUMN civic_spaces.posts.is_deleted IS 'Soft delete: true hides from feeds but preserves reply context';

-- ---------------------------------------------------------------------------
-- 5. replies
-- Threaded replies to posts; supports one level of nesting via parent_reply_id.
-- ---------------------------------------------------------------------------
CREATE TABLE civic_spaces.replies (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         uuid        NOT NULL REFERENCES civic_spaces.posts(id) ON DELETE CASCADE,
    parent_reply_id uuid        REFERENCES civic_spaces.replies(id) ON DELETE CASCADE,
    user_id         text        NOT NULL,
    body            text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    is_deleted      boolean     NOT NULL DEFAULT false
);

COMMENT ON TABLE  civic_spaces.replies IS 'Threaded replies; parent_reply_id NULL = direct reply to post';

-- =============================================================================
-- Indexes
-- =============================================================================

-- slice_members: fast membership lookups used heavily in RLS subqueries
CREATE INDEX idx_slice_members_user_id  ON civic_spaces.slice_members (user_id);
CREATE INDEX idx_slice_members_slice_id ON civic_spaces.slice_members (slice_id);

-- slices: slice lookup by jurisdiction (used during slice assignment)
CREATE INDEX idx_slices_geoid_type ON civic_spaces.slices (geoid, slice_type);

-- posts: feed pagination (newest first per slice)
CREATE INDEX idx_posts_slice_created ON civic_spaces.posts (slice_id, created_at DESC);

-- replies: thread rendering (oldest first per post)
CREATE INDEX idx_replies_post_created ON civic_spaces.replies (post_id, created_at);

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON civic_spaces.slices           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON civic_spaces.slice_members     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON civic_spaces.connected_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON civic_spaces.posts             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON civic_spaces.replies           TO authenticated;

-- Sequences (for any future serial/sequence columns and completeness)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA civic_spaces TO authenticated;
