-- ============================================================
-- Phase 5: Moderation & Safety
-- Migration: 20260328200000_phase5_moderation.sql
-- ============================================================
-- Tables: flags, blocks, moderators, action_log
-- Helpers: is_moderator(), is_blocked_by()
-- Feed RPCs: get_feed_filtered(), get_boosted_feed_filtered()
-- Mod RPCs: get_mod_queue(), mod_action(), send_warn_notification()
-- Block-aware policies: replies, friendships
-- Public views: flags, blocks, moderators, action_log
-- ============================================================


-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE civic_spaces.flags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES civic_spaces.posts(id) ON DELETE CASCADE,
  reporter_id text        NOT NULL,
  category    text        NOT NULL
                          CHECK (category IN ('spam', 'harassment', 'misinformation', 'other')),
  detail      text,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT flags_unique_reporter_post UNIQUE (reporter_id, post_id)
);

CREATE TABLE civic_spaces.blocks (
  blocker_id text        NOT NULL,
  blocked_id text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE civic_spaces.moderators (
  user_id    text        PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text        NOT NULL
);

CREATE TABLE civic_spaces.action_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id text        NOT NULL,
  action       text        NOT NULL
                           CHECK (action IN ('remove', 'dismiss', 'warn', 'suspend')),
  target_type  text        NOT NULL
                           CHECK (target_type IN ('post', 'user')),
  target_id    text        NOT NULL,
  flag_ids     uuid[]      NOT NULL DEFAULT '{}',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 2. is_moderator() helper
-- ============================================================

CREATE OR REPLACE FUNCTION civic_spaces.is_moderator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM civic_spaces.moderators
    WHERE user_id = (SELECT civic_spaces.current_user_id())
  );
$$;


-- ============================================================
-- 3. is_blocked_by(p_user_id) RPC
-- SECURITY DEFINER: bypasses blocks RLS so a blocked user can
-- detect they are blocked without reading the blocks table.
-- ============================================================

CREATE OR REPLACE FUNCTION civic_spaces.is_blocked_by(p_user_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM civic_spaces.blocks
    WHERE blocker_id = p_user_id
      AND blocked_id = (SELECT civic_spaces.current_user_id())
  );
$$;


-- ============================================================
-- 4. Enable RLS on all 4 tables
-- ============================================================

ALTER TABLE civic_spaces.flags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.blocks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.action_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 5. RLS policies
-- ============================================================

-- Flags: users see own; moderators see all + can update
CREATE POLICY flags_select_own ON civic_spaces.flags
  FOR SELECT TO authenticated
  USING (reporter_id = (SELECT civic_spaces.current_user_id()));

CREATE POLICY flags_insert_own ON civic_spaces.flags
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT civic_spaces.current_user_id()));

CREATE POLICY flags_select_moderator ON civic_spaces.flags
  FOR SELECT TO authenticated
  USING ((SELECT civic_spaces.is_moderator()));

CREATE POLICY flags_update_moderator ON civic_spaces.flags
  FOR UPDATE TO authenticated
  USING ((SELECT civic_spaces.is_moderator()))
  WITH CHECK ((SELECT civic_spaces.is_moderator()));

-- Blocks: only the blocker can see/insert/delete their own blocks
CREATE POLICY blocks_select_own ON civic_spaces.blocks
  FOR SELECT TO authenticated
  USING (blocker_id = (SELECT civic_spaces.current_user_id()));

CREATE POLICY blocks_insert_own ON civic_spaces.blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = (SELECT civic_spaces.current_user_id()));

CREATE POLICY blocks_delete_own ON civic_spaces.blocks
  FOR DELETE TO authenticated
  USING (blocker_id = (SELECT civic_spaces.current_user_id()));

-- Moderators: users can see if they themselves are a moderator
CREATE POLICY moderators_select_self ON civic_spaces.moderators
  FOR SELECT TO authenticated
  USING (user_id = (SELECT civic_spaces.current_user_id()));

-- Action Log: moderators only
CREATE POLICY action_log_insert_moderator ON civic_spaces.action_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT civic_spaces.is_moderator()));

CREATE POLICY action_log_select_moderator ON civic_spaces.action_log
  FOR SELECT TO authenticated
  USING ((SELECT civic_spaces.is_moderator()));


-- ============================================================
-- 6. Block-aware reply INSERT policy (replaces existing)
-- ============================================================

-- Drop the old policy that lacks block enforcement
DROP POLICY IF EXISTS "replies_insert_slice_member" ON civic_spaces.replies;

-- Recreate with block check in both directions
CREATE POLICY "replies_insert_slice_member"
    ON civic_spaces.replies
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT civic_spaces.current_user_id())
        AND post_id IN (
            SELECT p.id
            FROM   civic_spaces.posts        p
            JOIN   civic_spaces.slice_members sm
                   ON sm.slice_id = p.slice_id
            WHERE  sm.user_id = (SELECT civic_spaces.current_user_id())
              AND  p.is_deleted = false
        )
        -- Block check: reject if a block exists in either direction
        -- between the reply author and the post author
        AND NOT EXISTS (
            SELECT 1 FROM civic_spaces.blocks b
            WHERE (
                b.blocker_id = (
                    SELECT p.user_id FROM civic_spaces.posts p
                    WHERE p.id = post_id
                )
                AND b.blocked_id = (SELECT civic_spaces.current_user_id())
            ) OR (
                b.blocker_id = (SELECT civic_spaces.current_user_id())
                AND b.blocked_id = (
                    SELECT p.user_id FROM civic_spaces.posts p
                    WHERE p.id = post_id
                )
            )
        )
    );


-- ============================================================
-- 7. Block-aware friendship INSERT policy (replaces existing)
-- ============================================================

-- Drop the old policy that lacks block enforcement
DROP POLICY IF EXISTS "friendships_insert_own" ON civic_spaces.friendships;

-- Recreate with block check in both directions
CREATE POLICY "friendships_insert_own"
    ON civic_spaces.friendships
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            (user_low  = (SELECT civic_spaces.current_user_id()) AND status = 'REQ_LOW')
            OR
            (user_high = (SELECT civic_spaces.current_user_id()) AND status = 'REQ_HIGH')
        )
        -- Block check: reject if a block exists in either direction
        AND NOT EXISTS (
            SELECT 1 FROM civic_spaces.blocks b
            WHERE (b.blocker_id = user_low  AND b.blocked_id = user_high)
               OR (b.blocker_id = user_high AND b.blocked_id = user_low)
        )
    );


-- ============================================================
-- 8. get_feed_filtered RPC
-- Block-filtered feed: excludes posts from blocked users (both directions)
-- ============================================================

CREATE OR REPLACE FUNCTION civic_spaces.get_feed_filtered(
  p_slice_id  uuid,
  p_limit     integer     DEFAULT 20,
  p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_id uuid        DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  slice_id    uuid,
  user_id     text,
  title       text,
  body        text,
  reply_count integer,
  edit_history jsonb,
  is_deleted  boolean,
  created_at  timestamptz,
  updated_at  timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT p.id, p.slice_id, p.user_id, p.title, p.body,
         p.reply_count, p.edit_history, p.is_deleted, p.created_at, p.updated_at
  FROM civic_spaces.posts p
  WHERE p.slice_id = p_slice_id
    AND p.is_deleted = false
    AND p.slice_id IN (
      SELECT sm.slice_id FROM civic_spaces.slice_members sm
      WHERE sm.user_id = (SELECT civic_spaces.current_user_id())
    )
    AND NOT EXISTS (
      SELECT 1 FROM civic_spaces.blocks b
      WHERE (b.blocker_id = (SELECT civic_spaces.current_user_id()) AND b.blocked_id = p.user_id)
         OR (b.blocker_id = p.user_id AND b.blocked_id = (SELECT civic_spaces.current_user_id()))
    )
    AND (p_cursor_at IS NULL OR (p.created_at, p.id) < (p_cursor_at, p_cursor_id))
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT p_limit;
$$;


-- ============================================================
-- 9. get_boosted_feed_filtered RPC
-- Block-filtered boosted feed: friend/follow boost + block exclusion
-- ============================================================

CREATE OR REPLACE FUNCTION civic_spaces.get_boosted_feed_filtered(
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
LANGUAGE sql STABLE SECURITY INVOKER
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
    p.user_id  AS author_id,
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
  LEFT JOIN boosted_authors ba ON ba.author_id = p.user_id
  WHERE p.slice_id = p_slice_id
    AND p.is_deleted = false
    -- Block exclusion: exclude posts from blocked users in both directions
    AND NOT EXISTS (
      SELECT 1 FROM civic_spaces.blocks b
      WHERE (b.blocker_id = (SELECT uid FROM my_id) AND b.blocked_id = p.user_id)
         OR (b.blocker_id = p.user_id AND b.blocked_id = (SELECT uid FROM my_id))
    )
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


-- ============================================================
-- 10. get_mod_queue RPC (SECURITY DEFINER, plpgsql)
-- Returns flagged posts with aggregated flag data for the mod queue.
-- Restricted to moderators; raises 'forbidden' for non-moderators.
-- ============================================================

CREATE OR REPLACE FUNCTION civic_spaces.get_mod_queue(
  p_status   text DEFAULT 'pending',
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  post_id          uuid,
  body             text,
  title            text,
  author_id        text,
  post_created_at  timestamptz,
  flag_count       bigint,
  flag_categories  text[],
  first_flagged_at timestamptz,
  priority         text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF NOT civic_spaces.is_moderator() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT
      p.id              AS post_id,
      p.body,
      p.title,
      p.user_id         AS author_id,
      p.created_at      AS post_created_at,
      COUNT(f.id)       AS flag_count,
      ARRAY_AGG(DISTINCT f.category) AS flag_categories,
      MIN(f.created_at) AS first_flagged_at,
      CASE WHEN COUNT(f.id) >= 5 THEN 'high'::text ELSE 'normal'::text END AS priority
    FROM civic_spaces.flags f
    JOIN civic_spaces.posts p ON p.id = f.post_id
    WHERE f.status = p_status
      AND p.is_deleted = false
      AND (p_category IS NULL OR f.category = p_category)
    GROUP BY p.id, p.body, p.title, p.user_id, p.created_at
    ORDER BY
      CASE WHEN COUNT(f.id) >= 5 THEN 0 ELSE 1 END,
      MIN(f.created_at) ASC;
END;
$$;


-- ============================================================
-- 11. send_warn_notification RPC (SECURITY DEFINER)
-- Inserts a 'warn' notification for the targeted user.
-- Called internally by mod_action; not exposed directly to clients.
-- ============================================================

-- First update the event_type CHECK constraint to include 'warn'
ALTER TABLE civic_spaces.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_type_check;
ALTER TABLE civic_spaces.notifications
  ADD CONSTRAINT notifications_event_type_check
  CHECK (event_type IN ('reply', 'friend_request', 'friend_accepted', 'warn'));

CREATE OR REPLACE FUNCTION civic_spaces.send_warn_notification(
  p_target_user_id text,
  p_post_id        text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO civic_spaces.notifications (
    recipient_id, event_type, actor_id, actor_ids, reference_id,
    reference_excerpt, event_count, group_window
  ) VALUES (
    p_target_user_id,
    'warn',
    'system',
    ARRAY['system'],
    p_post_id,
    'Your post has been reviewed by a moderator',
    1,
    CURRENT_DATE
  );
END;
$$;


-- ============================================================
-- 12. mod_action RPC (SECURITY DEFINER, plpgsql)
-- Atomically performs a moderation action, resolves flags, and logs.
-- ============================================================

CREATE OR REPLACE FUNCTION civic_spaces.mod_action(
  p_action  text,
  p_post_id uuid DEFAULT NULL,
  p_user_id text DEFAULT NULL,
  p_notes   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_flag_ids uuid[];
  v_mod_id   text := civic_spaces.current_user_id();
BEGIN
  IF NOT civic_spaces.is_moderator() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Collect pending flag IDs for this post
  IF p_post_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_flag_ids
    FROM civic_spaces.flags
    WHERE post_id = p_post_id AND status = 'pending';
  END IF;

  -- Perform the action
  CASE p_action
    WHEN 'remove' THEN
      UPDATE civic_spaces.posts SET is_deleted = true WHERE id = p_post_id;
      UPDATE civic_spaces.flags SET status = 'resolved'
        WHERE post_id = p_post_id AND status = 'pending';

    WHEN 'dismiss' THEN
      UPDATE civic_spaces.flags SET status = 'dismissed'
        WHERE post_id = p_post_id AND status = 'pending';

    WHEN 'warn' THEN
      PERFORM civic_spaces.send_warn_notification(
        (SELECT user_id FROM civic_spaces.posts WHERE id = p_post_id),
        p_post_id::text
      );
      UPDATE civic_spaces.flags SET status = 'resolved'
        WHERE post_id = p_post_id AND status = 'pending';

    WHEN 'suspend' THEN
      UPDATE civic_spaces.connected_profiles
        SET account_standing = 'suspended'
        WHERE user_id = COALESCE(
          p_user_id,
          (SELECT user_id FROM civic_spaces.posts WHERE id = p_post_id)
        );
      IF p_post_id IS NOT NULL THEN
        UPDATE civic_spaces.flags SET status = 'resolved'
          WHERE post_id = p_post_id AND status = 'pending';
      END IF;
  END CASE;

  -- Log the action
  INSERT INTO civic_spaces.action_log (moderator_id, action, target_type, target_id, flag_ids, notes)
  VALUES (
    v_mod_id,
    p_action,
    CASE WHEN p_action = 'suspend' THEN 'user' ELSE 'post' END,
    CASE
      WHEN p_action = 'suspend' AND p_user_id IS NOT NULL THEN p_user_id
      WHEN p_post_id IS NOT NULL THEN p_post_id::text
      ELSE ''
    END,
    COALESCE(v_flag_ids, '{}'),
    p_notes
  );
END;
$$;


-- ============================================================
-- 13. Public-schema views (PostgREST access pattern)
-- ============================================================

CREATE OR REPLACE VIEW public.flags      AS SELECT * FROM civic_spaces.flags;
CREATE OR REPLACE VIEW public.blocks     AS SELECT * FROM civic_spaces.blocks;
CREATE OR REPLACE VIEW public.moderators AS SELECT * FROM civic_spaces.moderators;
CREATE OR REPLACE VIEW public.action_log AS SELECT * FROM civic_spaces.action_log;


-- ============================================================
-- 14. Grant permissions
-- ============================================================

GRANT ALL    ON civic_spaces.flags      TO authenticated;
GRANT ALL    ON civic_spaces.blocks     TO authenticated;
GRANT SELECT ON civic_spaces.moderators TO authenticated;
GRANT ALL    ON civic_spaces.action_log TO authenticated;

GRANT SELECT, INSERT        ON public.flags      TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.blocks    TO authenticated;
GRANT SELECT                ON public.moderators TO authenticated;
GRANT SELECT, INSERT        ON public.action_log TO authenticated;

GRANT EXECUTE ON FUNCTION civic_spaces.is_moderator() TO authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.is_blocked_by(text) TO authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_feed_filtered(uuid, integer, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_boosted_feed_filtered(uuid, integer, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_mod_queue(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.mod_action(text, uuid, text, text) TO authenticated;
