# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-03)

**Core value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.
**Current focus:** Milestone v2.0 — All Slices. Defining requirements.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-03 — Milestone v2.0 started

Progress: [░░░░░░░░░░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

- [v1.0 / Pre-Phase 1]: Jurisdiction GEOIDs as slice boundaries (not geographic circles)
- [v1.0 / Pre-Phase 1]: Federal Slice first; other tabs visible but grayed out
- [v1.0 / Pre-Phase 1]: Mutual friends model (both must accept)
- [v1.0 / Pre-Phase 1]: Elected accounts followable one-directionally
- [v1.0 / Pre-Phase 1]: 6k hard cap per slice → new slice created
- [v1.0 / Plan 01-01]: Supabase Third-Party Auth (ES256) — GoTrue migrated from HS256
- [v1.0 / Plan 01-02]: GEOID format verbatim TIGER/Line strings
- [v1.0 / Plan 01-02]: service_role only for slice_members INSERT (no client INSERT)
- [v1.0 / Plan 01-02]: Soft delete — posts/replies use is_deleted flag
- [v1.0 / Plan 02-01]: Two-query pattern in useFederalSlice (no FK constraints for embedded select)
- [v1.0 / Plan 02-02]: Composite cursor (created_at + id) for feed pagination
- [v1.0 / Plan 03-01]: Friendships use single-row normalization (user_low < user_high)
- [v1.0 / Plan 03-01]: get_boosted_feed uses SECURITY INVOKER
- [v1.0 / Plan 04-01]: SECURITY DEFINER on notification trigger functions
- [v1.0 / Plan 05-01]: is_moderator() and is_blocked_by() are SECURITY DEFINER
- [v1.0 / Plan 05-01]: get_feed_filtered() and get_boosted_feed_filtered() use NOT EXISTS bidirectional block check
- [v2.0 / Milestone init]: Global Slice (Unified tab) is a distinct 6k flat slice — worldwide membership, NOT an aggregate of geo slices
- [v2.0 / Milestone init]: Aggregate "all slices" feed deferred to future milestone
- [v2.0 / Milestone init]: Volunteer Slice is flat (all Volunteers together), role-gated, right-side tab
- [v2.0 / Milestone init]: Hub layout: geo slices on left, special slices (Global, Volunteer) on right

### Pending Todos

None.

### Blockers/Concerns

- Volunteer role API field name not yet confirmed — need to verify how accounts API surfaces the Volunteer role before slice assignment service can check it
- Global Slice GEOID convention not yet defined — needs a sentinel value (e.g., 'GLOBAL-001')

## Session Continuity

Last session: 2026-04-03
Stopped at: Milestone v2.0 initialized — moving to requirements definition
Resume file: None
