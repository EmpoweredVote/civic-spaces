---
phase: 07-new-slice-types
plan: 03
subsystem: ui
tags: [react, typescript, supabase, slices, feeds, tabs]

# Dependency graph
requires:
  - phase: 07-01
    provides: SliceType includes 'volunteer'; siblingIndex on SliceInfo; slices table has sibling_index column
  - phase: 07-02
    provides: unified and volunteer slice assignment on login; volunteer revocation
  - phase: 06-01
    provides: CSS hidden pattern for feed panel mounting; useAllSlices hook interface
provides:
  - Unified tab renders a real SliceFeedPanel (not a Coming Soon placeholder)
  - Volunteer tab conditionally rendered — absent from DOM when user has no volunteer slice
  - All 6 slice feeds have independent scroll refs for scroll preservation
  - Feed header "Name #N" visible above every feed
  - hasJurisdiction semantics corrected — true only when federal slice exists
  - NoJurisdictionBanner suppressed for users with Unified slice but no geo jurisdiction
affects: [08-discovery, phase-8, any future slice tab work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FEED_TABS array excludes volunteer; volunteer rendered conditionally after the loop
    - showVolunteerTab derived from !!slices['volunteer'] — single source of truth for tab visibility
    - TAB_LABELS module-level map drives both AppShell and SliceFeedPanel label consistency
    - ALL_TAB_KEYS used to initialize scrollRefs for all 6 tabs at mount time

key-files:
  created: []
  modified:
    - src/hooks/useAllSlices.ts
    - src/components/AppShell.tsx
    - src/components/SliceTabBar.tsx
    - src/components/SliceFeedPanel.tsx

key-decisions:
  - "FEED_TABS excludes volunteer — volunteer rendered as separate conditional block to allow DOM absence when not assigned"
  - "NoJurisdictionBanner gated on !hasJurisdiction && !slices['unified'] — unified users without geo slices see feeds, not banner"
  - "siblingIndex != null check (not falsy) used in header guard — allows index 0 to render if ever assigned"
  - "hasJurisdiction now derived from !!slices['federal'] — federal always assigned when jurisdiction exists"

patterns-established:
  - "Conditional tab DOM removal: showVolunteerTab prop drives both SliceTabBar RIGHT_TABS section and AppShell volunteer feed block"
  - "Feed header inside scrollable div before posts — visible even when feed is empty"

# Metrics
duration: 3min
completed: 2026-04-04
---

# Phase 7 Plan 03: Frontend Activation — Unified and Volunteer Feeds Summary

**Unified and Volunteer feeds activated in hub with conditional Volunteer tab gating, per-tab scroll refs for all 6 tabs, and "Name #N" headers on every feed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-04T04:03:41Z
- **Completed:** 2026-04-04T04:06:51Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Unified tab now loads a real SliceFeedPanel — "Coming soon" placeholder removed
- Volunteer tab absent from DOM entirely for non-Volunteer users; renders full feed for Volunteers
- Feed header ("Name #N") displayed inside scrollable div of every slice feed
- hasJurisdiction corrected to derive from federal slice presence only (not membership count)
- NoJurisdictionBanner suppressed for users with Unified slice but no geo jurisdiction
- Scroll refs initialized for all 6 tabs at mount time

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useAllSlices to return all slice types with siblingIndex** - `292e9dc` (feat)
2. **Task 2: Activate Unified and Volunteer feeds in AppShell + conditional Volunteer tab in SliceTabBar** - `ef5570c` (feat)
3. **Task 3: Add feed header with slice name and sibling index to SliceFeedPanel** - `1973b70` (feat)

## Files Created/Modified
- `src/hooks/useAllSlices.ts` - Removed GEO_SLICE_TYPES filter; added sibling_index to select; hasJurisdiction now federal-based
- `src/components/AppShell.tsx` - FEED_TABS + TAB_LABELS + ALL_TAB_KEYS; showVolunteerTab; volunteer conditional feed; NoJurisdictionBanner condition updated
- `src/components/SliceTabBar.tsx` - Replaced disabledTabs with showVolunteerTab; removed disabled state/Coming soon span; volunteer section conditionally rendered
- `src/components/SliceFeedPanel.tsx` - Added sliceName and siblingIndex optional props; feed header rendered before posts

## Decisions Made
- FEED_TABS excludes volunteer so it can be completely absent from DOM — volunteer rendered separately as a conditional block after the loop
- NoJurisdictionBanner now gated on `!hasJurisdiction && !slices['unified']` — Connected users without geo jurisdiction but with a Unified slice see feeds, not the banner
- `siblingIndex != null` used in header guard (not `!siblingIndex`) to allow index 0 to render correctly if ever assigned
- `hasJurisdiction` derived from `!!slices['federal']` — consistent with assignment service semantics (federal always assigned with valid jurisdiction)

## Deviations from Plan

None — plan executed exactly as written, with one minor extension: the `NoJurisdictionBanner` condition was updated to also check `!slices['unified']` so that users with a Unified slice but no geo jurisdiction see feeds instead of the banner. This directly implements the plan truth "A user with no geo jurisdiction but a Unified slice does NOT see the NoJurisdictionBanner."

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 (New Slice Types) is now complete — all 3 plans executed (schema, assignment service, frontend activation)
- Phase 8 (Discovery) can build on the full 6-tab hub
- Volunteer role field name still needs confirmation from accounts team before live check replaces stub in hasVolunteerRole
- get_boosted_feed_filtered RPC may need RLS adjustment for unified/volunteer slice_types (noted in STATE.md blockers)

---
*Phase: 07-new-slice-types*
*Completed: 2026-04-04*
