# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.
**Current focus:** v3.0 — UI/UX Redesign (Phase 11: Sidebar Widgets)

## Current Position

Phase: 11 of 12 (Sidebar Widgets) — In progress
Plan: 3 of 4 — 11-03 complete
Status: In progress
Last activity: 2026-04-07 — Completed 11-03-PLAN.md (representatives widget: rep cards with photo fallback, branch sorting, skeleton loading)

Next up: Phase 11 Plan 04 — Tools Widget

Progress: [██████░░░░] ~60% (v2.0 + Phases 9 + 10 complete, Phase 11 Plans 01-03 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 11+ (v2.0)
- Average duration: ~30 min/plan (estimated)
- Total execution time: ~5.5 hours (v2.0)

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v2.0] CSS-hidden SliceFeedPanels (not conditional render) — preserves React Query cache, Realtime subscriptions, and DOM scroll across tab switches. Scroll target is a specific scrollRef DOM node; two-column wrapper in Phase 9 must not break this.
- [v3.0 Roadmap] Sidebar hooks MUST be hoisted to AppShell level — all 6 panels mount simultaneously, so any hook inside a panel fires 6x. Establish in Phase 11 before any widget is wired.
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
- [10-01] HeroBanner photo resolution: photoUrl (DB) > wikiPhotoUrl (Wikipedia hook) > copy.defaultPhoto (type default) > null (gray fallback).
- [10-02] Wikipedia replaces Supabase Storage for hero images — no uploads, no service-role keys. photo_url DB column retained as curated override (currently unused).
- [10-02] Census Bureau API used for county/place name lookups — free, no key required. Indiana fast-path lookup avoids API call for known Indiana counties.
- [10-02] Tab labels: neighborhood->"Local", local->"County" — reflects civic jurisdiction levels better than TIGER/Line technical terms.
- [10-02] Unified tab hidden from users who don't have the slice — not shown until assigned.
- [10-02] federal slice Wikipedia: congressional district -> US Capitol; state slice -> "{State} State Capitol".
- [10-02] PostgREST schema cache: after DDL changes, may need NOTIFY pgrst, 'reload schema' and brief wait before new columns are queryable.
- [10-02] Unified slice backfilled to all existing connected users (BloomingtonVoter and Kades) after fixing missing Phase 7 CHECK constraint in production (applied 2026-04-06).
- [11-01] Hook hoisting implemented: useCompassData + useRepresentatives called at AppShell level, props drilled to Sidebar/SidebarMobile — prevents 6x API calls from simultaneous feed panel mounts.
- [11-01] party field omitted from PoliticianFlatRecord TypeScript type — anti-partisan policy enforced at the type layer.
- [11-01] SidebarMobile collapsed by default — feed is primary on mobile, sidebar is supplemental.
- [11-01] WidgetCard is the single extensible container for all widgets — Plans 02-04 replace placeholder children only.
- [11-02] Purple #7c3aed enforced at component level in CompassWidget — no red or blue, anti-partisan policy at the render layer.
- [11-02] Empty buildChartData result (all zeroes) falls through to calibration prompt — same UX as isUncalibrated.
- [11-03] party never rendered in RepresentativesWidget — anti-partisan policy at the render layer (type omission + component enforcement).
- [11-03] Widget uses complete absence (not empty state) when reps array is empty — clean sidebar layout.
- [11-03] RepAvatar sub-component holds imgFailed state; onError swaps to inline SVG FallbackAvatar.
- [11-03] BRANCH_ORDER ?? 99 fallback sorts unknown district_types to end of list.

### Blockers/Concerns

- Phase 11 pre-condition: Confirm `civicspaces.empowered.vote` is in `api.empowered.vote` CORS allowlist before Plans 02-03 go live (hooks are written but will fail CORS if not whitelisted).
- Phase 11 Plan 03 pre-condition: Confirm accounts API rep data fields match PoliticianFlatRecord type at `GET /api/essentials/representatives/me` before Representatives widget implementation. (Plan 03 complete — widget built to spec, runtime validation pending CORS confirmation.)

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

Last session: 2026-04-07
Stopped at: Completed 11-03-PLAN.md — representatives widget (rep cards with photo/fallback, branch sorting, skeleton loading) wired into Sidebar and SidebarMobile
Resume file: None
