# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-03)

**Core value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.
**Current focus:** Milestone v2.0 — All Slices. Phase 7 complete — verified 5/5. Ready for Phase 8: Profile Pages.

## Current Position

Phase: 7 of 8 (New Slice Types) — Complete
Plan: 3 of 3 in Phase 7 — frontend activation of Unified/Volunteer feeds
Status: Phase 7 complete
Last activity: 2026-04-04 — Completed 07-03-PLAN.md (Unified/Volunteer feeds activated, conditional Volunteer tab, feed headers)

Progress (v2.0): [████████░░░░░░░░░░░] 42%

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 14
- Phases 1–5 delivered 2026-03-27 to 2026-03-28

**Velocity (v2.0):**
- Phase 6 plans completed: 5 of 5
- Phase 6 delivered: 2026-04-03

## Accumulated Context

### Decisions

- [v2.0 / Plan 06-05]: tsconfig types array used for vite/client instead of vite-env.d.ts — canonical Vite approach, no file to maintain
- [v2.0 / Plan 06-05]: Supabase join array cast via `as unknown as T[]` — typegen emits joined rows as arrays even with maybeSingle(); cast through unknown is correct escape hatch
- [v2.0 / Plan 06-05]: tier: 'connected' as const in optimistic author stubs — satisfies Pick<ConnectedProfile, 'tier'> without importing full union
- [v2.0 / Plan 06-04]: onNavigateToThread kept optional in NotificationList interface; aliased _onNavigateToThread in destructuring to suppress TS6133 without removing backward-compat prop
- [v2.0 / Plan 07-03]: FEED_TABS excludes volunteer — volunteer rendered as separate conditional block so it can be absent from DOM entirely
- [v2.0 / Plan 07-03]: NoJurisdictionBanner gated on !hasJurisdiction && !slices['unified'] — unified users without geo slices see feeds, not banner
- [v2.0 / Plan 07-03]: hasJurisdiction derived from !!slices['federal'] — federal always assigned when jurisdiction exists, matches assignment service semantics
- [v2.0 / Plan 07-03]: siblingIndex != null guard (not falsy) used in feed header — allows index 0 to render correctly
- [v2.0 / Plan 07-02]: check-before-insert used for unified (not upsert) — stable 2-year cohort, users stay in same sibling slice
- [v2.0 / Plan 07-02]: unified assignment runs before jurisdiction check — non-geo slice, Connected users without jurisdiction still get Unified
- [v2.0 / Plan 07-02]: volunteer revocation on every login when role absent — prompt removal without webhook dependency
- [v2.0 / Plan 07-02 / gap fix]: checkVolunteerRole uses POST /api/roles/check with { feature_scope: 'volunteer', jurisdiction_geoid: null } — platform-scope grant check; 90s server-side cache means revocation lags by up to 90s (by design)
- [v2.0 / Plan 07-01]: SliceType now includes 'volunteer' — resolves Phase 6 deferral; Plan 06-04 cast (activeTab as SliceType) is now type-safe
- [v2.0 / Plan 07-01]: siblingIndex added as required field on SliceInfo — assignment service (07-02) always provides it from slices.sibling_index
- [v2.0 / Plan 07-01]: No sentinel rows inserted in migration — assignment service creates unified/volunteer slices on demand via findActiveSliceForGeoid
- [v2.0 / Plan 06-04]: activeTab as SliceType cast used at MemberDirectory sliceId access site — runtime safe (volunteer returns undefined, handled by optional chain); 'volunteer' NOT added to SliceType (Phase 7 domain — now resolved)
- [v2.0 / Plan 06-03]: useNotificationRouting is a one-off async resolver (no React Query) — called on notification tap, looks up posts.slice_id then reverse-maps against slices to find TabKey; falls back to 'federal' on any error
- [v2.0 / Plan 06-03]: Reply notifications route via onNavigateToSliceThread (new prop); onNavigateToThread kept for backward compat but unused for reply events now
- [v2.0 / Plan 06-02]: Explicit scrollTop save/restore used for per-tab scroll preservation — requestAnimationFrame ensures restore fires after display:none is removed; save fires synchronously in handleTabChange before setActiveTab
- [v2.0 / Plan 06-01]: CSS hidden used (not conditional rendering) for all 4 geo SliceFeedPanels — preserves React Query cache and DOM scroll across tab switches; required for 06-02 scroll preservation
- [v2.0 / Plan 06-01]: Per-tab activePostIds Record<TabKey,string|null> prevents cross-tab thread view interference when all panels are simultaneously mounted
- [v2.0 / Plan 06-01]: useAllSlices returns Partial<Record<SliceType,SliceInfo>> so AppShell handles users missing some geo slice assignments gracefully
- [v2.0 / Roadmap]: Phase 6 activates N/L/S geo tabs; Unified/Volunteer tab shells added as disabled placeholders
- [v2.0 / Roadmap]: Phase 7 owns all new slice_type schema, assignment service, and tab activation for Unified and Volunteer
- [v2.0 / Roadmap]: Unified geoid sentinel = 'UNIFIED'; Volunteer geoid sentinel = 'VOLUNTEER'
- [v2.0 / Milestone init]: Global Slice (Unified tab) is a distinct 6k flat slice — worldwide membership, NOT an aggregate of geo slices
- [v2.0 / Milestone init]: Volunteer Slice is flat (all Volunteers together), role-gated, right-side tab
- [v1.0 / Plan 05-01]: get_feed_filtered() and get_boosted_feed_filtered() use NOT EXISTS bidirectional block check
- [v1.0 / Plan 03-01]: get_boosted_feed uses SECURITY INVOKER; friendships use single-row normalization (user_low < user_high)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-04
Stopped at: Phase 7 verified 5/5 — volunteer role check wired to POST /api/roles/check
Resume file: None
