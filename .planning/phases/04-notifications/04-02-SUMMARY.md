---
phase: 04-notifications
plan: 02
subsystem: ui
tags: [react, supabase, realtime, react-query, date-fns, motion, react-modal-sheet, tailwind]

# Dependency graph
requires:
  - phase: 04-01
    provides: notifications table, public.notifications view, civic_spaces.notifications Realtime publication, Notification TypeScript type
  - phase: 03-02
    provides: useProfileById hook, AppShell pattern (onAuthorTap, profileUserId state), react-modal-sheet Sheet usage, motion/react AnimatePresence pattern
provides:
  - useNotifications hook with Realtime invalidation and unreadCount derived from query data
  - useMarkNotificationRead and useMarkAllNotificationsRead mutations
  - NotificationItem component with grouped copy, avatar, relative timestamp, unread dot
  - NotificationList with header, mark-all-read, empty state, tap routing
  - NotificationBell with capped badge, desktop AnimatePresence popover, mobile bottom sheet
  - AppShell integration — bell in header, activePostId state lifted from SliceFeedPanel
affects: ["05-voting", "future-phases"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Realtime invalidation per user: own channel notifications-${userId}, postgres_changes filtered by recipient_id, invalidates React Query cache on any event"
    - "Desktop popover + mobile sheet duality: Tailwind hidden/md:block for popover visibility; Sheet always rendered but closed on desktop — no JS breakpoint detection"
    - "State lifting: activePostId moved from SliceFeedPanel to AppShell so notification taps can trigger thread navigation from outside the feed"
    - "Capped unread badge: Math.min(rawCount, 99), display '99+' if over 99"

key-files:
  created:
    - src/hooks/useNotifications.ts
    - src/components/NotificationBell.tsx
    - src/components/NotificationList.tsx
    - src/components/NotificationItem.tsx
  modified:
    - src/components/AppShell.tsx
    - src/components/SliceFeedPanel.tsx

key-decisions:
  - "activePostId lifted from SliceFeedPanel to AppShell — notification tap from bell header must reach ThreadView which lives inside SliceFeedPanel; prop drilling chosen over context for explicitness"
  - "Desktop popover hidden via Tailwind hidden md:block; mobile Sheet always renders but stays closed on desktop — avoids JS-based window.matchMedia or resize listener complexity"
  - "useMarkAllNotificationsRead adds .eq('recipient_id', userId) alongside .eq('is_read', false) — defense-in-depth beyond RLS scoping"

patterns-established:
  - "Notification copy: getNotificationCopy function centralizes all copy logic — event_type + event_count + actor_ids determine which string variant to use"
  - "Grouped reply copy uses reference_excerpt with truncate(37) + '...' for 40-char cap"

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 4 Plan 02: Notification UI Summary

**Real-time notification bell with unread badge, grouped event copy, desktop popover + mobile sheet, and tap navigation to threads and profiles**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-28T22:43:07Z
- **Completed:** 2026-03-28T22:51:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- useNotifications hook queries public.notifications view, subscribes to civic_spaces.notifications Realtime channel per userId, and derives unreadCount capped at 99
- NotificationBell renders in AppShell header with blue badge; desktop shows AnimatePresence popover with click-outside dismiss; mobile shows react-modal-sheet bottom sheet at 75% snap point
- NotificationItem handles grouped copy (e.g., "3 replies on your post 'excerpt...'"), actor avatar with gray placeholder fallback, relative timestamp via date-fns formatDistanceToNow, blue dot + bold text when unread
- NotificationList routes taps: reply events navigate to thread, friend events open UserProfileCard — both mark notification read and close the panel
- activePostId state lifted from SliceFeedPanel to AppShell, enabling notification-driven thread navigation from header bell

## Task Commits

Each task was committed atomically:

1. **Task 1: useNotifications hook with Realtime and mark-read mutations** - `db68163` (feat)
2. **Task 2: NotificationBell, NotificationList, NotificationItem components** - `ef888b5` (feat)
3. **Task 3: Integrate NotificationBell into AppShell header** - `adf0587` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/hooks/useNotifications.ts` - Three named exports: useNotifications (query + Realtime channel), useMarkNotificationRead, useMarkAllNotificationsRead
- `src/components/NotificationItem.tsx` - Single notification row: avatar, grouped copy, timestamp, unread styling
- `src/components/NotificationList.tsx` - Header + mark-all-read + scrollable list + empty state; routes taps to thread/profile
- `src/components/NotificationBell.tsx` - Bell icon with badge, desktop AnimatePresence popover, mobile Sheet
- `src/components/AppShell.tsx` - NotificationBell added before Friends icon; activePostId + setActivePostId state added; props passed to SliceFeedPanel
- `src/components/SliceFeedPanel.tsx` - Removed internal activePostId useState; accepts activePostId + onNavigateToThread props; setActivePostId calls replaced with onNavigateToThread

## Decisions Made

- **activePostId lifted to AppShell** — notification taps in the header bell need to set the active thread, but ThreadView lives inside SliceFeedPanel. Lifting to AppShell and passing as props was the minimum-invasive approach consistent with the existing onAuthorTap pattern.
- **Tailwind hidden/md:block for desktop popover** — avoids JavaScript breakpoint detection (window.matchMedia or resize listeners). The Sheet always renders but stays closed on desktop; popover div is md:block so only visible md+.
- **Defense-in-depth on markAllRead** — .eq('recipient_id', userId) added alongside RLS which already scopes by recipient; belt-and-suspenders for when service calls bypass RLS.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript passed clean on first check, no import issues or missing packages.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Notification bell is live; real-time delivery functional once civic_spaces.notifications Realtime publication is active (confirmed in 04-01)
- Phase 5 (voting) can build on the same Realtime invalidation pattern established in this phase
- No blockers for Phase 5 execution

---
*Phase: 04-notifications*
*Completed: 2026-03-28*
