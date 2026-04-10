---
phase: 13-tech-debt-sprint
plan: 01
subsystem: ui
tags: [react, supabase, vite, tailwind, code-splitting, recharts, lazy-loading]

# Dependency graph
requires:
  - phase: 10-photos-and-storage
    provides: photo_url DB column and photoUrl resolution chain in ActiveHeroBanner
  - phase: 11-sidebar-widgets
    provides: CompassWidget, AppShell grid structure, volunteer tab sidebar guard
provides:
  - photo_url activated in useAllSlices SELECT — DB curated photos now flow to ActiveHeroBanner
  - Volunteer tab ghost sidebar column eliminated — feed spans full width
  - CompassWidget code-split via React.lazy — Recharts emits as separate async chunk
affects: [future-phases-using-slices-data, future-sidebar-changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - React.lazy with named export shim: lazy(() => import('./X').then((m) => ({ default: m.X })))
    - Conditional Tailwind class via template literal for mutually exclusive display states

key-files:
  created: []
  modified:
    - src/hooks/useAllSlices.ts
    - src/components/AppShell.tsx
    - src/components/Sidebar.tsx
    - src/components/SidebarMobile.tsx

key-decisions:
  - "TD-01: photo_url is a query-only addition — no DDL, no PostgREST cache reload required (column already existed)"
  - "TD-02: Conditional class uses mutually exclusive 'hidden' vs 'hidden md:flex' — avoids Tailwind md:hidden + hidden specificity conflict"
  - "TD-03: Named export shim .then((m) => ({ default: m.CompassWidget })) required for React.lazy with named exports"

patterns-established:
  - "Named-export lazy import: lazy(() => import('./Comp').then((m) => ({ default: m.Comp })))"
  - "Volunteer tab full-width: sidebar div uses activeTab === 'volunteer' ? 'hidden' : 'hidden md:flex' conditional"

# Metrics
duration: 3min
completed: 2026-04-10
---

# Phase 13 Plan 01: v3.0 Tech Debt Sprint Summary

**photo_url DB override activated, volunteer tab ghost column eliminated, and Recharts code-split into separate 328KB async chunk via React.lazy**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-10T14:09:42Z
- **Completed:** 2026-04-10T14:13:15Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- TD-01: `useAllSlices` SELECT now includes `photo_url`; `SliceInfo.photoUrl` is populated from DB, completing the photo resolution chain (`photoUrl (DB) > wikiPhotoUrl > copy.defaultPhoto > null`)
- TD-02: Volunteer tab desktop layout: sidebar div is `display:none` at all breakpoints, grid track collapses, feed spans full width
- TD-03: `CompassWidget` (and Recharts) moved to a separate async chunk via `React.lazy`; Vite build emits `CompassWidget-*.js` at 328.52KB / 99.28KB gzipped — 938KB monolithic chunk warning gone

## Task Commits

Each task was committed atomically:

1. **Task 1: Activate photo_url in useAllSlices SELECT (TD-01)** - `61ffdaf` (feat)
2. **Task 2: Fix volunteer tab ghost sidebar column (TD-02)** - `8fe7e04` (fix)
3. **Task 3: Code-split CompassWidget via React.lazy (TD-03)** - `bc2ca82` (feat)

## Files Created/Modified
- `src/hooks/useAllSlices.ts` - Added `photo_url` to SELECT, mapped to `photoUrl: row.photo_url ?? null`
- `src/components/AppShell.tsx` - Sidebar div uses conditional class hiding entire column on volunteer tab
- `src/components/Sidebar.tsx` - Static `CompassWidget` import replaced with `React.lazy` + `Suspense` boundary
- `src/components/SidebarMobile.tsx` - Static `CompassWidget` import replaced with `React.lazy` + `Suspense` boundary

## Decisions Made
- TD-01 required no DDL or PostgREST schema cache reload — `photo_url` column existed in DB since Phase 10; only the SELECT query was missing it
- TD-02: Used mutually exclusive `'hidden'` vs `'hidden md:flex'` in a template literal conditional rather than `md:hidden` alongside `hidden md:flex` (Tailwind specificity conflict)
- TD-03: Named export shim `.then((m) => ({ default: m.CompassWidget }))` is required — `React.lazy` expects a default export; without the shim it throws "Element type is invalid" at runtime

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all three tasks were clean surgical edits. TypeScript passed with zero errors. Vite build confirmed Recharts code-splitting.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tech debt items TD-01, TD-02, TD-03 resolved
- Phase 13 continues with remaining tech debt items from the v3.0 audit
- No blockers

---
*Phase: 13-tech-debt-sprint*
*Completed: 2026-04-10*
