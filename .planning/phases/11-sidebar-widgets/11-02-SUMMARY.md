---
phase: 11
plan: "02"
name: compass-widget
subsystem: sidebar-widgets
tags: [recharts, radar-chart, compass, widgets, tailwind]

dependency-graph:
  requires: ["11-01"]
  provides: ["CompassWidget component", "Recharts radar chart in sidebar"]
  affects: ["11-03", "11-04"]

tech-stack:
  added: []
  patterns:
    - "Pure presentational widget pattern with isLoading/isUncalibrated prop gates"
    - "Recharts ResponsiveContainer + aspect ratio for square radar chart"

key-files:
  created:
    - src/components/widgets/CompassWidget.tsx
  modified:
    - src/components/Sidebar.tsx
    - src/components/SidebarMobile.tsx

decisions:
  - "Purple #7c3aed enforced at component level per anti-partisan policy — no red or blue in compass"
  - "Empty chartData (all answers but all-zero averages) falls through to calibration prompt — same as isUncalibrated"
  - "Inline SVG compass icon avoids additional icon library dependency"
  - "Tooltip formatter typed as (value: number | string) to satisfy Recharts generic signature"

metrics:
  duration: "~2 minutes"
  completed: "2026-04-07"
---

# Phase 11 Plan 02: Compass Widget Summary

**One-liner:** Recharts RadarChart compass widget in purple (#7c3aed) with calibration prompt fallback for uncalibrated/unauthenticated users.

## What Was Built

The Issue Alignment Compass widget — the top visual anchor in the Civic Spaces sidebar and the primary connection to the Empower pillar of the EV ecosystem.

**CompassWidget (`src/components/widgets/CompassWidget.tsx`):**
- Three render states: loading skeleton, calibration prompt, radar chart
- Loading: react-loading-skeleton circle skeleton (square aspect)
- Calibration prompt: inline SVG compass icon, one-liner copy, "Calibrate Now" button linking to `https://compassv2.empowered.vote/results` in new tab
- Radar chart: Recharts RadarChart with PolarGrid, PolarAngleAxis, Radar (purple #7c3aed fill + stroke), Tooltip with score value formatted to 1 decimal
- Edge case: empty `buildChartData` result (answered topics but all zeroes) shows calibration prompt

**Sidebar wiring:**
- `Sidebar.tsx`: replaced placeholder WidgetCard with `<CompassWidget ...>`, fixed destructuring to use `compassData` prop
- `SidebarMobile.tsx`: identical replacement in collapsible animated section, fixed destructuring

## Verification Results

- `npx tsc --noEmit`: clean (0 errors)
- `npm run build`: success (6.89s, 1974 modules transformed)
- `#7c3aed` present in CompassWidget.tsx (compass SVG needle + radar fill/stroke)
- `compassv2.empowered.vote/results` present in CompassWidget.tsx
- No `ev_token` references in any modified file

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash    | Message |
|---------|---------|
| b76eafb | feat(11-02): create CompassWidget with radar chart and calibration prompt |
| 68ba7a9 | feat(11-02): wire CompassWidget into Sidebar and SidebarMobile |

## Next Phase Readiness

Plan 11-03 (Representatives widget) can proceed. The `repsData` placeholder WidgetCard is untouched and ready for replacement using the same pattern established here.

Pre-condition from STATE.md still applies: confirm accounts API rep data fields match `PoliticianFlatRecord` type before implementing 11-03.
