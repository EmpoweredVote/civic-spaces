-- Phase 8: Profile page RPC functions
-- Two SECURITY DEFINER functions for profile stats and mutual friends

-- ---------------------------------------------------------------------------
-- get_profile_stats(p_user_id text)
-- Returns aggregate stats for any user: post_count, reply_count, friend_count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION civic_spaces.get_profile_stats(p_user_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'post_count',   (
      SELECT COUNT(*)
      FROM civic_spaces.posts
      WHERE user_id = p_user_id
        AND is_deleted = false
    ),
    'reply_count',  (
      SELECT COUNT(*)
      FROM civic_spaces.replies
      WHERE user_id = p_user_id
        AND is_deleted = false
    ),
    'friend_count', (
      SELECT COUNT(*)
      FROM civic_spaces.friendships
      WHERE (user_low = p_user_id OR user_high = p_user_id)
        AND status = 'FRIEND'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.get_profile_stats(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_mutual_friends(p_subject_id text)
-- Returns TABLE of friends shared between the calling user and p_subject_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION civic_spaces.get_mutual_friends(p_subject_id text)
RETURNS TABLE(user_id text, display_name text, tier text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer_friends AS (
    SELECT
      CASE
        WHEN user_low  = civic_spaces.current_user_id() THEN user_high
        ELSE user_low
      END AS friend_id
    FROM civic_spaces.friendships
    WHERE (user_low = civic_spaces.current_user_id() OR user_high = civic_spaces.current_user_id())
      AND status = 'FRIEND'
  ),
  subject_friends AS (
    SELECT
      CASE
        WHEN user_low  = p_subject_id THEN user_high
        ELSE user_low
      END AS friend_id
    FROM civic_spaces.friendships
    WHERE (user_low = p_subject_id OR user_high = p_subject_id)
      AND status = 'FRIEND'
  )
  SELECT
    cp.user_id,
    cp.display_name,
    cp.tier
  FROM viewer_friends  vf
  JOIN subject_friends sf ON sf.friend_id = vf.friend_id
  JOIN civic_spaces.connected_profiles cp ON cp.user_id = vf.friend_id;
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.get_mutual_friends(text) TO authenticated;
