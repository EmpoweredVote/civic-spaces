-- =============================================================================
-- Civic Spaces: Triggers
-- Phase 01 Plan 02 - Task 2
-- Depends on: 20260327000001_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. enforce_slice_cap
-- BEFORE INSERT on slice_members.
-- Acquires a row-level FOR UPDATE lock on the slice to prevent races, then
-- checks the cap. If the slice already has 6000 members, raises 'slice_full'.
-- If under cap, increments current_member_count atomically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION civic_spaces.enforce_slice_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Lock the slice row to serialize concurrent inserts
    SELECT current_member_count
    INTO   v_count
    FROM   civic_spaces.slices
    WHERE  id = NEW.slice_id
    FOR UPDATE;

    IF v_count >= 6000 THEN
        RAISE EXCEPTION 'slice_full: slice % has reached the 6000 member cap', NEW.slice_id
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE civic_spaces.slices
    SET    current_member_count = current_member_count + 1
    WHERE  id = NEW.slice_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_slice_cap
    BEFORE INSERT ON civic_spaces.slice_members
    FOR EACH ROW
    EXECUTE FUNCTION civic_spaces.enforce_slice_cap();

-- ---------------------------------------------------------------------------
-- 2. decrement_slice_count
-- AFTER DELETE on slice_members.
-- Decrements current_member_count when a member leaves or is removed.
-- Uses GREATEST to guard against going below 0 (belt-and-suspenders).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION civic_spaces.decrement_slice_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE civic_spaces.slices
    SET    current_member_count = GREATEST(current_member_count - 1, 0)
    WHERE  id = OLD.slice_id;

    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_decrement_slice_count
    AFTER DELETE ON civic_spaces.slice_members
    FOR EACH ROW
    EXECUTE FUNCTION civic_spaces.decrement_slice_count();

-- ---------------------------------------------------------------------------
-- 3. set_updated_at
-- BEFORE UPDATE on connected_profiles, posts, and replies.
-- Keeps updated_at current without relying on application code.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION civic_spaces.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_connected_profiles_updated_at
    BEFORE UPDATE ON civic_spaces.connected_profiles
    FOR EACH ROW
    EXECUTE FUNCTION civic_spaces.set_updated_at();

CREATE TRIGGER trg_posts_updated_at
    BEFORE UPDATE ON civic_spaces.posts
    FOR EACH ROW
    EXECUTE FUNCTION civic_spaces.set_updated_at();

CREATE TRIGGER trg_replies_updated_at
    BEFORE UPDATE ON civic_spaces.replies
    FOR EACH ROW
    EXECUTE FUNCTION civic_spaces.set_updated_at();
