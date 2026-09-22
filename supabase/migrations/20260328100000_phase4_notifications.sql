-- ============================================================
-- Phase 4: Notifications
-- Migration: 20260328100000_phase4_notifications.sql
-- ============================================================
-- All trigger functions use NEW.* row data (never auth functions).
-- RLS policies use (SELECT auth.jwt() ->> 'sub') subquery wrapping.
-- Grouping: same recipient + event_type + reference_id + same day + unread = upsert.
-- ============================================================


-- ============================================================
-- 1. Notifications table
-- ============================================================
CREATE TABLE civic_spaces.notifications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id     text        NOT NULL,
  event_type       text        NOT NULL
                               CHECK (event_type IN ('reply', 'friend_request', 'friend_accepted')),
  actor_id         text        NOT NULL,
  actor_ids        text[]      NOT NULL DEFAULT '{}',
  reference_id     text        NOT NULL,
  reference_excerpt text,
  event_count      integer     NOT NULL DEFAULT 1,
  is_read          boolean     NOT NULL DEFAULT false,
  group_window     date        NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Main query path index
CREATE INDEX idx_notifications_recipient_read_updated
  ON civic_spaces.notifications (recipient_id, is_read, updated_at DESC);

-- Grouping index: unique unread notification per (recipient, type, reference, day)
CREATE UNIQUE INDEX notifications_group_idx
  ON civic_spaces.notifications (recipient_id, event_type, reference_id, group_window)
  WHERE is_read = false;


-- ============================================================
-- 2. RLS on notifications
-- ============================================================
ALTER TABLE civic_spaces.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: user may only read their own notifications
CREATE POLICY notifications_select_own ON civic_spaces.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = (SELECT auth.jwt() ->> 'sub'));

-- UPDATE: user may only mark their own notifications as read
CREATE POLICY notifications_update_own ON civic_spaces.notifications
  FOR UPDATE
  TO authenticated
  USING     (recipient_id = (SELECT auth.jwt() ->> 'sub'))
  WITH CHECK (recipient_id = (SELECT auth.jwt() ->> 'sub'));

-- No INSERT or DELETE from client — triggers handle inserts


-- ============================================================
-- 3. Trigger function: notify_on_reply
-- AFTER INSERT ON civic_spaces.replies
-- ============================================================
CREATE OR REPLACE FUNCTION civic_spaces.notify_on_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_owner   text;
  v_reply_owner  text;
  v_excerpt      text;
BEGIN
  -- Look up post owner
  SELECT user_id INTO v_post_owner
  FROM civic_spaces.posts
  WHERE id = NEW.post_id
    AND NOT is_deleted;

  -- Look up parent reply owner (if this is a nested reply)
  IF NEW.parent_reply_id IS NOT NULL THEN
    SELECT user_id INTO v_reply_owner
    FROM civic_spaces.replies
    WHERE id = NEW.parent_reply_id;
  END IF;

  -- Get post body excerpt for denormalization
  SELECT LEFT(body, 50) INTO v_excerpt
  FROM civic_spaces.posts
  WHERE id = NEW.post_id;

  -- Notify post owner (skip self-notification)
  IF v_post_owner IS NOT NULL AND v_post_owner <> NEW.user_id THEN
    INSERT INTO civic_spaces.notifications (
      recipient_id,
      event_type,
      actor_id,
      actor_ids,
      reference_id,
      reference_excerpt,
      event_count,
      is_read,
      group_window
    ) VALUES (
      v_post_owner,
      'reply',
      NEW.user_id,
      ARRAY[NEW.user_id],
      NEW.post_id::text,
      v_excerpt,
      1,
      false,
      CURRENT_DATE
    )
    ON CONFLICT (recipient_id, event_type, reference_id, group_window)
    WHERE is_read = false
    DO UPDATE SET
      actor_ids   = CASE
                      WHEN NEW.user_id = ANY(civic_spaces.notifications.actor_ids)
                      THEN civic_spaces.notifications.actor_ids
                      ELSE array_append(civic_spaces.notifications.actor_ids, NEW.user_id)
                    END,
      event_count = civic_spaces.notifications.event_count + 1,
      updated_at  = now();
  END IF;

  -- Notify reply owner if different from post owner and different from new replier
  IF v_reply_owner IS NOT NULL
     AND v_reply_owner <> NEW.user_id
     AND v_reply_owner <> v_post_owner
  THEN
    INSERT INTO civic_spaces.notifications (
      recipient_id,
      event_type,
      actor_id,
      actor_ids,
      reference_id,
      reference_excerpt,
      event_count,
      is_read,
      group_window
    ) VALUES (
      v_reply_owner,
      'reply',
      NEW.user_id,
      ARRAY[NEW.user_id],
      NEW.post_id::text,
      v_excerpt,
      1,
      false,
      CURRENT_DATE
    )
    ON CONFLICT (recipient_id, event_type, reference_id, group_window)
    WHERE is_read = false
    DO UPDATE SET
      actor_ids   = CASE
                      WHEN NEW.user_id = ANY(civic_spaces.notifications.actor_ids)
                      THEN civic_spaces.notifications.actor_ids
                      ELSE array_append(civic_spaces.notifications.actor_ids, NEW.user_id)
                    END,
      event_count = civic_spaces.notifications.event_count + 1,
      updated_at  = now();
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 4. Trigger function: notify_on_friendship_change
-- AFTER INSERT OR UPDATE ON civic_spaces.friendships
-- ============================================================
CREATE OR REPLACE FUNCTION civic_spaces.notify_on_friendship_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient text;
  v_actor     text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Friend request sent
    IF NEW.status = 'REQ_LOW' THEN
      -- user_low sent the request to user_high
      v_recipient := NEW.user_high;
      v_actor     := NEW.user_low;
    ELSIF NEW.status = 'REQ_HIGH' THEN
      -- user_high sent the request to user_low
      v_recipient := NEW.user_low;
      v_actor     := NEW.user_high;
    ELSE
      -- Direct FRIEND insert (unlikely but guard against it)
      RETURN NEW;
    END IF;

    INSERT INTO civic_spaces.notifications (
      recipient_id,
      event_type,
      actor_id,
      actor_ids,
      reference_id,
      reference_excerpt,
      event_count,
      is_read,
      group_window
    ) VALUES (
      v_recipient,
      'friend_request',
      v_actor,
      ARRAY[v_actor],
      v_actor,
      NULL,
      1,
      false,
      CURRENT_DATE
    )
    ON CONFLICT (recipient_id, event_type, reference_id, group_window)
    WHERE is_read = false
    DO UPDATE SET
      actor_ids   = CASE
                      WHEN v_actor = ANY(civic_spaces.notifications.actor_ids)
                      THEN civic_spaces.notifications.actor_ids
                      ELSE array_append(civic_spaces.notifications.actor_ids, v_actor)
                    END,
      event_count = civic_spaces.notifications.event_count + 1,
      updated_at  = now();

  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'FRIEND' AND OLD.status <> 'FRIEND' THEN
    -- Friendship accepted
    IF OLD.status = 'REQ_LOW' THEN
      -- user_low sent, user_high accepted → notify user_low (original requester)
      v_recipient := NEW.user_low;
      v_actor     := NEW.user_high;
    ELSIF OLD.status = 'REQ_HIGH' THEN
      -- user_high sent, user_low accepted → notify user_high (original requester)
      v_recipient := NEW.user_high;
      v_actor     := NEW.user_low;
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO civic_spaces.notifications (
      recipient_id,
      event_type,
      actor_id,
      actor_ids,
      reference_id,
      reference_excerpt,
      event_count,
      is_read,
      group_window
    ) VALUES (
      v_recipient,
      'friend_accepted',
      v_actor,
      ARRAY[v_actor],
      v_actor,
      NULL,
      1,
      false,
      CURRENT_DATE
    )
    ON CONFLICT (recipient_id, event_type, reference_id, group_window)
    WHERE is_read = false
    DO UPDATE SET
      actor_ids   = CASE
                      WHEN v_actor = ANY(civic_spaces.notifications.actor_ids)
                      THEN civic_spaces.notifications.actor_ids
                      ELSE array_append(civic_spaces.notifications.actor_ids, v_actor)
                    END,
      event_count = civic_spaces.notifications.event_count + 1,
      updated_at  = now();
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 5. Create triggers
-- ============================================================
CREATE TRIGGER reply_notification
  AFTER INSERT ON civic_spaces.replies
  FOR EACH ROW EXECUTE FUNCTION civic_spaces.notify_on_reply();

CREATE TRIGGER friendship_notification
  AFTER INSERT OR UPDATE ON civic_spaces.friendships
  FOR EACH ROW EXECUTE FUNCTION civic_spaces.notify_on_friendship_change();


-- ============================================================
-- 6. Public schema view (PostgREST access)
-- ============================================================
CREATE OR REPLACE VIEW public.civic_notifications AS
  SELECT * FROM civic_spaces.notifications;

GRANT SELECT, UPDATE ON public.civic_notifications TO authenticated;


-- ============================================================
-- 7. Realtime publication (required for private schema tables)
-- ============================================================
GRANT SELECT ON civic_spaces.notifications TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE civic_spaces.notifications;
