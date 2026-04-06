# Stack Research: Civic Spaces

## Confirmed Stack (pre-decided)

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 19 + Tailwind CSS v4 | Components as `.tsx`, Vite build |
| Backend | Express + TypeScript | Deployed on Render |
| Database | Supabase | PostgreSQL + RLS enabled |
| Auth | `accounts.empowered.vote` API | External — Third-Party Auth path, ES256 JWT, token in localStorage as `cs_token` |
| Cache | Upstash Redis | With in-memory fallback |

**These are not up for re-evaluation.** All other recommendations below work within these constraints.

---

## v3.0 UI/UX Additions — What Needs Deciding

The existing stack handles the forum core. v3.0 adds three capabilities that require new library decisions:

1. **Radar/spider chart** — Issue Alignment Compass widget in the sidebar
2. **Supabase Storage** — Hero photo upload and CDN-served image delivery
3. **Hero image transitions** — Crossfade on tab/slice switch

All three must respect the project's bundle-lean constraint (~5,332 LOC TypeScript, Render free tier).

---

## 1. Radar/Spider Chart: Recharts RadarChart

### Recommendation: Recharts `^3.x` (already a strong choice; no new dependency needed)

**Use `recharts` with its `RadarChart` component.** Recharts v3.8.1 (released March 25, 2026) is the current stable version. It ships built-in SVG-based radar chart support, has an `accessibilityLayer` prop defaulting to `true`, and is the library shadcn/ui uses for its radar chart primitives — meaning copy-paste patterns from shadcn/ui docs work directly.

**Why not alternatives:**

| Library | Verdict | Reason |
|---------|---------|--------|
| **Recharts** | **Use this** | SVG-based, accessibility built in, D3 submodules only (not full D3), shadcn/ui ecosystem, active v3 maintenance |
| react-chartjs-2 + Chart.js | Skip | Canvas-based (not SVG), ~10–80 KB additional but requires full Chart.js peer install, no native ARIA per-element |
| Victory | Skip | ~135 KB gzipped for full package, radar requires full install, Formidable Labs no longer primary maintainer |
| Nivo | Skip | Beautiful but heavy; multiple render backends add complexity for a single widget |
| react-d3-radar | Skip | Last published 7 years ago, unmaintained |
| react-svg-radar-chart | Skip | Unmaintained, no TypeScript-first support |
| Roll-your-own SVG | Skip | Significant complexity for correct accessibility, interaction, and responsive sizing |

**Bundle reality:** Recharts v3 is ~106 KB gzipped when adding the first chart component (the `generateCategoricalChart` architecture limits tree-shaking). This is the key tradeoff. However, if the project adds any charting capability at all, Recharts is the right investment — adding a second chart type (e.g., bar chart for vote breakdowns later) costs near zero additional bundle weight since the core is already loaded.

**Accessibility:** `RadarChart` accepts `accessibilityLayer` (defaults `true`), which adds ARIA labels, roles, and arrow-key keyboard navigation. Users can navigate chart data points with keyboard without tabbing through each point (arrow keys move between points, Tab skips the whole chart).

**Radar chart pattern for Issue Alignment Compass:**

```tsx
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

const compassData = [
  { axis: 'Environment', score: 72 },
  { axis: 'Economy', score: 58 },
  { axis: 'Housing', score: 85 },
  { axis: 'Transit', score: 63 },
  { axis: 'Public Safety', score: 49 },
];

<ResponsiveContainer width="100%" height={260}>
  <RadarChart data={compassData} accessibilityLayer>
    <PolarGrid />
    <PolarAngleAxis dataKey="axis" />
    <Radar
      name="Community Alignment"
      dataKey="score"
      stroke="#4f46e5"
      fill="#4f46e5"
      fillOpacity={0.25}
    />
  </RadarChart>
</ResponsiveContainer>
```

**Installation:**

```bash
npm install recharts
```

**Version:** `^3.8.1` (latest as of April 2026)

**Confidence:** HIGH — verified against official Recharts GitHub releases, Recharts docs, and shadcn/ui charts documentation.

---

## 2. Supabase Storage — Hero Photo Upload and CDN Delivery

### Recommendation: Native `@supabase/supabase-js` storage API (no new dependency)

Supabase Storage is already available through the existing `@supabase/supabase-js` client (`^2.100.1`). No additional library is needed.

### How it works

**Upload flow (browser → Storage):**

```typescript
// In a React mutation handler
const { data, error } = await supabase
  .storage
  .from('hero-photos')          // bucket name
  .upload(
    `slices/${sliceId}/${fileName}`,   // path within bucket
    file,                               // File object from <input type="file">
    {
      contentType: file.type,           // e.g. 'image/jpeg'
      upsert: true,                     // allow overwrite
      cacheControl: '3600',             // CDN cache: 1 hour
    }
  );
```

**Retrieve public CDN URL (synchronous — no network call):**

```typescript
const { data } = supabase
  .storage
  .from('hero-photos')
  .getPublicUrl(`slices/${sliceId}/${fileName}`);

// data.publicUrl = "https://kxsdzaojfaibhuzmclfq.supabase.co/storage/v1/object/public/hero-photos/slices/..."
```

`getPublicUrl()` is a pure string construction — it does not make a network request. Call it anywhere you need the URL, including in React render.

**CDN behavior:** All Supabase Storage requests route through a global CDN (~285 cities). Public bucket objects achieve high cache hit ratios because no per-user authorization check occurs at the CDN edge. For hero photos (low-write, high-read), public buckets are correct.

**Image transforms (built-in, no Cloudinary needed):**

```typescript
const { data } = supabase
  .storage
  .from('hero-photos')
  .getPublicUrl(`slices/${sliceId}/${fileName}`, {
    transform: { width: 1200, height: 400, resize: 'cover' },
  });
// Returns: ...supabase.co/storage/v1/render/image/public/...?width=1200&height=400
```

Supabase's built-in image transformation endpoint resizes on first request and caches the result at the CDN edge. This eliminates the need for a separate image CDN or Imgix.

### Bucket setup

Create a public bucket named `hero-photos` in Supabase Dashboard → Storage → New Bucket → toggle "Public bucket".

**RLS policy for uploads (admin-only for v3.0 — slice photos are set by admins, not end users):**

```sql
-- Allow authenticated users with admin role to upload hero photos
-- (For v3.0 hero photos are admin-managed, not user-uploaded)
create policy "Admins can upload hero photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'hero-photos'
  and (auth.jwt() ->> 'role') = 'admin'
);

-- Public read — anyone can read (bucket is public, but belt-and-suspenders)
create policy "Public can read hero photos"
on storage.objects for select
using (bucket_id = 'hero-photos');
```

**Critical note for Civic Spaces's Third-Party Auth:** Storage RLS uses `auth.jwt() ->> 'sub'` as the user identifier — identical to the pattern already working for table-level RLS. The existing Supabase client configuration (passing `cs_token` as `accessToken`) propagates correctly to Storage API calls. No additional auth wiring is needed.

**TanStack Query integration:**

```typescript
// useHeroPhoto.ts
export function useSliceHeroPhotoUrl(sliceId: string, fileName: string | null) {
  if (!fileName) return null;
  const { data } = supabase
    .storage
    .from('hero-photos')
    .getPublicUrl(`slices/${sliceId}/${fileName}`);
  return data.publicUrl;
}
```

Since `getPublicUrl` is synchronous, it does not need to be wrapped in `useQuery`. Store the `file_name` column in the `slices` table and construct the URL at render time.

**Schema addition:**

```sql
alter table civic_spaces.slices
  add column hero_photo_path text; -- e.g. "slices/abc-123/hero.jpg"
```

**Confidence:** HIGH — verified against Supabase official JS docs for `storage.from().upload()` and `storage.from().getPublicUrl()`, CDN docs, and Storage access control docs.

---

## 3. Hero Image Transitions on Tab/Slice Switch

### Recommendation: CSS-only via Tailwind `transition-opacity` (no new dependency)

The project already has `motion` v11 installed (`"motion": "^11.18.2"`). However, for a hero image crossfade on tab switch, **CSS-only is the correct choice**. Framer Motion / motion adds meaningful complexity (34 KB base for `motion` component, or 4.6 KB initial + 15 KB lazy-loaded features) for an effect that Tailwind handles in three lines.

**Why CSS-only wins here:**

| Criterion | CSS (Tailwind) | motion `<m.div>` |
|-----------|---------------|-----------------|
| Bundle cost | 0 KB added | 15–34 KB |
| Implementation complexity | 3 Tailwind classes | LazyMotion + m + AnimatePresence |
| Interruptibility | No (fine for slow hero swap) | Yes (unnecessary here) |
| GPU-accelerated | Yes (`opacity` composites on GPU) | Yes |
| Sufficient for this use case | Yes | Overkill |

**The crossfade pattern (absolute-positioned images with opacity transition):**

```tsx
// HeroBanner.tsx
interface HeroBannerProps {
  photoUrl: string | null;
  sliceName: string;
}

export function HeroBanner({ photoUrl, sliceName }: HeroBannerProps) {
  const [displayUrl, setDisplayUrl] = useState(photoUrl);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Fade out → swap → fade in
    setVisible(false);
    const timer = setTimeout(() => {
      setDisplayUrl(photoUrl);
      setVisible(true);
    }, 300); // match duration-300
    return () => clearTimeout(timer);
  }, [photoUrl]);

  return (
    <div className="relative w-full h-48 overflow-hidden rounded-lg bg-slate-200">
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={sliceName}
          className={[
            'absolute inset-0 w-full h-full object-cover',
            'transition-opacity duration-300 ease-in-out',
            visible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-300 to-slate-400" />
      )}
    </div>
  );
}
```

The `transition-opacity duration-300 ease-in-out` Tailwind classes compose to a GPU-composited opacity animation. No JS animation runtime required.

**When to use `motion` instead:** Use the existing `motion` v11 install for interactions that require spring physics, drag gestures, or shared-element transitions (e.g., expanding a post card into full view). Hero banner swap on slice tab click does not require any of these.

**Tailwind v4 note:** This project uses Tailwind v4 (`^4.2.2`). The `transition-opacity`, `duration-300`, `opacity-0`/`opacity-100` utilities exist unchanged in v4. The new `transition-discrete` utility in v4 is for `display` property transitions (e.g., toggling `hidden`/`block`) — not needed here since we're toggling opacity, not display.

**Confidence:** HIGH — verified against Tailwind CSS v4 docs and confirmed `motion` v11.18.2 is in the current `package.json`.

---

## v3.0 New Dependencies Summary

| Package | Version | Why | Added |
|---------|---------|-----|-------|
| `recharts` | `^3.8.1` | Radar chart for Issue Alignment Compass | NEW |

That's it. One new dependency for all three feature areas.

- Supabase Storage: existing `@supabase/supabase-js` client handles everything
- Hero image transitions: existing Tailwind CSS handles everything

---

## What NOT to Add

### D3 directly
Recharts already brings D3 submodules. Importing D3 separately for the radar chart doubles the D3 cost and creates version conflicts. Use Recharts' abstractions.

### Chart.js / react-chartjs-2
Canvas-based rendering means no per-element ARIA, no SVG DOM for screen readers, and a separate Chart.js peer dependency (~70 KB). Not justified for a single widget.

### Cloudinary / Imgix
Supabase Storage's built-in image transformation (`/render/image/public/`) covers resize-on-demand with CDN caching. No external image CDN needed at this scale.

### Nivo
Heavy, multiple render modes, complex configuration for a single radar widget. Recharts is simpler and already covers this use case.

### `framer-motion` (separate package)
The project already imports from `motion` (the unified package that superseded `framer-motion`). Do not install both. They are the same library with different package names — installing both will create two copies in the bundle.

### AnimatePresence for hero crossfade
AnimatePresence is useful for exit animations on unmounted components. For a static hero banner that stays mounted and swaps content, the CSS opacity approach is simpler and has zero runtime cost.

---

## Full Package Version Reference (v3.0)

| Package | Installed Version | Status |
|---------|-----------------|--------|
| `react` | `^19.2.4` | Existing |
| `react-dom` | `^19.2.4` | Existing |
| `tailwindcss` | `^4.2.2` | Existing — v4 |
| `@tailwindcss/vite` | `^4.2.2` | Existing |
| `@supabase/supabase-js` | `^2.100.1` | Existing — covers Storage |
| `@tanstack/react-query` | `^5.95.2` | Existing |
| `motion` | `^11.18.2` | Existing — use for interactions, not hero fade |
| `wouter` | `^3.9.0` | Existing |
| `react-hook-form` | `^7.72.0` | Existing |
| `zod` | `^4.3.6` | Existing |
| `sonner` | `^2.0.7` | Existing |
| `recharts` | `^3.8.1` | **NEW for v3.0** |

---

## Feed & Pagination (carried forward from v2.0 research)

### Cursor-based pagination

Use cursor pagination everywhere in feeds. Supabase's `.range()` (OFFSET/LIMIT) degrades badly at scale and causes duplicate/missing items in live feeds when new posts arrive mid-scroll. Cursor pagination using `created_at` or a composite `(created_at, id)` cursor avoids both problems.

```typescript
// First page
const { data } = await supabase
  .schema('civic_spaces')
  .from('posts')
  .select('*')
  .eq('slice_id', sliceId)
  .order('created_at', { ascending: false })
  .limit(20);

// Subsequent pages
const { data: nextPage } = await supabase
  .schema('civic_spaces')
  .from('posts')
  .select('*')
  .eq('slice_id', sliceId)
  .lt('created_at', lastCreatedAt)
  .order('created_at', { ascending: false })
  .limit(20);
```

### Real-time hybrid approach

Do not use Supabase Realtime subscriptions as the sole data delivery mechanism. Use Realtime `postgres_changes` subscription to *invalidate* TanStack Query cache on new posts — not as the data source itself. Fall back to polling at 15–30s if WebSocket drops.

### TanStack Query infinite scroll

```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['boosted-feed', sliceId],
  queryFn: ({ pageParam }) => fetchPosts(sliceId, pageParam),
  getNextPageParam: (lastPage) =>
    lastPage.length === 20 ? lastPage[lastPage.length - 1].created_at : undefined,
  initialPageParam: undefined,
});
```

---

## React UI Libraries (carried forward from v2.0 research)

### Virtualized List: React Virtuoso `^4.x`

React Virtuoso handles variable-height posts, reverse scroll for comment threads, and an `endReached` callback that integrates cleanly with `useInfiniteQuery`. Not currently installed — add when feed virtualization is needed.

### Toast: Sonner `^2.0.7` (already installed)

Zero dependencies, 2–3 KB gzipped.

### Form: React Hook Form `^7.x` + Zod `^4.x` (already installed)

---

## Supabase Patterns (carried forward, updated for v3.0 Storage)

### Auth Integration

Civic Spaces uses Third-Party Auth (Path A). GoTrue migrated to ES256. Token stored as `cs_token`, passed via `accessToken` option in supabase client. This propagates automatically to all Supabase APIs including Storage — no extra wiring needed.

### RLS Pattern

Use `auth.jwt() ->> 'sub'` as the user identifier in all RLS policies (table and storage).

### PostgREST Schema Routing

All `civic_spaces` schema queries must use `.schema('civic_spaces')` except reads from the four public views: `posts`, `slices`, `slice_members`, `connected_profiles`.

### Schema Indexing Checklist

| Table | Required Indexes |
|-------|-----------------|
| `posts` | `(slice_id, created_at DESC)`, `(slice_id, hot_score DESC, id DESC)` |
| `slice_members` | `(slice_id, user_id)` UNIQUE, `(user_id)` |
| `notifications` | `(recipient_id, read_at, created_at DESC)` |
| `replies` | `(post_id, created_at ASC)` |
| `storage.objects` | Default Supabase Storage indexes cover `(bucket_id, name)` |

---

## What NOT to Use (full list)

### Socket.io
Supabase Realtime already provides WebSocket infrastructure. Adding Socket.io creates a second connection layer, doubles infrastructure cost on Render (stateful server required).

### GraphQL / Apollo Client
Supabase PostgREST REST API + TanStack Query is equivalent without GraphQL overhead. Revisit only if highly complex cross-resource queries become frequent.

### Supabase Auth
Already decided against. External JWT integration via Third-Party Auth is the correct path.

### react-virtualized / react-window
Unmaintained or lacks variable-height item support. Use React Virtuoso if virtualization is needed.

### Offset-based pagination (`.range()`)
Degrades at scale and causes item duplication/skipping in live feeds.

### D3 directly
Recharts already includes D3 submodules. Importing D3 separately doubles cost.

### Chart.js / react-chartjs-2
Canvas-based, no per-element ARIA. Not appropriate for this accessibility-conscious widget.

### Cloudinary / Imgix
Supabase Storage built-in transforms cover resize-on-demand at this scale.

### `framer-motion` npm package
Already superseded by `motion` in this project. Do not install both.

---

*Researched: 2026-04-05*
*Scope: v3.0 UI/UX Redesign — radar chart, Supabase Storage, hero transitions*
