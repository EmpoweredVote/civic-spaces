-- Phase 10: Seed Bloomington pilot hero photos
-- ============================================================================
-- SETUP REQUIRED before running this migration:
--
--   1. Run the upload script to push photos to Supabase Storage:
--
--      SUPABASE_URL=https://<project-ref>.supabase.co \
--      SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
--      npx tsx scripts/upload-bloomington-photos.ts
--
--   2. Copy the SQL UPDATE statements printed by the script (they look like:
--      UPDATE civic_spaces.slices SET photo_url = 'https://...' WHERE ...;)
--      and replace the REPLACE_WITH_CDN_URL_FROM_UPLOAD_SCRIPT placeholders below.
--
--   3. Run: npx supabase db reset
--
-- CDN URL format (predictable once you know your project ref):
--   https://<project-ref>.supabase.co/storage/v1/object/public/slice-photos/bloomington/<filename>.jpg
-- ============================================================================

-- Federal slice: White House photo (IN-07 Congressional District)
UPDATE civic_spaces.slices
  SET photo_url = 'REPLACE_WITH_CDN_URL_FROM_UPLOAD_SCRIPT'
  WHERE geoid = '1807' AND slice_type = 'federal';

-- State slice: Indiana State Capitol photo (IN State Senate District 46)
UPDATE civic_spaces.slices
  SET photo_url = 'REPLACE_WITH_CDN_URL_FROM_UPLOAD_SCRIPT'
  WHERE geoid = '18046' AND slice_type = 'state';

-- Local slice: Monroe County Courthouse photo (Monroe County, IN)
UPDATE civic_spaces.slices
  SET photo_url = 'REPLACE_WITH_CDN_URL_FROM_UPLOAD_SCRIPT'
  WHERE geoid = '18097' AND slice_type = 'local';
