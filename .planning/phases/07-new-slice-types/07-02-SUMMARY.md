---
phase: 07-new-slice-types
plan: 02
subsystem: api
tags: [supabase, typescript, slice-assignment, postgres, express]

# Dependency graph
requires:
  - phase: 07-01
    provides: CHECK constraint accepting unified/volunteer slice_types; SliceType union updated; siblingIndex on SliceInfo
provides:
  - assignUnifiedIfNotAssigned export — check-before-insert idempotent unified assignment
  - assignVolunteerIfEligible export — role-gated volunteer assignment with revocation
  - hasVolunteerRole stub — returns false with TODO(volunteer-role); one change enables live role check
  - isAlreadyAssignedToType helper — prevents blind re-upsert for stable cohorts
  - removeMembershipByType helper — hard DELETE for volunteer revocation (trigger handles count)
  - /assign route now calls unified + volunteer for all Connected users, geo only when jurisdiction present
affects:
  - 07-03 (tab activation for Unified/Volunteer feeds)
  - volunteer-role-api (when accounts team finalizes field name — search TODO(volunteer-role))

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "check-before-insert pattern: query existing membership before upsert for stable-cohort slices (unified)"
    - "role revocation via DELETE: hard delete + DB trigger handles member count decrement"
    - "geoid sentinel strings: UNIFIED / VOLUNTEER constants for non-geo slice types"
    - "route orchestration: unified → volunteer → geo, each independently gated by its own conditions"

key-files:
  created: []
  modified:
    - services/slice-assignment/src/services/sliceAssigner.ts
    - services/slice-assignment/src/services/accountsApi.ts
    - services/slice-assignment/src/routes/assignment.ts

key-decisions:
  - "check-before-insert used for unified (not blind upsert) — users stay in same cohort for 2-year term"
  - "unified assignment runs before jurisdiction check — non-geo slice, no dependency on jurisdiction"
  - "volunteer revocation on every login when role is absent — ensures prompt removal without a separate webhook"
  - "assigned array may be empty only if no_jurisdiction AND unified fails (theoretical guard kept)"

patterns-established:
  - "Stable cohort pattern: isAlreadyAssignedToType + upsertSliceMember instead of blind upsert"
  - "Role-gated assignment: check role → if absent, revoke via DELETE; if present, check-before-insert assign"

# Metrics
duration: 3min
completed: 2026-04-04
---

# Phase 7 Plan 02: New Slice Types — Assignment Service Summary

**Unified and Volunteer slice assignment added to login flow with check-before-insert idempotency, role-revocation DELETE, and volunteer stub ready for one-line activation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-04T02:25:29Z
- **Completed:** 2026-04-04T02:28:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended sliceAssigner.ts with four new functions: `isAlreadyAssignedToType`, `removeMembershipByType`, `assignUnifiedIfNotAssigned` (exported), `assignVolunteerIfEligible` (exported)
- Volunteer infrastructure fully built — stubbed with `hasVolunteerRole` returning false; enabling live role check requires only updating `AccountData` field + one return statement
- Restructured /assign route so unified/volunteer assignment runs for all Connected users regardless of jurisdiction; geo assignment remains jurisdiction-gated; all slice IDs collected in a single response array

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend sliceAssigner.ts with Unified and Volunteer assignment** - `8daa356` (feat)
2. **Task 2: Wire new assignment functions into the /assign route** - `e9ea9fa` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/slice-assignment/src/services/sliceAssigner.ts` — Added UNIFIED_GEOID/VOLUNTEER_GEOID constants, isAlreadyAssignedToType, removeMembershipByType, assignUnifiedIfNotAssigned (export), assignVolunteerIfEligible (export), hasVolunteerRole stub with TODO(volunteer-role)
- `services/slice-assignment/src/services/accountsApi.ts` — Added TODO(volunteer-role) comment to AccountData interface explaining pending role field
- `services/slice-assignment/src/routes/assignment.ts` — Restructured to call unified + volunteer before geo; unified not gated by jurisdiction; all IDs merged into single assigned array

## Decisions Made
- **check-before-insert for unified** (not upsert): Users belong to a stable 2-year cohort. Blind upsert could silently move them between siblings if slice membership state changed. Query first, only insert if not found.
- **Unified before jurisdiction check**: Unified is not geo-based. Moving `assignUnifiedIfNotAssigned` before the `jurisdiction` guard ensures Connected users without a jurisdiction still get a Unified slice.
- **Volunteer revocation on every login**: When `hasVolunteerRole` returns false, `removeMembershipByType` runs unconditionally. This ensures prompt removal without needing a separate role-change webhook.
- **no_jurisdiction guard kept but narrowed**: The route now only returns `no_jurisdiction` if `assigned.length === 0`. Since unified always assigns (for Connected users), this case is currently unreachable — kept as a defensive guard.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Assignment service handles all three slice types: geo (4 slices), unified (1 global), volunteer (role-gated)
- Volunteer role check is a one-TODO change — search `TODO(volunteer-role)` in the codebase when accounts team confirms field name
- Phase 07-03 can now activate the Unified and Volunteer tabs in the hub UI, knowing assignment is wired
- Blocker to clear before activating Volunteer tab: confirm volunteer role API field name with accounts team

---
*Phase: 07-new-slice-types*
*Completed: 2026-04-04*
