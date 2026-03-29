---
plan: 05-01
status: complete
phase: 05-moderation-safety
subsystem: moderation-backend
tags: [postgresql, rls, plpgsql, security-definer, blocking, flagging, moderation]
requires: [04-01, 03-01, 02-01, 01-02]
provides: [flags-table, blocks-table, moderators-table, action-log-table, is-moderator-rpc, is-blocked-by-rpc, get-feed-filtered-rpc, get-boosted-feed-filtered-rpc, get-mod-queue-rpc, mod-action-rpc, send-warn-notification-rpc, block-aware-reply-policy, block-aware-friendship-policy, phase5-public-views, phase5-typescript-types]
affects: [05-02]
tech-stack:
  added: []
  patterns: [security-definer-helpers, block-aware-rls, plpgsql-mod-guard, bidirectional-block-exclusion]
key-files:
  created:
    - supabase/migrations/20260328200000_phase5_moderation.sql
  modified:
    - src/types/database.ts
decisions:
  - "get_boosted_feed_filtered uses p.user_id (not p.author_id) for the LEFT JOIN and block exclusion — posts table column is user_id; author_id is returned as an alias matching the RPC return signature"
  - "send_warn_notification uses CURRENT_DATE (date type) for group_window — matches the notifications table column type (date) defined in Phase 4"
  - "Phase 3 get_boosted_feed had a latent bug referencing p.author_id directly; get_boosted_feed_filtered corrects this pattern using p.user_id with explicit alias"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-28"
---

# Phase 5 Plan 1: Moderation & Safety Backend Summary

## What Was Built

One-liner: Complete Phase 5 database layer — flags, blocks, moderators, action_log tables with RLS; block-aware feed/reply/friendship policies; moderator queue and action RPCs; warn notification; public views; TypeScript types.

- **4 new tables** in `civic_spaces` schema: `flags`, `blocks`, `moderators`, `action_log` — all with RLS enabled
- **RLS policies** on all 4 tables: user-scoped policies for flags/blocks (own rows only); moderator-scoped policies for queue/action-log access; self-check policy for moderators table
- **`is_moderator()`** SECURITY DEFINER helper — checks `civic_spaces.moderators` bypassing RLS; used in all moderator-restricted policies and RPCs
- **`is_blocked_by(p_user_id)`** SECURITY DEFINER RPC — lets the frontend detect if a specific user has blocked the current viewer without exposing the blocks table
- **`get_feed_filtered()`** SECURITY INVOKER RPC — standard feed with bidirectional block exclusion via NOT EXISTS subquery
- **`get_boosted_feed_filtered()`** SECURITY INVOKER RPC — friend/follow boosted feed with same bidirectional block exclusion added to base query
- **`get_mod_queue()`** SECURITY DEFINER plpgsql RPC — aggregates flagged posts with flag counts, categories, first-flagged timestamp, and priority escalation at 5+ flags; moderator-only guard
- **`mod_action()`** SECURITY DEFINER plpgsql RPC — atomically performs remove/dismiss/warn/suspend; resolves/dismisses flags; inserts action_log entry; moderator-only guard
- **`send_warn_notification()`** SECURITY DEFINER RPC — inserts 'warn' notification; called internally by mod_action
- **Notifications constraint extended** — `notifications_event_type_check` updated to include 'warn'
- **Block-aware reply INSERT policy** — replaces Phase 2's `replies_insert_slice_member`; adds NOT EXISTS check against blocks in both directions between reply author and post author
- **Block-aware friendship INSERT policy** — replaces Phase 3's `friendships_insert_own`; adds NOT EXISTS check against blocks in both directions between user_low and user_high
- **4 public-schema views**: `public.flags`, `public.blocks`, `public.moderators`, `public.action_log`
- **TypeScript types**: `FlagCategory`, `FlagStatus`, `Flag`, `Block`, `ModQueueItem`, `ModAction`, `ActionLogEntry`; `NotificationEventType` extended with `'warn'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected p.author_id reference in get_boosted_feed_filtered**

- **Found during:** Task 1, authoring get_boosted_feed_filtered
- **Issue:** Phase 3's `get_boosted_feed` references `p.author_id` in the LEFT JOIN and WHERE clause, but `civic_spaces.posts` has `user_id` (not `author_id`). The Phase 3 function has a latent bug. Replicating `p.author_id` in the new filtered version would produce the same error at runtime.
- **Fix:** Used `p.user_id` for the JOIN predicate (`ON ba.author_id = p.user_id`) and block exclusion subquery. Return column aliased as `author_id` per the RPC return signature to maintain API compatibility with Phase 3.
- **Files modified:** `supabase/migrations/20260328200000_phase5_moderation.sql`
- **Commit:** 0c693bf

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| SECURITY DEFINER on `is_blocked_by` | blocks RLS only permits `blocker_id = current_user` to SELECT; blocked users cannot query the table to discover they're blocked; DEFINER bypasses RLS for this controlled lookup |
| SECURITY DEFINER on `is_moderator` | moderators table SELECT policy requires user_id match; is_moderator() needs to check the table as a helper used in RLS policies themselves — DEFINER avoids infinite recursion risk |
| SECURITY DEFINER on `get_mod_queue` / `mod_action` | Both need to read/write all flags regardless of reporter_id; RLS on flags only exposes own rows to non-moderators; DEFINER bypasses RLS with explicit moderator guard |
| SECURITY INVOKER on feed RPCs | Consistent with project auth model; RLS applies to caller for membership and is_deleted checks |
| (SELECT ...) subquery wrapping on all policies | Established pattern from prior phases; PostgreSQL caches subquery result within statement for perf |
| group_window uses CURRENT_DATE in send_warn_notification | Phase 4 notifications.group_window is `date` type; CURRENT_DATE produces a `date` value matching the column type |

## Commits

- `0c693bf` feat(05-01): Phase 5 migration — tables, RLS, RPCs, views, block-aware policies
- `0fc3ed8` feat(05-01): TypeScript types for Phase 5 moderation & safety

## Next Phase Readiness

Phase 5 Plan 2 (Moderation UI) can proceed. All backend primitives are in place:
- Flag submission: INSERT into `public.flags` (or call RPC)
- Block user: INSERT into `public.blocks`
- Check if blocked by: call `is_blocked_by(user_id)`
- Mod queue: call `get_mod_queue()`
- Mod action: call `mod_action(action, post_id)`
- Feed: call `get_feed_filtered()` instead of raw posts query
