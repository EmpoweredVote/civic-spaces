-- ============================================================
-- Phase 3: Social Graph
-- Migration: 20260328000000_phase3_social_graph.sql
-- ============================================================

-- ============================================================
-- 1. Fix Empowered tier CHECK constraint on connected_profiles
-- ============================================================
ALTER TABLE civic_spaces.connected_profiles
  DROP CONSTRAINT IF EXISTS connected_profiles_tier_check;
ALTER TABLE civic_spaces.connected_profiles
  ADD CONSTRAINT connected_profiles_tier_check
  CHECK (tier IN ('connected', 'inform', 'empowered'));


-- ============================================================
-- 2. Enable pg_trgm and create GIN index on display_name
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_connected_profiles_display_name_trgm
  ON civic_spaces.connected_profiles
  USING GIN (display_name gin_trgm_ops);


-- ============================================================
-- 3. Friendships table (single-row normalized)
-- ============================================================
CREATE TABLE civic_spaces.friendships (
  user_low   text        NOT NULL,
  user_high  text        NOT NULL,
  status     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_low, user_high),
  CHECK (user_low < user_high),
  CHECK (status IN ('REQ_LOW', 'REQ_HIGH', 'FRIEND'))
);

CREATE INDEX idx_friendships_user_low_status
  ON civic_spaces.friendships (user_low, status);

CREATE INDEX idx_friendships_user_high_status
  ON civic_spaces.friendships (user_high, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON civic_spaces.friendships TO authenticated;


-- ============================================================
-- 4. Follows table (directional)
-- ============================================================
CREATE TABLE civic_spaces.follows (
  follower_id text        NOT NULL,
  target_id   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, target_id)
);

CREATE INDEX idx_follows_follower
  ON civic_spaces.follows (follower_id);

CREATE INDEX idx_follows_target
  ON civic_spaces.follows (target_id);

GRANT SELECT, INSERT, DELETE ON civic_spaces.follows TO authenticated;


-- ============================================================
-- 5. RLS on friendships
-- ============================================================
ALTER TABLE civic_spaces.friendships ENABLE ROW LEVEL SECURITY;

-- SELECT: either party can see their friendships
CREATE POLICY friendships_select_own ON civic_spaces.friendships
  FOR SELECT USING (
    user_low  = (select civic_spaces.current_user_id())
    OR user_high = (select civic_spaces.current_user_id())
  );

-- INSERT: requester must be part of the pair AND status must match their side
CREATE POLICY friendships_insert_own ON civic_spaces.friendships
  FOR INSERT WITH CHECK (
    (user_low  = (select civic_spaces.current_user_id()) AND status = 'REQ_LOW')
    OR
    (user_high = (select civic_spaces.current_user_id()) AND status = 'REQ_HIGH')
  );

-- UPDATE: only the RECIPIENT can accept (not the sender)
-- REQ_LOW was sent by user_low, so user_high (recipient) can accept
-- REQ_HIGH was sent by user_high, so user_low (recipient) can accept
CREATE POLICY friendships_update_accept ON civic_spaces.friendships
  FOR UPDATE
  USING (
    (status = 'REQ_LOW'  AND user_high = (select civic_spaces.current_user_id()))
    OR
    (status = 'REQ_HIGH' AND user_low  = (select civic_spaces.current_user_id()))
  )
  WITH CHECK (status = 'FRIEND');

-- DELETE: either party can remove/cancel
CREATE POLICY friendships_delete_own ON civic_spaces.friendships
  FOR DELETE USING (
    user_low  = (select civic_spaces.current_user_id())
    OR user_high = (select civic_spaces.current_user_id())
  );


-- ============================================================
-- 6. RLS on follows
-- ============================================================
ALTER TABLE civic_spaces.follows ENABLE ROW LEVEL SECURITY;

-- SELECT: follower or target can see
CREATE POLICY follows_select_own ON civic_spaces.follows
  FOR SELECT USING (
    follower_id = (select civic_spaces.current_user_id())
    OR target_id = (select civic_spaces.current_user_id())
  );

-- INSERT: follower_id must be current user AND target must be Empowered
CREATE POLICY follows_insert_empowered ON civic_spaces.follows
  FOR INSERT WITH CHECK (
    follower_id = (select civic_spaces.current_user_id())
    AND target_id IN (
      SELECT user_id FROM civic_spaces.connected_profiles
      WHERE tier = 'empowered'
    )
  );

-- DELETE: only the follower can unfollow
CREATE POLICY follows_delete_own ON civic_spaces.follows
  FOR DELETE USING (
    follower_id = (select civic_spaces.current_user_id())
  );


-- ============================================================
-- 7. updated_at trigger for friendships
-- ============================================================
CREATE OR REPLACE FUNCTION civic_spaces.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON civic_spaces.friendships
  FOR EACH ROW EXECUTE FUNCTION civic_spaces.set_updated_at();


-- ============================================================
-- 8. get_boosted_feed RPC function
-- ============================================================
CREATE OR REPLACE FUNCTION civic_spaces.get_boosted_feed(
  p_slice_id  uuid,
  p_limit     integer     DEFAULT 20,
  p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_id uuid        DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  slice_id    uuid,
  author_id   text,
  body        text,
  is_deleted  boolean,
  created_at  timestamptz,
  updated_at  timestamptz,
  reply_count integer,
  boosted_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH
    my_id AS (
      SELECT civic_spaces.current_user_id() AS uid
    ),
    boosted_authors AS (
      -- mutual friends
      SELECT CASE
        WHEN f.user_low = (SELECT uid FROM my_id) THEN f.user_high
        ELSE f.user_low
      END AS author_id
      FROM civic_spaces.friendships f
      WHERE (f.user_low = (SELECT uid FROM my_id) OR f.user_high = (SELECT uid FROM my_id))
        AND f.status = 'FRIEND'
      UNION
      -- followed Empowered accounts
      SELECT fo.target_id AS author_id
      FROM civic_spaces.follows fo
      WHERE fo.follower_id = (SELECT uid FROM my_id)
    )
  SELECT
    p.id,
    p.slice_id,
    p.author_id,
    p.body,
    p.is_deleted,
    p.created_at,
    p.updated_at,
    p.reply_count,
    CASE
      WHEN ba.author_id IS NOT NULL
      THEN p.created_at + INTERVAL '2 hours'
      ELSE p.created_at
    END AS boosted_at
  FROM civic_spaces.posts p
  LEFT JOIN boosted_authors ba ON ba.author_id = p.author_id
  WHERE p.slice_id = p_slice_id
    AND p.is_deleted = false
    AND (
      p_cursor_at IS NULL
      OR (
        CASE WHEN ba.author_id IS NOT NULL THEN p.created_at + INTERVAL '2 hours' ELSE p.created_at END,
        p.id
      ) < (p_cursor_at, p_cursor_id)
    )
  ORDER BY boosted_at DESC, p.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.get_boosted_feed(uuid, integer, timestamptz, uuid) TO authenticated;


-- ============================================================
-- 9. Public-schema views for PostgREST access
-- ============================================================
CREATE OR REPLACE VIEW public.friendships AS SELECT * FROM civic_spaces.friendships;
CREATE OR REPLACE VIEW public.follows AS SELECT * FROM civic_spaces.follows;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
