# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.
**Current focus:** Phase 16 shipped; next phase undecided

## Current Position

Phase: 16 — Explore by Slice (complete)
Plan: 10/10 complete
Status: Shipped — next phase not yet defined in ROADMAP.md
Last activity: 2026-10-25 — #120 merged (1096e7a), closing #111

Progress: [██████████] 100% (Phase 16 — 10/10 plans)

## Performance Metrics

**Velocity:**
- v3.0 plans completed: 11
- Average duration: ~20 min/plan (estimated)
- v3.0 execution time: 5 days (2026-04-05 → 2026-04-10)

## Accumulated Context

### Decisions

*(Full decision log in PROJECT.md Key Decisions table)*

Key patterns carrying into v4.0:
- CSS-hidden SliceFeedPanels (not conditional render) — preserves React Query cache, Realtime subscriptions, and DOM scroll
- Hook-hoisting at AppShell level for any data hooks used by sidebar — all 6 panels mount simultaneously
- Anti-partisan policy enforced at: type layer (party omitted from PoliticianFlatRecord), render layer (never rendered), color layer (purple #7c3aed)
- Photo resolution chain: `photoUrl (DB) > wikiPhotoUrl (Wikipedia) > copy.defaultPhoto > null`
- Named-export lazy import shim: `lazy(() => import('./X').then((m) => ({ default: m.X })))`
- API base URL for EV ecosystem: `api.empowered.vote/api` (not `accounts.empowered.vote/api`)

### Blockers/Concerns

- CORS: `civicspaces.empowered.vote` in `api.empowered.vote` allowlist — should be confirmed before v4.0 work uses sidebar API hooks in production
- Volunteer tab sidebar: reserved for task assignment modal (future v4.0 feature)

### Known Tech Debt

None. All TD-01/02/03 closed in Phase 13.

### Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 001 | Remove stale onOpenProfile prop from mobile NotificationList | 2026-04-04 | fe9883b |

### Pending Todos

None.

## Session Continuity

Last session: 2026-10-25
Stopped at: Phase 16 shipped and verified in production; Phase 17 undecided. Open
  follow-ups in phases/16-explore-by-slice/deferred-items.md; ev-accounts asks in
  EXPLORE-HANDOFF.md. The signed-in in-situ visual check is still outstanding.
Resume file: None
