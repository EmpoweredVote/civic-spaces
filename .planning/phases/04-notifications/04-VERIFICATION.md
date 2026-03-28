---
phase: 04-notifications
verified: 2026-03-28T23:28:25Z
status: passed
score: 12/12 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 11/12
  gaps_closed:
    - Reply tap navigates to thread and scrolls to latest replies (scrollToLatest prop threaded through AppShell, SliceFeedPanel, ThreadView)
    - Badge clears when notification panel is opened (markAllRead called on isOpen in NotificationBell)
  gaps_remaining: []
  regressions: []
---

# Phase 4: Notifications Verification Report

**Phase Goal:** Users are notified of replies, friend requests, and accepted friendships so that returning to the app feels rewarding rather than opaque.
**Verified:** 2026-03-28T23:28:25Z
**Status:** passed
**Re-verification:** Yes -- after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User who receives a reply sees unread badge on bell | VERIFIED | useNotifications derives unreadCount from rawUnread capped at 99; NotificationBell renders badge when unreadCount > 0 |
| 2 | Badge clears when notification panel is opened | VERIFIED | NotificationBell useEffect: fires on isOpen change; if isOpen and unreadCount > 0 markAllRead.mutate() |
| 3 | Requester notified when friend request accepted | VERIFIED | notify_on_friendship_change trigger UPDATE path inserts friend_accepted notification for original requester |
| 4 | Friend request recipient sees it in notification list | VERIFIED | notify_on_friendship_change trigger INSERT path inserts friend_request notification for receiving user |
| 5 | Low-priority events grouped not per-ping | VERIFIED | Partial unique index notifications_group_idx; ON CONFLICT DO UPDATE increments event_count |
| 6 | No per-reaction notifications | VERIFIED | event_type CHECK constraint limits to (reply, friend_request, friend_accepted) only |
| 7 | Bell icon with unread count capped at 99+ | VERIFIED | badgeLabel: unreadCount > 99 renders 99+; badge only shown when unreadCount > 0 |
| 8 | Bell opens notification list (popover desktop, sheet mobile) | VERIFIED | Desktop: AnimatePresence motion.div gated by hidden md:block. Mobile: react-modal-sheet Sheet snapPoints 0.75. Both render NotificationList |
| 9 | Each notification shows actor name, description, relative timestamp | VERIFIED | NotificationItem uses useProfileById, getNotificationCopy, formatDistanceToNow |
| 10 | Grouped reply shows event count and truncated excerpt | VERIFIED | getNotificationCopy: event_count > 1 renders N replies on post with truncate() at 37 chars |
| 11 | Reply tap navigates to thread | VERIFIED | handleTap calls onNavigateToThread(notification.reference_id) then onClose(); activePostId lifted to AppShell via SliceFeedPanel |
| 12 | Reply tap scrolls to latest replies in thread | VERIFIED | AppShell sets activePostScrollToLatest=true before setActivePostId on notification tap; passed as scrollToLatest through SliceFeedPanel to ThreadView; ThreadView useEffect fires scrollIntoView on replyListRef when scrollToLatest=true and replies loaded |
| 13 | Friend tap opens UserProfileCard | VERIFIED | handleTap calls onOpenProfile(notification.reference_id); AppShell wires to setProfileUserId |
| 14 | Tapping notification marks it read | VERIFIED | handleTap calls markRead.mutate(notification.id) which runs update is_read=true |
| 15 | New notifications appear in real time | VERIFIED | useNotifications subscribes to postgres_changes on civic_spaces.notifications; supabase_realtime publication added in migration |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| supabase/migrations/20260328100000_phase4_notifications.sql | VERIFIED | 309 lines; table, 2 trigger functions, 2 triggers, RLS SELECT+UPDATE, public view, Realtime publication; no stubs |
| src/hooks/useNotifications.ts | VERIFIED | 111 lines; 3 named exports; imported by NotificationBell and NotificationList |
| src/components/NotificationBell.tsx | VERIFIED | 123 lines; exports default; used in AppShell; auto-clears badge on panel open via useEffect on isOpen |
| src/components/NotificationList.tsx | VERIFIED | 97 lines; exports default; header, mark-all-read, scrollable list, empty state, tap routing |
| src/components/NotificationItem.tsx | VERIFIED | 95 lines; exports default; avatar, copy, timestamp, unread dot |
| src/components/AppShell.tsx | VERIFIED | 156 lines; activePostId + activePostScrollToLatest state; bell tap sets scrollToLatest=true; feed tap resets to false; passed to SliceFeedPanel |
| src/components/SliceFeedPanel.tsx | VERIFIED | 176 lines; scrollToLatest in props interface; threaded through to ThreadView at line 170 |
| src/components/ThreadView.tsx | VERIFIED | 258 lines; scrollToLatest prop at line 17; replyListRef on reply list container line 198; useEffect fires scrollIntoView when scrollToLatest=true and replies loaded |
| src/types/database.ts | VERIFIED | NotificationEventType union and Notification interface; all 12 table columns covered |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| useNotifications.ts | public.notifications | supabase select from notifications | WIRED |
| useNotifications.ts | civic_spaces.notifications Realtime | supabase.channel postgres_changes filter recipient_id | WIRED |
| NotificationBell.tsx | useNotifications.ts | useNotifications() + useMarkAllNotificationsRead() | WIRED |
| NotificationBell.tsx | markAllRead on open | useEffect on isOpen: if isOpen and unreadCount > 0 markAllRead.mutate() | WIRED |
| NotificationList.tsx | useNotifications.ts | useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead | WIRED |
| NotificationBell.tsx | NotificationList.tsx | renders NotificationList in popover and Sheet | WIRED |
| NotificationList.tsx | AppShell (profile) | onOpenProfile callback for friend events | WIRED |
| NotificationList.tsx | AppShell (thread) | onNavigateToThread callback for reply events | WIRED |
| AppShell onNavigateToThread (bell) | activePostScrollToLatest | sets true before setActivePostId (AppShell lines 35-37) | WIRED |
| AppShell onNavigateToThread (feed) | activePostScrollToLatest | resets to false on native feed tap (AppShell lines 124-127) | WIRED |
| SliceFeedPanel | ThreadView scrollToLatest | prop pass-through at line 170 | WIRED |
| ThreadView scrollToLatest | replyListRef scrollIntoView | useEffect fires when scrollToLatest=true and replies.length > 0 (lines 36-38) | WIRED |
| notify_on_reply | civic_spaces.replies | AFTER INSERT trigger reply_notification | WIRED |
| notify_on_friendship_change | civic_spaces.friendships | AFTER INSERT OR UPDATE trigger friendship_notification | WIRED |

---

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| Unread badge on bell + clears when list viewed | SATISFIED | Badge auto-cleared via markAllRead on panel open |
| Reply notification visible in list | SATISFIED | - |
| Friend request in notification list | SATISFIED | - |
| Friend accepted notification for requester | SATISFIED | - |
| Event grouping not per-ping | SATISFIED | - |
| Reply notification navigates to thread | SATISFIED | - |
| Reply notification scrolls to latest replies | SATISFIED | scrollToLatest threaded through AppShell, SliceFeedPanel, ThreadView |

---

### Anti-Patterns Found

No stub patterns (TODO, FIXME, placeholder, return null, empty handlers) found across all new and modified files. No console.log-only implementations.

---

### Human Verification Required

#### 1. Realtime delivery end-to-end

**Test:** Have user A reply to user B post. Observe whether user B bell badge increments without page refresh.
**Expected:** Badge increments within 1-2 seconds.
**Why human:** Requires live Supabase project with Realtime enabled; cannot verify programmatically.

#### 2. Mobile bottom sheet visual behavior

**Test:** Open the app on mobile viewport under 768px. Tap the bell. Confirm bottom sheet slides up at 75% height rather than a dropdown popover.
**Why human:** Tailwind hidden/md:block split needs visual confirmation on a real mobile viewport.

#### 3. Scroll-to-latest visual experience

**Test:** Have unread reply notifications. Tap a reply notification. Confirm the thread opens and the reply list scrolls smoothly to the bottom so the latest replies are visible.
**Expected:** Smooth scroll to end of reply list within 1 second of thread render.
**Why human:** scrollIntoView behavior depends on DOM layout and browser scroll mechanics; cannot verify programmatically.

---

### Re-verification Summary

**Gap closed: Reply tap scrolls to latest replies.**

The previous gap filed the issue as no highlightReplyId prop and no visual highlight. The gap closure delivered a scrollToLatest prop instead of per-reply visual highlighting. This satisfies the plan must-have as written (scrolls to latest replies) and the ROADMAP success criterion (no per-reply highlight required by ROADMAP criterion 1).

The wiring is complete and correct:
- AppShell sets activePostScrollToLatest = true when navigating from a notification (line 35), and resets to false when navigating from a feed tap (line 125).
- SliceFeedPanel passes scrollToLatest through as a prop to ThreadView (line 170).
- ThreadView fires replyListRef.current scrollIntoView with smooth behavior when scrollToLatest is true and replies have loaded (lines 36-38).

**Additional fix: Badge auto-clears on panel open.**

The previous human verification flag noted the ROADMAP says badge clears when the list is viewed but the implementation required explicit action. NotificationBell now calls markAllRead.mutate() in a useEffect on isOpen -- the badge clears automatically when the panel opens. This resolves that flag as a code-verified behavior rather than a human verification requirement.

All 12 must-haves are now verified. Phase goal achieved.

---

_Verified: 2026-03-28T23:28:25Z_
_Verifier: Claude (gsd-verifier)_
