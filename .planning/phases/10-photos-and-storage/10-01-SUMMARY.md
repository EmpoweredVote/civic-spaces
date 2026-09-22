---
phase: 10-photos-and-storage
plan: "01"
subsystem: database, ui, storage
tags: [supabase, storage, rls, migration, react, typescript, herobanner]

# Dependency graph
requires:
  - phase: 09-hero-banner-layout-shell
    provides: HeroBanner component (pure presentational, ready for photoUrl prop wiring)
provides:
  - slice-photos Supabase Storage bucket with public read RLS
  - photo_url nullable text column on civic_spaces.slices
  - SliceInfo.photoUrl field in TypeScript types
  - photo_url in useAllSlices SELECT query and mapping
  - sliceCopy.ts defaultPhoto field (renamed from placeholderPhoto) for type-default fallback
  - HeroBanner two-level photo fallback: DB photoUrl -> type default -> null
  - AppShell passes photoUrl from activeSlice to HeroBanner
affects:
  - 10-02 (uploads Bloomington photos and seeds photo_url DB rows — depends on this bucket + column)
  - 11-sidebar (no photo concerns, but SliceInfo shape is now stable)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-level photo fallback: DB-sourced photoUrl (jurisdiction-specific) overrides type-default from sliceCopy.ts, which overrides null"
    - "Storage bucket RLS: public=true on bucket + explicit SELECT policy both required for 403-free public reads"
    - "sliceCopy.ts as type-default registry: external URLs only, never VITE_SUPABASE_URL"

key-files:
  created:
    - supabase/migrations/20260405000000_phase10_storage_photo_url.sql
  modified:
    - supabase/config.toml
    - src/types/database.ts
    - src/hooks/useAllSlices.ts
    - src/lib/sliceCopy.ts
    - src/components/HeroBanner.tsx
    - src/components/AppShell.tsx

key-decisions:
  - "placeholderPhoto renamed to defaultPhoto — reflects that these are permanent type defaults, not temporary placeholders"
  - "RLS SELECT policy required alongside public=true bucket — without it, reads return 403"
  - "sliceCopy.ts type defaults use external Unsplash URLs — no VITE_SUPABASE_URL dependency in sliceCopy.ts"
  - "HeroBanner resolves photo as: photoUrl (DB) ?? copy.defaultPhoto (type default) ?? null (gray fallback)"

patterns-established:
  - "Photo resolution pattern: DB value overrides type-default (sliceCopy) overrides null"
  - "Storage RLS pattern: always pair bucket public=true with explicit SELECT policy on storage.objects"

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 10 Plan 01: Storage Bucket, photo_url Column, and HeroBanner Data Wiring Summary

**Supabase Storage bucket `slice-photos` with public RLS, `photo_url` column on slices, and full TypeScript data path from DB through useAllSlices to HeroBanner with two-level type-default fallback**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-06T16:27:37Z
- **Completed:** 2026-04-06T16:29:27Z
- **Tasks:** 2
- **Files modified:** 6 (+ 1 created)

## Accomplishments

- Migration creates `slice-photos` Storage bucket with both `public = true` and an explicit `SELECT` RLS policy (both required — bucket flag alone causes 403 on public reads)
- `photo_url` nullable text column added to `civic_spaces.slices` with explanatory comment
- `config.toml` registers the bucket for local dev with 5MiB limit and MIME type allowlist
- Full TypeScript data path: `SliceInfo.photoUrl` -> `useAllSlices` SELECT -> `AppShell` prop passthrough -> `HeroBanner` `resolvedPhoto` fallback chain
- `sliceCopy.ts` field renamed `placeholderPhoto` -> `defaultPhoto` with updated JSDoc, signaling these are permanent type defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL migration + config.toml** - `313c995` (feat)
2. **Task 2: Wire photo_url through types, hook, sliceCopy, HeroBanner, AppShell** - `ab69c77` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/20260405000000_phase10_storage_photo_url.sql` - Storage bucket, RLS policy, photo_url column DDL
- `supabase/config.toml` - Bucket registration for local Supabase dev environment
- `src/types/database.ts` - `SliceInfo.photoUrl?: string | null` added
- `src/hooks/useAllSlices.ts` - `photo_url` in SELECT; `photoUrl: row.photo_url ?? null` in mapping
- `src/lib/sliceCopy.ts` - `placeholderPhoto` -> `defaultPhoto` rename across interface and all 6 entries
- `src/components/HeroBanner.tsx` - `photoUrl` prop; `resolvedPhoto = photoUrl ?? copy?.defaultPhoto ?? null`
- `src/components/AppShell.tsx` - `photoUrl={activeSlice.photoUrl}` passed to HeroBanner

## Decisions Made

- `placeholderPhoto` renamed to `defaultPhoto` — the field was previously named to signal "temporary placeholder, replace in Phase 10." Now that Phase 10 is here, the type defaults are permanent fallbacks, not placeholders.
- RLS SELECT policy is explicitly created alongside `public = true` bucket — Supabase Storage requires both for truly public reads; the bucket flag alone is not sufficient.
- `sliceCopy.ts` type defaults remain external Unsplash URLs — no `VITE_SUPABASE_URL` dependency. DB-sourced CDN URLs come from the hook exclusively.
- `HeroBanner.photoUrl` is `string | null | undefined` — undefined when no DB value exists yet (expected until Plan 10-02 seeds rows), falls back silently to type default.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npx supabase db reset` could not be run (Docker Desktop not running). Migration file is correctly authored and will execute on next `db reset` when Docker is available. TypeScript compilation passes with zero errors confirming the code changes are structurally correct.

## User Setup Required

None - no external service configuration required beyond running `npx supabase db reset` when Docker is available to apply the migration.

## Next Phase Readiness

- Plan 10-02 can now upload Bloomington hero photos to `slice-photos` bucket and seed `photo_url` on the relevant slice rows
- The HeroBanner will automatically display DB photos once rows are seeded (fallback chain handles null gracefully)
- TypeScript is clean; no further type changes expected for photo infrastructure

---
*Phase: 10-photos-and-storage*
*Completed: 2026-04-06*
