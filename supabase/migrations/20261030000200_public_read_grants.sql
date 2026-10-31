-- Phase 18-02: the grants. The privilege delta, and nothing else.
--
-- 20261030000100_public_read.sql defines six SECURITY DEFINER functions and REVOKEs
-- EXECUTE from PUBLIC on every one of them, each right after its own CREATE FUNCTION:
-- after that file alone, nobody but the owner can call any of them, and anon still
-- cannot resolve the schema. THIS file is the only thing that opens the door, and it is
-- short enough to read in one glance. So the functions can be reviewed, rehearsed and
-- applied with the door genuinely shut, and this is the single step that changes what
-- anon can do.
--
-- 🔴 The REVOKEs live in 20261030000100 and NOT here, because `authenticated` already
-- holds USAGE on schema civic_spaces and already reaches /rest/v1/rpc/*. A SECURITY
-- DEFINER function left at Postgres's default EXECUTE-to-PUBLIC is therefore callable
-- by any signed-in member from the moment it is created, RLS-bypassing. Had the REVOKEs
-- waited for this file, the window between the two migrations would have exposed
-- public_author_is_visible as a friendship / membership oracle. This file contains no
-- REVOKE at all: GRANT USAGE, four GRANT EXECUTE, NOTIFY.
--
-- Reversible in five statements (see 18-02-APPLY.md). The PUBLIC defaults stay revoked
-- afterwards, so rolling back lands tighter than before. What is NOT reversible is
-- DISCLOSURE: whatever the RPCs project, and anything read through a cache, cannot be
-- taken back. The caution belongs on what the RPCs return, not on this file.
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
-- authenticated KEEPS EXECUTE on the four. 18-03 calls them for signed-in members
-- too (a member calling the public RPC gets the wide projection for their own
-- slices, via current_user_id()).
--
-- 🔴 Targeted by name on purpose. NO `REVOKE ... ON ALL FUNCTIONS IN SCHEMA`:
-- civic_spaces.current_user_id() has PUBLIC as its only grant and sits inside 21
-- RLS policies. Revoking it would break reads for every signed-in member.
--
-- 🔴 Standing hazard: any SECURITY DEFINER function added to civic_spaces from now
-- on is anon-callable the moment it is created, unless it revokes PUBLIC itself.
-- check:anon-read asserts the anon-executable DEFINER set equals the four below.

GRANT USAGE ON SCHEMA civic_spaces TO anon;

GRANT EXECUTE ON FUNCTION civic_spaces.get_public_slice(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_feed(text, text, integer, timestamptz, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_post(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_replies(uuid, integer, timestamptz, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
