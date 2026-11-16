-- Phase 19-01 follow-up: a split must not notify anybody.
--
-- `reply_notification` fires AFTER INSERT on EVERY row that lands in
-- civic_spaces.replies, and split_slice()'s seed copy lands thousands of them at
-- once. A copy deliberately keeps the original byline (see posts.forked_from),
-- so the copied post's owner IS the original author — and notify_on_reply duly
-- told them they had new replies.
--
-- They did not. Those are forks of a conversation that already happened, days
-- ago, in another slice, usually already read and already answered. And because
-- reference_id is the COPY's post id, following the notification took them into
-- a slice they may not be a member of, where the thread resolver returns
-- `unavailable` (useNotificationRouting) — a notification that cannot be opened.
--
-- Measured on a 6000-member split of a busy jurisdiction (19-01-SPLIT-TIMING.md,
-- PR #144): 2,800 notification rows from one split. One per seeded post, to its
-- author, with event_count counting the copied replies underneath it. So the
-- moment a town divided, every member who had posted in the past fortnight was
-- told, all at once, about replies that were not new. Issue #145.
--
-- 🔴 THE GUARD IS forked_from, NOT A SESSION FLAG. The obvious fix — and the one
-- the issue proposed — is a transaction-local GUC that split_slice sets around
-- the seed and the trigger reads. forked_from is strictly better and it is
-- already here:
--
--   * It is a FACT ABOUT THE ROW, not about who inserted it. A GUC protects the
--     one caller that remembers to set it; any future path that copies replies
--     (a backfill, a repair script, a redistribution in a later phase) gets this
--     for free and would have had to re-learn the GUC.
--   * It cannot leak. A GUC left set — by an exception between set and reset, or
--     by a pooled session handed on — silently suppresses REAL notifications for
--     everything that follows, and the symptom is users quietly not being told
--     about replies, which nobody reports as a bug.
--   * NULL already MEANS "written in place". That is not a convenience reading;
--     it is the stated contract on the column, which is why its FK is ON DELETE
--     NO ACTION rather than SET NULL (20261102000000). has_written_in_thread and
--     posts_update_own already test it to decide standing. A notification is a
--     claim that somebody said something to you here — the same question.
--
-- What is deliberately NOT changed here: `trg_reply_count`. It is another ~34%
-- of a split's runtime and it is what restamps updated_at on seeded posts (the
-- S6b wart), but suppressing it means split_slice must maintain posts.reply_count
-- itself, and getting that wrong opens every seeded thread reading "0 replies"
-- while containing them. That is a performance change with a correctness risk,
-- it belongs with the scheduling work in ev-accounts#1281, and it is not this.
-- This file fixes a bug.
--
-- The body below is the deployed function (verified against production's prosrc
-- on 2026-11-02 — identical modulo comments and line wrapping) plus the four new
-- lines after BEGIN. Nothing else is touched.

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
  -- 🔴 A FORKED REPLY NOTIFIES NOBODY. It is an archival copy of words that were
  -- already said, already delivered and already notified about in the parent
  -- slice. See the header.
  IF NEW.forked_from IS NOT NULL THEN
    RETURN NEW;
  END IF;

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

-- 🔴 Restated, not newly imposed. CREATE OR REPLACE KEEPS the existing ACL, and
-- this function's is already `postgres=X/postgres, service_role=X/postgres` —
-- verified live before writing this. But the rule in CLAUDE.md is that a
-- SECURITY DEFINER function in this schema carries its own revoke beside its own
-- CREATE, because since Phase 18 `anon` resolves civic_spaces and Postgres's
-- default is EXECUTE TO PUBLIC. A reader should not have to go and check the
-- catalog to know this one is shut, and `check:anon-read` 3a asserts the
-- anon-executable DEFINER set is exactly the four public RPCs.
--
-- Revoking from `authenticated` does not stop the trigger: Postgres checks
-- EXECUTE on a trigger function at CREATE TRIGGER time, not on each fire. The
-- live proof is that members have been replying all along under exactly this
-- ACL.
REVOKE ALL ON FUNCTION civic_spaces.notify_on_reply() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION civic_spaces.notify_on_reply() IS
  'Notifies the post owner, and the parent reply owner, when a reply is written. Returns early on a FORKED reply (forked_from IS NOT NULL): those are archival copies made by split_slice() to seed a new slice, they keep the original byline, and notifying their author would announce replies that are not new and link to a post in a slice they may not belong to. See 20261102000300 and issue #145.';

NOTIFY pgrst, 'reload schema';
