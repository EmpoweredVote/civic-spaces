---
phase: 09-hero-banner-layout-shell
plan: 02
subsystem: ui
tags: [react, tailwind, typescript, hero-banner, slice-copy]

# Dependency graph
requires:
  - phase: 09-01
    provides: AppShell two-column grid, dark mode infrastructure, SliceInfo types
provides:
  - HeroBanner presentational component (src/components/HeroBanner.tsx)
  - SLICE_COPY static data map with tagline/description/photo for all 6 slice types (src/lib/sliceCopy.ts)
affects:
  - 09-03-PLAN (wires HeroBanner into AppShell above feed)
  - 10-phase (replaces Unsplash placeholder photos with Supabase Storage CDN URLs)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gradient text legibility: absolute inset-0 bg-gradient-to-t overlay makes any photo safe for white text"
    - "Null-safe photo guard: fallback to solid bg-gray-700 if SLICE_COPY entry missing"
    - "SliceType -> human label mapping via a separate const Record for clean separation"

key-files:
  created:
    - src/components/HeroBanner.tsx
    - src/lib/sliceCopy.ts
  modified: []

key-decisions:
  - "HeroBanner is pure presentational (no hooks, no state) — all data flows through props, ready for Plan 03 integration"
  - "Unsplash placeholder photos used temporarily — Phase 10 TODO comment added inline"
  - "Slice number pill shows only siblingIndex (not 'of Y') — siblingTotal not available in SliceInfo; TODO comment left for Phase 10"

patterns-established:
  - "aspect-[16/9] mobile / aspect-[16/5] desktop responsive aspect ratio pattern"
  - "dark:ring-1 dark:ring-white/10 subtle container border for dark mode on photo cards"

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 09 Plan 02: Hero Banner Component Summary

**HeroBanner presentational component with gradient overlay, 4 pill badges, and SLICE_COPY data map for all 6 slice types**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-06T01:39:29Z
- **Completed:** 2026-04-06T01:41:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `sliceCopy.ts` exports `SLICE_COPY` with tagline, description, and Unsplash placeholder photo for all 6 slice types
- `HeroBanner.tsx` renders full-width hero with background photo, dark gradient overlay, white text hierarchy, and 4 pill badges
- Responsive aspect ratio (16:9 mobile, 16:5 desktop) with card-like inset on mobile, flush on desktop
- Pure presentational — zero hooks, zero state, ready to drop into AppShell in Plan 03

## Task Commits

Each task was committed atomically:

1. **Task 1: Static slice copy data** - `ecb47c9` (feat)
2. **Task 2: HeroBanner component** - `f105f90` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/sliceCopy.ts` — SliceCopy interface and SLICE_COPY constant map (6 entries)
- `src/components/HeroBanner.tsx` — Hero banner component (92 lines), pure presentational

## Decisions Made

- HeroBanner is pure presentational (no hooks, no state) — all data flows through props. This makes Plan 03 integration a straightforward import + placement.
- Unsplash placeholder photos used temporarily with Phase 10 TODO comment inline — no tech debt surprise later.
- Slice number pill shows only `Slice ${siblingIndex}` without "of Y" — `siblingTotal` is not in `SliceInfo`; TODO comment left for Phase 10.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `HeroBanner` and `SLICE_COPY` are complete, compiled, and committed
- Plan 03 can import `HeroBanner` and place it above the feed in AppShell — no further data plumbing needed beyond the existing `SliceInfo` props
- No blockers

---
*Phase: 09-hero-banner-layout-shell*
*Completed: 2026-04-06*
