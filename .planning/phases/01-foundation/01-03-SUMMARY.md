---
phase: 01-foundation
plan: 03
subsystem: api
tags: [express, typescript, jose, jwks, supabase, slice-assignment, jwt]

# Dependency graph
requires:
  - phase: 01-01
    provides: Auth flow established — accounts JWT verified via JWKS, exchange-token Edge Function pattern
  - phase: 01-02
    provides: civic_spaces schema — slices, slice_members, connected_profiles tables with RLS and cap trigger

provides:
  - Express service at services/slice-assignment/ that authenticates via accounts JWKS and assigns users to civic slices
  - verifyToken middleware (jose JWKS remote verification, attaches userId + rawToken to req)
  - accountsApi client (GET /api/account/me with correct jurisdiction JSON keys)
  - sliceAssigner with findActiveSliceForGeoid, sibling overflow, slice_full retry, upsertConnectedProfile
  - POST /assign route with tier guard, jurisdiction null guard, idempotent upsert pattern

affects:
  - 02-federal-slice (uses slice membership to scope post queries)
  - Any service needing the accounts JWT verification pattern

# Tech tracking
tech-stack:
  added:
    - express@4 (HTTP server)
    - jose@5 (JWKS remote verification, jwtVerify)
    - "@supabase/supabase-js@2" (service-role client for privileged writes)
    - dotenv@16 (env config)
    - ts-node@10 (dev runner)
  patterns:
    - Health check route registered BEFORE auth middleware (unauthenticated probe support)
    - Service-role Supabase client bypasses RLS for slice_members INSERT
    - Sibling slice overflow: query max sibling_index, INSERT +1, handle 23505 conflict via re-query
    - slice_full retry: catch P0001/slice_full error, find sibling, retry up to 3 times
    - Jurisdiction null guard: return 200 no_jurisdiction rather than error (valid state for new users)

key-files:
  created:
    - services/slice-assignment/src/middleware/verifyToken.ts
    - services/slice-assignment/src/services/accountsApi.ts
    - services/slice-assignment/src/services/sliceAssigner.ts
    - services/slice-assignment/src/routes/assignment.ts
    - services/slice-assignment/src/index.ts
    - services/slice-assignment/package.json
    - services/slice-assignment/tsconfig.json
    - services/slice-assignment/.env.example
  modified: []

key-decisions:
  - "state slice maps to state_senate_district (not state_house_district) — broader representation unit"
  - "All 4 SLICE_ASSIGNMENTS use the confirmed jurisdiction JSON keys (congressional_district, state_senate_district, county, school_district)"
  - "slice_full retry calls findOrCreateSiblingSlice directly (not findActiveSliceForGeoid) to avoid re-checking the full slice again"
  - "health check at /health placed before verifyToken middleware so orchestrators can probe without a token"
  - "TypeScript strict mode enabled — tsc --noEmit passes cleanly"

patterns-established:
  - "Express Request augmentation for userId and rawToken in namespace Express.Request"
  - "Supabase .schema('civic_spaces') chained before .from() for all civic_spaces schema queries"

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 1 Plan 03: Slice Assignment Service Summary

**Express service with jose JWKS auth, 4-slice assignment with sibling overflow and slice_full retry, and idempotent connected_profiles upsert**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-27T21:46:32Z
- **Completed:** 2026-03-27T21:49:21Z
- **Tasks:** 2 implementation + 1 documentation
- **Files created:** 8

## Accomplishments

- Complete Express service in TypeScript with JWKS-based JWT verification using jose
- Slice assigner handles the full assignment lifecycle: find available slice, auto-create initial slice, create sibling slices when all full, retry on slice_full trigger errors
- POST /assign route enforces tier guard (inform blocked), jurisdiction null guard, and upserts connected_profiles atomically before slice assignment

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold service with JWT middleware and accounts API client** - `e4a487b` (feat)
2. **Task 2: Implement slice assigner, assignment route, and express app** - `a53a9d5` (feat)
3. **Task 3: SUMMARY.md and STATE.md** - (docs)

## Files Created/Modified

- `services/slice-assignment/src/middleware/verifyToken.ts` - JWKS remote verification, attaches userId/rawToken to req
- `services/slice-assignment/src/services/accountsApi.ts` - GET /api/account/me with AccountData interface using correct JSON keys
- `services/slice-assignment/src/services/sliceAssigner.ts` - Core slice logic: find/create slices, sibling overflow, slice_full retry, connected_profiles upsert
- `services/slice-assignment/src/routes/assignment.ts` - POST /assign with tier check and jurisdiction guard
- `services/slice-assignment/src/index.ts` - Express app with health check before auth middleware
- `services/slice-assignment/package.json` - Dependencies: express, jose, @supabase/supabase-js, dotenv
- `services/slice-assignment/tsconfig.json` - Strict TypeScript, ES2020 target, commonjs output
- `services/slice-assignment/.env.example` - Required env vars with placeholder values

## Decisions Made

- **State slice uses state_senate_district:** Represents a broader district unit aligned with the "state" level of civic engagement.
- **Sibling retry goes to findOrCreateSiblingSlice directly:** When slice_full fires, we already know the slice is full — skip re-querying findActiveSliceForGeoid to avoid re-checking the saturated slice.
- **Health check before auth middleware:** Standard operational practice; orchestrators/load balancers need unauthenticated probe access.
- **TypeScript strict mode:** All types explicit; no implicit any. tsc --noEmit passes cleanly.
- **Race condition handling on slice creation:** Both initial slice creation and sibling creation handle 23505 (unique_violation) by re-querying the existing row rather than failing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Requires `.env` file** before running. Copy `.env.example` and populate:
- `SUPABASE_URL` — civic_spaces Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (bypasses RLS for slice_members writes)
- `ACCOUNTS_JWKS_URL` — accounts project JWKS endpoint (pre-filled in example)
- `ACCOUNTS_ISSUER` — accounts project JWT issuer (pre-filled in example)
- `ACCOUNTS_API_URL` — accounts API base URL (pre-filled in example)

## Next Phase Readiness

Phase 1 complete. All three foundation plans delivered:
- 01-01: Auth flow (accounts JWT → exchange-token → cs_token)
- 01-02: civic_spaces schema (slices, slice_members, connected_profiles, posts, replies with RLS and cap trigger)
- 01-03: Slice assignment service (Express, JWKS auth, 4-slice assignment, sibling overflow)

Phase 2 (Federal Slice) can proceed. The slice assignment service must be running and accessible for the Edge Function to call on user login.

---
*Phase: 01-foundation*
*Completed: 2026-03-27*
