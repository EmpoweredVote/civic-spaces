---
phase: 06-hub-expansion
verified: 2026-04-03T19:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "tsc -p tsconfig.app.json --noEmit now exits with code 0 and zero output (06-05 gap closure plan)"
    - "vite/client added to tsconfig.app.json types array — resolves 4 TS2339 ImportMeta.env errors"
    - "Cursor narrowing guards added in useBoostedFeed, useFeed, useThread — resolves 3 TS18048 errors"
    - "Typed RPC map params in useFeed — resolves 2 TS7006 implicit-any errors"
    - "tier: 'connected' as const added to optimistic stubs in useCreatePost/useCreateReply — resolves 2 TS2741 errors"
    - "Supabase join array cast fixed via unknown in useProfileById — resolves TS2352 error"
  gaps_remaining: []
  regressions: []
    artifacts:
      - path: "src/lib/supabase.ts"
        issue: "TS2339: ImportMeta.env not found -- vite-env.d.ts not referenced in tsconfig.app.json"
      - path: "src/hooks/useAuth.ts"
        issue: "TS2339: ImportMeta.env not found"
      - path: "src/main.tsx"
        issue: "TS2339: ImportMeta.env not found"
      - path: "src/hooks/useBoostedFeed.ts"
        issue: "TS18048: last is possibly undefined (noUncheckedIndexedAccess on cursor array)"
      - path: "src/hooks/useFeed.ts"
        issue: "TS7006 implicit any on p and post; TS18048 cursor last possibly undefined"
      - path: "src/hooks/useThread.ts"
        issue: "TS18048: cursor last element possibly undefined"
      - path: "src/hooks/useCreatePost.ts"
        issue: "TS2741: tier missing from optimistic author stub"
      - path: "src/hooks/useCreateReply.ts"
        issue: "TS2741: tier missing from optimistic author stub"
      - path: "src/hooks/useProfileById.ts"
        issue: "TS2352: array-to-object cast mismatch"
    missing:
      - "Add vite/client to tsconfig.app.json compilerOptions.types (or triple-slash ref to vite-env.d.ts) to fix ImportMeta.env in supabase, useAuth, main"
      - "Narrow last-element cursor access in useBoostedFeed, useFeed, useThread to fix TS18048"
      - "Add tier field to optimistic author stubs in useCreatePost and useCreateReply"
      - "Fix array-to-object cast in useProfileById"
---

# Phase 6: Hub Expansion Verification Report

**Phase Goal:** The hub has its permanent two-column layout, geo slices (N/L/S) are fully active forums, scroll state is independently preserved per tab, and notifications route users to the correct slice tab.
**Verified:** 2026-04-03T18:48:29Z
**Status:** gaps_found
**Re-verification:** Yes -- after gap closure (06-04 plan)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Hub displays N/L/S/F geo tabs plus Unified on left group; Volunteer on right | VERIFIED | SliceTabBar LEFT_TABS: neighborhood/local/state/federal/unified in order; RIGHT_TABS: volunteer with border-l separator; AppShell disabledTabs=[unified,volunteer] |
| 2 | Switching between tabs and back returns user to exact prior scroll position per tab | VERIFIED | scrollPositions ref and scrollRefs map in AppShell; handleTabChange saves scrollTop synchronously before setActiveTab; useEffect+requestAnimationFrame restores scrollTop; scrollRef wired into SliceFeedPanel feed div |
| 3 | Friend-boosted feed weighting applies equally to N, L, S as to Federal | VERIFIED | SliceFeedPanel calls useBoostedFeed(sliceId) for every panel; RPC get_boosted_feed_filtered parameterized by p_slice_id; no Federal-specific branch; identical boost logic for all four geo tabs |
| 4 | Tapping a reply notification routes to the correct slice tab and opens the thread | VERIFIED | useNotificationRouting queries posts.slice_id then reverse-maps to TabKey; handleNotificationNavigate calls resolveTabForPost then handleTabChange and setActivePostIds; onNavigateToSliceThread wired to desktop (line 99) and mobile Sheet (line 119) after commit 1d278b3 |
| 5 | tsc -p tsconfig.app.json --noEmit passes with zero errors | VERIFIED | npx tsc -p tsconfig.app.json --noEmit exits with code 0 and zero output after 06-05 gap closure (commits 7b050f6, 15d224d, 982c1e6) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/hooks/useAllSlices.ts | Fetches all 4 geo slice types for user | VERIFIED | 70 lines; two-step Supabase query; Partial<Record<SliceType,SliceInfo>> return; imported in AppShell |
| src/components/SliceTabBar.tsx | Two-group layout N/L/S/F/Unified left, Volunteer right | VERIFIED | 78 lines; LEFT_TABS 5 items; RIGHT_TABS 1 item; border-l separator; disabled Coming soon subtext |
| src/components/AppShell.tsx | 4 geo panels CSS hidden, per-tab scroll, notification routing | VERIFIED | 270 lines; GEO_TABS.map mounts all 4 simultaneously; CSS hidden for inactive; scrollRefs+scrollPositions wired; handleNotificationNavigate connected |
| src/components/SliceFeedPanel.tsx | scrollRef prop attached to overflow-y-auto div | VERIFIED | scrollRef optional prop; ref={scrollRef} on feed container div at line 101 |
| src/hooks/useNotificationRouting.ts | Resolves postId to TabKey via Supabase lookup | VERIFIED | 53 lines; queries posts.slice_id; reverse-maps against slices; falls back to federal on any error |
| src/components/NotificationBell.tsx | onNavigateToSliceThread to both desktop and mobile NotificationList | VERIFIED | Desktop at line 99; mobile Sheet at line 119; both present after commit 1d278b3 |
| src/components/NotificationList.tsx | onNavigateToSliceThread called for reply events; onNavigateToThread optional | VERIFIED | Called at line 30 for reply event_type; onNavigateToThread made optional and aliased _onNavigateToThread |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| AppShell | useAllSlices | userId argument | WIRED | useAllSlices(userId) at line 41 |
| AppShell | SliceTabBar | handleTabChange and slices props | WIRED | onTabChange={handleTabChange} at line 206 |
| AppShell | SliceFeedPanel x4 | GEO_TABS.map, CSS hidden, scrollRef | WIRED | Lines 213-233; all 4 geo feeds mount simultaneously |
| AppShell | useNotificationRouting | resolveTabForPost | WIRED | handleNotificationNavigate lines 69-74 |
| AppShell | NotificationBell | onNavigateToSliceThread | WIRED | handleNotificationNavigate passed at line 115 |
| NotificationBell desktop | NotificationList | onNavigateToSliceThread | WIRED | Line 99 |
| NotificationBell mobile Sheet | NotificationList | onNavigateToSliceThread | WIRED | Line 119 -- gap closed by commit 1d278b3 |
| NotificationList | handleTap reply branch | onNavigateToSliceThread | WIRED | Line 30: reply event calls onNavigateToSliceThread(notification.reference_id) then onClose |
| handleTabChange | scrollPositions save | synchronous before setActiveTab | WIRED | Lines 59-62: scrollTop captured before state update |
| useEffect activeTab | scrollTop restore | requestAnimationFrame | WIRED | Lines 77-84: rAF deferred until after CSS unhide |
| MemberDirectory sliceId | slices lookup | activeTab cast as SliceType | WIRED | Line 261: slices[activeTab as SliceType]?.id -- cast by commit b34bb56 |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| HUB-06 | SATISFIED | Two-group SliceTabBar verified |
| HUB-08 | SATISFIED | Per-tab scroll save/restore verified |
| SLCE-02 | SATISFIED | useBoostedFeed(sliceId) applies to all 4 geo tabs equally |
| SLCE-03 | SATISFIED | Notification routing wired for both desktop popover and mobile Sheet |
| TS-clean | SATISFIED | tsc exits 0 with zero errors — pre-existing errors resolved in 06-05 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/lib/supabase.ts | 3-4 | ImportMeta.env TS2339 -- vite-env.d.ts not in tsconfig | Warning | Pre-existing; cascades to useAuth.ts and main.tsx (3 total) |
| src/hooks/useBoostedFeed.ts | 88 | TS18048 noUncheckedIndexedAccess on last array element | Warning | Pre-existing; same pattern in useFeed.ts and useThread.ts (4 total) |
| src/hooks/useCreatePost.ts | -- | TS2741 tier missing from optimistic author stub | Warning | Pre-existing; same in useCreateReply.ts (2 total) |

### Human Verification Required

None. All gaps are structural and fully verifiable from source code and TypeScript compiler output.

## Gaps Summary

Phase 6 achieves 4 of 5 observable truths. All behavioral goals are met in code: the two-column tab bar is implemented with geo tabs left and Volunteer right; all four geo feeds mount simultaneously with CSS hiding to preserve React Query cache and scroll state; per-tab scroll preservation saves and restores scrollTop on every tab switch; friend-boosted feeds apply the same RPC logic for all four geo slices equally; and notification routing is wired through both the desktop popover and mobile Sheet paths after the 06-04 gap closure.

The one remaining gap is the TypeScript clean build. The three Phase-6-specific errors -- TS2741 in NotificationBell, TS6133 in NotificationList, TS7053 in AppShell -- are all confirmed closed by commits 1d278b3 and b34bb56. The current tsc run shows zero errors in any Phase-6 file. However 16 errors remain in 9 pre-existing baseline files that existed before Phase 6 began. The must-have as written requires zero project-wide errors.

The pre-existing errors fall into three clusters. First, ImportMeta.env not found in supabase.ts, useAuth.ts, and main.tsx because vite-env.d.ts is not referenced in tsconfig.app.json -- adding a types entry or a triple-slash reference resolves all three. Second, noUncheckedIndexedAccess violations in useBoostedFeed.ts, useFeed.ts, and useThread.ts where last-element cursor array access is not narrowed before use. Third, missing tier field in optimistic author stubs in useCreatePost.ts and useCreateReply.ts. A targeted cleanup plan for these pre-existing issues closes this final gap without modifying any Phase-6 code.

---

_Verified: 2026-04-03T18:48:29Z_
_Verifier: Claude (gsd-verifier)_
