---
phase: 02-core-forum
plan: "04"
subsystem: ui
tags: [react, tanstack-query, zod, react-hook-form, date-fns, supabase, pagination, optimistic-updates]

# Dependency graph
requires:
  - phase: 02-02
    provides: PostCard, useFeed, SliceFeedPanel with infinite scroll
  - phase: 02-03
    provides: FAB, PostComposer, useDeletePost, tier-gating pattern

provides:
  - useThread hook (two-query: post + paginated replies with composite cursor)
  - useCreateReply hook with optimistic append to InfiniteData
  - InformUpgradePrompt modal component (reusable)
  - ReplyCard with depth-0 and depth-1 layouts
  - ReplyComposer inline form (react-hook-form + zod)
  - ThreadView with nested reply tree, load-more, and inform-tier gating
  - SliceFeedPanel wired to ThreadView on PostCard click

affects: [03-realtime, 04-search, 05-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-query pattern for replies: fetch replies then batch-fetch profiles by unique user_ids"
    - "Composite cursor (created_at + id) for ascending reply pagination — mirrors feed cursor pattern"
    - "InfiniteData optimistic append: snapshot last page, push temp item, restore on error"
    - "Hidden/show pattern for feed/thread: hidden class preserves scroll, ThreadView mounts on top"
    - "Two-level reply nesting: depth-0 shows Reply button, depth-1 indented with border-l-2 accent, no further nesting"

key-files:
  created:
    - src/hooks/useThread.ts
    - src/hooks/useCreateReply.ts
    - src/components/InformUpgradePrompt.tsx
    - src/components/ReplyCard.tsx
    - src/components/ReplyComposer.tsx
    - src/components/ThreadView.tsx
  modified:
    - src/components/SliceFeedPanel.tsx

key-decisions:
  - "Reply pagination uses ascending composite cursor (created_at ASC, id ASC) — oldest-first order"
  - "Reply composer renders inline below targeted post/reply, not in a modal sheet"
  - "Feed is hidden (not unmounted) when ThreadView is active — preserves scroll position"
  - "InformUpgradePrompt replaces inline overlay in SliceFeedPanel — now a reusable shared component"
  - "Depth-1 replies show no Reply button — max nesting enforced at render level"

patterns-established:
  - "InfiniteData optimistic update: cancel queries, snapshot, mutate last page, rollback on error"
  - "useThread composes useQuery (post) + useInfiniteQuery (replies) into single return object"
  - "InformUpgradePrompt: returns null if !isOpen, backdrop click closes, card click stopPropagation"

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 2 Plan 04: Thread View Summary

**Thread view with two-level nested reply tree, inline ReplyComposer, optimistic reply mutations, load-more pagination, and reusable InformUpgradePrompt component**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-28T02:36:01Z
- **Completed:** 2026-03-28T02:38:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Thread query hook using two-query pattern: useQuery for post + useInfiniteQuery for replies (page size 20, ascending composite cursor)
- useCreateReply with optimistic append to InfiniteData last page, snapshot rollback on error, invalidates replies + feed on settled
- ReplyCard with depth-0 (no indent) and depth-1 (ml-8 border-l-2 border-blue-200 pl-4) layouts; tombstone for deleted replies
- ThreadView renders full post, nested reply tree (2-level max), inline ReplyComposer, load-more button, inform-tier gating via InformUpgradePrompt
- SliceFeedPanel wired: PostCard onClick sets activePostId, feed hidden (not unmounted) to preserve scroll, ThreadView mounts over it
- Inline inform-tier overlay in SliceFeedPanel replaced with reusable InformUpgradePrompt component

## Task Commits

1. **Task 1: Thread query hook, reply mutation, InformUpgradePrompt** - `ddaf64d` (feat)
2. **Task 2: ReplyCard, ReplyComposer, ThreadView, feed navigation** - `75851cd` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/hooks/useThread.ts` - Post + paginated replies via two-query pattern, ascending composite cursor
- `src/hooks/useCreateReply.ts` - Reply insert mutation with optimistic InfiniteData append
- `src/components/InformUpgradePrompt.tsx` - Reusable inform-tier upgrade modal
- `src/components/ReplyCard.tsx` - Reply display with depth-0/depth-1 layouts and tombstone
- `src/components/ReplyComposer.tsx` - Inline reply form with react-hook-form + zod
- `src/components/ThreadView.tsx` - Full thread: post + nested reply tree + load-more + gating
- `src/components/SliceFeedPanel.tsx` - Added activePostId state, ThreadView navigation, InformUpgradePrompt swap

## Decisions Made
- Reply pagination uses ascending composite cursor (created_at ASC, id ASC) — matches "oldest first" display requirement
- Feed is hidden (not unmounted) when ThreadView is active — preserves IntersectionObserver scroll position
- Inline InformUpgradePrompt component replaces both the old inline overlay in SliceFeedPanel and serves ThreadView
- Depth-1 replies rendered with `canWrite={false}` — prevents Reply button at depth-1 (max nesting enforced at render)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript check zero errors, Vite build succeeds (chunk size warning is expected — large deps, not a bug).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (Core Forum) is complete: feed, post CRUD, reply thread, tier gating all wired
- Ready for Phase 3: realtime subscriptions, notifications, or search
- No blockers
- Pending: apply supabase/migrations/20260327100000_phase2_schema.sql before going live

---
*Phase: 02-core-forum*
*Completed: 2026-03-28*
