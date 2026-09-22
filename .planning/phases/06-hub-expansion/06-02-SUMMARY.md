---
phase: 06-hub-expansion
plan: 02
subsystem: ui
tags: [react, typescript, tailwind, scroll-preservation, refs]

# Dependency graph
requires:
  - phase: 06-01
    provides: CSS hidden mount pattern for all 4 geo SliceFeedPanels
provides:
  - Per-tab independent scroll position preservation for all 4 geo tabs
  - scrollRef prop on SliceFeedPanel exposing inner scroll container
  - handleTabChange in AppShell saves/restores scrollTop on tab switch
affects:
  - 06-03 (tab-level state management pattern extended)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Explicit scrollTop save/restore via useRef + requestAnimationFrame on tab change
    - Forwarded scrollRef prop from parent (AppShell) to child's scrollable div

key-files:
  created: []
  modified:
    - src/components/AppShell.tsx
    - src/components/SliceFeedPanel.tsx

key-decisions:
  - "Explicit save/restore chosen over visibility:hidden approach — reliable across all browsers, works with existing display:none pattern"
  - "requestAnimationFrame used for restore to ensure browser has re-laid out the newly visible tab before setting scrollTop"
  - "scrollRefs initialized at component mount via createRef in useRef initializer — stable references, no re-creation on render"
  - "Save triggered in handleTabChange (before setActiveTab) — captures scrollTop before display:none removes layout"

patterns-established:
  - "scrollRef pattern: AppShell creates ref, passes to SliceFeedPanel, component attaches to its scrollable div"
  - "Tab-change wrapper: handleTabChange wraps setActiveTab to add save/restore side effects without modifying SliceTabBar"

# Metrics
duration: 2min
completed: 2026-04-03
---

# Phase 6 Plan 02: Hub Expansion Scroll Preservation Summary

**Per-tab scroll position saved on tab leave and restored on tab enter via explicit scrollTop save/restore using requestAnimationFrame, with scrollRef forwarded from AppShell to each SliceFeedPanel's inner overflow-y-auto div**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-03T18:15:02Z
- **Completed:** 2026-04-03T18:16:42Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- HUB-08 requirement met: each of the 4 geo tabs independently preserves scroll position
- Tab switching saves current scrollTop before display:none is applied, then restores after next paint
- Thread open/close within a tab does not affect feed scroll (existing CSS hidden behavior unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement per-tab scroll position preservation** - `b31a8f1` (feat)

**Plan metadata:** _(see final commit below)_

## Files Created/Modified
- `src/components/AppShell.tsx` - Added scrollPositions ref, scrollRefs map, handleTabChange, useEffect restore, scrollRef prop wired to each SliceFeedPanel
- `src/components/SliceFeedPanel.tsx` - Added scrollRef optional prop, attached to feed's overflow-y-auto div

## Decisions Made
- Explicit save/restore chosen over `visibility: hidden` workaround because the existing CSS `hidden` (display:none) approach from 06-01 is already working well; explicit scrollTop capture is simpler and cross-browser reliable.
- `requestAnimationFrame` in the restore useEffect ensures the tab is visible in the DOM before scrollTop assignment — without rAF, display:none causes scrollTop writes to be ignored.
- Scroll is saved in `handleTabChange` (synchronously, before `setActiveTab`) to guarantee we read scrollTop while the element still has layout.
- `createRef` inside `useRef` initializer creates stable refs at component mount without needing useMemo or useState.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Scroll preservation complete; 06-03 (notification routing to specific tab) can proceed
- All 4 geo tab SliceFeedPanels mounted simultaneously with independent scroll, thread, and now scroll position state

---
*Phase: 06-hub-expansion*
*Completed: 2026-04-03*
