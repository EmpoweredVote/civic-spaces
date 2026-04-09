-- Add ui_theme preference to connected_profiles.
-- Default is 'dark' — matches the app default.
-- Users can update their own row via existing connected_profiles_update_own RLS policy.

ALTER TABLE civic_spaces.connected_profiles
  ADD COLUMN IF NOT EXISTS ui_theme TEXT NOT NULL DEFAULT 'dark'
    CHECK (ui_theme IN ('light', 'dark'));

COMMENT ON COLUMN civic_spaces.connected_profiles.ui_theme
  IS 'User preferred color scheme: light or dark. Default dark.';
