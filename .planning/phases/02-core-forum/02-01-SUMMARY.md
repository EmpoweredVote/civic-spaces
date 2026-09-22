---
phase: 02-core-forum
plan: 01
subsystem: ui
tags: [react, tailwind, vite, tanstack-query, typescript, react-hook-form, zod, supabase]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Supabase schema (slices, slice_members, posts, replies, connected_profiles), slice assignment service, auth token exchange pattern
provides:
  - React 19 app with Vite + Tailwind v4 + TanStack Query v5 entry point
  - AppShell layout with header, tab bar, and content area
  - SliceTabBar with five tabs (Federal active with blue accent + member count, others dimmed)
  - useAuth hook decoding cs_token via base64 JWT payload (no external lib)
  - useFederalSlice hook with two-query pattern (slice_members then slices)
  - NoJurisdictionBanner for users with no slice memberships
  - SliceFeedPanel placeholder for 02-02 feed implementation
  - Phase 2 schema migration (avatar_url, tier, is_suspended, edit_history, reply_count, triggers, Realtime)
affects:
  - 02-02-PLAN.md (PostCard feed, SliceFeedPanel implementation)
  - 02-03-PLAN.md (compose/reply forms use react-hook-form + zod already installed)
  - 02-04-PLAN.md (profile panel, avatar_url column now available)

# Tech tracking
tech-stack:
  added:
    - react@19
    - react-dom@19
    - tailwindcss@4 (Vite plugin, no config file)
    - "@tailwindcss/vite@4"
    - "@vitejs/plugin-react@5"
    - "@tanstack/react-query@5"
    - "@tanstack/react-query-devtools@5"
    - react-hook-form@7
    - zod@4
    - "@hookform/resolvers@5"
    - date-fns@4
    - react-loading-skeleton@3
    - react-modal-sheet@3
    - motion@11
    - "@types/react@19"
    - "@types/react-dom@19"
  patterns:
    - Tailwind v4 with @import directive (no tailwind.config.js)
    - CSS @theme block for custom civic design tokens
    - TanStack Query with staleTime 60s, retry 1
    - JWT payload decoded via base64 atob() — no external library
    - Two-query Supabase pattern for FK-less joins (slice_members -> slices)
    - supabase.createClient with db.schema: 'civic_spaces' default

key-files:
  created:
    - vite.config.ts
    - tsconfig.json
    - tsconfig.app.json
    - index.html
    - src/index.css
    - src/types/database.ts
    - src/main.tsx
    - src/App.tsx
    - src/hooks/useAuth.ts
    - src/hooks/useFederalSlice.ts
    - src/components/AppShell.tsx
    - src/components/SliceTabBar.tsx
    - src/components/NoJurisdictionBanner.tsx
    - src/components/SliceFeedPanel.tsx
    - supabase/migrations/20260327100000_phase2_schema.sql
  modified:
    - package.json
    - src/lib/supabase.ts

key-decisions:
  - "Used @vitejs/plugin-react@5 (not v6) — v6 requires vite@^8, project uses vite@6"
  - "Two-query pattern in useFederalSlice (slice_members then slices.in()) — no FK constraints for embedded select"
  - "JWT decode uses native atob() — no jose or jsonwebtoken dependency needed for read-only claims extraction"
  - "SliceFeedPanel renders placeholder text — full implementation deferred to 02-02"
  - "db: { schema: 'civic_spaces' } added to supabase createClient so all queries default to civic_spaces schema"

patterns-established:
  - "Two-query Supabase pattern: fetch IDs first, then .in() filter — use when no FK for embedded select"
  - "Native JWT decode: atob(base64url payload) + JSON.parse — no library needed for claim extraction"
  - "Tailwind v4 @theme block in index.css for project-wide design tokens"

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 2 Plan 01: App Shell Summary

**React 19 + Tailwind v4 + TanStack Query v5 hub shell with five-tab slice nav (Federal active), auth token decode hook, and Phase 2 schema migration adding avatar_url, tier, reply_count, edit_history, and Realtime publication**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T02:13:45Z
- **Completed:** 2026-03-28T02:17:48Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- React 19 app bootstrapped from scratch with Vite + Tailwind v4 (@import style, no config file) and TanStack Query v5
- Hub AppShell rendering five slice tabs with Federal active (blue bottom border, member count), other four dimmed and non-tappable
- Phase 2 schema migration adds avatar_url, tier, is_suspended (generated column), edit_history (jsonb), reply_count (trigger-maintained), edit window enforcement trigger, and Realtime publication

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, configure Vite+Tailwind+TS, create schema migration** - `8eb31b1` (feat)
2. **Task 2: Create React app shell, auth hook, federal slice hook, tab bar** - `a6e4c1d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `vite.config.ts` - Vite config with @vitejs/plugin-react and @tailwindcss/vite
- `tsconfig.json` / `tsconfig.app.json` - Project references TypeScript config, strict mode
- `index.html` - HTML entry point with root div and module script
- `src/index.css` - Tailwind v4 @import + civic design tokens via @theme block
- `src/types/database.ts` - TypeScript types for Slice, SliceMember, ConnectedProfile, Post, Reply, PostWithAuthor, ReplyWithAuthor
- `src/main.tsx` - React 19 createRoot, QueryClientProvider, ReactQueryDevtools (dev only)
- `src/App.tsx` - Root component rendering AppShell
- `src/hooks/useAuth.ts` - Decodes cs_token payload via atob(), listens to storage events
- `src/hooks/useFederalSlice.ts` - Two-query pattern fetching federal slice and jurisdiction status
- `src/components/AppShell.tsx` - Full layout with header, conditional tab bar, content area
- `src/components/SliceTabBar.tsx` - Five tabs; Federal has border-b-2 blue accent and member count; others opacity-40 + pointer-events-none
- `src/components/NoJurisdictionBanner.tsx` - Amber banner with profile link, dismissible
- `src/components/SliceFeedPanel.tsx` - Placeholder "Feed loading..." for 02-02
- `supabase/migrations/20260327100000_phase2_schema.sql` - Phase 2 schema additions
- `src/lib/supabase.ts` - Added db: { schema: 'civic_spaces' } to createClient

## Decisions Made

- Used `@vitejs/plugin-react@5` (not v6) — v6 requires vite@^8 but project uses vite@6.
- Two-query pattern in `useFederalSlice`: fetch slice_ids from slice_members, then `.in()` filter on slices — necessary because no FK constraints exist for Supabase embedded select.
- JWT decode uses native `atob()` — no external library needed for read-only claims extraction in the auth hook.
- `db: { schema: 'civic_spaces' }` added to supabase `createClient` so all queries default to the civic_spaces schema without explicit `.schema()` calls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned @vitejs/plugin-react to v5 instead of latest (v6)**
- **Found during:** Task 1 (npm install)
- **Issue:** `@vitejs/plugin-react@6.0.1` declares `peer vite@"^8.0.0"` but project uses vite@6.4.1 — npm refused to install with ERESOLVE
- **Fix:** Installed `@vitejs/plugin-react@^5` which is compatible with vite@6
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx vite build` succeeded; 132 modules transformed
- **Committed in:** `8eb31b1` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Functionally identical — plugin-react v5 is the current stable for vite 6. No capability lost.

## Issues Encountered

None beyond the plugin-react version constraint, handled automatically.

## User Setup Required

None - no external service configuration required. The schema migration `supabase/migrations/20260327100000_phase2_schema.sql` must be applied to the Supabase project before Phase 2 feed queries will work.

## Next Phase Readiness

- React app shell is complete and builds successfully
- Tab bar renders correctly: Federal active with blue accent, four tabs dimmed
- `SliceFeedPanel` is a placeholder — 02-02 implements the actual post feed
- All Phase 2 dependencies (react-hook-form, zod, motion, date-fns, react-loading-skeleton) installed and ready
- Schema migration must be applied to Supabase before proceeding with live data

---
*Phase: 02-core-forum*
*Completed: 2026-03-28*
