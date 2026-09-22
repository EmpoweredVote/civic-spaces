-- Phase 10: Storage bucket for slice hero photos + photo_url column on slices
-- ============================================================================

-- Section 1: Create the slice-photos Storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('slice-photos', 'slice-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Section 2: RLS policy for public reads on storage objects
-- NOTE: public=true on the bucket is NOT sufficient — an explicit SELECT policy
-- is required or public reads return 403.
CREATE POLICY "slice_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'slice-photos');

-- Section 3: Add nullable photo_url column to civic_spaces.slices
ALTER TABLE civic_spaces.slices
  ADD COLUMN photo_url text;

COMMENT ON COLUMN civic_spaces.slices.photo_url
  IS 'CDN URL for jurisdiction-specific hero photo; NULL = use type-default from sliceCopy.ts';
