---
phase: 11
plan: "03"
name: representatives-widget
subsystem: sidebar-widgets
tags: [react, typescript, representatives, civic-identity, anti-partisan]

dependency-graph:
  requires: ["11-01"]
  provides: ["RepresentativesWidget component", "rep cards in Sidebar and SidebarMobile"]
  affects: ["11-04"]

tech-stack:
  added: []
  patterns: ["conditional widget hiding (no empty state)", "onError photo fallback", "SkeletonTheme for loading"]

key-files:
  created:
    - src/components/widgets/RepresentativesWidget.tsx
  modified:
    - src/components/Sidebar.tsx
    - src/components/SidebarMobile.tsx

decisions:
  - "party field never rendered — anti-partisan policy enforced in component, not just type"
  - "Widget absent (not empty-state) when reps array is empty and not loading"
  - "onError on img tag swaps to inline SVG FallbackAvatar — no broken image icons"
  - "BRANCH_ORDER ?? 99 fallback sorts unknown district_types to end"
  - "RepAvatar as sub-component holds useState for imgFailed — keeps parent render clean"

metrics:
  duration: "~2 minutes"
  completed: "2026-04-07"
---

# Phase 11 Plan 03: Representatives Widget Summary

**One-liner:** Rep cards sorted Executive > Legislative > Judicial with photo/fallback, skeleton loading, and complete hiding when empty — no party affiliation anywhere.

## What Was Built

`RepresentativesWidget` renders elected official cards for the authenticated user's location. The component:

- Sorts `PoliticianFlatRecord[]` by `BRANCH_ORDER[district_type]` (unknown types fall to position 99)
- Filters out vacant seats (`is_vacant === true`)
- Shows each rep as a 40px avatar + name + office title row with subtle bottom borders
- Uses `getRepPhoto(rep)` for the image source; `onError` swaps to a head/shoulders SVG fallback
- Shows `SkeletonTheme`-wrapped skeleton cards (3 rows) during loading
- Is completely absent from the DOM when data is empty and not loading — no "no reps" message

Both `Sidebar.tsx` and `SidebarMobile.tsx` were updated to replace the `WidgetCard` placeholder with `RepresentativesWidget` using the same conditional: render only when loading OR when data has at least one rep.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create RepresentativesWidget component | 5baa6f4 | src/components/widgets/RepresentativesWidget.tsx |
| 2 | Wire into Sidebar and SidebarMobile | 12d4c82 | src/components/Sidebar.tsx, src/components/SidebarMobile.tsx |

## Verification Results

- `npx tsc --noEmit` — PASS
- `npm run build` — PASS (6.80s)
- `party` grep in RepresentativesWidget.tsx — 0 matches
- `BRANCH_ORDER` sort — confirmed at lines 77-79
- `is_vacant` filter — confirmed at line 75

## Decisions Made

- `party` is never referenced in the component — anti-partisan policy at the render layer (matches Plan 01 type omission)
- Widget uses complete absence (not empty state) when data is empty — clean sidebar layout
- `RepAvatar` sub-component owns the `imgFailed` state for cleanliness
- `SkeletonTheme` uses neutral grays `#e5e7eb`/`#f3f4f6` — works in light mode; dark mode handled via Tailwind class-based dark variants on surrounding elements

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

Plan 11-04 (Tools widget) can proceed immediately. No blockers introduced.
