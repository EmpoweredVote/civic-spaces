---
phase: 09-hero-banner-layout-shell
plan: 01
subsystem: ui
tags: [tailwind, react, dark-mode, layout, grid, teal, appshell]

# Dependency graph
requires:
  - phase: 08-profile-pages
    provides: v2.0 complete UI — AppShell, SliceTabBar, SliceFeedPanel, scroll preservation
provides:
  - Tailwind v4 @custom-variant dark for class-based dark mode
  - civic-teal theme token (oklch) for consistent teal branding
  - Two-column desktop grid (65/35) with sidebar placeholder in AppShell
  - Teal pill active tab styling in SliceTabBar (replaces blue underline)
  - Dark mode variant classes on header, nav, and sidebar elements
affects:
  - 09-02 (hero banner — uses AppShell layout structure)
  - 09-03 (layout shell polish — builds on this grid)
  - 10-post-composer (uses AppShell layout context)
  - 11-sidebar (fills the sidebar placeholder added here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 dark mode via @custom-variant dark (&:where(.dark, .dark *))"
    - "Two-column CSS grid with min-h-0 chain from h-screen to scrollRef for scroll preservation"
    - "CSS-hidden feed panels (not unmounted) for scroll + React Query cache preservation"
    - "Teal pill active state: bg-teal-600 rounded-lg px-4 py-2 on button, not border-b-2"

key-files:
  created: []
  modified:
    - src/index.css
    - src/components/AppShell.tsx
    - src/components/SliceTabBar.tsx

key-decisions:
  - "min-h-0 added to main tag and all feed column wrappers — required for CSS grid/flex to not expand to content height, preserving scroll containment"
  - "Sidebar placeholder uses hidden md:flex so Phase 11 just fills the existing column — no structural change needed"
  - "Teal pill uses rounded-lg not rounded-full — matches Krishna mockup rectangular capsule, not circular pill"

patterns-established:
  - "Dark mode: every new element gets dark: variant classes at time of creation, not as a separate pass"
  - "Grid scroll preservation: grid-cols-[65%_35%] + flex-1 overflow-hidden min-h-0 at grid level, then repeat on each column"

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 09 Plan 01: Layout Shell & Dark Mode Infrastructure Summary

**Tailwind v4 dark mode custom variant, civic-teal token, two-column 65/35 desktop grid with sidebar placeholder, and teal pill tab bar replacing blue underline**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-06T01:35:21Z
- **Completed:** 2026-04-06T01:36:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Dark mode infrastructure live: `@custom-variant dark` in index.css enables `dark:` classes throughout the app immediately
- Two-column desktop layout (65% feed / 35% sidebar) added to AppShell with scroll preservation chain intact (`min-h-0` at every flex/grid ancestor)
- SliceTabBar redesigned from blue border-bottom to teal pill capsule matching Krishna mockup visual language

## Task Commits

Each task was committed atomically:

1. **Task 1: Tailwind v4 dark mode setup + teal theme color + two-column grid in AppShell** - `0c4e278` (feat)
2. **Task 2: Teal pill active tab styling in SliceTabBar** - `2a7beb6` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/index.css` - Added `@custom-variant dark` and `--color-civic-teal` to `@theme` block
- `src/components/AppShell.tsx` - Two-column grid wrapper with sidebar placeholder; `min-h-0` on main and feed wrappers; dark mode classes on header
- `src/components/SliceTabBar.tsx` - Teal pill active tab (`bg-teal-600 rounded-lg`); dark mode on nav, tabs, and member count

## Decisions Made

- `min-h-0` must be on every flex/grid ancestor from `h-screen` down to the `scrollRef` target, or the grid item expands to intrinsic content height and scroll stops working. Added to `<main>` and both feed wrapper divs.
- Sidebar placeholder uses `hidden md:flex` — Phase 11 just fills this column, no structural AppShell changes needed.
- `rounded-lg` (not `rounded-full`) for the teal pill — matches the Krishna mockup's rectangular capsule shape.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Two-column grid is in place — Phase 09-02 (hero banner) can position content within the feed column
- Dark mode infrastructure ready — all subsequent components can use `dark:` variants immediately
- Sidebar placeholder at `hidden md:flex` in the grid — Phase 11 can fill it without AppShell changes
- Scroll preservation unchanged from v2.0; scroll behavior verified via TypeScript pass

---
*Phase: 09-hero-banner-layout-shell*
*Completed: 2026-04-06*
