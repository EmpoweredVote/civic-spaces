---
phase: 02-core-forum
plan: 03
subsystem: ui
tags: [react, zod, react-hook-form, tanstack-query, optimistic-updates, react-modal-sheet, tier-gating]

# Dependency graph
requires:
  - phase: 02-02
    provides: PostCard component, useFeed infinite query, SliceFeedPanel shell

provides:
  - Zod v4 validators for create/edit post forms
  - useProfile hook for tier and suspension checks
  - useCreatePost with optimistic prepend to feed
  - useEditPost with 1-hour window helper
  - useDeletePost with optimistic removal
  - FAB component with safe-area awareness
  - PostComposer bottom sheet (create + edit modes)
  - Tier gating: inform prompt overlay, suspended FAB disabled
  - PostCard "..." menu for own posts (edit within 1h, delete with confirm)

affects: [02-04, thread-view, reply-composer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic update pattern: cancelQueries → snapshot → setQueryData → onError restore → onSettled invalidate"
    - "Tier gating at FAB click: suspended = noop (disabled), inform = upgrade prompt, connected = open composer"
    - "Two-form pattern in PostComposer: separate useForm instances for create vs edit modes"
    - "isWithinEditWindow helper exported from mutation hook for use in UI components"

key-files:
  created:
    - src/lib/validators.ts
    - src/hooks/useProfile.ts
    - src/hooks/useCreatePost.ts
    - src/hooks/useEditPost.ts
    - src/hooks/useDeletePost.ts
    - src/components/FAB.tsx
    - src/components/PostComposer.tsx
  modified:
    - src/components/SliceFeedPanel.tsx
    - src/components/PostCard.tsx

key-decisions:
  - "PostComposer uses two separate useForm instances (createForm + editForm) rather than a single dynamic form to keep resolver schemas independent"
  - "react-modal-sheet Sheet.Backdrop onTap closes sheet (not onClick) per library API"
  - "PostCard refactored from <button> to <div> wrapper with inner <button> to accommodate absolute-positioned menu without nesting interactive elements"
  - "inform-tier prompt is an inline overlay (not a separate component) — full InformUpgradePrompt component ships in 02-04"

patterns-established:
  - "Optimistic mutation: always cancel queries, snapshot, update, return snapshot in context for onError restore"
  - "Tier gating: check profile.is_suspended first (maps to disabled FAB), then profile.tier === 'inform' (maps to upgrade prompt)"
  - "Own post detection: userId && post.user_id === userId passed as isOwnPost prop to PostCard"

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 2 Plan 03: Post Composer Summary

**FAB + bottom-sheet PostComposer with optimistic create/edit/delete mutations, Zod v4 validation, and tier-based access gating for inform and suspended users**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-28T02:28:49Z
- **Completed:** 2026-03-28T02:32:18Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Zod v4 schemas, profile hook, and three TanStack Query mutations (create/edit/delete) with full optimistic update patterns
- FAB (safe-area aware) + PostComposer bottom sheet using react-modal-sheet and react-hook-form, handling both create and edit modes
- Tier gating in SliceFeedPanel: suspended users see disabled FAB, inform-tier users see upgrade prompt, connected users open composer

## Task Commits

Each task was committed atomically:

1. **Task 1: Zod validators, profile hook, post mutations** - `4d70e82` (feat)
2. **Task 2: FAB, PostComposer, SliceFeedPanel + PostCard wiring** - `b9667bf` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/validators.ts` - createPostSchema and editPostSchema with Zod v4, inferred types
- `src/hooks/useProfile.ts` - useProfile with 5-minute stale time, returns ConnectedProfile
- `src/hooks/useCreatePost.ts` - useMutation with optimistic prepend to feed page 0
- `src/hooks/useEditPost.ts` - useMutation + isWithinEditWindow(createdAt) helper
- `src/hooks/useDeletePost.ts` - useMutation with optimistic filter removal from cache pages
- `src/components/FAB.tsx` - Fixed-position FAB with safe-area-inset-bottom, disabled state
- `src/components/PostComposer.tsx` - Bottom sheet with Sheet.Container/Header/Content/Backdrop
- `src/components/SliceFeedPanel.tsx` - Added useAuth, useProfile, useDeletePost, FAB, PostComposer, inform prompt
- `src/components/PostCard.tsx` - Added relative wrapper, "..." menu for isOwnPost, edit/delete handlers

## Decisions Made

- PostComposer uses two separate `useForm` instances (createForm + editForm) with distinct Zod resolvers rather than a single dynamic form — cleaner schema isolation.
- `react-modal-sheet` API uses `Sheet.Backdrop` with `onTap` (not `onClick`) for dismissal.
- PostCard was refactored from a single `<button>` to a `<div>` wrapper with an inner `<button>` for the card click, allowing the absolutely-positioned "..." menu button to avoid nested interactive elements.
- The inform-tier upgrade prompt is an inline overlay div in SliceFeedPanel — a proper `InformUpgradePrompt` component will ship in 02-04.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Post create/edit/delete fully wired with optimistic updates; feed reflects changes immediately.
- PostCard onClick still defers to `console.log('Open post', postId)` — thread/detail view ships in 02-04.
- 02-04 should implement proper `InformUpgradePrompt` component and replace the inline overlay in SliceFeedPanel.

---
*Phase: 02-core-forum*
*Completed: 2026-03-28*
