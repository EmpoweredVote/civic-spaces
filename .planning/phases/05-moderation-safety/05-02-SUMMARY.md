---
phase: 05-moderation-safety
plan: 02
subsystem: moderation-ui
tags: [react, hooks, sonner, flagging, blocking, moderation-queue, rpc]

dependency-graph:
  requires:
    - 05-01  # flags, blocks, moderators, action_log tables + RPCs
    - 04-02  # NotificationBell + notification rendering patterns
    - 03-02  # UserProfileCard, AppShell overlay patterns
  provides:
    - FlagButton + FlagModal (content flagging with category picker + toast)
    - Block/Unblock flow in UserProfileCard
    - Symmetric feed hide via block-filtered RPCs
    - "Unavailable" profile guard for blocked users
    - ModeratorQueue overlay (single-item focus, 4 actions)
    - Shield icon in AppShell header (moderator-only)
    - Warn notification rendering in NotificationItem
  affects: []  # Phase 5 is final phase

tech-stack:
  added:
    - sonner@2.0.7  # toast notifications
  patterns:
    - useMutation + toast (flag/block/mod actions follow hook-owns-toast pattern)
    - polling (useModQueue uses refetchInterval: 30000 — no Realtime for mod queue)
    - fixed full-screen overlay (ModeratorQueue matches FriendsList/MemberDirectory z-50 pattern)
    - SECURITY DEFINER RPC for is_blocked_by (bypasses RLS safely)

key-files:
  created:
    - src/hooks/useFlag.ts
    - src/hooks/useBlock.ts
    - src/hooks/useModQueue.ts
    - src/components/FlagButton.tsx
    - src/components/FlagModal.tsx
    - src/components/ModeratorQueue.tsx
  modified:
    - src/hooks/useFeed.ts  # migrated to get_feed_filtered RPC
    - src/hooks/useBoostedFeed.ts  # migrated to get_boosted_feed_filtered RPC
    - src/components/PostCard.tsx  # +currentUserId prop, +FlagButton
    - src/components/ReplyCard.tsx  # +currentUserId prop, +FlagButton
    - src/components/AppShell.tsx  # +shield icon, +ModeratorQueue
    - src/components/ThreadView.tsx  # pass currentUserId to ReplyCard
    - src/components/NotificationItem.tsx  # handle 'warn' event type
    - src/components/UserProfileCard.tsx  # +block guard, +block/unblock button
    - src/App.tsx  # +Toaster
    - src/components/NotificationBell.tsx  # bug fix: default -> named import

decisions:
  - decision: "FlagButton placed in post action row (bottom), not as absolute-positioned button — avoids nested interactive element conflict with PostCard's onClick button"
    rationale: "PostCard is a full-width <button>; FlagButton uses e.stopPropagation() to prevent thread navigation on flag click"
  - decision: "ReplyCard FlagButton uses reply.id as postId parameter — flags.post_id accepts both post and reply UUIDs at DB level"
    rationale: "Simpler than adding a separate reply flagging path; schema supports it"
  - decision: "useIsBlockedBy enabled only when userId is not null AND not self — prevents pointless self-block RPC call"
    rationale: "Guard: !!userId && userId !== currentUserId passed as enabled condition"

metrics:
  duration: "~5 minutes"
  completed: "2026-03-29"
  tasks: 3
  commits: 3
---

# Phase 5 Plan 02: Moderation UI Summary

**One-liner:** Full moderation frontend — flag+toast, block+symmetric feed hide, unavailable guard, moderator queue with 4 actions, warn notifications.

## What Was Built

Phase 5 Plan 2 delivers all moderation UI for public launch readiness:

**Flagging system:** `useFlag.ts` provides `useMyFlags` (Set-based O(1) lookup of personal flags) and `useFlagPost` (mutation with duplicate-tolerant 23505 handling). `FlagButton` renders inline in PostCard and ReplyCard for all non-own content. `FlagModal` is a react-modal-sheet with 4 category radio buttons and optional "Other" detail textarea.

**Blocking system:** `useBlock.ts` provides four hooks: `useBlockedUsers` (returns both array and Set), `useBlockUser`, `useUnblockUser`, `useIsBlockedBy` (SECURITY DEFINER RPC call). Feed hooks migrated to block-filtered RPCs — both `useFeed` and `useBoostedFeed` now call the `_filtered` variants. Block/unblock button added to UserProfileCard with window.confirm gate on block.

**Unavailable guard:** UserProfileCard calls `useIsBlockedBy(profileUserId)` and renders a generic "This profile is unavailable." sheet before showing any profile content — zero hint that a block exists.

**Moderator Queue:** `useModQueue.ts` provides polling-based queue (30s refetchInterval). `ModeratorQueue` is a fixed full-screen overlay matching the FriendsList pattern. Single-item focus with prev/next navigation, flag metadata (count, categories, priority badge), and 4 action buttons (Remove/Dismiss/Warn/Suspend). Shield icon in AppShell header visible only to moderators.

**Warn notifications:** NotificationItem handles `event_type === 'warn'` with "Your post was reviewed by a moderator" copy.

**Toast infrastructure:** Sonner installed, Toaster added to App.tsx root, all mutations use `toast.success/error` via sonner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NotificationBell default import**

- **Found during:** Task 3 (`npm run build`)
- **Issue:** `NotificationBell.tsx` used `import Sheet from 'react-modal-sheet'` (default import) but react-modal-sheet v5 only exports named exports. This caused Rollup build failure at bundling time (not caught by tsc since TypeScript resolved it via .d.ts).
- **Fix:** Changed to `import { Sheet } from 'react-modal-sheet'` — consistent with UserProfileCard and all other Sheet usages in the codebase.
- **Files modified:** `src/components/NotificationBell.tsx`
- **Commit:** 4fe650b

## Verification Results

- `npx tsc --noEmit`: pass (clean, no errors)
- `npm run build`: pass (5.61s, 896 kB bundle)
- Sonner: `npm ls sonner` confirms sonner@2.0.7

## Next Phase Readiness

Phase 5 is the final phase. All success criteria met:
- Flagging: category picker, toast, personal indicator, duplicate-tolerant
- Blocking: symmetric feed hide, profile guard (no block hint), block/unblock in profile
- Moderator queue: single-item focus, all 4 actions, polling
- Warn notification: rendered in notification list
- Build passes cleanly
