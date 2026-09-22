---
phase: 11
plan: "01"
name: sidebar-foundation
subsystem: sidebar
tags: [recharts, react-query, sidebar, widgets, hook-hoisting, motion]

dependency-graph:
  requires:
    - "09-01: two-column AppShell grid with sidebar placeholder"
    - "10-01: useAllSlices hook pattern at AppShell level"
  provides:
    - "Recharts installed and importable"
    - "useCompassData hook with categories + answers fetching"
    - "useRepresentatives hook with 204 handling"
    - "WidgetCard reusable container component"
    - "Sidebar desktop wrapper with three placeholder WidgetCards"
    - "SidebarMobile collapsible section with motion/react animation"
    - "Hook hoisting architecture: both hooks at AppShell level, not 6x"
  affects:
    - "11-02: Compass widget replaces placeholder in Sidebar/SidebarMobile"
    - "11-03: Representatives widget replaces placeholder in Sidebar/SidebarMobile"
    - "11-04: Tools widget replaces placeholder in Sidebar/SidebarMobile"

tech-stack:
  added:
    - "recharts@3.8.1: radar/bar charts for Compass widget"
  patterns:
    - "Hook hoisting: sidebar data hooks called once at AppShell, props drilled to Sidebar/SidebarMobile"
    - "204 guard: check response.status === 204 before .json() on representatives endpoint"
    - "cs_token: localStorage key for auth token in all new API calls"

file-tracking:
  created:
    - src/types/compass.ts
    - src/types/representatives.ts
    - src/hooks/useCompassData.ts
    - src/hooks/useRepresentatives.ts
    - src/components/widgets/WidgetCard.tsx
    - src/components/Sidebar.tsx
    - src/components/SidebarMobile.tsx
  modified:
    - src/components/AppShell.tsx
    - package.json
    - package-lock.json

decisions:
  - id: party-field-omitted
    context: "PoliticianFlatRecord type definition"
    decision: "party field omitted from TypeScript type to prevent accidental rendering"
    rationale: "Anti-partisan policy — party affiliation must never appear in the UI"
  - id: hook-hoisting-appshell
    context: "useCompassData and useRepresentatives placement"
    decision: "Both hooks called at AppShell top level, passed as props to Sidebar/SidebarMobile"
    rationale: "All 6 feed panels mount simultaneously; hooks inside panels would fire 6x each"
  - id: sidebar-mobile-collapsed-default
    context: "SidebarMobile initial state"
    decision: "useState(false) — collapsed by default on mobile"
    rationale: "Feed content is primary on mobile; sidebar is supplemental"
  - id: recharts-chunk-warning
    context: "Vite build output"
    decision: "938KB chunk warning accepted — recharts is a large library, code-splitting is Phase 12 concern"
    rationale: "Warning is pre-existing pattern in this project; not a build error"

metrics:
  duration: "~4 minutes"
  completed: "2026-04-07"
  tasks-completed: 2
  tasks-total: 2
---

# Phase 11 Plan 01: Sidebar Foundation Summary

**One-liner:** Recharts installed, hook-hoisting architecture established with useCompassData + useRepresentatives at AppShell level, and extensible WidgetCard container system wired into desktop Sidebar and mobile collapsible SidebarMobile.

## What Was Built

### Task 1: Install recharts + create data hooks

Installed recharts@3.8.1. Created two TypeScript type files and two React Query hooks:

- **`src/types/compass.ts`** — `CompassCategory` and `CompassAnswer` interfaces
- **`src/types/representatives.ts`** — `PoliticianFlatRecord` interface (party field intentionally omitted per anti-partisan policy), `BRANCH_ORDER` sort map, `getRepPhoto` utility
- **`src/hooks/useCompassData.ts`** — fetches categories (staleTime 30min) and user answers (staleTime 5min) from `accounts.empowered.vote`. Exports `buildChartData` for radar chart prep.
- **`src/hooks/useRepresentatives.ts`** — fetches from `/api/essentials/representatives/me` with critical 204 guard before `.json()` call. staleTime 10min.

Both hooks use `cs_token` from localStorage per project convention.

### Task 2: Create container components + wire into AppShell

- **`src/components/widgets/WidgetCard.tsx`** — shared container accepting title + children. Supports light/dark mode via Tailwind dark: variants. Used by all future widgets.
- **`src/components/Sidebar.tsx`** — desktop sidebar with three WidgetCards (Compass, Representatives, Tools). Representatives card is conditionally hidden when no data and not loading.
- **`src/components/SidebarMobile.tsx`** — mobile-only (`md:hidden`) collapsible with `motion/react` AnimatePresence animation. Collapsed by default. Chevron rotates on expand.
- **`src/components/AppShell.tsx`** — added `useCompassData(userId)` and `useRepresentatives(userId)` at hook level (lines 86-87). Replaced "Sidebar coming in Phase 11" placeholder with `<Sidebar>`. Inserted `<SidebarMobile>` between ActiveHeroBanner and feed panels.

## Verification Results

- `npm ls recharts` — recharts@3.8.1 confirmed
- `npx tsc --noEmit` — passes with zero errors
- `npm run build` — succeeds (938KB chunk warning is pre-existing, not an error)
- Grep confirms `useCompassData` and `useRepresentatives` called at AppShell top level, not inside panels
- No `ev_token` references in any new file (all use `cs_token`)
- No `party` field in `PoliticianFlatRecord` type

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

Plans 02-04 can now replace the three WidgetCard placeholder texts with real widget components. The hook hoisting architecture ensures no 6x API call duplication regardless of how many widgets are added.

Pre-conditions from STATE.md blockers remain relevant for API work in Plans 02-03:
- Confirm `civicspaces.empowered.vote` in `api.empowered.vote` CORS allowlist
- Confirm compass API endpoint/response shape matches types in `compass.ts`
- Confirm representatives API fields match `PoliticianFlatRecord` type
