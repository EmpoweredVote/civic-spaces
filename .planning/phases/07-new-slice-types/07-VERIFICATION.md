---
phase: 07-new-slice-types
verified: 2026-04-03T12:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Volunteer role check now calls POST /api/roles/check via checkVolunteerRole(); assignVolunteerIfEligible receives real boolean from route"
  gaps_remaining: []
  regressions: []
---

# Phase 7: New Slice Types - Verification Report

**Phase Goal:** The Unified and Volunteer slices exist in the schema, the assignment service populates them automatically, and their hub tabs are fully active forums - Volunteer tab is visible only to users with the Volunteer role.
**Verified:** 2026-04-03
**Status:** passed - 5/5 must-haves verified
**Re-verification:** Yes -- after gap closure (must-have 2 volunteer role stub replaced)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On login, assignment service upserts user into Unified slice (geoid sentinel UNIFIED); Unified tab loads the feed | VERIFIED | assignUnifiedIfNotAssigned called in /assign route for all Connected users; UNIFIED_GEOID constant used; findActiveSliceForGeoid handles create-on-demand; useAllSlices fetches all types; AppShell renders unified via FEED_TABS |
| 2 | Volunteer tab visible only to Volunteer-role users; absent from DOM for all others | VERIFIED | checkVolunteerRole() calls POST /api/roles/check; isVolunteer resolved in parallel with fetchAccountData; passed to assignVolunteerIfEligible(userId, isVolunteer); non-volunteer path removes membership via removeMembershipByType; showVolunteerTab = !!slices[volunteer] gates DOM |
| 3 | All 5 tabs (Neighborhood, Local, State, Federal, Unified) are fully active forums | VERIFIED | No Coming Soon placeholder remains; FEED_TABS includes all 5; each renders real SliceFeedPanel with useBoostedFeed; FAB, PostComposer, ThreadView all wired |
| 4 | Unified and Volunteer slices capped at 6,000 members; overflow creates sibling slice | VERIFIED | findActiveSliceForGeoid queries .lt(current_member_count, 6000); findOrCreateSiblingSlice called when no capacity found; same function used for both types |
| 5 | Schema has slice_type values unified and volunteer; get_boosted_feed_filtered RPC serves both without modification | VERIFIED | Migration extends CHECK constraint to 6 values; RPC filters only by p_slice_id UUID -- slice_type irrelevant; SliceType TS union mirrors constraint |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|----------|
| supabase/migrations/20260403000000_phase7_unified_volunteer.sql | CHECK constraint with 6 values + NOTIFY | VERIFIED | 13 lines; drops old constraint; adds unified and volunteer; NOTIFY pgrst present |
| src/types/database.ts | SliceType union with 6 values; SliceInfo with siblingIndex | VERIFIED | SliceType includes all 6 values; SliceInfo.siblingIndex: number (required field) |
| services/slice-assignment/src/services/accountsApi.ts | AccountData interface + checkVolunteerRole function | VERIFIED | 53 lines; AccountData interface intact; checkVolunteerRole POSTs to /api/roles/check; parses { permitted: boolean }; no TODO markers |
| services/slice-assignment/src/services/sliceAssigner.ts | assignUnifiedIfNotAssigned + assignVolunteerIfEligible(userId, isVolunteer: boolean); 6000 cap | VERIFIED | Both exported; isVolunteer param is boolean (not internal call); non-volunteer path calls removeMembershipByType; volunteer path upserts via findActiveSliceForGeoid; 6000 cap enforced |
| services/slice-assignment/src/routes/assignment.ts | Parallel fetch of accountData + isVolunteer; passes isVolunteer to assignVolunteerIfEligible | VERIFIED | Promise.all([fetchAccountData, checkVolunteerRole]); both results destructured; assignVolunteerIfEligible(accountData.id, isVolunteer) called with real boolean |
| src/hooks/useAllSlices.ts | Fetches all slice types; siblingIndex in select | VERIFIED | No GEO_SLICE_TYPES filter; sibling_index selected; hasJurisdiction = !!slices[federal] |
| src/components/AppShell.tsx | FEED_TABS includes unified; showVolunteerTab gating; volunteer block | VERIFIED | FEED_TABS has 5 non-volunteer tabs; showVolunteerTab = !!slices[volunteer]; volunteer block conditionally rendered with double-guard |
| src/components/SliceTabBar.tsx | Volunteer in RIGHT_TABS; showVolunteerTab prop gates DOM presence | VERIFIED | RIGHT_TABS has volunteer; prop drives presence/absence of right section; no disabled state |
| src/components/SliceFeedPanel.tsx | sliceName + siblingIndex optional props; feed header rendered | VERIFIED | Props added; header Name #N rendered before posts when both present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|----------|
| /assign route | checkVolunteerRole | import + Promise.all call | WIRED | Imported from accountsApi; called in parallel with fetchAccountData; isVolunteer boolean resolved before any assignments |
| /assign route | assignUnifiedIfNotAssigned | import + direct call | WIRED | Called for all Connected users before jurisdiction check |
| /assign route | assignVolunteerIfEligible | import + direct call with isVolunteer | WIRED | Called with real boolean; non-volunteer path removes stale membership |
| checkVolunteerRole | POST /api/roles/check | fetch with bearer token | WIRED | POSTs { feature_scope: volunteer, jurisdiction_geoid: null }; parses permitted field; throws on non-OK response |
| assignVolunteerIfEligible | removeMembershipByType (revocation) | isVolunteer === false branch | WIRED | Negative case deletes existing volunteer membership so revocation propagates on next login |
| assignVolunteerIfEligible | findActiveSliceForGeoid(volunteer) | isVolunteer === true branch | WIRED | Check-before-insert pattern; 6000 cap enforced; sibling creation if full |
| AppShell | useAllSlices | hook call | WIRED | slices, hasJurisdiction, isLoading all destructured and used in render logic |
| AppShell | SliceFeedPanel (unified) | FEED_TABS loop | WIRED | unified in FEED_TABS; renders when slices[unified] exists; passes sliceId, sliceName, siblingIndex |
| AppShell | SliceFeedPanel (volunteer) | showVolunteerTab conditional | WIRED | showVolunteerTab && slices[volunteer] double-guard; all required props passed |
| SliceFeedPanel | useBoostedFeed | hook call | WIRED | useBoostedFeed(sliceId) -- type-agnostic; works for any slice UUID |
| useBoostedFeed | get_boosted_feed_filtered RPC | supabase.rpc | WIRED | rpc call passes p_slice_id; no slice_type filtering in RPC |
| SliceTabBar | showVolunteerTab prop | prop binding | WIRED | Prop drives presence/absence of RIGHT_TABS section |

---

### Anti-Patterns Found

None. All previously flagged TODO(volunteer-role) markers and the unconditional return false stub have been removed. No stub patterns, placeholder content, or hardcoded returns detected in any phase artifact.

---

### Human Verification Required

#### 1. Unified tab feed visible and functional

**Test:** Log in as a Connected user with any jurisdiction, navigate to the hub.
**Expected:** Unified tab appears in the left tab group. Clicking it loads a feed. FAB is present. Feed header shows Unified #1.
**Why human:** Cannot verify DB state or runtime Supabase session from static code analysis.

#### 2. All geo tabs functional post-Phase 7

**Test:** Log in as a user with a known jurisdiction. Check Neighborhood, Local, State, Federal tabs.
**Expected:** No regressions from Phase 6; all 4 geo feeds active alongside Unified.
**Why human:** Feed content and interaction require browser runtime.

#### 3. NoJurisdictionBanner suppressed for Unified-only users

**Test:** Log in as a Connected user with NO jurisdiction set but with a Unified slice membership in the DB.
**Expected:** NoJurisdictionBanner does NOT appear; hub shows the Unified tab and feed.
**Why human:** Requires a test account with specific DB membership state.

#### 4. Volunteer tab visible for Volunteer-role user, absent for others

**Test:** Log in as a user whose account has the volunteer feature grant. Check hub tab bar.
**Expected:** Volunteer tab is visible in the right tab group. Clicking it loads the Volunteer feed. FAB is present.
**Secondary test:** Log in as a standard Connected user. Confirm right tab section is entirely absent from DOM.
**Why human:** Role grant state lives in the accounts service; cannot verify from static analysis. Runtime POST to /api/roles/check required.

#### 5. Volunteer role revocation removes tab on next login

**Test:** With a user who previously had the volunteer grant, revoke it and log in again.
**Expected:** After the next /assign call, the volunteer tab disappears and the slice membership is removed from slice_members.
**Why human:** Requires accounts service grant manipulation and session re-authentication.

---

## Gaps Summary

No gaps. All five must-haves are fully verified.

**Gap 2 closed:** The volunteer role stub (hasVolunteerRole returning false unconditionally) has been replaced by a full implementation across three files:

1. services/slice-assignment/src/services/accountsApi.ts -- new checkVolunteerRole(token) function POSTs to /api/roles/check and returns { permitted: boolean }. No AccountData field dependency; volunteer role is a separate role-grant system queried independently.

2. services/slice-assignment/src/routes/assignment.ts -- Promise.all([fetchAccountData(rawToken), checkVolunteerRole(rawToken)]) resolves both in parallel. The isVolunteer boolean is passed directly to assignVolunteerIfEligible.

3. services/slice-assignment/src/services/sliceAssigner.ts -- assignVolunteerIfEligible(userId, isVolunteer: boolean) signature takes an externally-resolved boolean. Negative path calls removeMembershipByType to enforce revocation on re-login. Positive path uses the same check-before-insert + 6000-cap pattern as unified.

No TODO markers, no hardcoded returns, and no placeholder patterns remain in any assignment service file.

---

_Verified: 2026-04-03_
_Verifier: Claude (gsd-verifier)_
