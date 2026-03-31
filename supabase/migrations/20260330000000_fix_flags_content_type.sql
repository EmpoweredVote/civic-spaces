-- ============================================================
-- Fix: flags table content_type (Bug 1)
-- Replaces post_id uuid FK with content_id text + content_type,
-- so replies can be flagged alongside posts.
-- Also updates get_mod_queue and mod_action RPCs accordingly,
-- and removes the broken dead get_boosted_feed RPC (Bug 4).
-- ============================================================


-- ============================================================
-- 1. Migrate flags table
-- ============================================================

-- Add new columns (nullable initially for backfill)
ALTER TABLE civic_spaces.flags
  ADD COLUMN content_id   text,
  ADD COLUMN content_type text;

-- Backfill from existing post_id rows
UPDATE civic_spaces.flags
SET content_id   = post_id::text,
    content_type = 'post';

-- Apply NOT NULL + CHECK
ALTER TABLE civic_spaces.flags
  ALTER COLUMN content_id   SET NOT NULL,
  ALTER COLUMN content_type SET NOT NULL,
  ADD CONSTRAINT flags_content_type_check
    CHECK (content_type IN ('post', 'reply'));

-- Drop view that depends on post_id, then drop the column
DROP VIEW IF EXISTS public.flags;
ALTER TABLE civic_spaces.flags
  DROP CONSTRAINT flags_unique_reporter_post,
  DROP COLUMN post_id;

-- New unique constraint
ALTER TABLE civic_spaces.flags
  ADD CONSTRAINT flags_unique_reporter_content
    UNIQUE (reporter_id, content_id);


-- ============================================================
-- 2. Extend action_log target_type to include 'reply'
-- ============================================================

ALTER TABLE civic_spaces.action_log
  DROP CONSTRAINT action_log_target_type_check;
ALTER TABLE civic_spaces.action_log
  ADD CONSTRAINT action_log_target_type_check
    CHECK (target_type IN ('post', 'reply', 'user'));


-- ============================================================
-- 3. Recreate public.flags view (SELECT * doesn't auto-update)
-- ============================================================

CREATE OR REPLACE VIEW public.flags AS SELECT * FROM civic_spaces.flags;


-- ============================================================
-- 4. get_mod_queue: drop and recreate with content_id/content_type
-- ============================================================

DROP FUNCTION IF EXISTS civic_spaces.get_mod_queue(text, text);

CREATE OR REPLACE FUNCTION civic_spaces.get_mod_queue(
  p_status   text DEFAULT 'pending',
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  content_id       text,
  content_type     text,
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
    WITH content AS (
      SELECT id::text AS cid, 'post'::text AS ctype, body, title, user_id AS author_id, created_at
        FROM civic_spaces.posts  WHERE NOT is_deleted
      UNION ALL
      SELECT id::text AS cid, 'reply'::text AS ctype, body, NULL::text AS title, user_id AS author_id, created_at
        FROM civic_spaces.replies WHERE NOT is_deleted
    )
    SELECT
      f.content_id,
      f.content_type,
      c.body,
      c.title,
      c.author_id,
      c.created_at        AS post_created_at,
      COUNT(f.id)         AS flag_count,
      ARRAY_AGG(DISTINCT f.category) AS flag_categories,
      MIN(f.created_at)   AS first_flagged_at,
      CASE WHEN COUNT(f.id) >= 5 THEN 'high'::text ELSE 'normal'::text END AS priority
    FROM civic_spaces.flags f
    JOIN content c ON c.cid = f.content_id AND c.ctype = f.content_type
    WHERE f.status = p_status
      AND (p_category IS NULL OR f.category = p_category)
    GROUP BY f.content_id, f.content_type, c.body, c.title, c.author_id, c.created_at
    ORDER BY
      CASE WHEN COUNT(f.id) >= 5 THEN 0 ELSE 1 END,
      MIN(f.created_at) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.get_mod_queue(text, text) TO authenticated;


-- ============================================================
-- 5. mod_action: drop old signature, recreate with content_id/content_type
-- ============================================================

DROP FUNCTION IF EXISTS civic_spaces.mod_action(text, uuid, text, text);

CREATE OR REPLACE FUNCTION civic_spaces.mod_action(
  p_action       text,
  p_content_id   text DEFAULT NULL,
  p_content_type text DEFAULT 'post',
  p_user_id      text DEFAULT NULL,
  p_notes        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_flag_ids  uuid[];
  v_mod_id    text := civic_spaces.current_user_id();
  v_author_id text;
BEGIN
  IF NOT civic_spaces.is_moderator() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Collect pending flag IDs for this content
  IF p_content_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_flag_ids
    FROM civic_spaces.flags
    WHERE content_id = p_content_id AND status = 'pending';
  END IF;

  -- Resolve author if not provided (needed for warn/suspend)
  IF p_content_id IS NOT NULL THEN
    IF p_content_type = 'reply' THEN
      SELECT user_id INTO v_author_id FROM civic_spaces.replies WHERE id = p_content_id::uuid;
    ELSE
      SELECT user_id INTO v_author_id FROM civic_spaces.posts   WHERE id = p_content_id::uuid;
    END IF;
  END IF;

  CASE p_action
    WHEN 'remove' THEN
      IF p_content_type = 'reply' THEN
        UPDATE civic_spaces.replies SET is_deleted = true WHERE id = p_content_id::uuid;
      ELSE
        UPDATE civic_spaces.posts   SET is_deleted = true WHERE id = p_content_id::uuid;
      END IF;
      UPDATE civic_spaces.flags SET status = 'resolved'
        WHERE content_id = p_content_id AND status = 'pending';

    WHEN 'dismiss' THEN
      UPDATE civic_spaces.flags SET status = 'dismissed'
        WHERE content_id = p_content_id AND status = 'pending';

    WHEN 'warn' THEN
      PERFORM civic_spaces.send_warn_notification(v_author_id, p_content_id);
      UPDATE civic_spaces.flags SET status = 'resolved'
        WHERE content_id = p_content_id AND status = 'pending';

    WHEN 'suspend' THEN
      UPDATE civic_spaces.connected_profiles
        SET account_standing = 'suspended'
        WHERE user_id = COALESCE(p_user_id, v_author_id);
      IF p_content_id IS NOT NULL THEN
        UPDATE civic_spaces.flags SET status = 'resolved'
          WHERE content_id = p_content_id AND status = 'pending';
      END IF;
  END CASE;

  INSERT INTO civic_spaces.action_log (moderator_id, action, target_type, target_id, flag_ids, notes)
  VALUES (
    v_mod_id,
    p_action,
    CASE
      WHEN p_action = 'suspend' THEN 'user'
      WHEN p_content_type = 'reply' THEN 'reply'
      ELSE 'post'
    END,
    CASE
      WHEN p_action = 'suspend' AND p_user_id IS NOT NULL THEN p_user_id
      WHEN p_content_id IS NOT NULL THEN p_content_id
      ELSE ''
    END,
    COALESCE(v_flag_ids, '{}'),
    p_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.mod_action(text, text, text, text, text) TO authenticated;


-- ============================================================
-- 6. Drop broken dead get_boosted_feed RPC (Bug 4)
-- Superseded by get_boosted_feed_filtered in Phase 5.
-- ============================================================

DROP FUNCTION IF EXISTS civic_spaces.get_boosted_feed(uuid, integer, timestamptz, uuid);
