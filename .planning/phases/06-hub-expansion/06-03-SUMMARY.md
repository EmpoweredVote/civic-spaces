---
phase: 06-hub-expansion
plan: 03
subsystem: ui
tags: [react, typescript, supabase, notifications, routing]

# Dependency graph
requires:
  - phase: 06-01
    provides: TabKey type, per-tab activePostIds/scrollToLatestMap, useAllSlices hook, handleTabChange

provides:
  - useNotificationRouting hook: resolves a post_id to the correct TabKey via Supabase posts.slice_id lookup
  - handleNotificationNavigate handler in AppShell: switches tab AND opens thread for reply notifications
  - onNavigateToSliceThread prop wired through NotificationBell -> NotificationList
  - Reply notifications now route to the correct geo slice tab (SLCE-03 fulfilled)

affects:
  - 06-04 (any further notification or hub enhancements)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Async one-off resolver hook pattern (useNotificationRouting) — no caching, called on tap
    - Prop passthrough for slice-aware navigation (onNavigateToSliceThread down AppShell -> Bell -> List)

key-files:
  created:
    - src/hooks/useNotificationRouting.ts
  modified:
    - src/components/AppShell.tsx
    - src/components/NotificationBell.tsx
    - src/components/NotificationList.tsx

key-decisions:
  - "useNotificationRouting is a one-off async resolver (not React Query) — called on notification tap, no cache needed"
  - "handleTabChange used in handleNotificationNavigate to preserve scroll position when switching tabs on notification tap"
  - "Reply notifications route via onNavigateToSliceThread; onNavigateToThread kept for backward compat (unused for reply events)"
  - "Fallback to 'federal' TabKey on any Supabase error or unmatched slice_id"

patterns-established:
  - "Resolver hook pattern: useCallback over slices map, returns async function called on demand"

# Metrics
duration: 2min
completed: 2026-04-03
---

# Phase 6 Plan 03: Hub Expansion — Notification Slice Routing Summary

**Reply notifications now resolve the post's owning geo slice via Supabase lookup and switch to that tab before opening the thread (SLCE-03)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-03T18:16:02Z
- **Completed:** 2026-04-03T18:18:04Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created `useNotificationRouting` hook that queries `posts.slice_id` and reverse-maps it against the user's slices to find the correct TabKey
- Added `handleNotificationNavigate` in AppShell that switches to the resolved tab (using `handleTabChange` for scroll preservation) and opens the thread with `scrollToLatest`
- Threaded the new `onNavigateToSliceThread` prop through NotificationBell to NotificationList, replacing `onNavigateToThread` for reply events

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useNotificationRouting hook** - `8a3b2e1` (feat)
2. **Task 2: Wire notification routing through AppShell, NotificationBell, and NotificationList** - `f470cfe` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified
- `src/hooks/useNotificationRouting.ts` - New hook: async resolver from post_id to TabKey using Supabase + slices map
- `src/components/AppShell.tsx` - Import hook, declare handleNotificationNavigate, pass onNavigateToSliceThread to NotificationBell
- `src/components/NotificationBell.tsx` - Add onNavigateToSliceThread prop; pass through to both desktop and mobile NotificationList instances
- `src/components/NotificationList.tsx` - Add onNavigateToSliceThread prop; reply events call it instead of onNavigateToThread

## Decisions Made
- **Async one-off resolver (no React Query):** resolveTabForPost is called on notification tap — one-off, low frequency, no stale data concern. React Query caching would add complexity for no benefit here.
- **handleTabChange used (not setActiveTab directly):** Reusing the scroll-preservation wrapper from 06-02 ensures tapping a notification also saves and restores scroll position correctly when switching tabs.
- **onNavigateToThread kept for backward compat:** The prop remains on NotificationList but is no longer called for reply events. Friend request/accepted events still use onOpenProfile; warn events are unaffected.
- **Fallback to 'federal':** Matches existing behavior — if slice lookup fails for any reason (network error, deleted post, unassigned slice), the thread still opens in Federal. No degradation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reordered hook/callback declarations in AppShell**
- **Found during:** Task 2 (AppShell wiring)
- **Issue:** Initial placement of handleNotificationNavigate before handleTabChange would cause a reference error at runtime (handleTabChange not yet defined when useCallback runs)
- **Fix:** Moved scroll refs, handleTabChange declaration above the useNotificationRouting call and handleNotificationNavigate declaration
- **Files modified:** src/components/AppShell.tsx
- **Verification:** `npx tsc --noEmit` clean; logical ordering verified by reading final file
- **Committed in:** f470cfe (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — declaration order)
**Impact on plan:** Minor ordering fix; no scope change.

## Issues Encountered
None beyond the declaration-order fix noted above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- SLCE-03 fully met: reply notifications route to the correct geo slice tab
- No regression to friend request / warn notifications
- Federal fallback guaranteed on lookup failure
- AppShell notification wiring is stable foundation for any future notification types (06-04 or beyond)

---
*Phase: 06-hub-expansion*
*Completed: 2026-04-03*
