# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** A Connected user can enter their Federal Slice, see posts from their ~6k civic neighbors, and contribute to the conversation — making civic engagement feel like a small town, not an ocean.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-03-27 — Completed 01-01-PLAN.md (auth foundation)

Progress: [█░░░░░░░░░] 7%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 1/3 | - | - |

**Recent Trend:**
- Last 5 plans: 01-01
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Federal Slice first; other three tabs are visible placeholders in Phase 2, fully active in later work.
- [Pre-Phase 1]: 6k cap is a DB CHECK constraint (not app logic) — trigger-maintained `current_member_count` on `slices` table.
- [Pre-Phase 1]: All RLS policies use `auth.jwt() ->> 'sub'` (not `auth.uid()`) — external JWT does not populate `auth.uid()`.
- [Plan 01-01]: Path B (Edge Function) chosen for auth — Supabase Third-Party Auth only supports named providers; GoTrue cannot issue client credentials for external apps. Auth flow: accounts JWT → exchange-token Edge Function → Supabase HS256 JWT (cs_token). Documented in 01-01-SUMMARY.md.

### Pending Todos

- **GEOID format:** The format returned by GET /api/account/me on accounts.empowered.vote is unknown. User must provide this before Plan 01-02 executes. (Federal Slice uses GEOID to identify the user's district.)

### Blockers/Concerns

- **Plan 01-02 gated on GEOID format:** Must know the exact field name and format (e.g., "5-digit FIPS string") before writing the slice assignment service. Not a blocker for other work.

## Session Continuity

Last session: 2026-03-27
Stopped at: Completed 01-01-PLAN.md
Resume file: None
