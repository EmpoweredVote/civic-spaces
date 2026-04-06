# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.
**Current focus:** v3.0 — UI/UX Redesign (Phase 10: Photos & Storage)

## Current Position

Phase: 10 of 12 (Photos & Storage)
Plan: 2 of 2 in current phase
Status: In progress — 10-02 at checkpoint (awaiting user upload + visual verify)
Last activity: 2026-04-06 — Tasks 1-2 of 10-02 complete; checkpoint awaiting user action

Next up: User runs upload script, fills migration, approves checkpoint → plan 10-02 complete

Progress: [█████░░░░░] 42% (v2.0 + Phase 9 + Phase 10 Plan 01 complete)

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
- [09-01] min-h-0 must be on every flex/grid ancestor from h-screen down to the scrollRef target — grid items expand to intrinsic content height otherwise, breaking scroll containment.
- [09-01] Sidebar placeholder uses hidden md:flex in existing grid column — Phase 11 fills it without structural AppShell changes.
- [09-01] Teal pill uses rounded-lg (not rounded-full) — matches Krishna mockup rectangular capsule shape.
- [09-02] HeroBanner is pure presentational (no hooks/state) — all data via props, ready for Plan 03 wiring.
- [09-02] Slice number pill shows only siblingIndex (not "of Y") — siblingTotal not in SliceInfo; Phase 10 TODO.
- [09-02] Unsplash placeholder photos in sliceCopy.ts — Phase 10 replaces with Supabase Storage CDN URLs.
- [09-03] HeroBanner rendered outside CSS-hidden tab divs — swaps via props, never remounts, preserves scroll-preservation pattern.
- [09-03] Feed panel wrapper uses flex-1 overflow-hidden min-h-0 — hero has natural height, feed scrolls independently below it.
- [10-01] placeholderPhoto renamed to defaultPhoto in sliceCopy.ts — permanent type defaults, not temporary placeholders.
- [10-01] Storage RLS: public=true bucket flag is not sufficient; explicit SELECT policy on storage.objects is also required to avoid 403 on public reads.
- [10-01] sliceCopy.ts type defaults use external Unsplash URLs only — no VITE_SUPABASE_URL dependency; DB CDN URLs come from useAllSlices hook exclusively.
- [10-01] HeroBanner photo resolution: photoUrl (DB) ?? copy.defaultPhoto (type default) ?? null (gray fallback).

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

Last session: 2026-04-06
Stopped at: 10-02-PLAN.md checkpoint — upload script + migration stub committed; awaiting user upload + visual verification
Resume file: None
