---
phase: 12-cleanup
plan: 01
subsystem: ui
tags: [typescript, react, dead-code, props, cleanup]

# Dependency graph
requires:
  - phase: 08-profile-pages
    provides: ProfileFriends + MutualFriendsList components
  - phase: 11-sidebar-widgets
    provides: AppShell with NotificationBell wired
provides:
  - Clean TypeScript type surface: friendCount and onNavigateToThread removed from all interfaces
  - MutualFriendsList accepts only { userId: string }
  - NotificationListProps and NotificationBellProps stripped of vestigial onNavigateToThread
affects: [any future work touching ProfileFriends, NotificationBell, NotificationList, AppShell]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/components/ProfileFriends.tsx
    - src/components/ProfilePage.tsx
    - src/components/NotificationList.tsx
    - src/components/NotificationBell.tsx
    - src/components/AppShell.tsx

key-decisions:
  - "ProfileStatsStrip.tsx friendCount prop intentionally preserved — actively rendered in the stats strip"
  - "SliceFeedPanel onNavigateToThread props intentionally preserved — genuine in-feed thread navigation"

patterns-established: []

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 12 Plan 01: Dead Prop Removal Summary

**Removed vestigial `friendCount` from ProfileFriends/MutualFriendsList and `onNavigateToThread` from NotificationList/NotificationBell/AppShell — zero TypeScript errors, clean type surface**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-09T00:00:00Z
- **Completed:** 2026-04-09T00:05:00Z
- **Tasks:** 3 (Tasks 1 + 2 executed together, Task 3 verified + committed)
- **Files modified:** 5

## Accomplishments
- `ProfileFriendsProps` and `MutualFriendsList` type stripped of never-used `friendCount` (CLEAN-01)
- `NotificationListProps` and `NotificationBellProps` stripped of never-used `onNavigateToThread` (CLEAN-02)
- `npx tsc --noEmit` exits with zero errors, zero warnings
- All 5 files committed in one atomic refactor commit

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove `friendCount` from ProfileFriends + ProfilePage** - `dca5cdf` (refactor)
2. **Task 2: Remove `onNavigateToThread` from NotificationList, NotificationBell, AppShell** - `dca5cdf` (refactor)
3. **Task 3: Full TypeScript verification + commit** - `dca5cdf` (refactor)

All three tasks combined into one atomic refactor commit: `dca5cdf` — `refactor(cleanup): remove dead props friendCount and onNavigateToThread (CLEAN-01, CLEAN-02)`

## Files Created/Modified
- `src/components/ProfileFriends.tsx` - Removed `friendCount` from `ProfileFriendsProps` interface, `MutualFriendsList` type, and `ProfileFriends` destructuring; removed `friendCount={friendCount}` from MutualFriendsList call site
- `src/components/ProfilePage.tsx` - Removed `friendCount={stats?.friendCount ?? 0}` from `ProfileFriends` JSX call site
- `src/components/NotificationList.tsx` - Removed `onNavigateToThread?` from `NotificationListProps` interface and destructuring
- `src/components/NotificationBell.tsx` - Removed `onNavigateToThread` from `NotificationBellProps` interface, destructuring, and both `NotificationList` call sites (desktop popover + mobile sheet)
- `src/components/AppShell.tsx` - Removed `onNavigateToThread` lambda from `NotificationBell` JSX call site

## Decisions Made
- `ProfileStatsStrip.tsx` `friendCount` prop intentionally untouched — it actively renders the friend count in the stats strip
- `SliceFeedPanel` `onNavigateToThread` props at AppShell lines 289 and 314 intentionally untouched — those are `SliceFeedPanel` props for genuine in-feed thread navigation, not the vestigial notification bell props

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 12 Plan 01 complete: type surface is clean
- No remaining known dead props (STATE.md tech debt section is now clear)
- v3.0 Cleanup phase is complete

---
*Phase: 12-cleanup*
*Completed: 2026-04-09*
