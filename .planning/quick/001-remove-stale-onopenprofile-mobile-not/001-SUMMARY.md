---
phase: quick
plan: "001"
subsystem: notifications
tags: [typescript, cleanup, NotificationBell, NotificationList]

dependency-graph:
  requires: [Phase 8 plan 08-03 — removed onOpenProfile from NotificationList interface]
  provides: [Clean NotificationBell.tsx — mobile Sheet path matches desktop popover]
  affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/components/NotificationBell.tsx

decisions: []

metrics:
  duration: "< 5 minutes"
  completed: "2026-04-04"
---

# Quick Task 001: Remove Stale onOpenProfile from Mobile NotificationList — Summary

**One-liner:** Removed stale `onOpenProfile={onOpenProfile}` line from mobile Sheet NotificationList call — Phase 8 cleanup missed this path while correctly cleaning the desktop popover.

## What Was Done

Phase 08-03 removed the `onOpenProfile` prop from `NotificationList`'s interface as part of the profile navigation overhaul (leaf components now navigate internally via `useLocation`). The desktop popover path in `NotificationBell.tsx` was correctly updated to omit the prop, but the mobile bottom Sheet path (around line 115) still passed `onOpenProfile={onOpenProfile}`.

This caused a TypeScript error because:
1. `onOpenProfile` is not in `NotificationBellProps` interface — it was never a prop of `NotificationBell`
2. `onOpenProfile` was never destructured or declared in the component — passing it referenced an undefined identifier
3. `NotificationList` no longer accepts `onOpenProfile` in its interface

The fix was a single-line deletion. No secondary cleanup was needed — `onOpenProfile` had no declaration anywhere in the component.

## Verification

- `npx tsc --noEmit` — passed with no errors (zero output)
- Mobile Sheet NotificationList call now matches desktop popover pattern exactly

## Commits

| Hash    | Message                                                              |
| ------- | -------------------------------------------------------------------- |
| fe9883b | fix(quick-001): remove stale onOpenProfile prop from mobile NotificationList |

## Deviations from Plan

None — plan executed exactly as written.
