# Phase 11: Sidebar Widgets - Research

**Researched:** 2026-04-06
**Domain:** React sidebar widget architecture, Recharts radar chart, Empowered Vote Compass API, Essentials representatives API
**Confidence:** HIGH (all primary findings verified against live codebase and official integration docs)

---

## Summary

Phase 11 populates the existing sidebar column placeholder (already in AppShell at line 313) with three widgets: Issue Alignment Compass (radar chart), Representing This Community (rep cards), and Tools for This Community (icon grid). The sidebar DOM structure requires no structural changes — Phase 9 left a `hidden md:flex flex-col` column waiting for content.

The critical architectural concern is the 6x hook firing problem. AppShell mounts all six SliceFeedPanels simultaneously (CSS-hidden). Any hook inside a panel fires 6x on load. Sidebar hooks must be hoisted to AppShell level and receive the `activeTab` value as input. The compass hook fetches from `accounts.empowered.vote/api` using the same `cs_token` already stored by `useAuth`. The representatives hook fetches from `accounts.empowered.vote/api/essentials/representatives/me` (requires Bearer auth, returns `PoliticianFlatRecord[]`).

The Compass widget uses **Recharts** (already used in Treasury Tracker at v3.5.1, not yet in Civic Spaces — needs install). The Compass data pipeline requires two calls: `GET /api/compass/categories` (public, for axis labels) and `GET /api/compass/answers` (optional auth, for user scores). The `ev_token` key name used by CompassV2 is different from Civic Spaces's `cs_token` key — both are the same JWT from the same auth hub, stored under different keys. For sidebar calls from Civic Spaces, use `cs_token`.

**Primary recommendation:** Install recharts, hoist all three widget data hooks to AppShell before writing any widget component, render widgets directly into the existing sidebar column div, and implement mobile collapsible as a separate component tree below HeroBanner in the feed column.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.5.1 | Radar chart for Compass widget | Already used in Treasury Tracker; official EV ecosystem choice |
| @tanstack/react-query | ^5.95.2 | Data fetching with caching | Already in project; prevents re-fetch on tab switch |
| react-loading-skeleton | ^3.5.0 | Loading states for rep cards | Already in project; matches FeedSkeleton pattern |
| motion/react (motion v11) | ^11.18.2 | Collapsible animation on mobile | Already in project; used in NotificationBell |
| tailwindcss v4 | ^4.2.2 | Styling | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | latest | Tool card icons | If added; alternative is inline SVGs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | @chrisandrewsedu/ev-ui RadarChartCore | ev-ui is a private package not on public npm; not installable in Civic Spaces without private registry access |
| recharts | d3 directly | recharts is higher-level and already in the EV ecosystem |
| motion/react animate | CSS transition | motion/react already in project; AnimatePresence handles unmount animation |

**Installation:**
```bash
npm install recharts
```

No other new packages needed — all other requirements are satisfied by existing dependencies.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── AppShell.tsx              # Hook hoisting lives here (EXISTING — modify)
│   ├── Sidebar.tsx               # New: desktop sidebar column wrapper
│   ├── SidebarMobile.tsx         # New: mobile collapsible section
│   ├── widgets/
│   │   ├── CompassWidget.tsx     # Radar chart + calibration prompt
│   │   ├── RepresentativesWidget.tsx  # Rep cards list
│   │   └── ToolsWidget.tsx       # 2-col icon grid
│   └── ...
├── hooks/
│   ├── useCompassData.ts         # Fetches categories + answers (hoisted to AppShell)
│   ├── useRepresentatives.ts     # Fetches /essentials/representatives/me (hoisted)
│   └── ...
```

### Pattern 1: AppShell Hook Hoisting

**What:** All sidebar data hooks live in AppShell, not inside any widget component. Widget components receive data as props.
**When to use:** Always — this is mandatory for all 6-panel simultaneously-mounted architectures.

```typescript
// In AppShell.tsx — hooks called unconditionally at AppShell level
const compassData = useCompassData()      // fetches categories + user answers once
const repsData = useRepresentatives(activeTab)  // re-fetches when tab changes

// Pass down to sidebar
<Sidebar
  activeTab={activeTab}
  compassData={compassData}
  repsData={repsData}
/>
```

### Pattern 2: Widget Visibility as Props (Not Conditional Render)

**What:** Sidebar receives data and conditionally renders widgets based on data state. Widgets themselves are pure presentational.
**When to use:** Extensible sidebar — new widgets can be added without touching AppShell hook logic.

```typescript
// Sidebar.tsx
function Sidebar({ compassData, repsData, activeTab }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <CompassWidget data={compassData} />
      {repsData.reps.length > 0 && (
        <RepresentativesWidget reps={repsData.reps} isLoading={repsData.isLoading} />
      )}
      <ToolsWidget />
    </div>
  )
}
```

### Pattern 3: useRepresentatives — Tab-Aware with Skeleton on Switch

**What:** The representatives hook takes `activeTab` as input and re-queries when it changes. Returns `{ reps, isLoading, isError }`. `isLoading` is `true` on tab switch (new query initiated) — widget shows skeleton instead of stale reps.
**When to use:** Any time the displayed content is slice-specific.

```typescript
// Source: verified from AppShell pattern and useAllSlices.ts
export function useRepresentatives(userId: string | null) {
  const token = localStorage.getItem('cs_token')
  return useQuery({
    queryKey: ['representatives', userId],
    queryFn: () => fetchRepresentatives(token),
    enabled: !!userId && !!token,
    staleTime: 5 * 60 * 1000,   // 5 min — reps don't change often
  })
}

// Note: /essentials/representatives/me is keyed to the authenticated user's
// stored jurisdiction, not to the active slice tab. The same reps appear
// regardless of which tab is selected. Tab-switching does NOT trigger a re-fetch.
// The "show for current slice" requirement maps to filtering client-side
// by district_type if needed, but the Context.md says "show all" in Phase 11.
```

### Pattern 4: Compass Radar Chart with Recharts

**What:** RadarChart using categories as axes, answers as data points.
**When to use:** Compass widget when user has 3+ answered topics.

```typescript
// Source: recharts GitHub source (verified), recharts v3 API
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip
} from 'recharts'

// Data shape for recharts RadarChart
// categories from GET /api/compass/categories → [{id, title, topics: [...]}]
// answers from GET /api/compass/answers → [{topic_id, value, inverted, ...}]
// Build one data entry per category:
const chartData = categories.map(cat => {
  // Average the answer values for topics in this category
  const catAnswers = cat.topics
    .map(t => answers.find(a => a.topic_id === t.id)?.value)
    .filter((v): v is number => v != null)
  const avg = catAnswers.length > 0
    ? catAnswers.reduce((sum, v) => sum + v, 0) / catAnswers.length
    : 0
  return { category: cat.title, value: avg }
})

<ResponsiveContainer width="100%" aspect={1}>
  <RadarChart data={chartData} outerRadius="75%">
    <PolarGrid />
    <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
    <Radar
      name="Your Compass"
      dataKey="value"
      fill="#7c3aed"       // purple-700 — anti-partisan color per CONTEXT.md
      fillOpacity={0.35}
      stroke="#7c3aed"
      strokeWidth={2}
    />
    <Tooltip
      formatter={(value: number, name: string) => [value.toFixed(1), name]}
    />
  </RadarChart>
</ResponsiveContainer>
```

### Pattern 5: Mobile Collapsible Section

**What:** Below HeroBanner in the feed column, a collapsible section using `motion/react` AnimatePresence.
**When to use:** Mobile only (md breakpoint hides sidebar column).

```typescript
// Source: motion/react already used in NotificationBell.tsx
import { AnimatePresence, motion } from 'motion/react'

const [expanded, setExpanded] = useState(false)

<div className="md:hidden">
  <button onClick={() => setExpanded(!expanded)} className="w-full ...">
    {/* header row */}
  </button>
  <AnimatePresence>
    {expanded && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        {/* widget content */}
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

### Pattern 6: Widget Card Container

**What:** Consistent visual container for each widget matching the v3.0 design standard.
**When to use:** All three widgets use this wrapper.

```typescript
function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700
                    bg-gray-50 dark:bg-gray-900 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide
                     text-gray-500 dark:text-gray-400 mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Hook inside widget component:** `useRepresentatives` called inside `RepresentativesWidget` fires 6x because widget is rendered inside or near the 6-panel area. Always hoist to AppShell.
- **Hardcoded compass axis labels:** Context.md explicitly says do not hardcode. Fetch from `GET /api/compass/categories`.
- **Using `ev_token` key:** CompassV2 uses `ev_token`, Civic Spaces uses `cs_token`. Both hold the same JWT but under different keys. Use `cs_token` everywhere in Civic Spaces.
- **Showing party affiliation:** `PoliticianFlatRecord.party` field exists in the API response — never render it. Display `full_name`, `office_title`, `photo_origin_url` only.
- **Showing reps widget with 0 results:** Hide entire widget when `reps.length === 0`. No empty state message.
- **Sidebar sticky breaking scroll containment:** The sidebar column needs `position: sticky; top: 0; height: 100vh; overflow-y: auto` to scroll independently when widget height exceeds viewport. Do not use `overflow: hidden` on the sidebar column.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radar chart | Custom SVG radar | recharts RadarChart | Axis math, polygon clipping, responsive sizing, tooltip all solved |
| Loading skeleton | Custom shimmer CSS | react-loading-skeleton SkeletonTheme | Matches FeedSkeleton pattern; dark mode via SkeletonTheme baseColor/highlightColor |
| Collapsible animation | CSS max-height trick | motion/react AnimatePresence | max-height trick has timing bugs with dynamic content height; motion handles it cleanly |
| Tooltip on hover | Custom tooltip div | recharts Tooltip | Recharts Tooltip handles positioning, overflow, mouse tracking |
| Image fallback | Try/catch img src | onError handler on `<img>` | Standard React pattern, no library needed |

**Key insight:** Recharts handles all the polar coordinate math. The only work is mapping API data to recharts data shape (array of objects with category name + value).

---

## API Reference (Verified Against Live Codebase)

### Compass Widget API Calls

**GET `/api/compass/categories`**
- Auth: Optional (public)
- Base URL: `https://accounts.empowered.vote/api`
- Returns: `Array<{ id: string; title: string; topics: Array<{ id: string; title: string; short_title: string | null; question_text: string }> }>`
- Use: Category titles become radar chart axis labels

**GET `/api/compass/answers`**
- Auth: Optional (unauthenticated returns `[]`)
- Token: `localStorage.getItem('cs_token')` as Bearer header
- Returns: `Array<{ topic_id: string; value: number; write_in_text: string | null; visibility: string; inverted: boolean; updated_at: string }>`
- Use: Values (0.5–5.5) become radar chart data points
- Note: `value` is NUMERIC float — always parseFloat, never parseInt

**Calibration threshold:** Show calibration prompt when `answers.length < 3`. Link to `https://compassv2.empowered.vote/results`.

### Representatives Widget API Call

**GET `/api/essentials/representatives/me`**
- Auth: Required (Bearer token, Connected tier)
- Base URL: `https://accounts.empowered.vote/api`
- Token: `localStorage.getItem('cs_token')`
- Response: `PoliticianFlatRecord[]` (see type below) OR `204 No Content` (user has no location on file)
- Response header: `X-Data-Status: 'fresh' | 'no-geofence-data'`

**PoliticianFlatRecord fields relevant to the widget:**
```typescript
{
  id: string;
  full_name: string;          // Display name for the card
  office_title: string;       // Role label (e.g. "U.S. Representative")
  photo_origin_url: string;   // Headshot URL (empty string if none — treat as no photo)
  district_type: string;      // For branch sorting (see below)
  government_type: string;    // Additional branch classification
  party: string;              // EXISTS — DO NOT DISPLAY (anti-partisan policy)
  is_vacant: boolean;         // If true, office is vacant — no name to show
  images: Array<{             // Additional image options
    id: string; url: string; type: string;
    photo_license: string; focal_point: string | null
  }>;
}
```

**Branch sorting by `district_type`:**
```typescript
const BRANCH_ORDER: Record<string, number> = {
  // Executive
  NATIONAL_EXEC: 0,
  STATE_EXEC: 1,
  LOCAL_EXEC: 2,
  // Legislative
  NATIONAL_UPPER: 10,
  NATIONAL_LOWER: 11,
  STATE_UPPER: 12,
  STATE_LOWER: 13,
  COUNTY: 14,
  LOCAL: 15,
  SCHOOL: 16,
  // Judicial
  NATIONAL_JUDICIAL: 20,
  JUDICIAL: 21,
}

const sorted = reps.sort((a, b) =>
  (BRANCH_ORDER[a.district_type] ?? 99) - (BRANCH_ORDER[b.district_type] ?? 99)
)
```

**Photo resolution for rep cards:**
```typescript
// Priority: images[0].url (if present) → photo_origin_url (if non-empty) → generic avatar SVG
function getRepPhoto(rep: PoliticianFlatRecord): string | null {
  if (rep.images.length > 0 && rep.images[0].url) return rep.images[0].url
  if (rep.photo_origin_url) return rep.photo_origin_url
  return null  // caller renders generic avatar icon
}
```

### Tools Widget

No API call — static configuration. Live tools as of research date:
- **Empowered Compass** → `https://compassv2.empowered.vote/results`
- **Empowered Essentials** → `https://essentials.empowered.vote` (verify live URL before coding)
- **Treasury Tracker** → `https://treasury-tracker.empowered.vote` (verify live URL before coding)

All links open in new tab (`target="_blank" rel="noopener noreferrer"`).

Tools list should be defined in a static config array within the component, not fetched from an API. If a tool's URL is not confirmed live, exclude it.

---

## Common Pitfalls

### Pitfall 1: Hook Fires 6x

**What goes wrong:** Widget hook (e.g., `useRepresentatives`) placed inside `RepresentativesWidget` which is rendered in a location that causes 6 instances to mount.
**Why it happens:** All 6 SliceFeedPanels mount simultaneously (CSS hidden). If the sidebar widget is ever rendered inside a SliceFeedPanel, or if the hook is called in a component below AppShell that has 6 instances, each fires independently.
**How to avoid:** Call all data hooks in AppShell (single instance). Pass data as props through `Sidebar → widgets`. Sidebar and widgets are stateless presentational components.
**Warning signs:** Network tab shows 6 identical requests to `accounts.empowered.vote/api/essentials/representatives/me` on page load.

### Pitfall 2: Sidebar Scroll Trap

**What goes wrong:** Combined widget height > viewport height but sidebar doesn't scroll — content cut off.
**Why it happens:** Parent flex container with `overflow-hidden` applied for layout reasons (necessary for feed scroll containment) propagates to sidebar column.
**How to avoid:** The sidebar column `<div>` needs both `overflow-y-auto` and `height: 100%` (or `max-h-[calc(100vh-XXpx)]` accounting for header + tab bar height). The existing Phase 9 sidebar placeholder div already has `overflow-y-auto` — verify this is preserved.
**Warning signs:** Sidebar widgets get cut off at the bottom of the viewport with no scroll indicator.

### Pitfall 3: Stale Reps During Tab Switch

**What goes wrong:** User switches from Federal tab to State tab; still sees Federal reps briefly.
**Why it happens:** React Query returns cached data while re-fetching, and the `isLoading` flag is `false` on cache hits.
**How to avoid:** Use `isFetching` (not `isLoading`) to detect re-fetch in progress, OR use `placeholderData: undefined` and show skeleton while `isLoading || isFetching`. Since reps are the same for all slices (jurisdiction-based, not slice-based), this is actually not a real concern — the same reps show on all tabs. Do not add unnecessary re-fetch logic.
**Note from research:** `/essentials/representatives/me` returns reps for the user's stored jurisdiction — it does NOT change by active tab. Tab switching does not need to trigger a rep re-fetch.

### Pitfall 4: `ev_token` vs `cs_token` Key Mismatch

**What goes wrong:** Compass API calls fail with 401 because code reads `ev_token` (CompassV2's key) instead of `cs_token` (Civic Spaces's key).
**Why it happens:** The integration docs (COMPASSV2-INTEGRATION.md) reference `ev_token` throughout. The token itself is the same JWT — just stored under a different key in localStorage.
**How to avoid:** In all Civic Spaces API calls to `accounts.empowered.vote`, use `localStorage.getItem('cs_token')` as the token source. Never use `ev_token` in Civic Spaces code.
**Warning signs:** 401 responses from compass endpoints even though user is logged in.

### Pitfall 5: Displaying Party Affiliation

**What goes wrong:** `PoliticianFlatRecord.party` field is populated (e.g., "Democrat", "Republican") — accidentally rendering it violates anti-partisan policy.
**Why it happens:** It's a natural field to include when displaying a politician card.
**How to avoid:** Never render `rep.party`. The field exists in TypeScript types and API responses but must never appear in the UI. Code review check: any string interpolation touching `.party` is a bug.
**Warning signs:** Party names visible in rep cards — this would be a platform policy violation.

### Pitfall 6: Recharts Import in SSR/Vite Context

**What goes wrong:** Recharts may have issues with certain Vite build configurations related to ESM vs CJS.
**Why it happens:** recharts v3 ships ESM; most setups work fine but some Vite configs need the package to be processed.
**How to avoid:** recharts is already in `dependencies` of treasury-tracker with this same Vite setup (no issues reported). Standard import should work fine. If build errors occur, add `recharts` to `optimizeDeps.include` in `vite.config.ts`.
**Warning signs:** `Cannot find module 'recharts'` or top-level `await` errors during build.

### Pitfall 7: 204 No Content from Representatives API

**What goes wrong:** `fetch()` call crashes when trying to call `.json()` on a 204 response.
**Why it happens:** `GET /essentials/representatives/me` returns `204 No Content` when the user has no stored location (never set address in accounts profile). `.json()` on a 204 throws.
**How to avoid:** Check `response.status === 204` before calling `.json()`. Return empty array and hide the widget.

```typescript
const response = await fetch(
  'https://accounts.empowered.vote/api/essentials/representatives/me',
  { headers: { Authorization: `Bearer ${token}` } }
)
if (response.status === 204) return []
return response.json() as Promise<PoliticianFlatRecord[]>
```

---

## Code Examples

### useCompassData Hook (Hoisted to AppShell)

```typescript
// Source: verified against compass.ts routes + compassService.ts
const ACCOUNTS_API = 'https://accounts.empowered.vote/api'

async function fetchCompassCategories() {
  const res = await fetch(`${ACCOUNTS_API}/compass/categories`)
  if (!res.ok) throw new Error('Failed to fetch compass categories')
  return res.json() as Promise<CompassCategory[]>
}

async function fetchCompassAnswers(token: string | null) {
  if (!token) return []
  const res = await fetch(`${ACCOUNTS_API}/compass/answers`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  return res.json() as Promise<CompassAnswer[]>
}

export function useCompassData(userId: string | null) {
  const token = userId ? localStorage.getItem('cs_token') : null

  const categories = useQuery({
    queryKey: ['compass-categories'],
    queryFn: fetchCompassCategories,
    staleTime: 30 * 60 * 1000,  // categories rarely change
  })

  const answers = useQuery({
    queryKey: ['compass-answers', userId],
    queryFn: () => fetchCompassAnswers(token),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    categories: categories.data ?? [],
    answers: answers.data ?? [],
    isLoading: categories.isLoading || answers.isLoading,
    isUncalibrated: !userId || (answers.data ?? []).length < 3,
  }
}
```

### useRepresentatives Hook (Hoisted to AppShell)

```typescript
// Source: verified against essentials.ts route + PoliticianFlatRecord type
async function fetchRepresentatives(token: string): Promise<PoliticianFlatRecord[]> {
  const res = await fetch(
    'https://accounts.empowered.vote/api/essentials/representatives/me',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 204) return []   // no location on file
  if (!res.ok) throw new Error(`Representatives fetch failed: ${res.status}`)
  return res.json()
}

export function useRepresentatives(userId: string | null) {
  const token = userId ? localStorage.getItem('cs_token') : null
  return useQuery({
    queryKey: ['representatives', userId],
    queryFn: () => fetchRepresentatives(token!),
    enabled: !!userId && !!token,
    staleTime: 10 * 60 * 1000,  // 10 min — reps are stable
  })
}
```

### Compass Chart Data Transform

```typescript
// Source: verified against compass category API shape
function buildChartData(
  categories: CompassCategory[],
  answers: CompassAnswer[]
): Array<{ category: string; value: number }> {
  const answerByTopicId = new Map(answers.map(a => [a.topic_id, a.value]))

  return categories.map(cat => {
    const values = cat.topics
      .map(t => answerByTopicId.get(t.id))
      .filter((v): v is number => v != null && v > 0)

    const avg = values.length > 0
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : 0

    return { category: cat.title, value: parseFloat(avg.toFixed(2)) }
  }).filter(d => d.value > 0)  // only axes the user has answered
}
```

### RepresentativesWidget Skeleton (Claude's Discretion)

```typescript
// Source: FeedSkeleton.tsx pattern + react-loading-skeleton
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

function RepSkeleton() {
  return (
    <SkeletonTheme baseColor="#f3f4f6" highlightColor="#e5e7eb">
      <div className="flex items-center gap-3 py-2">
        <Skeleton circle width={40} height={40} />
        <div className="flex-1">
          <Skeleton width="60%" height={13} />
          <Skeleton width="45%" height={11} className="mt-1" />
        </div>
      </div>
    </SkeletonTheme>
  )
}
```

---

## Pre-Conditions to Verify Before Implementation

These are flagged in STATE.md as open blockers:

1. **CORS allowlist:** Confirm `civicspaces.empowered.vote` is in `api.empowered.vote` CORS allowlist before any frontend call to `accounts.empowered.vote/api` from Civic Spaces. The `useAuth` hook already calls `accounts-api.empowered.vote` (note different subdomain) — the essentials/compass calls go to `accounts.empowered.vote/api`. Verify this subdomain is also in the CORS allowlist.

2. **Compass API response confirmed:** `GET /api/compass/categories` is public (no auth required) and returns `[{id, title, topics: [...]}]` — confirmed from compassService.ts source. `GET /api/compass/answers` requires Bearer token and returns user answers — confirmed.

3. **Representatives API confirmed:** `GET /api/essentials/representatives/me` requires Connected tier and returns `PoliticianFlatRecord[]` or `204` — confirmed from essentials.ts source code.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sidebar as placeholder div | Sidebar populated with 3 live widgets | Phase 11 | First real content in sidebar column |
| `ev_token` key in CompassV2 | `cs_token` key in Civic Spaces | Auth architecture | Different key names for same JWT; never mix them |
| Party badges on rep cards | No party display | Anti-partisan policy | `party` field exists in API but must not be rendered |
| Recharts not in Civic Spaces | Recharts v3.5.1 to be installed | Phase 11 | Treasury Tracker already uses it at this version |

**Deprecated/outdated:**
- Sidebar placeholder text "Sidebar coming in Phase 11": remove this in Phase 11 plan.

---

## Open Questions

1. **CORS allowlist for `accounts.empowered.vote/api`**
   - What we know: `accounts-api.empowered.vote` is already working (useAuth uses it). The essentials and compass endpoints are at `accounts.empowered.vote/api` (different subdomain).
   - What's unclear: Whether the CORS allowlist covers both subdomains for `civicspaces.empowered.vote`.
   - Recommendation: Planner should include a CORS verification task before any widget API integration work. If blocked, all three API-dependent widgets are blocked.

2. **Live tool URLs**
   - What we know: compassv2.empowered.vote exists and is live. Treasury Tracker and Essentials are mentioned as features but their deployed URLs are not confirmed in the codebase.
   - What's unclear: Whether `essentials.empowered.vote` and `treasury-tracker.empowered.vote` are live prod URLs.
   - Recommendation: Tools widget config should be defined in a constant with verified URLs. Planner should include a task to confirm URLs before hardcoding them.

3. **Category-based vs topic-based compass axes**
   - What we know: `GET /api/compass/categories` returns categories with nested topics. CompassV2 uses `short_title` of individual topics as spoke labels (selected topics, not categories).
   - What's unclear: Phase 11 CONTEXT.md says "axes pulled from Empowered Vote API topic categories" — this could mean either (a) one axis per category (aggregated) or (b) individual topics per user's selection.
   - Recommendation: The sidebar compass is a **summary view** — use categories (not individual topics) as axes. This gives a compact multi-axis view even for users with many answered topics. Category aggregation approach documented in Code Examples above.

---

## Sources

### Primary (HIGH confidence)
- `C:\Civic Spaces\src\components\AppShell.tsx` — existing sidebar placeholder, hook architecture, panel mounting pattern
- `C:\Civic Spaces\package.json` — confirmed dependencies (recharts not present, motion/react present, react-loading-skeleton present)
- `C:\EV-Accounts\backend\src\routes\essentials.ts` (lines 411-559) — `/essentials/representatives/me` endpoint, 204 handling, auth requirements
- `C:\EV-Accounts\backend\src\lib\essentialsService.ts` (lines 76-123, 1377-1547) — `PoliticianFlatRecord` type, `images[]` field, `getRepresentativesByJurisdiction` implementation
- `C:\EV-Accounts\backend\src\routes\compass.ts` (lines 107-135, 173-206) — `/compass/categories` and `/compass/answers` endpoints
- `C:\EV-Accounts\backend\src\lib\compassService.ts` (lines 107-194) — `getCompassCategories` return shape, `getCompassTopics` return shape
- `C:\EV-CompassV2\COMPASSV2-INTEGRATION.md` — CompassV2 integration guide, token key (`ev_token`), answer value constraints
- `C:\Civic Spaces\src\hooks\useAuth.ts` — `cs_token` key name, token pattern
- `C:\Civic Spaces\CIVIC-SPACES-ONBOARDING.md` — accounts API base URL, endpoint table
- `github.com/recharts/recharts/blob/main/src/chart/RadarChart.tsx` — RadarChart component props (verified via WebFetch)
- `github.com/recharts/recharts/blob/main/src/polar/Radar.tsx` — Radar component props including fill, stroke, dataKey (verified via WebFetch)

### Secondary (MEDIUM confidence)
- `C:\treasury-tracker\package.json` — recharts ^3.5.1 in EV ecosystem (same Vite stack, no known build issues)
- `C:\EV-CompassV2\src\pages\Compass.jsx` — how chartData is built from selectedTopics + answers (verified pattern)

### Tertiary (LOW confidence)
- Live tool URLs (essentials.empowered.vote, treasury-tracker.empowered.vote) — not confirmed from codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts in EV ecosystem, all other deps already in project
- Architecture (hook hoisting): HIGH — directly derived from existing AppShell pattern and STATE.md decision
- Compass API shape: HIGH — verified against live backend source code
- Representatives API shape: HIGH — verified against live backend source code + type definitions
- Pitfalls: HIGH — derived from live codebase inspection and documented decisions
- Tool URLs: LOW — not confirmed in codebase

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable API contracts; compass/representatives APIs are production and change infrequently)
