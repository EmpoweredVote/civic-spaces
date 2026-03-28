# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** A Connected user can enter their Federal Slice, see posts from their ~6k civic neighbors, and contribute to the conversation — making civic engagement feel like a small town, not an ocean.
**Current focus:** Phase 2 — Core Forum

## Current Position

Phase: 2 of 5 (Core Forum)
Plan: 1 of 4 in current phase
Status: In progress
Last activity: 2026-03-28 — Completed 02-01-PLAN.md (React app bootstrap, hub shell, tab bar, schema migration)

Progress: [████░░░░░░] 29%

## Performance Metrics

**Velocity:**
- Total plans completed: 4 (3 Phase 1 + 1 Phase 2)
- Average duration: ~4 min
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 3/3 | ~3 min avg | ~3 min |
| Phase 2 | 1/4 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 01-01, 01-02, 01-03, 02-01
- Trend: Stable ~4 min per plan

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Federal Slice first; other three tabs are visible placeholders in Phase 2, fully active in later work.
- [Pre-Phase 1]: 6k cap is a DB CHECK constraint (not app logic) — trigger-maintained `current_member_count` on `slices` table.
- [Pre-Phase 1]: All RLS policies use `auth.jwt() ->> 'sub'` (not `auth.uid()`) — external JWT does not populate `auth.uid()`.
- [Plan 01-01]: Path B (Edge Function) chosen for auth — Supabase Third-Party Auth only supports named providers; GoTrue cannot issue client credentials for external apps. Auth flow: accounts JWT → exchange-token Edge Function → Supabase HS256 JWT (cs_token). Documented in 01-01-SUMMARY.md.
- [Plan 01-02]: GEOID format confirmed — raw TIGER/Line strings stored verbatim as text. congressional_district=4-digit (e.g. "1807"), state_senate_district=5-digit (e.g. "18046"), county=5-digit FIPS (e.g. "18097"), school_district=7-digit NCES (e.g. "1804770"). No normalization anywhere. JSON keys match API field names exactly.
- [Plan 01-02]: slice_members INSERT is service_role only in practice (RLS only exposes SELECT to authenticated); cap trigger fires regardless of role.
- [Plan 01-02]: Soft delete pattern established — posts/replies use is_deleted flag, never hard-deleted.
- [Plan 01-03]: State slice maps to state_senate_district (broader representation unit). All 4 SLICE_ASSIGNMENTS use confirmed jurisdiction JSON keys.
- [Plan 01-03]: Health check at /health placed before verifyToken middleware — unauthenticated probe access for orchestrators/load balancers.
- [Plan 01-03]: Race conditions on slice creation handled via 23505 re-query pattern (not retry loops).
- [Plan 01-03]: slice_full retry goes directly to findOrCreateSiblingSlice (skips re-checking the known-full slice).
- [Plan 02-01]: Used @vitejs/plugin-react@5 (not v6) — v6 requires vite@^8; project uses vite@6.
- [Plan 02-01]: Two-query pattern in useFederalSlice (slice_members then slices.in()) — no FK constraints for embedded select.
- [Plan 02-01]: JWT decode uses native atob() — no external library needed for read-only claims extraction.
- [Plan 02-01]: db: { schema: 'civic_spaces' } added to supabase createClient — all queries default to civic_spaces schema.

### Pending Todos

- Apply supabase/migrations/20260327100000_phase2_schema.sql to Supabase project before Phase 2 feed queries go live.

### Blockers/Concerns

None — 02-01 complete. SliceFeedPanel is a placeholder; 02-02 implements the actual post feed. All Phase 2 dependencies installed.

## Session Continuity

Last session: 2026-03-28T02:17:48Z
Stopped at: Completed 02-01-PLAN.md (app shell plan)
Resume file: None
