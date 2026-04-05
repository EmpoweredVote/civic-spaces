# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.
**Current focus:** v3.0 — UI/UX Redesign (Phase 9: Hero Banner & Layout)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-05 — Milestone v3.0 started

## Accumulated Context

### Decisions

(Cleared — full decision log in PROJECT.md and milestones/v2.0-ROADMAP.md)

### Known Tech Debt (from v2.0 audit — addressed in CLEAN-01/02)

- `MutualFriendsList` accepts `friendCount` prop but never renders it — CLEAN-01
- `onNavigateToThread` vestigial in `NotificationListProps` — CLEAN-02

### Pending Todos

None.

### Blockers/Concerns

- Compass integration: Need to confirm the Empower pillar API endpoint/shape for the calibrated compass. Probe before Phase 11.
- Rep data: Accounts API partially has rep data — need to confirm what fields are available before Phase 11.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Remove stale onOpenProfile prop from mobile NotificationList | 2026-04-04 | fe9883b | [001-remove-stale-onopenprofile-mobile-not](./quick/001-remove-stale-onopenprofile-mobile-not/) |

## Session Continuity

Last session: 2026-04-05
Stopped at: v3.0 milestone initialized — requirements defined, roadmap pending
Resume file: None
