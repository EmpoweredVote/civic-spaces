---
plan: 03-01
status: complete
phase: 03-social-graph
subsystem: database/social-graph
tags: [supabase, postgresql, rls, typescript, social-graph, friendships, follows]
depends_on: [02-04]
provides: [friendships-table, follows-table, rls-policies, get_boosted_feed-rpc, social-graph-types, friendship-utilities]
affects: [03-02, 03-03]
tech-stack:
  added: []
  patterns: [single-row-normalized-friendship, directional-follow, boosted-feed-rpc, composite-cursor-pagination]
key-files:
  created:
    - supabase/migrations/20260328000000_phase3_social_graph.sql
    - src/lib/friendship.ts
  modified:
    - src/types/database.ts
decisions:
  - "Friendships use single-row normalization (user_low < user_high) — eliminates duplicate-row bugs and simplifies RLS"
  - "RLS policies all use (select civic_spaces.current_user_id()) subquery wrapping — consistent with project-wide auth pattern"
  - "BoostedPostWithAuthor includes tier in author Pick — Phase 3 UI needs tier for EmpoweredBadge rendering"
  - "get_boosted_feed uses SECURITY INVOKER — RLS applies to the caller, follows project security model"
metrics:
  duration: "~2 min"
  completed: "2026-03-28"
---

# Phase 3 Plan 1: Social Graph Foundation Summary

**One-liner:** Phase 3 schema foundation — friendships (normalized), follows (directional), 7 RLS policies, get_boosted_feed RPC with boosted_at synthetic column, pg_trgm GIN index, and TypeScript types + friendship key utilities.

## What Was Built

- **Empowered tier fix:** `connected_profiles_tier_check` constraint updated to include `'empowered'` as valid tier value
- **pg_trgm:** Extension enabled with GIN trigram index on `connected_profiles.display_name` for fuzzy member search
- **Friendships table:** Single-row normalized (`user_low < user_high` CHECK), composite PK, status enum (`REQ_LOW`, `REQ_HIGH`, `FRIEND`), two composite indexes, `updated_at` auto-trigger
- **Follows table:** Directional (`follower_id`, `target_id`), composite PK, two single-column indexes
- **Friendship RLS (4 policies):** SELECT (both sides), INSERT (requester's side + status match), UPDATE (recipient-only accept, `FRIEND` only), DELETE (either side)
- **Follows RLS (3 policies):** SELECT (follower or target), INSERT (follower is self AND target is Empowered-tier), DELETE (follower only)
- **get_boosted_feed RPC:** Returns posts with `boosted_at` = `created_at + 2 hours` for mutual friends and followed Empowered accounts; supports composite cursor pagination
- **Public-schema views:** `public.friendships` and `public.follows` forwarding to `civic_spaces.*` for PostgREST access
- **TypeScript types:** `Friendship`, `Follow`, `BoostedPost`, `BoostedPostWithAuthor`, `RelationshipState`, `FriendshipStatus`; `ConnectedProfile.tier` updated to include `'empowered'`
- **Friendship utilities:** `friendshipKey()` (canonical row key) and `friendshipStatus()` (RelationshipState from row + currentUserId)

## Commits

| Task | Hash | Files |
|------|------|-------|
| Task 1: Phase 3 migration | 203e074 | supabase/migrations/20260328000000_phase3_social_graph.sql |
| Task 2: TypeScript types and utilities | 212ba2e | src/types/database.ts, src/lib/friendship.ts |

## Decisions

- **Single-row normalization for friendships:** One row per pair with `user_low < user_high` enforced by CHECK constraint. Eliminates the need for bidirectional row management and makes RLS policies unambiguous.
- **SECURITY INVOKER on get_boosted_feed:** RLS policies apply to the calling user's context, consistent with the rest of the project. No security definer elevation needed.
- **`BoostedPostWithAuthor` includes `tier` in author Pick:** Phase 3 UI needs tier badge rendering on feed cards (EmpoweredBadge), unlike Phase 2's `PostWithAuthor` which omits tier.
- **`(select ...)` subquery wrapping on all RLS policies:** PostgreSQL caches the subquery result within a statement, improving performance over bare function calls on large tables.

## Deviations from Plan

None — plan executed exactly as written.

## Verified

- Migration file reviewed manually: all 9 sections present, correct SQL syntax, all constraints and indexes in place
- 4 friendship RLS policies confirmed with OR logic covering both user_low and user_high sides
- 3 follows RLS policies confirmed with Empowered subquery on INSERT
- `get_boosted_feed` returns `boosted_at` synthetic column using composite cursor pattern
- `npx tsc --noEmit` passed with zero errors after all type additions
- `friendshipKey()` and `friendshipStatus()` logic verified against REQ_LOW/REQ_HIGH semantics

## Next Phase Readiness

- Phase 3 Plans 02 and 03 (UI components) depend on all artifacts from this plan
- `src/lib/friendship.ts` utilities are ready to import for friend request flows
- `get_boosted_feed` RPC is callable via `supabase.rpc('get_boosted_feed', { p_slice_id })` from Phase 3 hooks
