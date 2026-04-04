---
phase: 08-profile-pages
plan: 03
subsystem: ui
tags: [react, wouter, navigation, profile, post-card, reply-card, notification, friends-list, app-shell]

# Dependency graph
requires:
  - phase: 08-02
    provides: ProfilePage at /profile/:userId with back navigation
provides:
  - All display name tap points navigate to /profile/:userId via wouter
  - AppShell cleaned of profileUserId state and UserProfileCard overlay
  - onAuthorTap callback pattern fully removed from active codebase
  - FriendsList uses direct route navigation instead of inline profile sheet
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf component owns navigation: PostCard/ReplyCard/NotificationItem import useLocation directly rather than bubbling tap events up via callbacks"
    - "stopPropagation on author tap: author buttons always call e.stopPropagation() to prevent parent card onClick from opening the thread"
    - "Notification copy split into actorSegment + restSegment: allows actor name to be an independently tappable inline element while rest of text remains non-interactive"

key-files:
  created: []
  modified:
    - src/components/PostCard.tsx
    - src/components/ReplyCard.tsx
    - src/components/NotificationItem.tsx
    - src/components/SliceFeedPanel.tsx
    - src/components/ThreadView.tsx
    - src/components/FriendsList.tsx
    - src/components/NotificationBell.tsx
    - src/components/NotificationList.tsx
    - src/components/AppShell.tsx

key-decisions:
  - "onAuthorTap callback pattern fully removed — leaf components (PostCard, ReplyCard, ThreadView) import useLocation and navigate directly; no prop threading needed"
  - "NotificationItem copy refactored from single string to actorSegment/restSegment tuple — enables actor name to be a tappable inline span with stopPropagation when actor_ids.length === 1"
  - "NotificationList onOpenProfile prop removed — uses useLocation navigate directly for friend_request/friend_accepted tap handling"
  - "NotificationBell onOpenProfile prop removed — no longer threaded from AppShell; notification profile navigation is internal to NotificationList"
  - "UserProfileCard NOT deleted — file preserved for potential future use; only removed from AppShell and FriendsList usage"

patterns-established:
  - "Profile navigation ownership: tap components navigate themselves, not their parents"
  - "Actor-name inline tap: span with role=button, tabIndex=0, stopPropagation, aria-label for a11y"

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 08 Plan 03: Profile Navigation Wiring Summary

**All display name tap points throughout the app now navigate to /profile/:userId via wouter; the deprecated UserProfileCard overlay and onAuthorTap callback pattern fully removed from AppShell and all feed/thread/notification/friends components.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-04T06:54:04Z
- **Completed:** 2026-04-04T06:58:02Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- PostCard and ReplyCard: removed `onAuthorTap` prop, each imports `useLocation` and navigates directly on author button click with `e.stopPropagation()`
- NotificationItem: refactored copy rendering from a single template string to `actorSegment` + `restSegment` parts; actor name is a tappable `span[role=button]` with `stopPropagation` when `actor_ids.length === 1`
- SliceFeedPanel and ThreadView: removed `onAuthorTap` from interfaces and all child pass-through sites
- FriendsList: removed `useState` for `profileUserId`, removed `UserProfileCard` import and nested sheet, friend tap now calls `navigate('/profile/' + p.user_id)`
- NotificationList: removed `onOpenProfile` prop, uses `useLocation` navigate directly for friend-related notification taps
- NotificationBell: removed `onOpenProfile` prop from interface and both `NotificationList` render sites
- AppShell: removed `profileUserId` state, `UserProfileCard` import, global overlay render, and all `onAuthorTap`/`onOpenProfile` props — component is now simpler with no profile overlay state

## Task Commits

1. **Task 1: Update PostCard, ReplyCard, and NotificationItem with profile navigation** - `3f6f32c` (feat)
2. **Task 2: Update FriendsList navigation + clean up AppShell profile overlay** - `e602bb1` (feat)

**Plan metadata:** (follows)

## Files Created/Modified

- `src/components/PostCard.tsx` - Removed `onAuthorTap` prop; added `useLocation` import; navigates to `/profile/` + `post.user_id` on author button click
- `src/components/ReplyCard.tsx` - Same pattern as PostCard; author button navigates directly
- `src/components/NotificationItem.tsx` - Refactored to `actorSegment`/`restSegment` tuple rendering; actor name is inline tappable span with `stopPropagation` and `navigate('/profile/' + primaryActorId)` when single actor
- `src/components/SliceFeedPanel.tsx` - Removed `onAuthorTap` from `SliceFeedPanelProps` interface and all child call sites (PostCard, ThreadView)
- `src/components/ThreadView.tsx` - Removed `onAuthorTap` from `ThreadViewProps`; added `useLocation`; post author button navigates directly; removed `onAuthorTap` from both `ReplyCard` call sites
- `src/components/FriendsList.tsx` - Removed `useState` for `profileUserId`, removed `UserProfileCard` import and nested sheet; friend tap calls `navigate('/profile/' + p.user_id)`
- `src/components/NotificationBell.tsx` - Removed `onOpenProfile` from interface; removed prop from both `NotificationList` renders
- `src/components/NotificationList.tsx` - Removed `onOpenProfile` prop; added `useLocation`; friend notification taps call `navigate('/profile/' + notification.reference_id)`
- `src/components/AppShell.tsx` - Removed `profileUserId` state, `UserProfileCard` import and global overlay, `onAuthorTap` from all `SliceFeedPanel` calls, `onOpenProfile` from `NotificationBell`

## Decisions Made

- `onAuthorTap` callback pattern fully removed — leaf components import `useLocation` and navigate directly; prop threading eliminated from SliceFeedPanel and ThreadView as well
- `NotificationItem` copy refactored to actorSegment/restSegment tuple — actor name becomes independently tappable only when `actor_ids.length === 1` (grouped notifications remain non-interactive text)
- `NotificationList` `onOpenProfile` removed in favor of internal `useLocation` navigate — eliminates one level of callback threading from AppShell through NotificationBell to NotificationList
- `UserProfileCard.tsx` file preserved (not deleted) — removed only from AppShell and FriendsList usage; file may be useful as reference

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SliceFeedPanel and ThreadView also carried onAuthorTap — removed from both**

- **Found during:** Task 1 (reading call chain before editing)
- **Issue:** The plan listed PostCard, ReplyCard, NotificationItem, FriendsList, AppShell — but `onAuthorTap` was also threaded through `SliceFeedPanel` (interface + two render sites) and `ThreadView` (interface + post author button + two ReplyCard calls). Leaving those in place would have caused TypeScript errors since PostCard and ReplyCard no longer accept the prop.
- **Fix:** Removed `onAuthorTap` from `SliceFeedPanel` interface and both child sites; removed from `ThreadView` interface, replaced post author `onAuthorTap?.(post.user_id)` with `navigate('/profile/' + post.user_id)`, removed from both `ReplyCard` call sites.
- **Files modified:** `src/components/SliceFeedPanel.tsx`, `src/components/ThreadView.tsx`
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `3f6f32c` (Task 1 commit)

**2. [Rule 1 - Bug] NotificationBell and NotificationList also carried onOpenProfile — removed from both**

- **Found during:** Task 2 (reading AppShell's NotificationBell usage before editing)
- **Issue:** The plan mentioned removing `onOpenProfile` from AppShell's `NotificationBell` call site, but `onOpenProfile` was also declared in `NotificationBell`'s props interface and passed through to `NotificationList`, which used it in `handleTap`. Leaving the prop in place would have orphaned it after removing the AppShell pass-through.
- **Fix:** Removed `onOpenProfile` from `NotificationBell` interface; removed from both `NotificationList` renders inside `NotificationBell`; updated `NotificationList` to import `useLocation` and navigate directly in `handleTap` for friend notifications.
- **Files modified:** `src/components/NotificationBell.tsx`, `src/components/NotificationList.tsx`
- **Verification:** `npx tsc --noEmit` passes; `npm run build` succeeds
- **Committed in:** `e602bb1` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in adjacent components that would have caused TypeScript errors if left unaddressed)
**Impact on plan:** Both auto-fixes necessary for type correctness. No scope creep — work was directly in the same call chain as the planned changes.

## Issues Encountered

None — TypeScript caught the full call chain scope immediately on first check, making the scope of required changes clear before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PROF-01 satisfied: every display name in the feed, thread view, notifications, and friends list navigates to `/profile/:userId`
- AppShell simplified: no profile overlay state, no UserProfileCard — profile viewing is fully owned by the `/profile/:userId` route in App.tsx
- Phase 8 (Profile Pages) complete — all three plans delivered: data layer (08-01), UI component tree (08-02), navigation wiring (08-03)
- No blockers for future phases

---
*Phase: 08-profile-pages*
*Completed: 2026-04-04*
