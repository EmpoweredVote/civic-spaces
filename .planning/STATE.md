# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-03)

**Core value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.
**Current focus:** Milestone v2.0 — All Slices. Phase 6: Hub Expansion.

## Current Position

Phase: 6 of 8 (Hub Expansion)
Plan: 0 of 4 in current phase
Status: Ready to plan
Last activity: 2026-04-03 — Roadmap created for v2.0 (Phases 6–8)

Progress (v2.0): [░░░░░░░░░░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 14
- Phases 1–5 delivered 2026-03-27 to 2026-03-28

*v2.0 metrics will update after first plan completion*

## Accumulated Context

### Decisions

- [v2.0 / Roadmap]: Phase 6 activates N/L/S geo tabs; Unified/Volunteer tab shells added as disabled placeholders
- [v2.0 / Roadmap]: Phase 7 owns all new slice_type schema, assignment service, and tab activation for Unified and Volunteer
- [v2.0 / Roadmap]: Unified geoid sentinel = 'UNIFIED'; Volunteer geoid sentinel = 'VOLUNTEER'
- [v2.0 / Milestone init]: Global Slice (Unified tab) is a distinct 6k flat slice — worldwide membership, NOT an aggregate of geo slices
- [v2.0 / Milestone init]: Volunteer Slice is flat (all Volunteers together), role-gated, right-side tab
- [v1.0 / Plan 05-01]: get_feed_filtered() and get_boosted_feed_filtered() use NOT EXISTS bidirectional block check
- [v1.0 / Plan 03-01]: get_boosted_feed uses SECURITY INVOKER; friendships use single-row normalization (user_low < user_high)

### Pending Todos

None.

### Blockers/Concerns

- [Phase 7]: Volunteer role API field name not confirmed — verify how accounts API surfaces the Volunteer role before implementing assignment service check
- [Phase 7]: Confirm whether get_boosted_feed_filtered RPC needs any RLS adjustment when called for 'unified' / 'volunteer' slice_types

## Session Continuity

Last session: 2026-04-03
Stopped at: v2.0 roadmap written (Phases 6–8, 22 requirements mapped). Ready to plan Phase 6.
Resume file: None
