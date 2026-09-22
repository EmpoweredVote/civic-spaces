---
plan: 03-02
status: complete
subsystem: social-graph-ui
tags: [react, tanstack-query, react-modal-sheet, supabase, tailwind, social-graph]
dependency-graph:
  requires: ["03-01"]
  provides: [EmpoweredBadge, UserProfileCard, FriendsList, MemberDirectory, useFriendship, useFollow, useFriends, useMemberDirectory, useMemberSearch, useProfileById]
  affects: ["03-03"]
tech-stack:
  added: []
  patterns: [bottom-sheet-overlay, author-tap-propagation, tier-conditional-ui, cross-slice-search]
key-files:
  created:
    - src/components/EmpoweredBadge.tsx
    - src/components/UserProfileCard.tsx
    - src/components/FriendsList.tsx
    - src/components/MemberDirectory.tsx
    - src/hooks/useFriendship.ts
    - src/hooks/useFollow.ts
    - src/hooks/useFriends.ts
    - src/hooks/useMemberDirectory.ts
    - src/hooks/useMemberSearch.ts
    - src/hooks/useProfileById.ts
  modified:
    - src/hooks/useFeed.ts
    - src/types/database.ts
    - src/components/PostCard.tsx
    - src/components/ReplyCard.tsx
    - src/components/ReplyComposer.tsx
    - src/components/ThreadView.tsx
    - src/components/SliceFeedPanel.tsx
    - src/components/AppShell.tsx
decisions:
  - "EmpoweredBadge uses role=img + title element for accessibility in addition to aria-label"
  - "UserProfileCard uses snapPoints=[0.45] (Sheet v3 API), not detent=content-height — snap to 45% viewport height"
  - "PostWithAuthor and ReplyWithAuthor now include tier in author Pick — required for EmpoweredBadge in feed without extra queries"
  - "onAuthorTap propagated through SliceFeedPanel -> PostCard and SliceFeedPanel -> ThreadView -> ReplyCard — AppShell owns the UserProfileCard state"
  - "FriendsList and MemberDirectory as fixed full-screen overlays (z-50) rather than sheets — simpler state management at AppShell level"
  - "ThreadView receives onAuthorTap prop — post author row also made tappable in thread detail view"
metrics:
  duration: "6m"
  completed: "2026-03-28"
---

# Phase 3 Plan 2: Social Graph UI Summary

**One-liner:** React social graph UI — EmpoweredBadge, friend/follow bottom sheet, FriendsList, MemberDirectory with cross-slice search, all wired into PostCard/ReplyCard/AppShell.

## What Was Built

- **EmpoweredBadge**: Reusable 5-pointed star SVG in `text-red-500` with aria-label and title for accessibility. Accepts optional `className`.
- **useProfileById**: Fetches single connected_profiles row + slice name by userId. 5min staleTime. Returns profile + sliceName.
- **useFriendship**: Four hooks — `useRelationship` (derives RelationshipState from DB row), `useSendFriendRequest` (REQ_LOW/REQ_HIGH based on friendshipKey), `useAcceptFriendRequest`, `useRemoveFriend`. All use `friendshipKey()` from lib/friendship.ts.
- **useFollow**: `useFollowStatus` (boolean query), `useToggleFollow` (insert/delete mutation).
- **UserProfileCard**: react-modal-sheet bottom sheet (snapPoints=[0.45]). Shows avatar, display name + EmpoweredBadge if empowered, tier label, slice name. Action button: "This is you" for self, Follow/Unfollow for empowered tier, Add Friend/Pending/Accept Request/Friends+remove overflow for connected tier. Empowered background tinted `#FFF0EE`.
- **useFriendsList**: Queries all friendship rows for current user, derives friends vs pendingReceived, batch-fetches profiles. 2min staleTime.
- **useMemberDirectory**: `useInfiniteQuery` over slice_members + connected_profiles. 50/page offset pagination.
- **useMemberSearch**: Search by display_name with `.ilike()`. Cross-slice (all profiles) or within-slice (two-query). Enabled at 2+ chars, 30s staleTime.
- **FriendsList**: Fixed full-screen overlay. Pending Requests section at top (with Accept + Decline), Friends section below. Tapping a friend opens nested UserProfileCard. Empty state message.
- **MemberDirectory**: Fixed full-screen overlay. Search input + "Search beyond your slice" checkbox. Shows directory when search < 2 chars, search results when >= 2 chars. Tapping opens UserProfileCard.
- **useFeed updated**: Profile select now includes `tier`. profileMap type updated.
- **database.ts updated**: PostWithAuthor and ReplyWithAuthor now include `tier` in author Pick.
- **PostCard updated**: `onAuthorTap` prop, tappable author area (stopPropagation on card click), EmpoweredBadge for empowered authors.
- **ReplyCard updated**: `onAuthorTap` prop, tappable author row, EmpoweredBadge inline next to name.
- **ReplyComposer updated**: `replyingToTier` prop renders EmpoweredBadge in "Replying to {name}" header.
- **ThreadView updated**: `onAuthorTap` prop threaded to all ReplyCards and post author row, EmpoweredBadge on post author.
- **SliceFeedPanel updated**: `onAuthorTap` prop passed to PostCard and ThreadView.
- **AppShell updated**: Friends (people icon) + Directory (search icon) nav buttons in header. `activePanel` state controls FriendsList/MemberDirectory overlays. Global `UserProfileCard` rendered at shell level with `profileUserId` state.

## Commits

| Task | Hash | Files |
|------|------|-------|
| Task 1: EmpoweredBadge, hooks, UserProfileCard | bf3004b | EmpoweredBadge.tsx, UserProfileCard.tsx, useFriendship.ts, useFollow.ts, useProfileById.ts |
| Task 2: FriendsList, MemberDirectory, hooks | d1bab96 | FriendsList.tsx, MemberDirectory.tsx, useFriends.ts, useMemberDirectory.ts, useMemberSearch.ts |
| Task 3: Integration + AppShell wiring | c10f62c | PostCard.tsx, ReplyCard.tsx, ReplyComposer.tsx, ThreadView.tsx, SliceFeedPanel.tsx, AppShell.tsx, useFeed.ts, database.ts |

## Decisions

- **PostWithAuthor/ReplyWithAuthor now include `tier`**: Previously only `display_name` and `avatar_url`. The EmpoweredBadge requirement in feed cards made this necessary without adding per-card queries.
- **onAuthorTap propagated to ThreadView and original post row**: Not just feed cards — all author surfaces in ThreadView are also tappable so the profile card can open from thread context.
- **FriendsList/MemberDirectory as fixed overlays (not sheets)**: These are multi-section panels with lists and controls. A bottom sheet would constrain height and scrollability. Fixed overlays with a close button are cleaner.
- **EmpoweredBadge inline everywhere**: Same component used in PostCard, ReplyCard, UserProfileCard, FriendsList, MemberDirectory — single source of truth for the civic leader visual.

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed as written with one scope addition:

**Addition: ThreadView post author made tappable**

The plan specified wiring onAuthorTap "at minimum at SliceFeedPanel level." The original post displayed in ThreadView also shows an author — this was made tappable as well (same prop propagation pattern, no architectural change).

## Verified

- `npx tsc --noEmit` passes after each task (no TypeScript errors at any step)
- EmpoweredBadge: renders SVG path with `text-red-500`, aria-label and title set
- UserProfileCard: uses `Sheet` from `react-modal-sheet` v3.5.0 with `snapPoints={[0.45]}`
- FriendsList: pending-requests section rendered first when pendingReceived.length > 0
- MemberDirectory: search enabled at 2+ chars, cross-slice checkbox toggles query scope
- PostCard/ReplyCard: EmpoweredBadge renders when `author.tier === 'empowered'`
- Author tap in feed: button wraps avatar+name, stopPropagation prevents card navigation
- AppShell: UserProfileCard rendered at shell level, Friends/Directory icons in header

## Next Phase Readiness

Phase 3 Plan 3 (03-03) can proceed. All social graph UI components are in place. The boosted feed (get_boosted_feed RPC from 03-01) and any remaining social graph features can be wired in 03-03.
