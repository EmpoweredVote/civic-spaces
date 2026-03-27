# Phase 1 Plan 1: Auth Foundation Summary

**Status:** Complete
**Completed:** 2026-03-27
**Duration:** ~2 sessions (checkpoint at decision point)

## One-liner

Edge Function token exchange: accounts JWT verified via JWKS, re-signed as Supabase HS256 JWT for RLS with no user record creation.

## What Was Built

- `supabase/migrations/20260327000000_current_user_id.sql` — civic_spaces schema and current_user_id() helper reading auth.jwt() ->> 'sub'
- `supabase/functions/exchange-token/index.ts` — Edge Function that verifies accounts JWT via JWKS and returns a Supabase-compatible HS256 JWT
- `src/lib/supabase.ts` — Supabase client with accessToken injection + exchangeToken() helper
- `.env.example` — all required env vars documented for frontend and Edge Function

## Key Decision: Path B (Edge Function Token Exchange)

Supabase's Third-Party Auth Dashboard only exposes named providers (Firebase, Clerk, etc.). GoTrue does not support OAuth client registration — it cannot issue client_id/client_secret for external apps.

Auth flow: accounts JWT → POST /functions/v1/exchange-token → Supabase HS256 JWT (stored as cs_token) → all Supabase queries use cs_token via accessToken callback.

The exchanged JWT carries the accounts UUID as `sub` — identical to the accounts JWT sub. All RLS policies read this via civic_spaces.current_user_id() with no changes needed.

## JWT Claims Verified

- role: "authenticated" — present in all GoTrue tokens (standard behavior)
- sub — accounts UUID
- iss — https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1

## Pending for Plan 01-02

- GEOID format from GET /api/account/me — user to provide before 01-02 executes

## Deviations from Plan

None — plan executed exactly as written after checkpoint resolution.

## Commits

- c96f679 — feat(01-01): create auth foundation artifacts
- 076fb95 — feat(01-01): add exchange-token edge function
- 445f811 — feat(01-01): update supabase client for edge function token exchange
