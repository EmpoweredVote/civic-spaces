# Phase 10: Photos & Storage - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Upload jurisdiction-specific hero photos to Supabase Storage and serve them via CDN URL into the Phase 9 hero banner. Bloomington pilot slices get authentic local imagery (courthouse, Indiana State Capitol, White House). Every slice type has at least one curated photo — no broken image states. Editing or managing photos after upload is a future phase.

</domain>

<decisions>
## Implementation Decisions

### Photo Sourcing
- Free/public domain only — nonprofit budget constraint
- Government buildings (courthouse, Indiana State Capitol, White House): Wikimedia Commons or official U.S. government sources (public domain by law)
- Neighborhood and Local imagery: Unsplash or Pexels (free, commercially licensed)
- No paid stock photography

### Slice-to-Photo Mapping
- Photo URLs stored **per slice instance** in the database, not per type globally
- Requires a `photo_url` column (or equivalent) on the `slices` table — migration needed
- App queries the DB for a jurisdiction-specific URL first; falls back to type default if null
- This allows future cities to have their own photos without a code deploy

### Fallback Behavior
- When a slice has no `photo_url` set in the DB, the hero banner falls back to the **per-type default** defined in `sliceCopy.ts`
- Lookup priority: DB `photo_url` (jurisdiction-specific) → `sliceCopy.ts` type default
- No broken image states — every slice type must have a type-default photo in sliceCopy.ts

### Upload Scope (Phase 10 deliverable)
- **6 type-default photos** (one per slice type: Neighborhood, Local, Civil/District, State, Federal, Unified/Volunteer) stored in `sliceCopy.ts` as CDN URLs
- **3 Bloomington-specific photos** stored as DB records:
  - Civil Civics / District slice → Bloomington courthouse
  - State slice → Indiana State Capitol
  - Federal slice → White House
- Neighborhood and Local Bloomington slices use type defaults (no jurisdiction-specific photo in Phase 10)

### Claude's Discretion
- Exact Supabase Storage bucket name and folder structure
- Whether type-default photos are also uploaded to Supabase Storage or remain as external Unsplash/Wikimedia URLs in sliceCopy.ts
- RLS policy implementation details (public read, service-role write is the requirement)
- How the DB lookup is wired into the HeroBanner component (prop drilling vs. hook)

</decisions>

<specifics>
## Specific Ideas

- Roadmap explicitly calls out the three Bloomington subjects: courthouse (Civil/District), Indiana State Capitol (State), White House (Federal)
- Project is a nonprofit with limited funding — free sources are a hard preference, not just a nice-to-have
- The `sliceCopy.ts` file already exists from Phase 9 with Unsplash placeholder URLs — Phase 10 updates those to real CDN URLs for type defaults

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-photos-and-storage*
*Context gathered: 2026-04-05*
