---
phase: 01-foundation
plan: "02"
subsystem: database
tags: [postgres, rls, triggers, supabase, geoid, tiger-line]

requires:
  - phase: 01-01
    provides: civic_spaces schema, current_user_id() helper, authenticated role grants

provides:
  - All civic_spaces tables: slices, slice_members, connected_profiles, posts, replies
  - RLS policies on all 5 tables using civic_spaces.current_user_id()
  - 6000-member cap trigger with FOR UPDATE lock (enforce_slice_cap)
  - Decrement trigger for clean count maintenance (decrement_slice_count)
  - updated_at triggers on connected_profiles, posts, replies
  - Seed data using real Monroe County, IN TIGER/Line GEOIDs

affects:
  - 01-03 (slice assignment service reads slices table, inserts into slice_members)
  - Phase 2 (feed UI queries posts/replies through RLS)
  - All phases using civic_spaces tables

tech-stack:
  added: []
  patterns:
    - "RLS subquery pattern: posts/replies gated via slice_members membership check"
    - "FOR UPDATE lock in BEFORE INSERT trigger for concurrent cap enforcement"
    - "Soft delete: is_deleted flag on posts/replies (never hard-deleted)"
    - "GREATEST() guard on decrement to prevent count underflow"
    - "Direct UPDATE bypass for seed data near-cap state (trigger only fires on INSERT)"

key-files:
  created:
    - supabase/migrations/20260327000001_schema.sql
    - supabase/migrations/20260327000002_rls.sql
    - supabase/migrations/20260327000003_triggers.sql
    - supabase/seed.sql
  modified: []

key-decisions:
  - "GEOID stored verbatim as text: no normalization, no hyphens, raw TIGER/Line strings"
  - "user_id is text (not uuid) on all tables — matches auth.jwt() ->> 'sub' from accounts JWT"
  - "FOR UPDATE lock in enforce_slice_cap serializes concurrent inserts to prevent race to 6001"
  - "slice_members INSERT is service_role only in practice; authenticated RLS only allows SELECT own rows"
  - "Soft delete on posts/replies: is_deleted = true hides from feeds, preserves reply thread integrity"
  - "GREATEST(count - 1, 0) in decrement trigger guards against impossible negative counts"

patterns-established:
  - "RLS subquery: SELECT slice_id FROM civic_spaces.slice_members WHERE user_id = civic_spaces.current_user_id()"
  - "Cap trigger: SELECT ... FOR UPDATE then UPDATE in same BEFORE INSERT function"
  - "Seed bypass: INSERT at 0, then direct UPDATE to 5999, so trigger fires only for real test members"

duration: 2min
completed: 2026-03-27
---

# Phase 1 Plan 2: Schema DDL Summary

**Five civic_spaces tables with RLS, cap-enforcement trigger (FOR UPDATE lock), decrement trigger, and Monroe County seed data using raw TIGER/Line GEOIDs**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-27T21:40:57Z
- **Completed:** 2026-03-27T21:43:00Z
- **Tasks:** 2 (+ documentation)
- **Files created:** 4

## Accomplishments

- Schema DDL for all 5 civic_spaces tables with correct column types, constraints, and indexes
- RLS enabled on every table; posts/replies gated to slice membership; profiles world-readable to authenticated
- Three triggers: cap enforcement with row lock, count decrement, updated_at maintenance
- Seed data that exercises cap at exactly 6000, verifies the slice_full exception, and tests decrement

## Task Commits

1. **Task 1: Schema DDL** - `1fa2488` (feat)
2. **Task 2: RLS, triggers, seed** - `ffa873b` (feat)

## Files Created/Modified

- `supabase/migrations/20260327000001_schema.sql` — All 5 tables, constraints, indexes, grants
- `supabase/migrations/20260327000002_rls.sql` — RLS enable + 8 policies across 5 tables
- `supabase/migrations/20260327000003_triggers.sql` — 3 trigger functions + 5 CREATE TRIGGER statements
- `supabase/seed.sql` — Monroe County GEOIDs, 3 test profiles, cap test, decrement test, sample posts/replies

## Decisions Made

**GEOID format confirmed (raw TIGER/Line, stored verbatim):**
- Congressional district: 4-digit (state_fips + district_num), e.g. "1807"
- State senate district: 5-digit (state_fips + zero-padded 3-digit), e.g. "18046"
- County: 5-digit FIPS, e.g. "18097"
- School district: 7-digit NCES, e.g. "1804770"
- No normalization anywhere — the `slices.geoid` column stores strings exactly as received from the accounts API

**FOR UPDATE lock strategy:** The cap trigger acquires a row-level lock on the slice row before checking the count. This serializes concurrent join attempts, preventing two users from racing past 6000.

**Service role for slice_members inserts:** The RLS policy on slice_members only grants SELECT to authenticated users (own rows only). The slice assignment service (01-03) will use the service role key for INSERT, bypassing RLS but still running through the cap trigger.

**Seed bypass pattern:** Seed inserts the federal slice at count=0, then uses a direct UPDATE to 5999 (no trigger on UPDATE), then inserts 1 real member via the trigger to reach exactly 6000. This keeps the trigger logic honest while allowing fast seeding.

## Deviations from Plan

None — plan executed exactly as written.

One minor enhancement: added `GREATEST(count - 1, 0)` guard in the decrement trigger to prevent an impossible negative count if data is ever inconsistent. This is defensive programming, not scope expansion.

## Issues Encountered

None.

## User Setup Required

None — migrations and seed run via `supabase db push` / `supabase db reset`. No external service configuration needed for this plan.

## Next Phase Readiness

- Schema is complete; 01-03 (slice assignment service) can be written against these tables
- The `slices` table contains Monroe County seed data; 01-03 will query it by GEOID to assign users
- RLS is live on all tables; the exchange-token Edge Function (01-01) must be working before any client queries will succeed

---
*Phase: 01-foundation*
*Completed: 2026-03-27*
