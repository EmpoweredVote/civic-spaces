---
phase: 08-profile-pages
plan: 02
subsystem: ui
tags: [react, wouter, tailwind, react-loading-skeleton, date-fns, profile, social-graph]

# Dependency graph
requires:
  - phase: 08-01
    provides: useProfileById, useProfileStats, useProfileSlices, useMutualFriends hooks + wouter installed
  - phase: 03-social-graph
    provides: useFriendship, useFollow, useFriendsList hooks + RelationshipState type
provides:
  - ProfilePage component orchestrating all profile data hooks
  - ProfileHeader with tier badge, join date, friend/follow actions
  - ProfileStatsStrip 3-column Posts/Replies/Friends layout
  - ProfileSlices with shared-slice indicator (by slice_type key)
  - ProfileFriends with own-view full list / other-view mutual friends branching
  - ProfileSkeleton for loading state
  - App.tsx Router integration with CSS-hidden AppShell pattern
affects: [08-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AppContent child component pattern — useRoute called inside Router by child, avoids top-level Router wrapping issues
    - CSS-hidden AppShell — AppShell never unmounts; display:none toggled via isProfileRoute so per-tab scroll refs are preserved
    - Shared-slice detection by slice_type key not slice_id — sibling slices have different IDs but same type

key-files:
  created:
    - src/components/ProfilePage.tsx
    - src/components/ProfileHeader.tsx
    - src/components/ProfileStatsStrip.tsx
    - src/components/ProfileSlices.tsx
    - src/components/ProfileFriends.tsx
    - src/components/ProfileSkeleton.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "AppContent child pattern wraps useRoute call inside Router — direct call in App() would error since Router not yet mounted"
  - "Shared slice detection uses slice_type key comparison, not slice_id — sibling slices differ by ID, same type means both in same geo tier"
  - "ProfilePage uses fixed inset-0 overlay so profile page stacks above CSS-hidden AppShell without layout interference"

patterns-established:
  - "Profile page as full-screen overlay: fixed inset-0 bg-white z-10 with overflow-y-auto — clean separation from AppShell"
  - "FriendRow as reusable button with navigate callback — same pattern for own friends list and mutual friends list"
  - "window.history.back() for profile back navigation — preserves AppShell scroll position since AppShell stays mounted"

# Metrics
duration: 18min
completed: 2026-04-04
---

# Phase 8 Plan 02: Profile Pages UI Summary

**wouter Router integration with ProfilePage component tree — CSS-hidden AppShell, tier-badged header, 3-col stats, ordered slice memberships with shared-slice chip, and own/mutual friends branching**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-04T06:48:32Z
- **Completed:** 2026-04-04T07:06:00Z
- **Tasks:** 2
- **Files modified:** 7 (1 modified + 6 created)

## Accomplishments
- Wired wouter Router into App.tsx with AppContent child pattern so useRoute works inside Router context; AppShell stays CSS-mounted when profile route is active
- Built ProfilePage orchestrator composing all four profile hooks (useProfileById, useProfileStats, useProfileSlices, useAllSlices) with loading skeleton and not-found states
- ProfileHeader renders tier badge (EmpoweredBadge for empowered, blue chip for connected, gray chip for inform), formatted join date, and friend/follow action buttons for other-view
- ProfileSlices iterates Federal→State→Local→Neighborhood→Unified→Volunteer order, detecting shared membership by slice_type key (not slice_id, which differs for siblings)
- ProfileFriends branches on isSelf: full useFriendsList for own view, useMutualFriends + muted total count for other view

## Task Commits

Each task was committed atomically:

1. **Task 1: App.tsx Router integration + ProfilePage orchestrator + header + stats + skeleton** - `8eab449` (feat)
2. **Task 2: ProfileSlices with shared-slice indicator + ProfileFriends with own/other branching** - `9491e07` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/App.tsx` - Router wrapper with AppContent child; CSS-hidden AppShell when /profile/:userId active
- `src/components/ProfilePage.tsx` - Full-screen orchestrator: hooks, loading state, back button, component composition
- `src/components/ProfileHeader.tsx` - Display name + TierBadge + join date + FriendRequestButton + FollowButton
- `src/components/ProfileStatsStrip.tsx` - 3-column grid-cols-3 divide-x: Posts | Replies | Friends (muted)
- `src/components/ProfileSlices.tsx` - Ordered slice list with SharedSliceChip (blue dot + text) for shared types
- `src/components/ProfileFriends.tsx` - OwnFriendsList (useFriendsList) and MutualFriendsList (useMutualFriends) branches
- `src/components/ProfileSkeleton.tsx` - react-loading-skeleton placeholders matching profile layout sections

## Decisions Made
- **AppContent child pattern:** useRoute must be called inside Router context. Wrapping it in a child component (AppContent) is the cleanest approach — avoids Switch complexity and keeps App() as a thin provider shell.
- **Shared slice detection by slice_type:** Two users in sibling slices (same geo tier, different 6k groups) share the same slice_type but have different slice_ids. Comparing by type is semantically correct — they're in the same civic tier.
- **ProfilePage as fixed overlay:** Using `fixed inset-0 bg-white z-10` lets the profile page stack visually above the CSS-hidden AppShell without any layout coupling between the two.

## Deviations from Plan

None - plan executed exactly as written. All components implemented per spec, TypeScript passes, build succeeds.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Profile page UI complete and navigable at /profile/:userId
- Friend rows in ProfileFriends navigate to other profiles, enabling profile chaining
- Plan 08-03 (polish, linking from AppShell) can proceed immediately
- AppShell linking to own profile (e.g., tapping avatar/name in header) is the primary remaining integration point

---
*Phase: 08-profile-pages*
*Completed: 2026-04-04*
