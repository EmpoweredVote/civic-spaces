---
phase: 07-new-slice-types
plan: 01
subsystem: database
tags: [postgres, typescript, supabase, check-constraint, slice-types]

# Dependency graph
requires:
  - phase: 06-hub-expansion
    provides: SliceType union type and SliceInfo interface baseline; zero-error tsc build

provides:
  - SQL migration that extends slices CHECK constraint to 6 values (adds unified, volunteer)
  - SliceType TypeScript union with all 6 values mirroring DB constraint
  - SliceInfo interface with siblingIndex field for assignment service use

affects:
  - 07-02 (assignment service — reads SliceType, constructs SliceInfo with siblingIndex)
  - 07-03 (frontend tab activation — consumes updated SliceInfo shape)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DROP/ADD constraint pattern for Postgres CHECK constraint expansion (no data migration needed)"
    - "NOTIFY pgrst 'reload schema' appended to every structural DDL migration"
    - "SliceType union kept in sync with DB CHECK constraint values as single source of truth"

key-files:
  created:
    - supabase/migrations/20260403000000_phase7_unified_volunteer.sql
  modified:
    - src/types/database.ts

key-decisions:
  - "SliceType now includes 'volunteer' — resolves the Phase 6 decision to defer this to Phase 7"
  - "siblingIndex added as required field on SliceInfo — assignment service (07-02) populates it from slices.sibling_index"
  - "No sentinel rows inserted — assignment service findActiveSliceForGeoid creates slices on demand (confirmed in research)"
  - "Existing UNIQUE constraint slices_geoid_type_sibling_key handles unified and volunteer types automatically"

patterns-established:
  - "DB CHECK constraint values and SliceType union must stay identical — verified by tsc after each migration"

# Metrics
duration: 2min
completed: 2026-04-04
---

# Phase 7 Plan 01: New Slice Types Summary

**Postgres CHECK constraint extended to 6 slice types (unified + volunteer) with matching TypeScript SliceType union and siblingIndex field on SliceInfo — tsc clean**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-04T02:21:27Z
- **Completed:** 2026-04-04T02:22:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Migration file drops and recreates `slices_slice_type_check` constraint accepting all 6 slice_type values
- `SliceType` TypeScript union now mirrors the DB constraint exactly (federal, state, local, neighborhood, unified, volunteer)
- `SliceInfo` interface gains `siblingIndex: number` required field — needed by assignment service and feed queries
- Project-wide `tsc --noEmit` passes clean with zero errors after both changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration — extend CHECK constraint and add NOTIFY** - `f593d0f` (feat)
2. **Task 2: Extend TypeScript types — SliceType and SliceInfo** - `d49d7b4` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/migrations/20260403000000_phase7_unified_volunteer.sql` — DDL migration: DROP old constraint, ADD new with 6 values, NOTIFY pgrst
- `src/types/database.ts` — SliceType union extended to include 'volunteer'; SliceInfo gains siblingIndex field

## Decisions Made

- **'volunteer' added to SliceType now:** Resolves Phase 6 deferral. The Plan 06-04 cast workaround (`activeTab as SliceType`) becomes type-safe after this change.
- **siblingIndex as required field:** The field is always present in the DB row; making it required ensures assignment service constructs are complete.
- **No sentinel row inserts:** Assignment service creates unified/volunteer slices on demand via `findActiveSliceForGeoid` — inserting sentinel rows here would duplicate that logic.

## Deviations from Plan

None — plan executed exactly as written. TSC was clean rather than producing the expected `useAllSlices.ts` downstream errors (those were pre-resolved in Phase 6 gap-closure 06-05).

## Issues Encountered

None. Clean execution.

## User Setup Required

None — no external service configuration required. The migration will be applied when `supabase db push` is run (Phase 7 deployment step).

## Next Phase Readiness

- **07-02 (Assignment Service):** Schema and types are ready. SliceType includes 'volunteer', SliceInfo has siblingIndex. Assignment service can now call the DB and construct typed SliceInfo objects.
- **07-03 (Frontend Activation):** SliceType and SliceInfo shape is finalized. Tab activation code can safely reference 'volunteer' without casts.
- **Remaining blocker:** Volunteer role API field name not yet confirmed — must resolve before 07-02 assignment service implements role-gating.

---
*Phase: 07-new-slice-types*
*Completed: 2026-04-04*
