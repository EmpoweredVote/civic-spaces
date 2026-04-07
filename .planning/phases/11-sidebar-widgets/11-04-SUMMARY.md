---
phase: 11-sidebar-widgets
plan: "04"
name: tools-widget-visual-verification
subsystem: sidebar
tags: [sidebar, widgets, tools, visual-verification]

dependency-graph:
  requires:
    - "11-02: CompassWidget"
    - "11-03: RepresentativesWidget"
  provides:
    - "ToolsWidget with confirmed-live tool links (Compass, Essentials)"
    - "All three sidebar widgets live together in desktop and mobile"
    - "Visual verification checkpoint passed by user on live site"
  affects: []

tech-stack:
  added: []
  patterns:
    - "LIVE_TOOLS static config: only confirmed-live URLs included, non-live tools excluded entirely"
    - "Tab-aware rep filtering: filterRepsByTab() in types/representatives.ts"
    - "Volunteer tab: sidebar hidden entirely (future task assignment modal)"

file-tracking:
  created:
    - src/components/widgets/ToolsWidget.tsx
  modified:
    - src/components/Sidebar.tsx
    - src/components/SidebarMobile.tsx
    - src/types/representatives.ts
    - src/components/AppShell.tsx
    - src/hooks/useCompassData.ts
    - src/hooks/useRepresentatives.ts
    - src/components/widgets/CompassWidget.tsx
    - src/components/widgets/ToolsWidget.tsx

decisions:
  - id: api-base-url
    decision: "Use api.empowered.vote/api (not accounts.empowered.vote/api) for compass and representatives hooks"
    rationale: "accounts.empowered.vote is the auth hub frontend; api.empowered.vote is the actual Express API — confirmed from CompassV2 source"
  - id: tab-aware-reps
    decision: "Representatives filtered client-side by activeTab using filterRepsByTab()"
    rationale: "API returns all reps for user's jurisdiction; display should match the civic level of the active slice tab"
  - id: local-exec-in-neighborhood
    decision: "LOCAL_EXEC (Mayor) placed in Local tab alongside LOCAL (City Council) and SCHOOL"
    rationale: "Mayor and City Council are both city-level officials; should appear together"
  - id: volunteer-sidebar-hidden
    decision: "Sidebar returns null on Volunteer tab — no widgets shown"
    rationale: "Volunteer tab will eventually have a task assignment modal; civic widgets are not relevant"
  - id: unified-reps-hidden
    decision: "Representatives widget hidden on Unified tab (empty filter array)"
    rationale: "Unified is a worldwide cross-jurisdiction slice; no meaningful rep set to display"
  - id: sidebar-width
    decision: "Sidebar narrowed from 35% to 18% of viewport width"
    rationale: "User feedback — feed content should dominate; sidebar is supplemental"
  - id: tools-layout
    decision: "Tools widget uses single-column horizontal rows (icon + label) instead of 2-column grid"
    rationale: "2-column grid too cramped at 18% sidebar width"
  - id: treasury-tracker-excluded
    decision: "Treasury Tracker excluded from LIVE_TOOLS — connection refused at build time"
    rationale: "Plan requirement: only confirmed-live tools included; no coming-soon cards"

metrics:
  duration: "~45 minutes including post-verification fixes"
  completed: "2026-04-07"
  tasks-completed: 2
  tasks-total: 2
---

# Phase 11 Plan 04: Tools Widget + Visual Verification Summary

**ToolsWidget built with confirmed-live tools (Compass + Essentials); all three sidebar widgets verified on live site; tab-aware rep filtering, correct API base URL, and sidebar width all corrected post-verification.**

## What Was Built

### Task 1: ToolsWidget + wiring
- `src/components/widgets/ToolsWidget.tsx` — static LIVE_TOOLS config, single-column horizontal row layout, all links open in new tab. Treasury Tracker excluded (unreachable). Compass URL fixed to `compass.empowered.vote`.

### Post-Checkpoint Fixes (all part of this plan's visual verification)
- **API base URL**: hooks were calling `accounts.empowered.vote/api` (the auth hub frontend); corrected to `api.empowered.vote/api` (the actual Express API used by all other EV ecosystem apps)
- **Tab-aware rep filtering**: `filterRepsByTab()` added to `types/representatives.ts`; Sidebar and SidebarMobile filter reps based on `activeTab` prop passed from AppShell
- **LOCAL_EXEC moved to Local tab**: Mayor + City Council now appear together on the Local tab
- **Volunteer tab**: sidebar hidden entirely (`return null`) — reserved for future task assignment modal
- **Unified tab**: representatives widget hidden (empty filter)
- **Sidebar width**: narrowed from 35% → 18% of viewport
- **Tools layout**: switched from 2-column grid to single-column rows for narrow sidebar

## Verification
- Visual verification performed on live site (civicspaces.empowered.vote) by user
- All three widgets render correctly in desktop sidebar and mobile collapsible
- Representatives correctly scoped to each tab's civic level
- No party affiliation displayed anywhere
- All tool links open in new tab

## Commits
- `a7cd867` feat(11-04): create ToolsWidget and wire into sidebar
- `081f9e8` fix(11): use api.empowered.vote base URL
- `4534678` fix(11): filter reps by active tab, compass.empowered.vote URL
- `6cd38f8` fix(11): hide representatives on Unified tab
- `6943454` fix(11): LOCAL_EXEC to Local tab, hide Volunteer sidebar
- `bbdc997` fix(11): narrow sidebar to 18%, tools single-column layout

## Next Phase Readiness
Phase 11 complete. Phase 12 (Cleanup) removes two dead props: `friendCount` from MutualFriendsList and `onNavigateToThread` from NotificationListProps.
