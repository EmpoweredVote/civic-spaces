-- Phase 18-02: the grants. THE ONE-WAY DOOR.
--
-- 20261030000100_public_read.sql defines four SECURITY DEFINER RPCs. They are
-- inert to anon until THIS file runs: anon has no USAGE on schema civic_spaces,
-- so it cannot even resolve them. This file is kept separate so the functions can
-- be reviewed, rehearsed and applied with the door shut, and so what opens it is
-- short enough to read in one glance.
--
-- After this file, anon holds exactly:
--   * USAGE on schema civic_spaces
--   * EXECUTE on get_public_slice, get_public_feed, get_public_post,
--     get_public_replies
-- and NOTHING else. No GRANT SELECT on any table, view, column or sequence. Ever.
--
-- 🔴 D-43: anon now RESOLVES the civic_spaces schema. Every table in it is one
-- stray `GRANT SELECT` (or one future migration that grants broadly) away from
-- being world-readable. check:anon-read (18-02 Task 6) is what stands between.
-- Before this file the schema was invisible to anon ("schema does not exist");
-- after it, a table read fails with "permission denied for table" instead. Both
-- refuse. Expect the second in logs.
--
-- 🔴 NOT GRANTED IS NOT THE SAME AS NOT CALLABLE. Postgres grants EXECUTE on every
-- new function to PUBLIC by default, so every function in this schema is already
-- anon-executable and the only thing stopping it today is the missing schema
-- USAGE -- the very thing granted below. The pre-existing functions are all
-- SECURITY INVOKER and fail closed on table rights. The new ones are SECURITY
-- DEFINER and do not. So:
--
--   public_author_is_visible(text, text, uuid) is an internal helper, SECURITY
--   DEFINER, that answers "are X and Y friends?" and "is X a member of slice S?".
--   Left at the default, anyone could call it with chosen arguments and probe
--   friendships and memberships one pair at a time. It is therefore REVOKED from
--   PUBLIC, anon and authenticated, not merely ungranted. The RPCs still call it:
--   they run as the function owner, who keeps EXECUTE.
--
-- The four public RPCs are revoked from PUBLIC first, then granted explicitly:
-- an allowlist, not a reliance on the default.
--
-- authenticated KEEPS EXECUTE on the four. 18-03 calls them for signed-in members
-- too (a member calling the public RPC gets the wide projection for their own
-- slices, via current_user_id()), and authenticated reaches them today only via
-- the PUBLIC default we are removing.
--
-- 🔴 Targeted by name on purpose. NO `REVOKE ... ON ALL FUNCTIONS IN SCHEMA`:
-- civic_spaces.current_user_id() has PUBLIC as its only grant and sits inside 21
-- RLS policies. Revoking it would break reads for every signed-in member.
--
-- 🔴 Standing hazard: any SECURITY DEFINER function added to civic_spaces from now
-- on is anon-callable the moment it is created, unless it revokes PUBLIC itself.
-- check:anon-read asserts the anon-executable DEFINER set equals the four below.

-- The internal helper: no one but its owner.
REVOKE ALL ON FUNCTION civic_spaces.public_author_is_visible(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- The four RPCs: strip the PUBLIC default, then grant explicitly.
REVOKE ALL ON FUNCTION civic_spaces.get_public_slice(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_spaces.get_public_feed(text, text, integer, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_spaces.get_public_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION civic_spaces.get_public_replies(uuid, integer, timestamptz, uuid) FROM PUBLIC;

GRANT USAGE ON SCHEMA civic_spaces TO anon;

GRANT EXECUTE ON FUNCTION civic_spaces.get_public_slice(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_feed(text, text, integer, timestamptz, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_post(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_replies(uuid, integer, timestamptz, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
