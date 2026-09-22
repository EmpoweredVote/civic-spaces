-- Create civic_spaces schema
CREATE SCHEMA IF NOT EXISTS civic_spaces;

-- Helper function: resolves current user from external JWT
CREATE OR REPLACE FUNCTION civic_spaces.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() ->> 'sub';
$$;

-- Grant usage on schema to authenticated role
GRANT USAGE ON SCHEMA civic_spaces TO authenticated;
