---
phase: 02-core-forum
plan: 02
subsystem: ui
tags: [react, tanstack-query, supabase-realtime, infinite-scroll, intersection-observer, date-fns, react-loading-skeleton]

# Dependency graph
requires:
  - phase: 02-01
    provides: App shell, supabase client with civic_spaces schema, PostWithAuthor type, SliceFeedPanel placeholder
  - phase: 01-02
    provides: civic_spaces schema with posts and connected_profiles tables

provides:
  - Cursor-paginated feed with useInfiniteQuery and composite cursor (created_at + id)
  - Two-query pattern for post + author profile merging (no FK join)
  - Supabase Realtime subscription invalidating feed cache on post changes
  - PostCard component with avatar, author, timestamp, edited indicator, reply count, tombstone
  - FeedSkeleton with 5 skeleton cards for loading state
  - SliceFeedPanel with IntersectionObserver infinite scroll

affects:
  - 02-03 (post creation — adds to feed via Realtime invalidation)
  - 02-04 (thread view — onClick handler in PostCard currently console.log, needs routing)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite cursor pagination: order by (created_at DESC, id DESC), cursor filters with .or() for stable keyset"
    - "Two-query pattern for relational data: fetch IDs then .in() for profiles"
    - "IntersectionObserver infinite scroll: sentinel div at bottom of list, observer in useEffect"
    - "Realtime cache invalidation: supabase.channel + postgres_changes triggers queryClient.invalidateQueries"
    - "base64url cursor encoding: JSON -> btoa -> replace +/= chars for URL safety"

key-files:
  created:
    - src/lib/cursors.ts
    - src/hooks/useFeed.ts
    - src/hooks/useRealtimeInvalidation.ts
    - src/components/PostCard.tsx
    - src/components/FeedSkeleton.tsx
  modified:
    - src/components/SliceFeedPanel.tsx

key-decisions:
  - "Composite cursor (created_at + id) chosen over offset pagination for consistency under concurrent inserts"
  - "Two-query pattern retained (no FK constraints in schema, consistent with useFederalSlice precedent)"
  - "PostCard onClick logs post ID — thread view deferred to 02-04"

patterns-established:
  - "Composite cursor pattern: last item's (created_at, id) becomes next page cursor"
  - "Realtime invalidation pattern: channel per slice, invalidate on any postgres_changes event"

# Metrics
duration: 2min
completed: 2026-03-27
---

# Phase 2 Plan 02: Feed — Cursor Pagination, PostCard, Realtime Cache Invalidation Summary

**Infinite-scroll post feed using useInfiniteQuery with composite keyset cursor, two-query author merging, Supabase Realtime invalidation, PostCard with avatar/timestamp/reply count, and FeedSkeleton loading placeholders**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-28T02:23:10Z
- **Completed:** 2026-03-28T02:25:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Cursor utilities (FeedCursor type, base64url encode/decode) for stable keyset pagination
- useFeed with useInfiniteQuery: two-query pattern (posts then profiles) with composite cursor preventing duplicates on concurrent inserts
- useRealtimeInvalidation: Supabase Realtime channel per slice, invalidates `['feed', sliceId]` cache on any post change
- PostCard: avatar with initial fallback, relative timestamp via date-fns, edited indicator, reply count with SVG icon, tombstone for deleted posts
- FeedSkeleton: 5 placeholder cards matching PostCard layout using react-loading-skeleton
- SliceFeedPanel: fully replaces placeholder with IntersectionObserver infinite scroll, error state with retry, empty state, loading spinner for next-page fetch

## Task Commits

Each task was committed atomically:

1. **Task 1: Cursor utils, useFeed, useRealtimeInvalidation** - `9ee30be` (feat)
2. **Task 2: PostCard, FeedSkeleton, SliceFeedPanel** - `7cc3d8a` (feat)

**Plan metadata:** `(pending)` (docs: complete feed plan)

## Files Created/Modified
- `src/lib/cursors.ts` - FeedCursor type, base64url encode/decode utilities
- `src/hooks/useFeed.ts` - useInfiniteQuery with two-query pattern and composite cursor
- `src/hooks/useRealtimeInvalidation.ts` - Realtime subscription with cache invalidation
- `src/components/PostCard.tsx` - Post card with avatar, author info, body preview, reply count, deleted tombstone
- `src/components/FeedSkeleton.tsx` - 5-card loading skeleton matching PostCard layout
- `src/components/SliceFeedPanel.tsx` - Rewritten from placeholder with full infinite scroll implementation

## Decisions Made
- Composite cursor (created_at + id) rather than offset: offset pagination skips or duplicates posts on concurrent inserts; keyset is stable
- Two-query pattern retained for profiles (no FK constraints in civic_spaces schema — established in 02-01)
- PostCard onClick defers to `console.log` — thread/detail view ships in 02-04

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Feed read experience complete: infinite scroll, skeleton loading, error state, Realtime updates
- 02-03 (post creation) will add posts that appear via Realtime invalidation automatically
- 02-04 (thread view) needs to replace `console.log('Open post', postId)` in PostCard onClick with actual navigation
- Migration `20260327100000_phase2_schema.sql` must be applied to Supabase before feed queries return data

---
*Phase: 02-core-forum*
*Completed: 2026-03-27*
