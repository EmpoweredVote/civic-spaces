---
phase: 06-hub-expansion
plan: "06-04"
name: "Gap Closure — TS Errors and Mobile Notification Routing"
subsystem: notifications
tags: [typescript, notifications, mobile, routing, bug-fix]

dependency-graph:
  requires: ["06-03"]
  provides: ["zero-ts-errors-for-target-files", "mobile-slice-routing-complete"]
  affects: ["06-VERIFICATION"]

tech-stack:
  added: []
  patterns:
    - "Unused destructured prop aliased with _ prefix to suppress TS6133 without removing interface entry"
    - "as SliceType cast at index site to handle TabKey superset safely"

file-tracking:
  key-files:
    created: []
    modified:
      - src/components/NotificationBell.tsx
      - src/components/NotificationList.tsx
      - src/components/AppShell.tsx

decisions:
  - "onNavigateToThread kept in NotificationList interface as optional (?) for backward compat; aliased _onNavigateToThread in destructuring to suppress TS6133 without removing the prop entirely"
  - "SliceType cast (activeTab as SliceType) applied at MemberDirectory sliceId access site — runtime is safe because volunteer returns undefined, handled by optional chain and null coalescing"
  - "Did NOT add 'volunteer' to SliceType in database.ts — that is Phase 7's domain per roadmap decision"

metrics:
  duration: "~2 minutes"
  completed: "2026-04-03"
  tasks-completed: 2
  tasks-total: 2
---

# Phase 6 Plan 04: Gap Closure — TS Errors and Mobile Notification Routing Summary

**One-liner:** Surgical three-file fix closing mobile notification routing gap and resolving TS2741/TS6133/TS7053 compiler errors identified in phase verification.

## What Was Built

Phase 6 verification scored 3/4 — one functional gap (mobile reply notifications bypassed slice routing) and two compiler errors. This plan applied three targeted edits.

### Task 1: Wire onNavigateToSliceThread to mobile Sheet + silence TS6133

**NotificationBell.tsx — mobile Sheet NotificationList** was missing `onNavigateToSliceThread`. The desktop popover NotificationList already received it, but the mobile bottom Sheet did not. Added the missing prop.

**NotificationList.tsx — TS6133** fired because `onNavigateToThread` was destructured but never called (`handleTap` uses `onNavigateToSliceThread` for reply events exclusively). Made the prop optional in the interface and aliased the destructured parameter as `_onNavigateToThread` to suppress the compiler error while preserving the prop for backward compatibility with any future callers.

### Task 2: Fix TS7053 — type-safe TabKey indexing in AppShell

`slices` is typed as `Partial<Record<SliceType, SliceInfo>>` where `SliceType` = `'federal' | 'state' | 'local' | 'neighborhood' | 'unified'`. `activeTab` is `TabKey` which additionally includes `'volunteer'`. TypeScript rejected `slices[activeTab]` at the `MemberDirectory` `sliceId` prop because `'volunteer'` is not in `SliceType`.

Fixed with a cast at the access site: `slices[activeTab as SliceType]?.id ?? null`. The runtime is safe — when `activeTab` is `'volunteer'`, `slices['volunteer']` returns `undefined`, which the optional chain and null coalescing already handle. Also added `SliceType` to the import from `../types/database`.

## Verification

After both tasks, the following errors no longer appear in `npx tsc -p tsconfig.app.json --noEmit`:
- `TS2741` at `NotificationBell.tsx` (missing `onNavigateToSliceThread` on mobile Sheet)
- `TS6133` at `NotificationList.tsx` (`onNavigateToThread` declared but never read)
- `TS7053` at `AppShell.tsx` (`TabKey` can't index `Partial<Record<SliceType, SliceInfo>>`)

All three target files compile cleanly.

## Deviations from Plan

None — plan executed exactly as written. The `_` alias approach for TS6133 is equivalent to the plan's intended fix (making optional silences TS2741 callers; aliasing silences TS6133 on the destructuring).

## Decisions Made

| Decision | Rationale |
|---|---|
| `onNavigateToThread` kept as optional prop, aliased `_onNavigateToThread` in destructuring | Preserves backward compat while suppressing TS6133 without removing the prop from the interface |
| `activeTab as SliceType` cast at access site only | Localized, safe; does not change `SliceType` in database.ts which is Phase 7's domain |
| `SliceType` imported into AppShell rather than inlining cast string union | Stays DRY, consistent with existing import pattern |

## Next Phase Readiness

Phase 6 is complete. All four plans delivered:
- 06-01: All-slices feed panel with CSS hidden pattern
- 06-02: Per-tab scroll preservation
- 06-03: Notification slice routing (useNotificationRouting hook)
- 06-04: Gap closure (TS errors + mobile routing fix)

Phase 7 prerequisites confirmed:
- Volunteer role API field name still needs confirmation before implementing assignment service check
- `get_boosted_feed_filtered` RPC may need RLS adjustment for `'unified'`/`'volunteer'` slice types
