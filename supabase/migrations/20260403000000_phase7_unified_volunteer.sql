-- Phase 7: New Slice Types
-- Extends the slice_type CHECK constraint to allow 'unified' and 'volunteer'
-- No new RLS policies needed — existing membership-based policies are type-agnostic
-- (confirmed: get_boosted_feed_filtered uses SECURITY INVOKER, posts_select_slice_member gates by slice_id membership)

ALTER TABLE civic_spaces.slices
  DROP CONSTRAINT slices_slice_type_check;

ALTER TABLE civic_spaces.slices
  ADD CONSTRAINT slices_slice_type_check
  CHECK (slice_type IN ('federal', 'state', 'local', 'neighborhood', 'unified', 'volunteer'));

NOTIFY pgrst, 'reload schema';
