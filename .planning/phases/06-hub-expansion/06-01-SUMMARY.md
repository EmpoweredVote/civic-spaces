---
phase: 06-hub-expansion
plan: 01
subsystem: ui
tags: [react, typescript, supabase, react-query, tailwind]

# Dependency graph
requires:
  - phase: 05-moderation
    provides: Full forum stack (feed, threads, boosted feed RPC, moderation)
provides:
  - Multi-tab hub: N/L/S/F geo feeds switchable via tab bar
  - useAllSlices hook returning all 4 geo slices for current user
  - TabKey and SliceInfo types in database.ts
  - SliceTabBar: two-column layout with geo+Unified left, Volunteer right
  - Per-tab activePostId isolation preventing cross-tab thread state
affects:
  - 06-02 (scroll preservation depends on CSS hidden mount pattern established here)
  - 06-03 (notification routing to specific tab needs TabKey and per-tab state)
  - 06-04 (any feed/tab enhancements build on this hub)
  - 07 (Unified/Volunteer tab activation extends this tab structure)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS hidden pattern for simultaneous SliceFeedPanel mounting (preserves scroll + React Query cache across tab switches)
    - Per-tab state maps keyed by TabKey (activePostIds, scrollToLatestMap)
    - Two-step Supabase query: slice_members -> slices (no slice_type filter, returns all geo types)

key-files:
  created:
    - src/hooks/useAllSlices.ts
  modified:
    - src/types/database.ts
    - src/components/SliceTabBar.tsx
    - src/components/AppShell.tsx

key-decisions:
  - "CSS hidden used (not conditional rendering) for inactive SliceFeedPanels to preserve scroll position and React Query subscriptions"
  - "Per-tab activePostIds Record<TabKey, string|null> prevents cross-tab thread view interference when all 4 panels are simultaneously mounted"
  - "useAllSlices returns Partial<Record<SliceType, SliceInfo>> so AppShell can check slices[tabKey] and skip null (user not in that geo slice)"
  - "MemberDirectory sliceId updates to slices[activeTab]?.id so it shows members of the currently visible slice"
  - "Volunteer tab placed in right group separated by border-l; Unified stays in left group with other geo tabs"

patterns-established:
  - "Per-tab state map: Record<TabKey, T> initialized with all 6 TabKey values, updated via prev spread"
  - "CSS hidden mount: <div className={activeTab === tabKey ? 'flex flex-col flex-1 overflow-hidden' : 'hidden'}>"

# Metrics
duration: 3min
completed: 2026-04-03
---

# Phase 6 Plan 01: Hub Expansion — Multi-Tab Hub Summary

**Multi-tab hub wired with N/L/S/F geo slice feeds, two-column SliceTabBar, per-tab thread isolation, and Unified/Volunteer as disabled placeholders**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-03T18:10:09Z
- **Completed:** 2026-04-03T18:12:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `useAllSlices` hook that fetches all 4 geo slices for the current user in a two-step Supabase query (no slice_type filter)
- Added `TabKey` and `SliceInfo` types to `database.ts`
- Rewrote `SliceTabBar` with two-column layout: N/L/S/F/Unified on the left, Volunteer on the right with a border separator; disabled tabs show "Coming soon" and are not clickable
- Rewrote `AppShell` to mount all 4 geo `SliceFeedPanel`s simultaneously via CSS hidden (critical for scroll preservation in Plan 06-02); per-tab `activePostIds` and `scrollToLatestMap` prevent cross-tab thread state interference

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useAllSlices hook and add TabKey type** - `c3c8cf3` (feat)
2. **Task 2: Redesign SliceTabBar and rewire AppShell for multi-tab hub** - `9e8c89b` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified
- `src/hooks/useAllSlices.ts` - New hook: fetches all 4 geo slices for user, returns `Partial<Record<SliceType, SliceInfo>>`
- `src/types/database.ts` - Added `TabKey` union type and `SliceInfo` interface
- `src/components/SliceTabBar.tsx` - Full rewrite: two-column layout, disabled tab support, member count display, Coming soon label
- `src/components/AppShell.tsx` - Major rewrite: useAllSlices, activeTab state, per-tab activePostIds/scrollToLatestMap, CSS hidden multi-panel mount

## Decisions Made
- **CSS hidden over conditional rendering:** All 4 geo SliceFeedPanels are mounted simultaneously. This preserves React Query cache, realtime subscriptions, and DOM scroll position when the user switches tabs. Plan 06-02 (scroll preservation) depends on this.
- **Per-tab state maps:** `Record<TabKey, string | null>` for activePostIds and `Record<TabKey, boolean>` for scrollToLatest. Because all panels are mounted, a shared single value would cause ALL panels to enter thread view when any one opens a thread.
- **Partial<Record<SliceType, SliceInfo>>:** Hook returns partial map so AppShell can gracefully handle users who may not have all 4 geo slices assigned yet.
- **Volunteer placed right, Unified placed left:** Matches HUB-06 requirement: N/L/S/F/Unified on left group, Volunteer on right group separated by border.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Foundation for Phase 6 complete: multi-tab hub is wired and all subsequent plans (06-02 scroll preservation, 06-03 notification routing) can build on this structure
- CSS hidden pattern is in place for scroll preservation work in 06-02
- `TabKey` type is available for notification routing in 06-03
- Unified and Volunteer tabs are disabled shells ready for Phase 7 activation

---
*Phase: 06-hub-expansion*
*Completed: 2026-04-03*
