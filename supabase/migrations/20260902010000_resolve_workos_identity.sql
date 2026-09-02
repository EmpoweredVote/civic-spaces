-- Resolve the caller's INTERNAL user id, whichever issuer minted their token.
--
-- 🔴 WHAT BROKE. The accounts platform cut over to WorkOS AuthKit-only login on
-- 2026-08-28 (ev-accounts #209 / #214, decision 0002). The API now accepts tokens from two
-- issuers, and they name the same person differently -- from ev-accounts
-- backend/src/lib/tokenIdentity.ts:
--
--     Supabase `sub` is the internal UUID; WorkOS `sub` is a WorkOS id (`user_01…`).
--
-- A WorkOS token carries the internal UUID in `external_id`, populated by the migration
-- import from the user's original Supabase auth.users id and copied into the access token
-- by the WorkOS JWT template.
--
-- This function read `sub` unconditionally, so for a WorkOS-issued member it returned
-- `user_01M…` and compared it against slice_members.user_id, which holds UUIDs. Nothing
-- matched. Twenty-one policies across nine tables funnel through here, so every one of
-- them silently returned zero rows: the member landed on "Setting up your civic spaces…"
-- forever, because an empty membership list is indistinguishable from a new account.
--
-- Observed 2026-09-02 with a live WorkOS token: iss api.workos.com, not expired,
-- role authenticated, external_id present, and the frontend querying
-- `user_id=eq.user_01M14T3W1R72ZQM70KRXH4K5E8` -- an id that appears nowhere in the schema.
--
-- ⚠ SECURITY NOTE, because this is an auth boundary. Honouring `external_id` means RLS
-- trusts a claim to name the internal user. That is safe only because WorkOS mints the
-- claim from `user.external_id`, which the account holder cannot set. If that ever stops
-- being true, one member can read another's rows by forging the claim. The stricter
-- alternative -- honour `external_id` only when `iss` is the WorkOS issuer -- was
-- considered and rejected for now: it hardcodes an issuer string in the database and
-- breaks under the custom-auth-domain override that tokenIdentity.ts provides for.
-- Revisit if a third issuer is ever added, or if any non-first-party issuer becomes
-- trusted.
--
-- Fail-closed by construction: an UNLINKED WorkOS account (created outside the import, so
-- no external_id) falls through to its WorkOS `sub`, which matches no stored row. Such a
-- member sees nothing rather than someone else's data.
--
-- This is additive. A Supabase-issued token has no external_id claim and resolves through
-- the same `sub` path it always did, so the five existing UUID members are unaffected.

CREATE OR REPLACE FUNCTION civic_spaces.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'civic_spaces'
AS $function$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'external_id', ''),
    auth.jwt() ->> 'sub'
  );
$function$;

DO $verify$
DECLARE
  v_got text;
BEGIN
  -- A Supabase-issued token: sub IS the internal id, no external_id claim.
  PERFORM set_config('request.jwt.claims',
    '{"iss":"https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1",'
    || '"sub":"4e6dde8f-2bd0-4054-824f-4164744165ea","role":"authenticated"}', true);
  SELECT civic_spaces.current_user_id() INTO v_got;
  IF v_got <> '4e6dde8f-2bd0-4054-824f-4164744165ea' THEN
    RAISE EXCEPTION 'supabase token resolved to %, expected the sub uuid', v_got;
  END IF;

  -- A WorkOS-issued token for the same person: sub is a WorkOS id, external_id is the uuid.
  PERFORM set_config('request.jwt.claims',
    '{"iss":"https://api.workos.com/user_management/client_x",'
    || '"sub":"user_01M14T3W1R72ZQM70KRXH4K5E8",'
    || '"external_id":"4e6dde8f-2bd0-4054-824f-4164744165ea","role":"authenticated"}', true);
  SELECT civic_spaces.current_user_id() INTO v_got;
  IF v_got <> '4e6dde8f-2bd0-4054-824f-4164744165ea' THEN
    RAISE EXCEPTION 'workos token resolved to %, expected the external_id uuid', v_got;
  END IF;

  -- An UNLINKED WorkOS account must NOT resolve to anything that exists.
  PERFORM set_config('request.jwt.claims',
    '{"iss":"https://api.workos.com/user_management/client_x",'
    || '"sub":"user_01UNLINKED000000000000000","role":"authenticated"}', true);
  SELECT civic_spaces.current_user_id() INTO v_got;
  IF v_got <> 'user_01UNLINKED000000000000000' THEN
    RAISE EXCEPTION 'unlinked workos token resolved to %, expected its own sub', v_got;
  END IF;
  IF EXISTS (SELECT 1 FROM civic_spaces.slice_members WHERE user_id = v_got) THEN
    RAISE EXCEPTION 'an unlinked workos sub matched a real membership -- not fail-closed';
  END IF;

  -- An empty external_id must not shadow a usable sub.
  PERFORM set_config('request.jwt.claims',
    '{"sub":"4e6dde8f-2bd0-4054-824f-4164744165ea","external_id":"","role":"authenticated"}', true);
  SELECT civic_spaces.current_user_id() INTO v_got;
  IF v_got <> '4e6dde8f-2bd0-4054-824f-4164744165ea' THEN
    RAISE EXCEPTION 'empty external_id shadowed the sub, resolved to %', v_got;
  END IF;

  PERFORM set_config('request.jwt.claims', '', true);
END $verify$;
