---
plan: 03-03
status: complete
phase: 03-social-graph
subsystem: feed
tags: [boosted-feed, rpc, cursor-pagination, react-query, realtime, social-graph]
depends_on: ["03-01", "03-02"]
provides: [useBoostedFeed-hook, BoostedFeedCursor-type, SliceFeedPanel-boosted]
affects: ["04-voting", "05-notifications"]
tech-stack:
  added: []
  patterns: [rpc-with-cursor-pagination, realtime-invalidation-in-hook, batch-profile-fetch]
key-files:
  created:
    - src/hooks/useBoostedFeed.ts
  modified:
    - src/lib/cursors.ts
    - src/components/SliceFeedPanel.tsx
decisions:
  - "useBoostedFeed owns its own realtime invalidation (postgres_changes on boosted-feed queryKey) — not delegated to useRealtimeInvalidation"
  - "RPC returns author_id (not user_id) — hook uses (p: any) cast for impedance mismatch between RPC result and Post type"
  - "Cursor uses boosted_at from RPC result (synthetic sort key), never created_at — critical for correct pagination across page boundaries"
  - "useRealtimeInvalidation left in SliceFeedPanel (minimal diff approach) — it targets old feed queryKey, harmless no-op"
metrics:
  duration: ~3 min
  completed: 2026-03-28
---

# Phase 3 Plan 3: Boosted Feed Summary

**One-liner:** Replaced chronological feed with friend-boosted RPC feed — `useBoostedFeed` calls `get_boosted_feed`, cursor tracks `boosted_at` synthetic sort key, SliceFeedPanel switched from `useFeed`.

## What Was Built

- `BoostedFeedCursor` interface added to `src/lib/cursors.ts` — tracks `boosted_at` (ISO timestamp synthetic sort key) and `id` (UUID tiebreaker)
- `src/hooks/useBoostedFeed.ts` — new hook calling `supabase.rpc('get_boosted_feed')` with cursor pagination, batch profile fetch from `connected_profiles` view, and built-in realtime invalidation
- `SliceFeedPanel.tsx` wired to `useBoostedFeed` — posts from mutual friends and followed Empowered accounts appear 2 hours earlier in the sort order without any visible label

## Commits

| Task | Hash | Files |
|------|------|-------|
| Task 1: BoostedFeedCursor type and useBoostedFeed hook | f58ae86 | src/lib/cursors.ts, src/hooks/useBoostedFeed.ts |
| Task 2: Wire SliceFeedPanel to use boosted feed | 45412ac | src/components/SliceFeedPanel.tsx |

## Decisions

- **Cursor field:** `boosted_at` from the RPC result is used as the cursor `p_cursor_at` parameter. This is the synthetic value (`created_at + 2h` for boosted authors, `created_at` for others) that the RPC's WHERE clause compares against — using `created_at` here would cause skipped/duplicated posts across pages.
- **`author_id` vs `user_id`:** The `get_boosted_feed` RPC RETURNS TABLE declares `author_id text` (renamed from posts.user_id). The hook uses `(p: any)` casting to bridge the impedance mismatch. `BoostedPostWithAuthor` structural typing is a superset of `PostWithAuthor` so `editingPost: PostWithAuthor | null` in SliceFeedPanel accepts it without changes.
- **Realtime in hook:** Built the realtime channel directly into `useBoostedFeed` (invalidates `['boosted-feed', sliceId]`) rather than relying on `useRealtimeInvalidation` which targets the old `['feed', sliceId]` queryKey.

## Deviations from Plan

None — plan executed exactly as written.

## Verified

- TypeScript compiles with `npx tsc --noEmit` — zero errors after both tasks
- `BoostedFeedCursor` interface present in `src/lib/cursors.ts` alongside `FeedCursor`
- `useBoostedFeed` calls `supabase.rpc('get_boosted_feed', { p_slice_id, p_limit, p_cursor_at, p_cursor_id })`
- Cursor `getNextPageParam` returns `{ boosted_at: last.boosted_at, id: last.id }` — boosted_at field confirmed
- `SliceFeedPanel` imports and calls `useBoostedFeed(sliceId)` — old `useFeed` import commented as fallback
- `useInfiniteQuery` API identical between hooks — infinite scroll, `fetchNextPage`, `hasNextPage`, `isFetchingNextPage` all work unchanged

## Next Phase Readiness

Phase 3 complete. All three plans (03-01 schema, 03-02 social UI, 03-03 boosted feed) delivered.
Phase 4 (voting) can proceed — no blockers.
