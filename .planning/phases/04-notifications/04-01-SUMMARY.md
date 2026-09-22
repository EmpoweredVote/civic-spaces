---
phase: 04-notifications
plan: 01
subsystem: database
tags: [postgres, supabase, triggers, rls, realtime, typescript]

# Dependency graph
requires:
  - phase: 03-social-graph
    provides: civic_spaces.friendships table with INSERT/UPDATE triggers for friend events
  - phase: 02-core-forum
    provides: civic_spaces.replies and civic_spaces.posts tables for reply trigger source
provides:
  - civic_spaces.notifications table with 24-hour grouping (partial unique index)
  - notify_on_reply trigger function (post owner + nested reply owner notification)
  - notify_on_friendship_change trigger function (friend_request + friend_accepted events)
  - RLS policies (SELECT + UPDATE for own notifications only)
  - public.notifications view for PostgREST access
  - supabase_realtime publication for live notification delivery
  - Notification and NotificationEventType TypeScript types
affects: [04-02, ui-notification-bell, notification-hooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SECURITY DEFINER trigger functions using NEW.* row data (never auth functions)
    - Partial unique index + ON CONFLICT for 24-hour notification grouping
    - actor_ids array append deduplication pattern (CASE WHEN x = ANY(arr))
    - Two-policy RLS (SELECT + UPDATE) with no client INSERT/DELETE

key-files:
  created:
    - supabase/migrations/20260328100000_phase4_notifications.sql
  modified:
    - src/types/database.ts

key-decisions:
  - "SECURITY DEFINER on trigger functions — triggers fire as postgres role, not the inserting user; auth.jwt() would return NULL inside trigger context"
  - "actor_ids deduplication via CASE WHEN x = ANY(array) — prevents duplicate actor entries on repeated actions by same user within group window"
  - "reference_id is text (not uuid) — covers both post UUIDs (reply events) and user_id strings (friend events) without schema split"

patterns-established:
  - "Trigger-only inserts: notifications table has no INSERT RLS policy — all notification rows come from DB triggers exclusively"
  - "24-hour grouping window: CURRENT_DATE as group_window + partial unique index WHERE is_read = false enables collapse without app-layer logic"

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 4 Plan 01: Notifications Database Layer Summary

**Notifications table with 24-hour grouping triggers for reply/friend events, RLS, PostgREST view, and Realtime publication — all notification capture handled at DB level**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T22:36:46Z
- **Completed:** 2026-03-28T22:39:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Full notifications schema: table, partial unique index for 24-hour grouping, and main query path index
- Two SECURITY DEFINER trigger functions covering reply (post owner + nested reply owner) and friendship (request sent + accepted) events, with actor deduplication via array append
- RLS: SELECT + UPDATE for own rows only; no client INSERT path (triggers only)
- public.notifications view + grants for PostgREST; supabase_realtime publication for live delivery
- TypeScript Notification interface and NotificationEventType union type matching table schema exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Notifications migration — table, triggers, RLS, view, Realtime** - `61fc671` (feat)
2. **Task 2: TypeScript notification types** - `03b2732` (feat)

**Plan metadata:** (to follow in docs commit)

## Files Created/Modified

- `supabase/migrations/20260328100000_phase4_notifications.sql` - Notifications table, grouping index, notify_on_reply, notify_on_friendship_change triggers, RLS policies, public view, Realtime publication
- `src/types/database.ts` - Added NotificationEventType and Notification interface

## Decisions Made

- **SECURITY DEFINER on trigger functions:** Triggers execute as the postgres superrole, not the session user. Using auth.jwt() inside a trigger body would return NULL because there is no HTTP session context. All actor identification uses NEW.user_id, NEW.user_low, NEW.user_high from the triggering row.
- **actor_ids deduplication via CASE WHEN x = ANY(array):** Prevents the same actor being added twice to the aggregated list if they reply to the same post twice in one day. Keeps the actor list clean for display ("Alice, Bob, and 3 others replied").
- **reference_id as text:** Reply events reference a post UUID; friend events reference a user_id string. Keeping reference_id as text allows a single table to cover both event classes without a schema split or nullable FK columns.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Notifications database layer is complete and ready for Plan 02 (notification bell UI, useNotifications hook, mark-as-read mutation)
- The public.notifications view + Realtime publication is the query surface Plan 02 will consume
- NotificationWithActor enrichment type (joining connected_profiles for display names/avatars) is intentionally deferred to Plan 02 as specified

---
*Phase: 04-notifications*
*Completed: 2026-03-28*
