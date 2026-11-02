-- Phase 18-02: the grants, half one of two — members only. Nothing anonymous.
--
-- Order: 20261030000100 (functions, all revoked) -> THIS FILE -> 20261030000200 (anon).
--
-- WHY THIS FILE EXISTS, since the two halves used to be one.
--
-- 20261030000100 creates six SECURITY DEFINER functions and REVOKEs EXECUTE from
-- PUBLIC on every one of them immediately. After it, nobody but the owner can call
-- anything — including `authenticated`. That is correct and deliberate, but it means
-- the four RPCs cannot be exercised over HTTP at all until a grant lands, and the
-- only grant that existed also opened the door to `anon`.
--
-- So the one thing that most wanted proving before the irreversible step — that the
-- per-author projection (D-48, D-49) behaves over PostgREST exactly as it does in
-- SQL — could only be tested AFTER anon could already read. check:anon-read section 4
-- exists precisely to test it, and had never run.
--
-- This file is the seam. After it:
--   * `authenticated` holds EXECUTE on the four public RPCs.
--   * `anon` holds nothing. It still cannot resolve schema civic_spaces at all;
--     a probe gets 42501 "permission denied for schema", verified live 2026-11-01.
-- which is a state where section 4's four JWT viewers run over real HTTP and the
-- public door is still shut.
--
-- 🔴 DISCLOSURE DELTA OF THIS FILE: close to nothing, and reversible in four
-- statements. A signed-in member can already read every post these RPCs return
-- through the member path — RLS grants SELECT on their own slices and, since
-- 20260917000000, on every sibling slice of a jurisdiction they belong to. The RPCs
-- return a NARROWER projection than that path does (no edit_history, no is_deleted,
-- no account_standing, no tier, no current_member_count — D-34). The one genuine
-- widening is reach: a member may now read a PUBLIC slice of a jurisdiction they do
-- not belong to, which RLS does not permit them today. That is a strict subset of
-- what 20261030000200 grants the whole internet minutes later, and
-- `REVOKE EXECUTE ... FROM authenticated` takes it back whole.
--
-- 🔴 NO `GRANT USAGE ON SCHEMA` HERE. `authenticated` already holds USAGE on
-- civic_spaces — it is how 49 `.schema('civic_spaces')` calls work today. This file
-- therefore grants schema resolution to nobody who lacks it, which is the property
-- that makes it safe to apply ahead of the real decision. D-43's hazard ("anon now
-- RESOLVES the schema") belongs to 20261030000200 and stays there.
--
-- 🔴 NO REVOKE HERE. The PUBLIC revokes live in 20261030000100, beside each
-- CREATE FUNCTION, for the reason that file explains: an un-revoked SECURITY DEFINER
-- function is callable by any signed-in member the moment it exists, RLS-bypassing,
-- which would have made public_author_is_visible a membership/friendship oracle.
--
-- The two internal helpers — public_author_is_visible, public_author_is_blocked —
-- are NOT granted here and must never be. They stay owner-only. Granting either to
-- `authenticated` would hand every signed-in member an RLS-bypassing
-- "are A and B friends?" oracle, which is the whole reason they were revoked.

GRANT EXECUTE ON FUNCTION civic_spaces.get_public_slice(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_feed(text, text, integer, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.get_public_replies(uuid, integer, timestamptz, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
