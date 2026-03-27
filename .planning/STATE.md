# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** A Connected user can enter their Federal Slice, see posts from their ~6k civic neighbors, and contribute to the conversation — making civic engagement feel like a small town, not an ocean.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-27 — Roadmap created; ready to begin Phase 1 planning

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: OIDC availability on accounts.empowered.vote is unresolved — determines whether to use Supabase Third-Party Auth natively (RS256 + OIDC discovery) or an Edge Function token exchange. Must resolve before any RLS policy is written.
- [Pre-Phase 1]: Federal Slice first; other three tabs are visible placeholders in Phase 2, fully active in later work.
- [Pre-Phase 1]: 6k cap is a DB CHECK constraint (not app logic) — trigger-maintained `current_member_count` on `slices` table.
- [Pre-Phase 1]: All RLS policies use `auth.jwt() ->> 'sub'` (not `auth.uid()`) — external JWT does not populate `auth.uid()`.

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 1 blocker (auth path):** OIDC discovery availability on accounts.empowered.vote is unknown. Plan 01-01 must resolve this before writing any RLS policy. Two known paths: (a) native Supabase Third-Party Auth if RS256 + OIDC endpoint available, (b) Edge Function token exchange if not.

## Session Continuity

Last session: 2026-03-27
Stopped at: Roadmap created; STATE.md initialized; REQUIREMENTS.md traceability updated.
Resume file: None
