---
phase: 10-photos-and-storage
plan: 02
subsystem: ui
tags: [wikipedia, react-hooks, geoid, fips, census-api, typescript, supabase]

# Dependency graph
requires:
  - phase: 10-01
    provides: photo_url DB column, HeroBanner accepts photoUrl prop, sliceCopy defaultPhoto fallback chain
  - phase: 09-03
    provides: HeroBanner rendered in AppShell, accepts photoUrl/sliceType/geoid/memberCount/siblingIndex props
provides:
  - geoidToWiki.ts — FIPS decoder mapping (sliceType, geoid) to Wikipedia article title
  - useWikiHeroImage.ts — React hook fetching Wikipedia REST API /page/summary, session-cached
  - useJurisdictionName.ts — React hook resolving human-readable jurisdiction names from geoids
  - ActiveHeroBanner component in AppShell wiring both hooks
  - Tab label renames (neighborhood→Local, local→County)
  - Unified slice backfilled to all existing connected users
  - Tabs hidden for slices user doesn't belong to
affects: [11-sidebar-widgets, 12-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Wikipedia REST API /api/rest_v1/page/summary/{title} for geographic hero images
    - Session-scoped Map cache keyed by sliceType|geoid to prevent duplicate fetches
    - Census Bureau API (api.census.gov) for county/place name lookups — no key required
    - photo_url DB column as curated override layer (photoUrl ?? wikiPhotoUrl ?? defaultPhoto)
    - FIPS decoder pattern: stateFips (first 2 digits) → state name; countyFips (digits 2-4) → county name

key-files:
  created:
    - src/lib/geoidToWiki.ts
    - src/hooks/useWikiHeroImage.ts
    - src/hooks/useJurisdictionName.ts
  modified:
    - src/components/AppShell.tsx
    - src/components/HeroBanner.tsx
    - src/components/SliceTabBar.tsx
    - src/lib/sliceCopy.ts
    - supabase/migrations/backfill_unified_*

key-decisions:
  - "Wikipedia replaces Supabase Storage — no uploads, no service-role keys, no manual seeding"
  - "Census Bureau API for county/place name lookups — free, no API key required"
  - "photo_url DB column retained as curated override layer — currently unused, ready for future"
  - "Tab labels: neighborhood→Local, local→County (reflects civic jurisdiction levels)"
  - "Unified tab hidden from users who don't have the slice — not shown until assigned"
  - "federal slice uses state-level Wikipedia article (congressional districts have no own article)"
  - "useWikiHeroImage returns null synchronously on first render, sets URL asynchronously — no loading spinner needed"

patterns-established:
  - "FIPS decoder pattern: slice geoid prefix maps to human-readable name for external API calls"
  - "Session cache (module-level Map) for external API results — prevents re-fetch on tab switch"
  - "ActiveHeroBanner extracted component — wrapper that calls hooks, passes results to pure HeroBanner"

# Metrics
duration: ~3h (multi-session including pivoted approach)
completed: 2026-04-06
---

# Phase 10 Plan 02: Wikipedia Hero Image + Jurisdiction Names Summary

**Wikipedia REST API replaces Supabase Storage for hero images — FIPS decoder maps slice geoids to geo-appropriate Wikipedia articles (state capitol, county courthouse), with Census API for jurisdiction display names**

## Performance

- **Duration:** ~3 hours (multi-session; approach pivoted from Supabase Storage uploads to Wikipedia)
- **Started:** 2026-04-06
- **Completed:** 2026-04-06
- **Tasks:** 2 (+ checkpoint approved)
- **Files modified:** 8+

## Accomplishments

- Wikipedia hero images load automatically for all geo-based slices — Monroe County courthouse for Local, Indiana State House for State and Federal — zero uploads required
- Jurisdiction name hooks resolve human-readable names from raw FIPS geoids (e.g., "18097" → "Monroe County") using a fast inline Indiana lookup with Census Bureau API fallback
- SliceTabBar updated with corrected civic terminology (neighborhood→Local, local→County) and tabs hidden for slices a user doesn't belong to
- Unified slice backfilled to all existing connected users via production migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove old artifacts + create geoidToWiki.ts** — `6f5e6d6` (feat)
2. **Task 2: Create useWikiHeroImage hook + wire into AppShell** — `34bad09` (feat)
3. **Post-checkpoint: Capitol photos for federal/state, Census API fallback** — `45db690` (fix)
4. **Post-checkpoint: Resolve jurisdiction display names** — `1742943` (feat)
5. **Post-checkpoint: Rename tabs + Earth photo for Unified** — `6a46a1a` (feat)
6. **Post-checkpoint: Hide tabs for slices user doesn't belong to** — `0576554` (fix)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `src/lib/geoidToWiki.ts` — FIPS decoder: (sliceType, geoid) → Wikipedia article title. Full 50-state table + Indiana county fast path. federal/state → state name, local → "{County} County, {State}", neighborhood/unified/volunteer → null
- `src/hooks/useWikiHeroImage.ts` — React hook fetching Wikipedia REST API `/page/summary/{title}`. Session-cached per sliceType|geoid key. Prefers originalimage over thumbnail for banner resolution. Census API fallback for local slices not in Indiana lookup
- `src/hooks/useJurisdictionName.ts` — React hook resolving human-readable names. federal → "United States of America", state → state name, local → "{County} County" via Census API, neighborhood → city name via Census API FIPS place code
- `src/components/AppShell.tsx` — ActiveHeroBanner component extracted to call hooks at component level (React rules of hooks). Wires useWikiHeroImage and useJurisdictionName, passes results to HeroBanner
- `src/components/HeroBanner.tsx` — Jurisdiction pill shows sliceName (resolved name) instead of raw geoid. SLICE_LEVEL_LABELS updated for new tab terminology
- `src/components/SliceTabBar.tsx` — Tabs renamed (neighborhood→"Local", local→"County"). Tabs hidden for slice types the user doesn't belong to
- `src/lib/sliceCopy.ts` — Taglines updated for neighborhood/local slices; unified defaultPhoto kept as Unsplash Earth fallback
- `supabase/migrations/backfill_unified_*` — Unified slice created in production, all existing users enrolled

## Decisions Made

- **Wikipedia over Supabase Storage:** Original plan required uploading photos, managing a service-role key, and running a seed script. Wikipedia's REST API returns high-quality geo-appropriate images for free — state capitols, county courthouses, skylines — with no auth required.
- **Census Bureau API for names:** `api.census.gov/data/2020/dec/pl?get=NAME&for=county:{fips}` returns the authoritative county name. No API key required. Used as fallback for counties not in the Indiana fast-path lookup.
- **photo_url column retained:** DB column from Plan 10-01 kept as a curated override layer. When set, it takes priority over Wikipedia. Currently unused — ready for future admin tooling.
- **Tab labels:** "neighborhood" and "local" are TIGER/Line technical terms. "Local" (neighborhood) and "County" (local) better reflect what civic users understand as their community levels.
- **Unified tab visibility:** Users without the unified slice shouldn't see the tab — it would be empty and confusing. Tab hidden until slice is assigned.
- **federal → state Wikipedia fallback:** Congressional district pages on Wikipedia are stubs with no lead image. The containing state article has strong landmark photography. Federal slice falls back to state name.

## Deviations from Plan

### Pivoted Approach (Pre-execution)

**Wikipedia replaces Supabase Storage upload pipeline**
- **Context:** Original 10-02 plan called for a Node.js upload script to seed photo URLs into the DB and a Supabase migration stub
- **Pivot reason:** Wikipedia approach is cleaner, requires no uploads, no service-role keys, and returns better photos automatically for any US state or county
- **Impact:** Old upload script (`scripts/upload-bloomington-photos.ts`) and stub migration deleted; two new files created instead

### Auto-fixed Issues

**1. [Rule 1 - Bug] Capitol photo mapping for federal/state slices**
- **Found during:** Post-checkpoint visual verification
- **Issue:** Initial geoidToWiki mapped federal/state to plain state name — Indiana Wikipedia article photo is a generic landscape, not the capitol
- **Fix:** Added explicit capitol title mapping: state → "Indiana State Capitol", federal → "United States Capitol" (congressional districts fall back to US Capitol)
- **Files modified:** `src/lib/geoidToWiki.ts`
- **Committed in:** `45db690`

**2. [Rule 2 - Missing Critical] Jurisdiction display names for hero banner title**
- **Found during:** Post-checkpoint — hero banner was showing raw geoid strings (e.g., "18097") as the location label
- **Issue:** HeroBanner pill showed raw geoid; no human-readable name resolution existed
- **Fix:** Created `useJurisdictionName.ts` hook with Census Bureau API lookups; wired into AppShell/HeroBanner
- **Files modified:** `src/hooks/useJurisdictionName.ts`, `src/components/AppShell.tsx`, `src/components/HeroBanner.tsx`
- **Committed in:** `1742943`

---

**Total deviations:** 3 (1 approach pivot pre-execution, 2 auto-fixed post-checkpoint)
**Impact on plan:** Approach pivot improved the implementation significantly. Auto-fixes addressed display quality issues discovered during visual verification. No scope creep.

## Issues Encountered

- **PostgREST schema cache:** After adding `photo_url` column in Plan 10-01, the column wasn't visible to PostgREST until `NOTIFY pgrst, 'reload schema'` was sent and a brief wait elapsed. Subsequent queries succeeded. This is a known PostgREST behavior after DDL changes.
- **Missing Phase 7 migration in production:** Production database was missing the unified/volunteer CHECK constraint migration from Phase 7. Applied manually on 2026-04-06 before backfill could run cleanly.
- **Unified slice backfill:** Two connected users (BloomingtonVoter and Kades) needed enrollment in the unified slice. Applied via migration.

## User Setup Required

None — Wikipedia REST API requires no authentication. Census Bureau API requires no key. No environment variables added.

## Next Phase Readiness

- Phase 10 complete. All slice tabs display geo-appropriate hero images with human-readable jurisdiction names.
- Phase 11 (Sidebar Widgets) can proceed. Pre-conditions to confirm before starting:
  - `civicspaces.empowered.vote` in `api.empowered.vote` CORS allowlist
  - Empower pillar compass API endpoint/response shape
  - Accounts API rep data fields at `GET /api/essentials/representatives/me`
- Sidebar hooks must be hoisted to AppShell level (Phase 11 pre-condition established in 09-01 decision) — all 6 panels mount simultaneously

---
*Phase: 10-photos-and-storage*
*Completed: 2026-04-06*
