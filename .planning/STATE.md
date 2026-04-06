# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.
**Current focus:** v3.0 — UI/UX Redesign (Phase 9: Hero Banner & Layout Shell)

## Current Position

Phase: 9 of 12 (Hero Banner & Layout Shell)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-04-05 — v3.0 roadmap created (4 phases, 14 requirements mapped)

Progress: [██░░░░░░░░] 20% (v2.0 complete; v3.0 not started)

## Performance Metrics

**Velocity:**
- Total plans completed: 11+ (v2.0)
- Average duration: ~30 min/plan (estimated)
- Total execution time: ~5.5 hours (v2.0)

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v2.0] CSS-hidden SliceFeedPanels (not conditional render) — preserves React Query cache, Realtime subscriptions, and DOM scroll across tab switches. Scroll target is a specific scrollRef DOM node; two-column wrapper in Phase 9 must not break this.
- [v3.0 Roadmap] Sidebar hooks MUST be hoisted to AppShell level — all 6 panels mount simultaneously, so any hook inside a panel fires 6×. Establish in Phase 11 before any widget is wired.

### Blockers/Concerns

- Phase 11 pre-condition: Confirm `civicspaces.empowered.vote` is in `api.empowered.vote` CORS allowlist before any sidebar API work begins.
- Phase 11 pre-condition: Confirm Empower pillar compass API endpoint/response shape before Compass widget implementation.
- Phase 11 pre-condition: Confirm accounts API rep data fields available at `GET /api/essentials/representatives/me` before Representatives widget implementation.

### Known Tech Debt (addressed in Phase 12)

- `MutualFriendsList` accepts `friendCount` prop but never renders it — CLEAN-01
- `onNavigateToThread` vestigial in `NotificationListProps` — CLEAN-02

### Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 001 | Remove stale onOpenProfile prop from mobile NotificationList | 2026-04-04 | fe9883b |

### Pending Todos

None.

## Session Continuity

Last session: 2026-04-05
Stopped at: v3.0 roadmap written — Phase 9 ready to plan
Resume file: None
