---
phase: 08-profile-pages
plan: 01
subsystem: database, api, ui
tags: [supabase, rpc, react-query, wouter, typescript, postgresql, security-definer]

# Dependency graph
requires:
  - phase: 07-new-slice-types
    provides: SliceType union (including unified/volunteer), SliceInfo shape, useAllSlices pattern
  - phase: 03-social-graph
    provides: friendships table with user_low/user_high normalization and status enum
provides:
  - get_profile_stats RPC: post_count, reply_count, friend_count for any user_id
  - get_mutual_friends RPC: TABLE of shared friends between viewer and subject
  - useProfileById hook extended with created_at field
  - useProfileStats hook wrapping get_profile_stats RPC
  - useProfileSlices hook: generalized slice memberships for any userId
  - useMutualFriends hook wrapping get_mutual_friends RPC
  - wouter installed for client-side routing
affects: [08-02-profile-components, 08-03-navigation-wiring]

# Tech tracking
tech-stack:
  added: [wouter@3.9.0]
  patterns: [SECURITY DEFINER RPCs with SET search_path = '' and fully qualified table refs, React Query hooks wrapping RPC calls with typed returns]

key-files:
  created:
    - supabase/migrations/20260404000000_phase8_profile_rpcs.sql
    - src/hooks/useProfileStats.ts
    - src/hooks/useProfileSlices.ts
    - src/hooks/useMutualFriends.ts
  modified:
    - src/hooks/useProfileById.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Vite SPA fallback: no config change needed — Vite's default appType='spa' already serves index.html for unmatched routes in dev"
  - "get_profile_stats returns JSON (not TABLE) since it aggregates three scalar counts into one row"
  - "useProfileSlices mirrors useAllSlices internals exactly, parameterized on userId — avoids touching useAllSlices for backward compat"

patterns-established:
  - "RPC hooks: call supabase.rpc(), throw on error, cast response as typed interface, wrap in React Query with staleTime: 5min"
  - "SECURITY DEFINER pattern: all table refs fully qualified with civic_spaces., SET search_path = '', GRANT EXECUTE to authenticated"

# Metrics
duration: 2min
completed: 2026-04-04
---

# Phase 8 Plan 01: Profile Data Layer Summary

**Two SECURITY DEFINER RPC functions (profile stats + mutual friends), wouter router, and four React Query hooks establishing the full data layer for profile pages**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-04T06:43:22Z
- **Completed:** 2026-04-04T06:45:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created `get_profile_stats` and `get_mutual_friends` RPC functions as SECURITY DEFINER with fully qualified table references and GRANT to authenticated role
- Installed wouter@3.9.0 for client-side routing (foundation for `/profile/:userId` routes)
- Extended `useProfileById` to include `created_at`, and created three new React Query hooks: `useProfileStats`, `useProfileSlices`, `useMutualFriends`
- All hooks type-check with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase migration with profile RPC functions + Vite SPA fallback** - `8848522` (feat)
2. **Task 2: Install wouter + create/extend all profile hooks** - `f817be8` (feat)

## Files Created/Modified

- `supabase/migrations/20260404000000_phase8_profile_rpcs.sql` - get_profile_stats and get_mutual_friends SECURITY DEFINER functions
- `src/hooks/useProfileStats.ts` - React Query hook wrapping get_profile_stats RPC, returns { postCount, replyCount, friendCount }
- `src/hooks/useProfileSlices.ts` - Generalized slice memberships hook for any userId (mirrors useAllSlices internals)
- `src/hooks/useMutualFriends.ts` - React Query hook wrapping get_mutual_friends RPC, returns MutualFriend[]
- `src/hooks/useProfileById.ts` - Extended: created_at added to select string, Pick type, and ProfileByIdResult interface
- `package.json` / `package-lock.json` - wouter@3.9.0 added as dependency

## Decisions Made

- **Vite SPA fallback:** No config change needed — Vite's default `appType='spa'` already serves `index.html` for unmatched routes in dev. The plan noted this as the likely outcome.
- **get_profile_stats returns JSON not TABLE:** Aggregates three scalar counts into one JSON object; more ergonomic for the hook's single-row consumption.
- **useProfileSlices mirrors useAllSlices:** Duplicated the fetch logic parameterized on `userId` rather than modifying `useAllSlices` — preserves backward compatibility and keeps concerns separate.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The migration will be applied when `supabase db push` is run (handled in deployment flow).

## Next Phase Readiness

- Data layer complete: all four hooks ready for Plan 02 (ProfilePage component) to consume
- wouter installed: Plan 03 (navigation wiring) can add `<Route path="/profile/:userId">` immediately
- Migration queued: `get_profile_stats` and `get_mutual_friends` RPCs will be available after next `supabase db push`
- No blockers

---
*Phase: 08-profile-pages*
*Completed: 2026-04-04*
