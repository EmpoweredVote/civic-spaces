-- Phase 2 schema additions
-- Adds columns required by Phase 2 UI that were not in the original schema

-- connected_profiles: avatar_url for PostCard author display
ALTER TABLE civic_spaces.connected_profiles
  ADD COLUMN avatar_url text;

-- connected_profiles: tier for Inform-tier gating
ALTER TABLE civic_spaces.connected_profiles
  ADD COLUMN tier text NOT NULL DEFAULT 'connected'
  CHECK (tier IN ('connected', 'inform'));

-- connected_profiles: is_suspended as generated column for convenience
ALTER TABLE civic_spaces.connected_profiles
  ADD COLUMN is_suspended boolean GENERATED ALWAYS AS (account_standing = 'suspended') STORED;

-- posts: edit_history for FEED-08 internal edit history retention
ALTER TABLE civic_spaces.posts
  ADD COLUMN edit_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- posts: reply_count for PostCard display (trigger-maintained)
ALTER TABLE civic_spaces.posts
  ADD COLUMN reply_count integer NOT NULL DEFAULT 0;

-- Trigger to maintain reply_count on posts
CREATE OR REPLACE FUNCTION civic_spaces.update_reply_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_spaces.posts
    SET reply_count = reply_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_spaces.posts
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reply_count
  AFTER INSERT OR DELETE ON civic_spaces.replies
  FOR EACH ROW
  EXECUTE FUNCTION civic_spaces.update_reply_count();

-- Edit window enforcement trigger (1 hour)
CREATE OR REPLACE FUNCTION civic_spaces.enforce_edit_window()
RETURNS trigger AS $$
BEGIN
  -- Only enforce on body changes (allow is_deleted updates anytime)
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    IF OLD.created_at < now() - interval '1 hour' THEN
      RAISE EXCEPTION 'edit_window_expired' USING HINT = 'Posts can only be edited within 1 hour of creation';
    END IF;
    -- Append old body to edit_history
    NEW.edit_history = OLD.edit_history || jsonb_build_array(jsonb_build_object(
      'body', OLD.body,
      'edited_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ));
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_edit_window
  BEFORE UPDATE ON civic_spaces.posts
  FOR EACH ROW
  EXECUTE FUNCTION civic_spaces.enforce_edit_window();

-- Realtime publication for live feed updates
ALTER PUBLICATION supabase_realtime ADD TABLE civic_spaces.posts;
