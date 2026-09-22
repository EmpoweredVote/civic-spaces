---
phase: 09-hero-banner-layout-shell
plan: 03
subsystem: ui
tags: [react, tailwind, typescript, hero-banner, appshell, layout]

# Dependency graph
requires:
  - phase: 09-01
    provides: AppShell two-column grid, teal pill tab bar, dark mode infrastructure
  - phase: 09-02
    provides: HeroBanner presentational component, SLICE_COPY data map
provides:
  - HeroBanner wired into AppShell feed column, driven by activeTab state
  - Complete Phase 9 v3.0 layout shell — user-verified
affects:
  - 10-phase (replaces Unsplash placeholder photos with Supabase Storage CDN URLs)
  - 11-phase (sidebar fills the already-present placeholder column)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HeroBanner sits above feed panels with natural height; feed panels below use flex-1 to fill remaining space — avoids HeroBanner stretching"
    - "activeTab drives hero via slices[activeTab as SliceType] lookup — single source of truth, no separate state"

key-files:
  created: []
  modified:
    - src/components/AppShell.tsx

key-decisions:
  - "HeroBanner rendered outside the CSS-hidden tab divs — always visible, swaps content via activeTab prop, no remount on tab switch"
  - "Feed panel wrapper gains flex-1 overflow-hidden min-h-0 so feed scrolls independently below the hero banner"

patterns-established:
  - "Hero-above-feed pattern: HeroBanner (natural height) + flex-1 feed wrapper = sticky hero, scrollable feed"

# Metrics
duration: ~5min
completed: 2026-04-06
---

# Phase 09 Plan 03: HeroBanner Integration Summary

**HeroBanner wired into AppShell above the feed column, swapping content per activeTab — completing the v3.0 layout shell (user-verified)**

## Performance

- **Duration:** ~5 min (including checkpoint)
- **Started:** 2026-04-06
- **Completed:** 2026-04-06
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- `HeroBanner` imported and placed above the feed panels in AppShell's feed column
- Active slice data computed via `slices[activeTab as SliceType]` and passed as props — switching tabs instantly swaps hero content (name, tagline, photo, pill badges)
- Feed panel wrapper adjusted to `flex-1 overflow-hidden min-h-0` so feed scrolls independently; hero takes natural aspect-ratio height
- User verified: teal pill tabs, hero swap on click, scroll preservation, two-column desktop, single-column mobile

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire HeroBanner into AppShell feed column** - `1d3f9fe` (feat)
2. **Task 2: Visual verification checkpoint** - user approved (no code commit)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/AppShell.tsx` — Added HeroBanner import, rendered above feed panels with activeTab-driven slice data, adjusted feed wrapper flex layout

## Decisions Made

- HeroBanner placed outside the CSS-hidden tab divs (not inside each tab panel) — hero is always rendered, content swaps via props rather than remounting. Preserves the CSS-hidden scroll-preservation pattern established in v2.0.
- Feed panel wrapper explicitly given `flex-1 overflow-hidden min-h-0` — ensures hero stays fixed at top of feed column and feed scrolls independently below it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 9 is fully complete: layout shell, hero banner component, and hero integration are all committed and user-verified
- Phase 10 (Slice Data & Photos): replace Unsplash placeholder photos in `sliceCopy.ts` with Supabase Storage CDN URLs; populate real taglines/descriptions; add `siblingTotal` to pill badge
- Phase 11 (Sidebar): fill the existing `hidden md:flex` sidebar column in AppShell — no structural AppShell changes needed
- No blockers

---
*Phase: 09-hero-banner-layout-shell*
*Completed: 2026-04-06*
