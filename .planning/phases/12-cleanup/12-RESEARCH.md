---
phase: 12
name: Cleanup
status: complete
---

# Phase 12 Research: Dead Prop Removal

## Summary

Two vestigial props need surgical removal. Both are already clearly identified with exact file locations. No architectural decisions needed — this is purely mechanical cleanup.

---

## CLEAN-01: `friendCount` in `MutualFriendsList`

### Root Cause
`MutualFriendsList` (internal component in `ProfileFriends.tsx`) accepts `friendCount: number` but never uses it. The component displays mutual count from `useMutualFriends` hook directly (`mutualFriends.length`).

### Full Call Chain

```
ProfilePage.tsx:93
  → ProfileFriends (friendCount in ProfileFriendsProps)
    → MutualFriendsList (friendCount in inline type — NEVER USED)
```

Note: `ProfileStatsStrip` (sibling component) legitimately uses `friendCount` for a "Friends" stat cell — that stays.

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/components/ProfileFriends.tsx` | 10 | Remove `friendCount: number` from `ProfileFriendsProps` |
| `src/components/ProfileFriends.tsx` | 59 | Remove `friendCount: number` from `MutualFriendsList` inline type |
| `src/components/ProfileFriends.tsx` | 89 | Remove `friendCount` from `ProfileFriends` destructuring |
| `src/components/ProfileFriends.tsx` | 98 | Remove `friendCount={friendCount}` from `MutualFriendsList` call |
| `src/components/ProfilePage.tsx` | 93 | Remove `friendCount={stats?.friendCount ?? 0}` from `ProfileFriends` call |

### What Does NOT Change
- `ProfileStatsStrip.tsx` — actively renders `friendCount` in the "Friends" stat cell, stays
- `ProfilePage.tsx:76` — passes `friendCount` to `ProfileStatsStrip`, stays
- `useProfileStats.ts` — still needed by `ProfileStatsStrip`, stays

---

## CLEAN-02: `onNavigateToThread` in `NotificationListProps`

### Root Cause
`NotificationList` accepts `onNavigateToThread?` but destructures it as `_onNavigateToThread` (underscore = intentionally unused). The `handleTap` function uses `onNavigateToSliceThread` for reply navigation, never `onNavigateToThread`.

### Full Call Chain

```
AppShell.tsx:163,289,314
  → NotificationBell (onNavigateToThread — only passed through)
    → NotificationList (onNavigateToThread: _onNavigateToThread — NEVER USED)
```

Note: `SliceFeedPanel` also has `onNavigateToThread` in its own separate props — that's genuine thread navigation, completely unrelated to this cleanup.

### Cascade

Removing from `NotificationList` triggers a clean cascade up:

| File | Change |
|------|--------|
| `src/components/NotificationList.tsx` | Remove `onNavigateToThread?` from `NotificationListProps`; remove `_onNavigateToThread` from destructuring |
| `src/components/NotificationBell.tsx` | Remove `onNavigateToThread` from `NotificationBellProps`; remove from destructuring; remove from both `NotificationList` call sites (lines 96, 115) |
| `src/components/AppShell.tsx` | Remove `onNavigateToThread={...}` from all 3 `NotificationBell` call sites (lines 163, 289, 314) |

### What Does NOT Change
- `SliceFeedPanel.tsx` — its `onNavigateToThread` prop is genuine, used for thread navigation — stays

---

## TypeScript Verification

After changes, run:
```bash
npx tsc --noEmit
```

Expected: zero errors. Both props are currently optional or only flow to dead code, so removal should not break compilation — but `tsc --noEmit` confirms it.

---

## Execution Order

Both cleanups are independent and can be done in a single plan. Recommended order:
1. CLEAN-01 first (fewer files, simpler cascade)
2. CLEAN-02 second (longer cascade but straightforward)
3. `tsc --noEmit` verification at end

One plan, one wave, fully autonomous.
