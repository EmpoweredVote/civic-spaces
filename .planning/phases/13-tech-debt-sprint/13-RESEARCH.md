# Phase 13: v3.0 Tech Debt Sprint - Research

**Researched:** 2026-04-10
**Domain:** Codebase surgery — three isolated, well-understood fixes across DB query, CSS layout, and bundle splitting
**Confidence:** HIGH

---

## Summary

Phase 13 closes three non-blocking tech debt items surfaced by the v3.0 milestone audit. Each item is a surgical single-file change with zero architectural ambiguity. The research was conducted by reading the exact source files involved; all findings are HIGH confidence based on direct code inspection of the live codebase.

**TD-01 (photo_url):** `useAllSlices` SELECTs six columns from `civic_spaces.slices` but omits `photo_url`. The `SliceInfo` type already has `photoUrl?: string | null`, `HeroBanner` already consumes it, and `AppShell.ActiveHeroBanner` already passes `slice.photoUrl ?? wikiPhotoUrl`. The only missing link is the SELECT. Adding `photo_url` to the Supabase query activates the entire dormant path without any downstream changes.

**TD-02 (volunteer ghost column):** The `Sidebar` component correctly returns `null` for the volunteer tab, but the wrapping column `div` in `AppShell` — `<div className="hidden md:flex ...">` — stays in the DOM and occupies the 18% right-column grid track. The fix is a single conditional class: when `activeTab === 'volunteer'`, suppress the column by adding `md:hidden` to override `md:flex`. No changes needed to `Sidebar.tsx`, `SidebarMobile.tsx`, or the grid structure.

**TD-03 (Recharts chunk):** `CompassWidget.tsx` statically imports six named exports from `recharts` at the top of the file. Recharts is 938KB and bundles into the initial chunk. The fix is to lazy-load `CompassWidget` itself via `React.lazy` + dynamic `import()`, wrapping the call site (in `Sidebar.tsx` and `SidebarMobile.tsx`) in `<Suspense>`. No changes to `CompassWidget.tsx` internals are needed — just change the import to dynamic.

**Primary recommendation:** Each TD item is a 1–3 line change in a single file. Plan one task per TD item; no dependencies between the three tasks.

---

## Standard Stack

No new libraries needed. All work uses existing project stack.

### Core (already installed)
| Library | Version | Purpose | Relevant TD Item |
|---------|---------|---------|-----------------|
| `@supabase/supabase-js` | ^2.100.1 | DB query — adding `photo_url` to SELECT | TD-01 |
| React (built-in) | ^19.2.4 | `React.lazy` + `Suspense` for code splitting | TD-03 |
| `recharts` | ^3.8.1 | Chart library being split into async chunk | TD-03 |
| Tailwind CSS | ^4.2.2 | CSS class change for volunteer column | TD-02 |

**Installation:** No new packages required.

---

## Architecture Patterns

### TD-01: DB Column Selection

**Pattern: Add column to Supabase `.select()` and map to typed field**

The query in `useAllSlices` is:
```typescript
// File: src/hooks/useAllSlices.ts, line 32
const { data: sliceRows, error: sliceError } = await supabase
  .from('slices')
  .select('id, slice_type, geoid, current_member_count, sibling_index')
  .in('id', sliceIds)
```

The mapping loop is at lines 39–47. `photo_url` (snake_case from DB) must be mapped to `photoUrl` (camelCase) on the `SliceInfo` object.

**The `SliceInfo` type** (`src/types/database.ts`, line 11) already declares `photoUrl?: string | null` — no type change needed.

**PostgREST schema cache:** The `photo_url` column already exists in the DB (migration `20260405000000_phase10_storage_photo_url.sql`). This is NOT a DDL change — no `NOTIFY pgrst, 'reload schema'` is required. The column is already in the schema cache.

**Pattern: Add column name to SELECT string, add field to mapping**

```typescript
// BEFORE (line 32-34)
.select('id, slice_type, geoid, current_member_count, sibling_index')

// AFTER
.select('id, slice_type, geoid, current_member_count, sibling_index, photo_url')
```

```typescript
// BEFORE: mapping loop (lines 41-46)
slices[sliceType] = {
  id: row.id,
  sliceType,
  geoid: row.geoid,
  memberCount: row.current_member_count,
  siblingIndex: row.sibling_index,
}

// AFTER: add photoUrl
slices[sliceType] = {
  id: row.id,
  sliceType,
  geoid: row.geoid,
  memberCount: row.current_member_count,
  siblingIndex: row.sibling_index,
  photoUrl: row.photo_url ?? null,
}
```

**Downstream unchanged:** `AppShell.tsx` line 46 already reads `slice.photoUrl ?? wikiPhotoUrl` — this already prefers DB value over Wikipedia. Once `photoUrl` is populated (non-undefined), DB-seeded values will win. Currently `photoUrl` is always `undefined` (not selected), causing `slice.photoUrl ?? wikiPhotoUrl` to always resolve to `wikiPhotoUrl`.

---

### TD-02: Volunteer Tab Ghost Column

**Pattern: Conditional Tailwind class to suppress grid column**

The ghost column lives in `AppShell.tsx` at line 329:
```tsx
{/* Sidebar column — hidden on mobile, live on desktop */}
<div className="hidden md:flex flex-col border-l border-gray-200 dark:border-gray-700 overflow-y-auto sticky top-0 max-h-screen">
  <Sidebar compassData={compassData} repsData={repsData} activeTab={activeTab} />
</div>
```

`Sidebar` returns `null` when `activeTab === 'volunteer'`, but the `div` still exists and the `md:grid-cols-[82%_18%]` grid forces it to occupy 18% of width.

**Fix: conditionally add `md:hidden` to the column div when on volunteer tab.**

```tsx
// AFTER — AppShell.tsx line 329
<div className={[
  'flex-col border-l border-gray-200 dark:border-gray-700',
  'overflow-y-auto sticky top-0 max-h-screen',
  activeTab === 'volunteer' ? 'hidden' : 'hidden md:flex',
].join(' ')}>
  <Sidebar compassData={compassData} repsData={repsData} activeTab={activeTab} />
</div>
```

Alternative (more concise):
```tsx
<div className={`flex-col border-l border-gray-200 dark:border-gray-700 overflow-y-auto sticky top-0 max-h-screen ${activeTab === 'volunteer' ? 'hidden' : 'hidden md:flex'}`}>
```

**Effect:** When `activeTab === 'volunteer'`, the column div gets `hidden` (not `md:flex`), so it takes no grid space. The feed column gets the full width. When on any other tab, `hidden md:flex` restores the normal behaviour. The grid template `md:grid-cols-[82%_18%]` stays unchanged on the outer div — CSS grid with an invisible/zero-content second column track does not free the space unless the element is removed or set to `display:none`, which `hidden` achieves.

**Note on `SidebarMobile`:** It already returns `null` on volunteer tab (line 19 of `SidebarMobile.tsx`) and lives inside the feed column, so it does not contribute to the ghost space problem. No change needed there.

---

### TD-03: Recharts Dynamic Import

**Pattern: React.lazy + Suspense to defer large library chunk**

`CompassWidget.tsx` currently imports Recharts statically:
```typescript
// File: src/components/widgets/CompassWidget.tsx, lines 2-9
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
```

This causes the entire 938KB Recharts bundle to be included in the initial JS chunk.

**Approach:** Lazy-load `CompassWidget` itself at its import sites rather than modifying `CompassWidget.tsx`. Both `Sidebar.tsx` and `SidebarMobile.tsx` import `CompassWidget` statically.

**In `Sidebar.tsx` and `SidebarMobile.tsx`:**
```typescript
// BEFORE
import { CompassWidget } from './widgets/CompassWidget'

// AFTER
import { lazy, Suspense } from 'react'
const CompassWidget = lazy(() =>
  import('./widgets/CompassWidget').then((m) => ({ default: m.CompassWidget }))
)
```

The `.then((m) => ({ default: m.CompassWidget }))` dance is needed because `CompassWidget` is a named export, not a default export. `React.lazy` requires a module with a `default` export.

**Suspense boundary at the call site:**
```tsx
// In Sidebar.tsx render and SidebarMobile.tsx render
<Suspense fallback={<div className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
  <CompassWidget
    categories={compassData.categories}
    answers={compassData.answers}
    isLoading={compassData.isLoading}
    isUncalibrated={compassData.isUncalibrated}
  />
</Suspense>
```

**Alternative approach — lazy-load in CompassWidget.tsx itself:** Keep the static import in Sidebar/SidebarMobile but change `CompassWidget.tsx` to lazy-import recharts components internally. This avoids the named-export wrapper but requires restructuring `CompassWidget.tsx` to split the chart rendering into a separate file. The approach above (lazy the whole `CompassWidget`) is simpler.

**Note on existing `isLoading` skeleton:** `CompassWidget` already renders a `<Skeleton>` when `isLoading` is true. The `Suspense` fallback only fires during the first JS chunk load (network). The skeleton fires when data is fetching. They serve different purposes and do not conflict.

**No `React.lazy` precedent in codebase:** The codebase currently has zero uses of `React.lazy` or `Suspense` (confirmed by grep). This is the first use. The pattern is well-supported in React 19.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code-splitting Recharts | Manual webpack chunk config | `React.lazy` + dynamic `import()` | Vite handles the split automatically when dynamic import is used; no Vite config changes needed |
| Volunteer tab column suppression | JS-driven grid reflow | Tailwind conditional class | One class swap is sufficient; no layout restructuring needed |
| DB photo_url type inference | Custom type assertion | Supabase's inferred row type + existing `SliceInfo` type | Type already defined; just map the field |

**Key insight:** All three TD items require only the minimum change to activate already-designed paths. No new patterns, no new dependencies, no architectural changes.

---

## Common Pitfalls

### Pitfall 1: Forgetting the named-export wrapper for React.lazy
**What goes wrong:** `lazy(() => import('./widgets/CompassWidget'))` will fail at runtime with "Element type is invalid" because `CompassWidget` is a named export, not a default export.
**Why it happens:** `React.lazy` only accepts modules with a `default` export.
**How to avoid:** Always use `.then((m) => ({ default: m.ExportName }))` for named exports.
**Warning signs:** TypeScript may not catch this; it's a runtime error.

### Pitfall 2: Applying `md:hidden` instead of removing `md:flex`
**What goes wrong:** Adding `md:hidden` to a div that already has `md:flex` — the last Tailwind class wins (in Tailwind v4, utility conflicts resolve by source order). Both classes target the same breakpoint and `display` property.
**Why it happens:** The existing class is `hidden md:flex`. If you add `md:hidden` after it, you get `hidden md:flex md:hidden` — in Tailwind v4, the last matching utility wins, so `md:hidden` takes precedence and the result is correct. But this is fragile.
**How to avoid:** Use conditional class logic (`activeTab === 'volunteer' ? 'hidden' : 'hidden md:flex'`) to produce mutually exclusive class strings rather than adding to an existing class string.

### Pitfall 3: Triggering PostgREST schema cache reload unnecessarily
**What goes wrong:** Adding `photo_url` to the SELECT could prompt concern about schema cache. But this is not a DDL change — the column already exists. PostgREST only needs a cache reload after DDL (ALTER TABLE, CREATE TABLE, etc.). The column was added in migration `20260405000000_phase10_storage_photo_url.sql`, which already ran. No `NOTIFY` needed.
**How to avoid:** Only reload PostgREST schema cache after DDL migrations. TD-01 is a query-only change.

### Pitfall 4: Suspense boundary placed outside the null-return guard in Sidebar
**What goes wrong:** If `<Suspense>` wraps the entire `Sidebar` return value but `Sidebar` returns `null` on volunteer tab, the Suspense boundary fires on first load even when on the volunteer tab.
**Why it happens:** The Suspense fallback fires when the lazy component hasn't loaded yet, regardless of what props the component will receive.
**How to avoid:** Place the `<Suspense>` boundary inside the Sidebar `return` JSX, after the early `if (activeTab === 'volunteer') return null` guard — or simply wrap only the `<CompassWidget />` call site in `<Suspense>`.

---

## Code Examples

### TD-01: Complete diff for useAllSlices.ts

```typescript
// src/hooks/useAllSlices.ts — change 1: add photo_url to SELECT (line 32)
const { data: sliceRows, error: sliceError } = await supabase
  .from('slices')
  .select('id, slice_type, geoid, current_member_count, sibling_index, photo_url')
  .in('id', sliceIds)

// src/hooks/useAllSlices.ts — change 2: map photo_url to photoUrl (lines 41-46)
slices[sliceType] = {
  id: row.id,
  sliceType,
  geoid: row.geoid,
  memberCount: row.current_member_count,
  siblingIndex: row.sibling_index,
  photoUrl: row.photo_url ?? null,
}
```

### TD-02: Complete diff for AppShell.tsx (sidebar column div)

```tsx
// src/components/AppShell.tsx — line 329
// BEFORE:
<div className="hidden md:flex flex-col border-l border-gray-200 dark:border-gray-700 overflow-y-auto sticky top-0 max-h-screen">

// AFTER:
<div className={`${activeTab === 'volunteer' ? 'hidden' : 'hidden md:flex'} flex-col border-l border-gray-200 dark:border-gray-700 overflow-y-auto sticky top-0 max-h-screen`}>
```

### TD-03: Complete diff for Sidebar.tsx (and mirror in SidebarMobile.tsx)

```typescript
// src/components/Sidebar.tsx — BEFORE (line 5):
import { CompassWidget } from './widgets/CompassWidget'

// AFTER (replace line 5 with):
import { lazy, Suspense } from 'react'
const CompassWidget = lazy(() =>
  import('./widgets/CompassWidget').then((m) => ({ default: m.CompassWidget }))
)
```

```tsx
// src/components/Sidebar.tsx — in JSX, wrap CompassWidget usage with Suspense:
// BEFORE:
<CompassWidget
  categories={compassData.categories}
  answers={compassData.answers}
  isLoading={compassData.isLoading}
  isUncalibrated={compassData.isUncalibrated}
/>

// AFTER:
<Suspense fallback={<div className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
  <CompassWidget
    categories={compassData.categories}
    answers={compassData.answers}
    isLoading={compassData.isLoading}
    isUncalibrated={compassData.isUncalibrated}
  />
</Suspense>
```

---

## File Map

| TD Item | File to Change | Line(s) | Nature of Change |
|---------|---------------|---------|-----------------|
| TD-01 | `src/hooks/useAllSlices.ts` | 32, 41–46 | Add `photo_url` to SELECT; add `photoUrl` field to mapping |
| TD-02 | `src/components/AppShell.tsx` | 329 | Replace `"hidden md:flex"` with conditional class expression |
| TD-03 | `src/components/Sidebar.tsx` | 5, ~22 | Change static import to lazy; wrap call site in Suspense |
| TD-03 | `src/components/SidebarMobile.tsx` | 9, ~61 | Same as Sidebar.tsx |
| TD-03 | `CompassWidget.tsx` | — | No change needed |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static import of heavy charting library | `React.lazy` + dynamic import | React 16.6+ | Recharts ~938KB removed from initial bundle; loaded on first sidebar render |
| DB override path wired but dormant | DB override activated | TD-01 fix | `photo_url` DB values will now take priority over Wikipedia images for seeded slices |

---

## Open Questions

1. **Should `CompassWidget.tsx` be converted to a default export to simplify the lazy pattern?**
   - What we know: It's a named export. The lazy wrapper `.then((m) => ({ default: m.CompassWidget }))` is a valid workaround.
   - What's unclear: Whether converting to default export is preferred.
   - Recommendation: Leave as named export; use the wrapper. Changing to default export would require updating all current import sites and adds risk for a cosmetic preference.

2. **Does the TD-02 Tailwind conditional class work correctly in Tailwind v4?**
   - What we know: Tailwind v4 uses CSS Cascade Layers; class conflict resolution is by source order in generated CSS, not specificity. Conditional class generation (producing mutually exclusive strings) avoids the conflict entirely.
   - What's unclear: Exact Tailwind v4 conflict resolution between `hidden md:flex` when both breakpoint-prefixed classes appear in the same string.
   - Recommendation: Use the conditional expression (`activeTab === 'volunteer' ? 'hidden' : 'hidden md:flex'`) which produces mutually exclusive outputs — avoids the question entirely.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/hooks/useAllSlices.ts` — confirmed current SELECT columns, confirmed `SliceInfo` mapping
- Direct codebase inspection: `src/types/database.ts` — confirmed `SliceInfo.photoUrl?: string | null` already typed
- Direct codebase inspection: `src/components/AppShell.tsx` — confirmed ghost column div at line 329, confirmed `slice.photoUrl ?? wikiPhotoUrl` at line 46
- Direct codebase inspection: `src/components/Sidebar.tsx` — confirmed `if (activeTab === 'volunteer') return null` at line 15
- Direct codebase inspection: `src/components/widgets/CompassWidget.tsx` — confirmed static Recharts import lines 2–9
- Direct codebase inspection: `.planning/v3.0-MILESTONE-AUDIT.md` — authoritative audit document describing all three TD items with impact assessments
- Direct codebase inspection: `supabase/migrations/20260405000000_phase10_storage_photo_url.sql` — confirmed `photo_url` column exists in DB

### Secondary (MEDIUM confidence)
- React documentation on `React.lazy` and `Suspense` — standard React 16.6+ pattern, well-established
- Vite documentation — dynamic imports automatically trigger code splitting in Vite without config changes

---

## Metadata

**Confidence breakdown:**
- TD-01 fix: HIGH — exact SELECT string and mapping loop identified in source; column exists in DB migration; TypeScript type already correct
- TD-02 fix: HIGH — exact div and class string identified in source; Tailwind conditional class is idiomatic
- TD-03 fix: HIGH — exact static import identified; React.lazy + named export wrapper is standard pattern; no Vite config needed
- PostgREST concern: HIGH — no DDL change, no cache reload needed

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable codebase, no fast-moving dependencies involved)
