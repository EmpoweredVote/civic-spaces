---
phase: 01-foundation
verified: 2026-03-27T00:00:00Z
status: gaps_found
score: 2.5/4 must-haves verified
gaps:
  - truth: A Connected user who logs in via accounts.empowered.vote receives a valid JWT that Supabase accepts, and their identity resolves correctly through current_user_id() in every RLS policy
    status: partial
    reason: Edge Function and current_user_id() are correctly implemented. The supabase.ts client is correct. But exchangeToken() has no caller in the codebase - no login page, auth hook, or callback invokes it. The token exchange cannot happen in the running app.
    artifacts:
      - path: src/lib/supabase.ts
        issue: exchangeToken() is defined and exported but no caller exists anywhere in src/ - the frontend has no login flow that triggers the exchange
    missing:
      - A login callback or auth hook that receives the accounts JWT and calls exchangeToken(accountsJwt) before any Supabase query
  - truth: When a slice reaches 6,000 members, the DB CHECK constraint prevents the 6,001st insert and a new sibling slice is created automatically - verifiable by reviewing the migration and seed SQL
    status: partial
    reason: CHECK constraint and BEFORE INSERT trigger correctly prevent the 6,001st insert and raise slice_full. However sibling slice creation is NOT automatic at the DB layer - it lives entirely in sliceAssigner.ts service code. seed.sql verifies the exception fires but does not test sibling creation.
    artifacts:
      - path: supabase/seed.sql
        issue: Seed verifies slice_full exception fires but does not test or exercise the sibling slice creation path
      - path: supabase/migrations/20260327000003_triggers.sql
        issue: enforce_slice_cap raises slice_full but contains no sibling creation logic - that is handled in services/slice-assignment/src/services/sliceAssigner.ts
    missing:
      - seed.sql should exercise the sibling creation path, or the must-have wording should acknowledge sibling creation lives in the service layer not the DB. The service-layer implementation in sliceAssigner.ts IS correct.
---
# Phase 1: Foundation Verification Report

**Phase Goal:** The Supabase schema, external JWT auth integration, and slice assignment service are all working correctly - every downstream phase builds on this without touching auth or RLS again.
**Verified:** 2026-03-27
**Status:** gaps_found
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Connected user login produces a JWT that Supabase accepts; identity resolves via current_user_id() | PARTIAL | Edge Function is correct; current_user_id() reads auth.jwt() ->> sub; supabase.ts client is correct - but exchangeToken() has no caller in src/ |
| 2 | On login, slice assignment service calls accounts API, reads jurisdiction GEOIDs, upserts into all four slice member tables | VERIFIED | Service code fully implements this: verifyToken -> fetchAccountData -> assignUserToSlices -> 4x upsertSliceMember; verified by code review |
| 3 | DB CHECK prevents 6,001st insert; new sibling slice created automatically | PARTIAL | CHECK + trigger verified; seed tests exception only. Sibling creation is service-layer code, not in DB, and not tested in seed.sql |
| 4 | All civic_spaces.* tables have RLS; non-member JWT cannot read another slices posts | VERIFIED | RLS enabled on all 5 tables; posts_select_slice_member policy gates via slice_members subquery using current_user_id() |

**Score:** 2.5/4 truths verified (2 fully verified, 2 partial)
---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| supabase/migrations/20260327000000_current_user_id.sql | civic_spaces schema + current_user_id() | VERIFIED | Creates schema; function reads auth.jwt() ->> sub; grants authenticated role |
| supabase/functions/exchange-token/index.ts | JWKS verification + HS256 re-signing | VERIFIED | Verifies via createRemoteJWKSet; re-signs with sub, role: authenticated |
| src/lib/supabase.ts | Supabase client with token injection + exchangeToken() | PARTIAL - ORPHANED | Client and function are correct; exchangeToken() has no caller anywhere in codebase |
| supabase/migrations/20260327000001_schema.sql | All 5 tables with constraints and indexes | VERIFIED | slices, slice_members, connected_profiles, posts, replies; CHECK/UNIQUE constraints; all indexes |
| supabase/migrations/20260327000002_rls.sql | RLS enabled + 8 policies | VERIFIED | RLS on all 5 tables; 8 policies using current_user_id() subquery pattern |
| supabase/migrations/20260327000003_triggers.sql | Cap trigger + decrement trigger + updated_at | VERIFIED | enforce_slice_cap with FOR UPDATE lock; decrement_slice_count with GREATEST; set_updated_at on 3 tables |
| supabase/seed.sql | Monroe County seed data + cap test | PARTIAL | 4 slices with real GEOIDs; slice_full exception tested; sibling creation NOT tested |
| services/slice-assignment/src/middleware/verifyToken.ts | JWKS JWT verification middleware | VERIFIED | jose createRemoteJWKSet; attaches userId and rawToken to request |
| services/slice-assignment/src/services/accountsApi.ts | GET /api/account/me client | VERIFIED | Calls correct endpoint; AccountData typed with congressional_district, state_senate_district, county, school_district |
| services/slice-assignment/src/services/sliceAssigner.ts | Core slice assignment logic | VERIFIED | findActiveSliceForGeoid, findOrCreateSiblingSlice, upsertSliceMember with slice_full retry, upsertConnectedProfile |
| services/slice-assignment/src/routes/assignment.ts | POST /assign route | VERIFIED | Tier guard; jurisdiction null guard; fetchAccountData -> upsertConnectedProfile -> assignUserToSlices |
| services/slice-assignment/src/index.ts | Express app entry point | VERIFIED | Health check before auth middleware; verifyToken -> assignment router; listens on configured port |
---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| exchange-token/index.ts | accounts JWKS | createRemoteJWKSet + jwtVerify | WIRED | Verifies issuer; extracts sub; re-signs as HS256 |
| exchange-token/index.ts | Supabase JWT | SignJWT with SUPABASE_JWT_SECRET | WIRED | Produces role: authenticated, preserves sub as-is |
| src/lib/supabase.ts | exchange-token Edge Function | fetch in exchangeToken() | WIRED (function) - NOT CALLED | Function POSTs to /functions/v1/exchange-token correctly but nothing in src/ invokes it |
| supabase client / RLS | current_user_id() | auth.jwt() ->> sub | WIRED | accessToken callback supplies cs_token; current_user_id() reads sub from that JWT |
| assignment.ts | accountsApi.ts | fetchAccountData(rawToken) | WIRED | Route calls with users forwarded token |
| assignment.ts | sliceAssigner.ts | assignUserToSlices(accountData.id, accountData.jurisdiction) | WIRED | Full jurisdiction object passed through |
| sliceAssigner.ts | civic_spaces.slice_members | service-role Supabase client upsert | WIRED | SUPABASE_SERVICE_ROLE_KEY bypasses RLS; onConflict for idempotency |
| sliceAssigner.ts | civic_spaces.slices | .lt(current_member_count, 6000) query | WIRED | Finds under-cap slices; creates siblings on overflow |
| enforce_slice_cap trigger | slice_full exception | BEFORE INSERT raises P0001 | WIRED | Trigger fires; exception raised; service catches and retries |
| Service slice_full catch | findOrCreateSiblingSlice | Error message check + retry loop | WIRED | retries parameter prevents infinite loop; max 3 attempts |

---

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| ASMT-01 (auth integration) | PARTIAL | exchangeToken() caller missing in frontend; architecture correct but uncalled |
| ASMT-02 (schema + RLS) | VERIFIED | All tables, RLS policies, triggers complete |
| ASMT-03 (slice assignment service) | VERIFIED | Service fully implemented; code review confirms all paths |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/lib/supabase.ts | 14 | exchangeToken() exported but never imported or called anywhere in src/ | Warning | Token exchange cannot occur; login flow is incomplete |
| supabase/seed.sql | 71-88 | Cap test verifies exception fires but does not exercise sibling creation | Info | Must-have #3 claims sibling creation verifiable in seed SQL; it is not |
---

### Human Verification Required

#### 1. Exchange Token End-to-End

**Test:** Deploy exchange-token Edge Function with secrets configured in Supabase Dashboard; send a valid accounts JWT to POST /functions/v1/exchange-token; use the returned access_token as Bearer on a civic_spaces.posts query.
**Expected:** Query succeeds and returns only posts for the authenticated users slice; current_user_id() resolves to the accounts UUID.
**Why human:** Requires live Supabase deployment and a real accounts JWT - JWKS resolution, JWT signing, and RLS evaluation cannot be verified from static analysis.

#### 2. Slice Assignment Service Live Call

**Test:** Run services/slice-assignment with a populated .env file; POST to /assign with a valid accounts JWT for a Connected user who has jurisdiction set; query civic_spaces.slice_members directly.
**Expected:** Exactly four rows exist for the user (one per slice type); connected_profiles contains the users display_name and account_standing.
**Why human:** Requires live Supabase and live accounts API; cannot verify network calls or DB writes from static analysis.

#### 3. RLS Isolation Between Slices

**Test:** Exchange two JWTs for users in different slices; use each JWT to query civic_spaces.posts; verify neither user can read the other slices posts.
**Expected:** Each user sees only their own slices posts; cross-slice query returns 0 rows.
**Why human:** Requires live database with RLS enforced and valid exchanged tokens.

---

### Gaps Summary

Two partial gaps prevent a full pass:

**Gap 1 - Login flow uncalled (Must-have #1):** The exchangeToken() function in src/lib/supabase.ts is architecturally correct but orphaned. No page, hook, or component calls it. For the must-have to be fully satisfied, a login callback must exist that invokes exchangeToken(accountsJwt) when the user completes the accounts.empowered.vote login. This is most likely Phase 2 scope (AppShell auth wiring) but it is absent from the codebase today. The infrastructure - Edge Function, JWKS verification, JWT re-signing, client accessToken callback - is complete and correct. The last mile is the caller.

**Gap 2 - Sibling creation not in DB/seed (Must-have #3):** The must-have states that new sibling slice creation is automatic and verifiable by reviewing the migration and seed SQL. The DB trigger raises slice_full on the 6,001st insert but does not create siblings - that responsibility belongs to the application layer in sliceAssigner.ts. The seed.sql confirms the exception fires correctly but does not test the recovery path. The sliceAssigner.ts sibling creation logic is correct and fully implemented. This gap is a framing mismatch: the must-have implied the DB would handle siblings automatically, but the correct and complete implementation is in the service layer.

Both gaps are bounded and addressable. The foundation artifacts are substantive - no stubs, no placeholder implementations, no empty handlers. The codebase is ready to support Phase 2 construction once a login flow caller is added and the must-have framing is reconciled with where sibling creation actually lives.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_