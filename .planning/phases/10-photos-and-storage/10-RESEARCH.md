# Phase 10: Photos & Storage - Research

**Researched:** 2026-04-05
**Domain:** Supabase Storage, CDN asset serving, SQL migrations, React component wiring
**Confidence:** HIGH

## Summary

Phase 10 introduces Supabase Storage as the CDN backend for hero banner photos. The work has three parts: (1) provision a public Storage bucket and its RLS policy via SQL migration, (2) add a `photo_url` column to `civic_spaces.slices` and seed 3 Bloomington-specific rows, and (3) update `sliceCopy.ts` with 6 type-default CDN URLs and wire the HeroBanner component to prefer the DB value over the type default.

The codebase already has no Storage usage — this is the first bucket. The existing migration naming convention (`YYYYMMDDHHMMSS_description.sql`) and the service-role bypass pattern (used by the slice-assignment service) are both well-established. The `supabase-js` client is version `^2.100.1`, which includes the full Storage API including `getPublicUrl()`.

The critical architectural decision (Claude's Discretion) is whether type-default photos live in Supabase Storage or stay as external CDN URLs in `sliceCopy.ts`. Research strongly favors keeping type-defaults as external Unsplash/Pexels direct URLs for now — it avoids uploading 6 binary files, avoids a seed/storage sync step, and the Unsplash license is irrevocable and commercially free. Only the 3 Bloomington-specific government photos need Supabase Storage because (a) Wikimedia URLs have the potential to go stale and (b) control matters for a nonprofit's institutional imagery.

**Primary recommendation:** Create one public bucket named `slice-photos`, add `photo_url text` to `civic_spaces.slices`, seed 3 Bloomington DB rows via SQL UPDATE, keep 6 type-defaults as external Unsplash/Pexels URLs in `sliceCopy.ts`, add a `photoUrl` prop to `HeroBanner` with fallback to `copy.placeholderPhoto`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.100.1 (already installed) | Storage client: bucket creation, upload, getPublicUrl | Already the project's Supabase client; Storage is a built-in API surface |
| Supabase CLI | 2.85.0 (already installed) | Migrations, local bucket seeding via config.toml | Already used for all migrations in this project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node `fs` / `fetch` | Built-in | One-time upload script for Bloomington photos | Download Wikimedia source → upload to bucket via service-role key |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Storage for type-defaults | External Unsplash URLs in sliceCopy.ts | External URLs are fine: Unsplash license is irrevocable/commercial, URLs are stable with ixid param. Avoids binary file management. Recommended. |
| External Wikimedia URL for Bloomington govt photos | Supabase Storage CDN | Wikimedia is stable but could theoretically change. For the nonprofit's canonical location imagery, owning the CDN URL is better. |

**Installation:** No new packages needed — `@supabase/supabase-js` is already installed.

## Architecture Patterns

### Recommended Project Structure
```
supabase/
├── migrations/
│   └── 20260405000000_phase10_slice_photo_url.sql   # ADD COLUMN + RLS bucket policy
├── config.toml                                        # [storage.buckets.slice-photos] section added
scripts/
└── upload-bloomington-photos.ts                       # One-time upload script (service role)
src/
├── lib/sliceCopy.ts                                  # Update placeholderPhoto → real CDN URLs
├── components/HeroBanner.tsx                         # Add photoUrl prop, priority logic
└── hooks/useAllSlices.ts                             # Add photo_url to slices SELECT
```

### Pattern 1: Public Bucket via SQL Migration

**What:** Create the `slice-photos` bucket via `INSERT INTO storage.buckets` in a migration file, plus an RLS policy allowing public SELECT on `storage.objects`. Service role bypasses RLS automatically — no write policy needed.

**When to use:** Any time bucket existence must be tracked in git alongside table migrations.

```sql
-- Source: https://supabase.com/docs/guides/storage/buckets/creating-buckets
-- and https://supabase.com/docs/guides/storage/security/access-control

INSERT INTO storage.buckets (id, name, public)
VALUES ('slice-photos', 'slice-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read: anyone (anon or authenticated) can SELECT objects in this bucket.
-- Service role bypasses RLS entirely — no INSERT/UPDATE policy is needed for uploads.
CREATE POLICY "slice_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'slice-photos');
```

**Notes:**
- The `public = true` flag enables CDN caching for all objects in the bucket.
- Service role key (used in upload scripts and slice-assignment service) entirely bypasses RLS — confirmed by official Supabase docs.
- No need for an INSERT or UPDATE RLS policy; uploads happen only via service-role scripts, not authenticated users.

### Pattern 2: config.toml Bucket Registration for Local Dev

**What:** Add the bucket to `supabase/config.toml` so `supabase db reset` and `supabase start` provision it locally without needing to run migrations manually.

```toml
# Source: https://github.com/supabase/cli/blob/develop/pkg/config/templates/config.toml
[storage.buckets.slice-photos]
public = true
file_size_limit = "5MiB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]
```

**Notes:**
- `objects_path` is optional; omit it here since local seeding of photos is not needed for development.
- The SQL migration and config.toml are both required: migration runs on production/remote, config.toml covers local.

### Pattern 3: CDN URL Construction

**What:** The public URL format for any uploaded file is deterministic.

```typescript
// Source: https://supabase.com/docs/guides/storage/serving/downloads
// and https://supabase.com/docs/reference/javascript/storage-from-getpublicurl

// Manual construction (no SDK call needed — bucket is public):
const CDN_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/slice-photos/bloomington/courthouse.jpg`

// Or via SDK:
const { data } = supabase.storage
  .from('slice-photos')
  .getPublicUrl('bloomington/courthouse.jpg')
// data.publicUrl === `${SUPABASE_URL}/storage/v1/object/public/slice-photos/bloomington/courthouse.jpg`
```

**Recommended folder layout inside the bucket:**
```
slice-photos/
└── bloomington/
    ├── courthouse.jpg       # Civil/District slice (Monroe County Courthouse)
    ├── indiana-capitol.jpg  # State slice (Indiana State Capitol)
    └── white-house.jpg      # Federal slice (White House)
```

Using a `bloomington/` prefix makes future city-specific folders obvious and prevents name collisions.

### Pattern 4: DB Column + Fallback Logic

**What:** The `slices` table gets a nullable `photo_url` column. `useAllSlices` selects it. `AppShell` passes it as a prop to `HeroBanner`, which prefers the DB value over the type default from `sliceCopy.ts`.

```sql
-- Migration fragment
ALTER TABLE civic_spaces.slices
  ADD COLUMN photo_url text;
```

```typescript
// useAllSlices.ts — add photo_url to SELECT and SliceInfo
// SliceInfo gains: photoUrl?: string | null

// HeroBanner.tsx — updated props + fallback
interface HeroBannerProps {
  sliceType: SliceType
  sliceName: string
  geoid: string
  memberCount: number
  siblingIndex: number
  photoUrl?: string | null   // new — from DB; null = use type default
}

export function HeroBanner({ ..., photoUrl }: HeroBannerProps) {
  const copy = SLICE_COPY[sliceType]
  const resolvedPhoto = photoUrl ?? copy?.placeholderPhoto ?? null
  // ...
}
```

**AppShell wiring (prop drilling — no new hook needed):**
```typescript
// AppShell.tsx — activeSlice already has photoUrl after SliceInfo update
<HeroBanner
  sliceType={activeSlice.sliceType}
  sliceName={TAB_LABELS[activeTab]}
  geoid={activeSlice.geoid}
  memberCount={activeSlice.memberCount}
  siblingIndex={activeSlice.siblingIndex}
  photoUrl={activeSlice.photoUrl}      // new
/>
```

### Pattern 5: One-Time Upload Script

**What:** A Node/TypeScript script that downloads photos from source URLs and uploads them to the bucket using the service-role key.

```typescript
// scripts/upload-bloomington-photos.ts
// Run once: npx ts-node scripts/upload-bloomington-photos.ts
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // bypasses RLS
)

async function uploadPhoto(localPath: string, storagePath: string) {
  const file = fs.readFileSync(localPath)
  const { error } = await supabase.storage
    .from('slice-photos')
    .upload(storagePath, file, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (error) throw error
  const { data } = supabase.storage.from('slice-photos').getPublicUrl(storagePath)
  console.log(`Uploaded: ${data.publicUrl}`)
}
```

**Workflow:**
1. Manually download photos from Wikimedia Commons (public domain) to a local `tmp/` directory.
2. Run the script — it uploads and logs the CDN URLs.
3. Paste the CDN URLs into the Bloomington seed migration (UPDATE statements).
4. Delete the `tmp/` directory (do not commit binaries).

### Pattern 6: Bloomington DB Seed via SQL UPDATE

**What:** After uploading, store the 3 CDN URLs in the `slices` table rows. These rows already exist in production (inserted by the slice-assignment service when Bloomington users joined). The migration uses UPDATE WHERE to target specific geoid+slice_type rows.

```sql
-- Bloomington GEOIDs (from 01-02-SUMMARY.md and seed.sql):
-- Federal:   geoid = '1807',  slice_type = 'federal'   → White House
-- State:     geoid = '18046', slice_type = 'state'      → Indiana State Capitol
-- Local:     geoid = '18097', slice_type = 'local'      → Bloomington Courthouse
--   (Note: CONTEXT.md says "Civil Civics/District" maps to the local/county slice)

UPDATE civic_spaces.slices
  SET photo_url = 'https://[project].supabase.co/storage/v1/object/public/slice-photos/bloomington/white-house.jpg'
  WHERE geoid = '1807' AND slice_type = 'federal';

UPDATE civic_spaces.slices
  SET photo_url = 'https://[project].supabase.co/storage/v1/object/public/slice-photos/bloomington/indiana-capitol.jpg'
  WHERE geoid = '18046' AND slice_type = 'state';

UPDATE civic_spaces.slices
  SET photo_url = 'https://[project].supabase.co/storage/v1/object/public/slice-photos/bloomington/courthouse.jpg'
  WHERE geoid = '18097' AND slice_type = 'local';
```

**Important:** The migration file must be created with the CDN URLs known at write time. This means the upload script runs BEFORE the migration is finalized.

### Anti-Patterns to Avoid

- **Creating the bucket via JS at app startup:** Do not call `supabase.storage.createBucket()` from frontend code. Bucket creation belongs in migrations or the upload script.
- **Storing Wikimedia URLs directly in the DB:** Wikimedia image URLs are stable but not guaranteed CDN-cached. Upload to Supabase Storage for control.
- **RLS write policy for authenticated users:** Users should never be able to upload to `slice-photos`. No INSERT policy means no user writes. Service role bypasses RLS.
- **Committing photo binaries to git:** Do not add `.jpg` files to the repo. Download locally, upload to Storage, use CDN URLs in code.
- **Encoding CDN URLs before the bucket exists:** The upload script must run first. The migration with UPDATE statements must use confirmed CDN URLs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CDN URL construction | Custom URL builder | `getPublicUrl()` or hardcode pattern `${SUPABASE_URL}/storage/v1/object/public/...` | URL format is documented and deterministic for public buckets |
| Public access policy | Complex RLS logic | Simple `TO public USING (bucket_id = 'slice-photos')` | Service role bypasses entirely; anon needs only SELECT |
| Bucket creation in frontend code | `supabase.storage.createBucket()` in React | SQL migration + config.toml | Bucket is infrastructure, not runtime app logic |
| Custom fallback image logic | Complex state management | `photoUrl ?? copy?.placeholderPhoto ?? null` inline in HeroBanner | Two-level fallback is one line of code |

**Key insight:** Supabase Storage for a read-heavy, low-write use case (6 static images) requires almost no custom logic — the main work is the migration, the upload script, and a prop addition to HeroBanner.

## Common Pitfalls

### Pitfall 1: Migration runs before upload script
**What goes wrong:** The SQL UPDATE migration hardcodes CDN URLs. If the migration runs before photos are uploaded, the URLs are invalid and images break.
**Why it happens:** The migration and upload are sequential dependencies but easy to conflate with regular schema migrations.
**How to avoid:** Treat the upload script as a pre-migration step. Run it first, verify CDN URLs return 200, then finalize the migration SQL with the confirmed URLs. Or: run the migration with `photo_url = NULL` first and do the UPDATE as a separate step post-upload.
**Warning signs:** Migration file contains placeholder `[project]` tokens.

### Pitfall 2: Bucket created but no RLS policy = uploads blocked
**What goes wrong:** Supabase Storage requires at least a SELECT policy for public reads even on `public = true` buckets. Without the policy, `anon` role gets 403 even if the bucket is marked public.
**Why it happens:** `public = true` enables CDN caching but the RLS policy controls the authorization layer separately.
**How to avoid:** Always include the `storage.objects` SELECT policy alongside the `storage.buckets` INSERT in the migration.
**Warning signs:** Photos return 403 in browser. Dashboard shows bucket as "public" but files are inaccessible.

### Pitfall 3: `useAllSlices` SELECT doesn't include `photo_url`
**What goes wrong:** The DB column exists and is populated, but HeroBanner never receives the jurisdiction-specific URL because `useAllSlices` doesn't select it.
**Why it happens:** The Supabase JS client only returns columns explicitly listed in `.select()`. Omitting `photo_url` from the select string means it's silently absent from `sliceRows`.
**How to avoid:** Update the `.select()` string and `SliceInfo` type in tandem. Test that `activeSlice.photoUrl` is defined for a Bloomington state slice.
**Warning signs:** Bloomington State slice shows generic type-default photo despite DB having a value.

### Pitfall 4: Wikimedia source URL downloaded incorrectly
**What goes wrong:** Downloading the Wikimedia *page* URL instead of the *direct file* URL. The page URL returns HTML, not a binary.
**Why it happens:** Wikimedia file pages (e.g., `commons.wikimedia.org/wiki/File:...`) are not the direct image URL.
**How to avoid:** On Wikimedia, click the image to reach the full-resolution view, right-click → "Copy image address." URL should end in `.jpg` or `.png` and start with `upload.wikimedia.org`.
**Warning signs:** Uploaded file has wrong MIME type or zero byte size.

### Pitfall 5: Supabase project URL leaks into sliceCopy.ts
**What goes wrong:** The SUPABASE_URL is hardcoded into `sliceCopy.ts` for the 6 type-default photos if they were also uploaded to Storage.
**Why it happens:** sliceCopy.ts is static, not env-aware.
**How to avoid:** Keep the 6 type-default photos as external Unsplash/Pexels URLs in `sliceCopy.ts`. Only Bloomington-specific DB rows reference `supabase.co` CDN URLs — and those come from the DB query, not sliceCopy.ts.
**Warning signs:** `VITE_SUPABASE_URL` value appears in a `.ts` source file.

### Pitfall 6: Existing sliceCopy.ts Unsplash URLs need ixid param for API compliance
**What goes wrong:** If the type-default Unsplash URLs are being used directly in production (not replaced by Supabase Storage URLs), Unsplash API guidelines require the `ixid` query parameter to remain in the URL for photo view reporting.
**Why it happens:** The existing placeholders in `sliceCopy.ts` use bare `?w=1200&h=400&fit=crop` params without `ixid`. For production, get proper URLs via the Unsplash API or source via the Unsplash website download which includes the required param.
**How to avoid:** When finalizing type-default photos, download through the Unsplash web interface or API to get URLs with `ixid`. Alternatively use Pexels, which has no such requirement.

## Code Examples

### Storage bucket creation SQL (migration)
```sql
-- Source: https://supabase.com/docs/guides/storage/buckets/creating-buckets
-- Source: https://supabase.com/docs/guides/storage/security/access-control
INSERT INTO storage.buckets (id, name, public)
VALUES ('slice-photos', 'slice-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "slice_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'slice-photos');
```

### Add photo_url column (migration)
```sql
ALTER TABLE civic_spaces.slices
  ADD COLUMN photo_url text;

COMMENT ON COLUMN civic_spaces.slices.photo_url
  IS 'CDN URL for jurisdiction-specific hero photo; NULL = use type-default from sliceCopy.ts';
```

### getPublicUrl usage
```typescript
// Source: https://supabase.com/docs/reference/javascript/storage-from-getpublicurl
// After uploading 'bloomington/courthouse.jpg':
const { data } = supabase.storage
  .from('slice-photos')
  .getPublicUrl('bloomington/courthouse.jpg')
// data.publicUrl: "https://{project}.supabase.co/storage/v1/object/public/slice-photos/bloomington/courthouse.jpg"
```

### Upload with service role (script pattern)
```typescript
// Source: https://supabase.com/docs/reference/javascript/storage-from-upload
const { error } = await supabase.storage
  .from('slice-photos')
  .upload('bloomington/courthouse.jpg', fileBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',  // 1 year; photos don't change
  })
```

### SliceInfo type update
```typescript
// src/types/database.ts
export interface SliceInfo {
  id: string
  sliceType: SliceType
  geoid: string
  memberCount: number
  siblingIndex: number
  photoUrl?: string | null    // new in Phase 10
}
```

### HeroBanner fallback logic
```typescript
// src/components/HeroBanner.tsx
const copy = SLICE_COPY[sliceType]
const resolvedPhoto = photoUrl ?? copy?.placeholderPhoto ?? null
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unsplash placeholder URLs in sliceCopy.ts | Supabase Storage CDN for jurisdiction-specific, Unsplash for type defaults | Phase 10 | Bloomington gets authentic local imagery; fallback chain preserved |
| No `photo_url` on slices table | `photo_url text` nullable column | Phase 10 migration | Per-slice photo without code deploy for future cities |

**Deprecated/outdated:**
- `placeholderPhoto` field name in `SliceCopy` interface: rename to `defaultPhoto` to accurately reflect it's the permanent type default (not a temporary placeholder). This is a clean-up opportunity during Phase 10.

## Open Questions

1. **Which specific Wikimedia file for Monroe County Courthouse?**
   - What we know: Wikimedia Commons has multiple photos of the Monroe County Courthouse in Bloomington, IN. All U.S. government building photos by U.S. government employees are public domain.
   - What's unclear: The exact file to use — planner should pick based on landscape/widescreen orientation suitability for a 16:5 hero banner (approximately 2400×750 cropped view).
   - Recommendation: Search `commons.wikimedia.org` for "Monroe County Courthouse Indiana" and select a horizontal wide-format photo. Download the highest resolution available.

2. **Neighborhood GEOID for Bloomington seed rows**
   - What we know: The seed.sql and migration files show geoid values for federal (`1807`), state (`18046`), and local/county (`18097`). The neighborhood geoid is likely a 7-digit school district or census tract GEOID.
   - What's unclear: The exact neighborhood geoid string for Bloomington's test user. Phase 10 only seeds courthouse/capitol/white-house so neighborhood is excluded — no issue.
   - Recommendation: No action needed for Phase 10 scope.

3. **Should the upload script be checked into git?**
   - What we know: It's a one-time script. The slice-assignment service already uses service-role patterns.
   - What's unclear: Whether it's worth maintaining as a repeatable artifact.
   - Recommendation: Yes — keep `scripts/upload-bloomington-photos.ts` in git as documentation of how the Supabase Storage files were created. Mark it with a comment that it should only be run once. Delete downloaded photos from `tmp/` before committing.

## Sources

### Primary (HIGH confidence)
- https://supabase.com/docs/guides/storage/buckets/creating-buckets — bucket creation methods, SQL INSERT syntax
- https://supabase.com/docs/guides/storage/serving/downloads — CDN URL format `${project}.supabase.co/storage/v1/object/public/{bucket}/{path}`
- https://supabase.com/docs/guides/storage/security/access-control — RLS on `storage.objects`, service role bypass, SELECT policy SQL
- https://supabase.com/docs/reference/javascript/storage-from-upload — upload options: contentType, upsert, cacheControl
- https://supabase.com/docs/reference/javascript/storage-from-getpublicurl — getPublicUrl return shape
- https://github.com/supabase/cli/blob/develop/pkg/config/templates/config.toml — config.toml `[storage.buckets.*]` syntax

### Secondary (MEDIUM confidence)
- https://unsplash.com/license — Unsplash license is irrevocable, commercial-use OK, no attribution required
- https://www.pexels.com/license/ — Pexels license free for commercial use, no attribution required
- WebSearch confirmation that `INSERT INTO storage.buckets` is the SQL pattern for migration-based bucket creation

### Tertiary (LOW confidence)
- WebSearch: Wikimedia Commons public domain coverage for U.S. government buildings (widely accepted, not sourced from official copyright statement)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@supabase/supabase-js` ^2.100.1 already installed; Storage API verified via official docs
- Architecture: HIGH — migration patterns match existing project conventions; RLS policy SQL verified against official docs
- Pitfalls: HIGH — bucket/RLS interaction and column omission bugs are documented in official Supabase materials and are deterministic
- Photo sourcing: MEDIUM — Unsplash/Pexels license verified; Wikimedia public domain for U.S. government works is HIGH by U.S. copyright law (17 U.S.C. § 101) but specific file identification is LOW

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (Supabase Storage API is stable; 30-day window reasonable)
