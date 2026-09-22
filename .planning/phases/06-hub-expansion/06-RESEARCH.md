# Phase 6: Hub Expansion - Research

**Researched:** 2026-04-03
**Domain:** React tab state management, per-tab scroll preservation, Supabase multi-slice feed wiring, notification-to-tab routing
**Confidence:** HIGH (all findings derived from the live codebase and verified schema)

---

## Summary

Phase 6 has four distinct sub-problems: (1) hub layout redesign with two-column tab bar, (2) activating the N/L/S geo slice feeds, (3) per-tab independent scroll preservation, and (4) routing notification taps to the correct slice tab. All four work within the existing React + React Query + Supabase stack — no new npm packages are needed and no schema migrations are required.

The key insight is that the N/L/S feeds require zero new backend work. The `get_boosted_feed_filtered` RPC already takes `p_slice_id` as a parameter and works for any `slice_id` in any slice. The only frontend change is loading the user's N/L/S slice IDs alongside the existing `useFederalSlice` pattern and passing those IDs to `SliceFeedPanel`. Per-tab scroll preservation uses the same CSS hidden-not-unmount pattern already used for the feed-to-thread navigation, extended to the tab level. Notification routing requires knowing the `slice_id` of the post referenced by the notification — this means a DB lookup (posts.slice_id WHERE id = reference_id) at notification-tap time, then resolving which tab key owns that slice_id.

The two-column tab bar layout (geo tabs left, special tabs right) is a pure Tailwind layout change to `SliceTabBar.tsx`. Unified and Volunteer tabs appear as disabled placeholder shells — they must not render `SliceFeedPanel` and must have appropriate empty-state styling to communicate "coming soon" without confusing users.

**Primary recommendation:** Plan split as roadmap describes — 06-01 (layout), 06-02 (activate N/L/S feeds), 06-03 (scroll preservation), 06-04 (notification routing) in dependency order. Plans 06-01 and 06-02 are independent of each other; 06-03 depends on 06-01's tab switching being wired; 06-04 depends on 06-01's tab state to know which tab to activate.

---

## Standard Stack

No new packages required. All existing dependencies handle the full scope.

### Core (Already Installed)

| Library | Version | Phase 6 Use |
|---------|---------|-------------|
| `react` | ^19.2.4 | `useState`, `useRef`, tab state management |
| `@tanstack/react-query` | ^5.95.2 | `useBoostedFeed` per slice_id (already works for any slice) |
| `@supabase/supabase-js` | ^2.100.1 | Slice membership query, post slice lookup for notifications |
| `tailwindcss` | ^4.2.2 | Two-column tab layout |

### No New Packages Needed

The scroll preservation approach uses browser-native `scrollTop` + `useRef` — no virtualization library needed. The notification routing uses an inline Supabase query — no routing library change needed.

---

## Architecture Patterns

### Recommended Project Structure

No new files are required in the component or hook hierarchy. Changes are concentrated in:

```
src/
├── components/
│   ├── AppShell.tsx          # Tab state, multi-slice data fetch, notification routing
│   └── SliceTabBar.tsx       # Two-column layout, all 6 tab keys
├── hooks/
│   └── useAllSlices.ts       # NEW: loads N/L/S/F slice IDs for current user (replaces useFederalSlice)
```

`SliceFeedPanel.tsx` requires no changes — it already accepts any `sliceId` prop.
`useBoostedFeed.ts` requires no changes — it already works for any `sliceId`.

### Pattern 1: Multi-Slice Data Loading

**What:** Replace `useFederalSlice` with `useAllSlices`, which loads all four geographic slice IDs in a single query and returns a map keyed by `slice_type`.
**When to use:** AppShell needs to know all slice IDs to mount feeds and to resolve notification routing.

```typescript
// Source: derived from existing useFederalSlice.ts pattern
interface SliceData {
  id: string
  geoid: string
  memberCount: number
}

interface AllSlicesResult {
  slices: Record<string, SliceData>  // key = slice_type
  hasJurisdiction: boolean
  isLoading: boolean
}

// Query pattern (mirrors useFederalSlice, no .eq('slice_type', 'federal') filter):
const { data: slices } = await supabase
  .from('slices')
  .select('id, slice_type, geoid, current_member_count')
  .in('id', sliceIds)
  // Returns all types: 'neighborhood', 'local', 'state', 'federal'
  // Do NOT filter by slice_type — return all of them
```

**Key detail:** The existing `useFederalSlice` uses `.eq('slice_type', 'federal')` and `.single()`. `useAllSlices` should NOT use `.single()` — it returns an array and reduces to a map by `slice_type`.

### Pattern 2: Tab Key Definitions

**What:** Define both tab groups as typed constants. Unified and Volunteer are defined in Phase 6 as disabled shells — their `sliceId` will be `null` until Phase 7.

```typescript
// Source: existing SliceTabBar.tsx TABS constant, extended
type TabKey = 'neighborhood' | 'local' | 'state' | 'federal' | 'unified' | 'volunteer'

const GEO_TABS: { key: TabKey; label: string }[] = [
  { key: 'neighborhood', label: 'Neighborhood' },
  { key: 'local', label: 'Local' },
  { key: 'state', label: 'State' },
  { key: 'federal', label: 'Federal' },
  { key: 'unified', label: 'Unified' },  // disabled shell in Phase 6
]

const SPECIAL_TABS: { key: TabKey; label: string }[] = [
  { key: 'volunteer', label: 'Volunteer' },  // disabled shell in Phase 6
]
```

**Layout:** Two-column flex row with a vertical divider between groups. Both columns scroll horizontally independently if needed on small screens.

### Pattern 3: Per-Tab Scroll Preservation

**What:** Store each tab's scroll position in a `useRef` map keyed by tab key. On tab switch, save the current scroll position to the map before switching, then restore it after the new tab renders.

**When to use:** Implemented in AppShell.tsx, applied to the scroll container that wraps `SliceFeedPanel`.

```typescript
// Source: derived from existing feed-hidden pattern in SliceFeedPanel.tsx
const scrollPositions = useRef<Record<string, number>>({})

// On tab switch (before changing activeTab):
function handleTabChange(newTabKey: string) {
  // Save current position
  const container = scrollContainerRef.current
  if (container) {
    scrollPositions.current[activeTab] = container.scrollTop
  }
  setActiveTab(newTabKey)
}

// After tab renders (useEffect watching activeTab):
useEffect(() => {
  const saved = scrollPositions.current[activeTab] ?? 0
  scrollContainerRef.current?.scrollTo({ top: saved, behavior: 'instant' })
}, [activeTab])
```

**Critical detail:** The scroll container ref must point to the element with `overflow-y-auto`. In the current AppShell, the outer `<div className="flex flex-col flex-1 overflow-y-auto">` is the scroll container. The `SliceFeedPanel` must be mounted (not unmounted) for its tab to preserve scroll — use CSS visibility/display toggling, not conditional rendering.

**Mount-not-unmount:** Render all active geo feeds simultaneously, show only the active one via CSS. This is the same pattern already used in `SliceFeedPanel` for feed-vs-thread. All four geo feeds remain mounted; three are hidden via `display: none`. This means all four React Query caches are live and real-time subscriptions are active across all tabs.

```typescript
// In AppShell — render all mounted, show only active:
{(['neighborhood', 'local', 'state', 'federal'] as const).map((tabKey) => {
  const sliceId = allSlices[tabKey]?.id ?? null
  return (
    <div
      key={tabKey}
      ref={tabKey === activeTab ? scrollContainerRef : undefined}
      className={activeTab === tabKey ? 'flex flex-col flex-1 overflow-y-auto' : 'hidden'}
    >
      {sliceId && (
        <SliceFeedPanel
          sliceId={sliceId}
          // ...other props
        />
      )}
    </div>
  )
})}
```

**Alternative (useRef per tab):** Each tab gets its own scroll container ref. On tab switch, save/restore scroll on the specific container div. This is slightly more explicit than the single `scrollContainerRef` approach but requires the same mount-not-unmount constraint.

### Pattern 4: Notification-to-Tab Routing

**What:** When a `reply` notification is tapped, look up the `slice_id` of the referenced post, then resolve which tab key owns that `slice_id`, then set `activeTab` to that key before opening the thread.

**The gap in current code:** `NotificationList.handleTap` calls `onNavigateToThread(notification.reference_id)` but passes no tab information. AppShell then just opens the thread panel — currently this always shows in the Federal tab context. With multiple active tabs, the thread must open in the correct tab.

**Data flow needed:**
1. `reference_id` = `post_id` (this is what the notification trigger stores — confirmed in `notify_on_reply` trigger)
2. Look up `posts.slice_id WHERE id = reference_id` 
3. Match `slice_id` against the loaded `allSlices` map to find the `TabKey`
4. Set `activeTab` to that `TabKey` and then open the thread

```typescript
// Source: Supabase query pattern, derived from useFederalSlice approach
async function resolveTabForPost(postId: string, allSlices: Record<string, SliceData>): Promise<TabKey | null> {
  const { data } = await supabase
    .schema('civic_spaces')
    .from('posts')
    .select('slice_id')
    .eq('id', postId)
    .single()

  if (!data) return null

  const entry = Object.entries(allSlices).find(([, s]) => s.id === data.slice_id)
  return (entry?.[0] as TabKey) ?? null
}
```

**Where to call this:** The lookup happens inside `NotificationBell`'s callback or AppShell's `onNavigateToThread` handler — wherever tab switching is controlled. Since AppShell owns both `activeTab` and `allSlices`, the lookup belongs in AppShell. `NotificationBell` should call a callback that accepts `postId`, and AppShell does the tab resolution internally.

**Schema note:** `posts` table is NOT available via public schema for writes, but SELECT reads work via the `public.posts` view. The query should use `.from('posts')` (public view) without `.schema('civic_spaces')` for this read-only lookup.

### Anti-Patterns to Avoid

- **Unmounting inactive tabs:** Do NOT use conditional rendering (`{activeTab === 'federal' && <SliceFeedPanel />}`) for tab switching. Unmounting destroys React Query cache, scroll position, and open threads. Use CSS `hidden` class.
- **Remounting on tab switch:** Do NOT toggle the `key` prop of `SliceFeedPanel` when switching tabs. Changing `key` forces a full remount.
- **Querying slice_id on every notification render:** The post-to-tab lookup is async and should only run on notification tap, not on render. Store `allSlices` in a ref if needed inside a callback.
- **Using `.from('posts').schema('civic_spaces')` for the notification lookup:** The public view `public.posts` supports reads — use it without schema override.
- **Relying on slice_type to find the tab key:** A user has exactly one slice of each geo type, but the `allSlices` map should be keyed by `slice_type` not by `slice_id`. Reverse lookup (slice_id → slice_type) is the notification routing path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feed for N/L/S slices | New RPC or new query hook | Existing `useBoostedFeed(sliceId)` | The RPC already accepts any `slice_id`; just pass the right ID |
| Scroll virtualization | React Virtual or custom virtualized list | CSS `hidden` + `scrollTop` on container ref | The existing pattern (feed-vs-thread in SliceFeedPanel) works at current data volumes; adding virtualization is premature complexity |
| Tab routing library | React Router, TanStack Router | `useState` in AppShell | There is no URL-based routing in this app; tabs are local UI state |
| Notification deeplink queue | Message queue, pub/sub | Inline async lookup in `onNavigateToThread` callback | Single sequential action; no queuing needed |

**Key insight:** The entire phase's backend requirement is already built. `get_boosted_feed_filtered` is slice-agnostic. The phase is a frontend state management and wiring problem.

---

## Common Pitfalls

### Pitfall 1: scroll container is inside SliceFeedPanel, not AppShell

**What goes wrong:** `SliceFeedPanel` renders `<div className="relative h-full">` with the inner feed div having `overflow-y-auto`. If AppShell wraps SliceFeedPanel in its own scrollable div, there are now two scroll containers and neither gets the position you expect to save/restore.

**Why it happens:** The current AppShell wraps SliceFeedPanel in `<div className="flex flex-col flex-1 overflow-y-auto">`. SliceFeedPanel's inner feed div also has `overflow-y-auto`. The actual scroll happens on the inner div.

**How to avoid:** When adding per-tab scroll refs, attach the ref to the specific scrollable `div` inside the rendered tab — or remove the outer overflow wrapper in AppShell and let SliceFeedPanel own scrolling entirely. Verify which element actually scrolls by checking `scrollTop > 0` in DevTools.

**Warning signs:** `scrollTop` always reads 0 even after scrolling.

### Pitfall 2: Unified/Volunteer tab shells trigger feed fetches

**What goes wrong:** If the tab switch logic calls `useBoostedFeed` for Unified or Volunteer tabs (with a null/undefined sliceId), the enabled guard in the hook may still fire or cause query errors.

**Why it happens:** `useBoostedFeed` has `enabled: !!sliceId` guard, but if AppShell still renders a `SliceFeedPanel` for the Unified tab (even with `sliceId={null}`), the panel will render a loading state that never resolves.

**How to avoid:** Unified and Volunteer tabs in Phase 6 must NOT render `SliceFeedPanel`. Render a "Coming soon" or disabled placeholder div instead. Only render `SliceFeedPanel` when a real `sliceId` is available.

### Pitfall 3: Member count shows only for Federal

**What goes wrong:** The current `SliceTabBar` only shows member count for `tab.key === 'federal'`. After Phase 6, the active N/L/S tabs may also want to show member counts.

**Why it happens:** The original `SliceTabBar` props only accept `federalMemberCount: number | null`. After multi-slice loading, all four counts are available.

**How to avoid:** Update `SliceTabBar` props in 06-01 to accept a `memberCounts: Partial<Record<TabKey, number>>` map, or pass only the active tab's member count. Don't pass only `federalMemberCount` as the prop signature — it won't generalize.

### Pitfall 4: Notification routing fails for posts not in user's geo slices

**What goes wrong:** A user might receive a notification for a post in a slice they are no longer in (edge case) or in a Unified/Volunteer slice that doesn't exist yet in Phase 6. The tab resolution returns `null`.

**Why it happens:** The `allSlices` map only contains the user's current geo slices. If `resolveTabForPost` returns null, the app has no target tab.

**How to avoid:** Fall back to Federal tab when the resolved tab is null. Log the mismatch for debugging. Don't crash or silently open a threadless panel.

### Pitfall 5: CSS `hidden` prevents IntersectionObserver from triggering

**What goes wrong:** The IntersectionObserver sentinel in `SliceFeedPanel` uses `threshold: 0.1`. When the feed div is `hidden` (display: none), the sentinel is not visible, so infinite scroll may not trigger when the tab becomes visible.

**Why it happens:** `display: none` makes the element invisible to IntersectionObserver. The observer fires correctly when the element is visible, but if the user scrolled to the bottom of a tab while it was active, then switched away, and then the tab was hidden — when switching back, the observer may have already fired and disconnected.

**How to avoid:** This is acceptable behavior — the observer re-connects on re-render when the tab becomes active. The current SliceFeedPanel already handles `hasNextPage && !isFetchingNextPage` checks in the observer callback. No special handling needed; just verify in testing that bottom-of-feed infinite scroll works after a tab round-trip.

### Pitfall 6: Realtime subscriptions multiply with mount-not-unmount

**What goes wrong:** If all four geo feeds are mounted simultaneously, each `useBoostedFeed` instance creates a Supabase Realtime channel subscription. Four channels are active at once.

**Why it happens:** `useBoostedFeed` has a `useEffect` that creates a channel subscription per `sliceId`. Four mounted feeds = four subscriptions.

**How to avoid:** This is intentional and correct behavior — each feed needs its own realtime invalidation. Supabase handles this fine. Document it as a known characteristic. The existing `useRealtimeInvalidation` hook (also mounted in SliceFeedPanel) creates a separate channel, so total channels per tab is 2 — meaning 8 channels when all four geo tabs are mounted simultaneously. This is well within Supabase's limits.

---

## Code Examples

### Loading All Geo Slices

```typescript
// Source: derived from useFederalSlice.ts (live codebase)
async function fetchAllSlicesData(userId: string) {
  // Step 1: Get all slice memberships
  const { data: memberships, error: memberError } = await supabase
    .from('slice_members')
    .select('slice_id')
    .eq('user_id', userId)

  if (memberError) throw memberError
  if (!memberships?.length) return { slices: {}, hasJurisdiction: false }

  const sliceIds = memberships.map((m) => m.slice_id)

  // Step 2: Fetch all geo slices (no slice_type filter)
  const { data: slices, error: sliceError } = await supabase
    .from('slices')
    .select('id, slice_type, geoid, current_member_count')
    .in('id', sliceIds)
    .in('slice_type', ['neighborhood', 'local', 'state', 'federal'])

  if (sliceError) throw sliceError

  const sliceMap = Object.fromEntries(
    (slices ?? []).map((s) => [
      s.slice_type,
      { id: s.id, geoid: s.geoid, memberCount: s.current_member_count },
    ])
  )

  return { slices: sliceMap, hasJurisdiction: true }
}
```

### Tab-Keyed Mount-Not-Unmount Pattern

```typescript
// Source: SliceFeedPanel.tsx existing pattern (CSS hidden for feed-vs-thread)
// Extended to tab level in AppShell

const GEO_TAB_KEYS = ['neighborhood', 'local', 'state', 'federal'] as const

// In AppShell render:
{GEO_TAB_KEYS.map((tabKey) => {
  const sliceId = allSlices[tabKey]?.id ?? null
  const isActive = activeTab === tabKey
  return (
    <div
      key={tabKey}
      className={isActive ? 'flex flex-col flex-1 overflow-y-auto' : 'hidden'}
    >
      {sliceId ? (
        <SliceFeedPanel
          sliceId={sliceId}
          onAuthorTap={setProfileUserId}
          activePostId={isActive ? activePostId : null}
          onNavigateToThread={(postId) => {
            setActivePostScrollToLatest(false)
            setActivePostId(postId)
          }}
          scrollToLatest={activePostScrollToLatest}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
          Slice not yet assigned
        </div>
      )}
    </div>
  )
})}
```

### Notification Routing with Tab Resolution

```typescript
// Source: derived from NotificationList.handleTap + AppShell pattern

// In AppShell — replacing the simple onNavigateToThread callback:
async function handleNotificationNavigateToThread(postId: string) {
  setActivePostScrollToLatest(true)

  // Resolve which tab owns this post
  const { data } = await supabase
    .from('posts')           // public view — no .schema() needed
    .select('slice_id')
    .eq('id', postId)
    .single()

  if (data) {
    const entry = Object.entries(allSlices).find(([, s]) => s.id === data.slice_id)
    const targetTab = (entry?.[0] as TabKey) ?? 'federal'   // fallback to federal
    setActiveTab(targetTab)
  }

  setActivePostId(postId)
}
```

### Two-Column SliceTabBar Layout

```typescript
// Source: SliceTabBar.tsx (full rewrite of layout section)
// Left group: N, L, S, F, Unified | Right group: Volunteer

<nav className="flex flex-row border-b border-gray-200 bg-white" aria-label="Slice tabs">
  {/* Left group — geo slices */}
  <div className="flex flex-row flex-nowrap overflow-x-auto flex-1">
    {GEO_TABS.map(renderTab)}
  </div>

  {/* Divider */}
  <div className="w-px bg-gray-200 self-stretch mx-1" aria-hidden="true" />

  {/* Right group — special slices */}
  <div className="flex flex-row flex-nowrap">
    {SPECIAL_TABS.map(renderTab)}
  </div>
</nav>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Federal-only hub (hardcoded `activeTab="federal"`) | Multi-tab hub with switchable geo tabs | Phase 6 | AppShell must own tab state and multi-slice IDs |
| `useFederalSlice` — single federal slice hook | `useAllSlices` — returns map of all geo slices | Phase 6 | Single query, returns Record keyed by slice_type |
| Notification routing always opens Federal tab | Notification routing resolves correct tab from post's slice_id | Phase 6 | Requires async lookup at tap time |
| SliceTabBar: single row, all tabs equal | SliceTabBar: two-column (geo left, special right) | Phase 6 | Unified beside Federal; Volunteer isolated right |

**Current state of codebase (confirmed live):**
- `SliceTabBar.tsx`: renders 5 tabs (N/L/S/F/Unified), all disabled except active. No tab switching logic. No onClick handlers.
- `AppShell.tsx`: hardcodes `activeTab="federal"`. Uses `useFederalSlice` for single slice ID. `SliceFeedPanel` receives one `sliceId`.
- `useBoostedFeed.ts`: slice-agnostic — works for any `p_slice_id`. No changes needed.
- `get_boosted_feed_filtered` RPC: already in production, already handles block filtering and friend boosting for any slice_id.
- Notifications: `reference_id` for `reply` events is the `post_id` (confirmed in `notify_on_reply` trigger). No `slice_id` stored on the notification row.

---

## Open Questions

1. **Thread panel across tabs**
   - What we know: `activePostId` and `activePostScrollToLatest` are currently top-level state in AppShell, shared across all feeds.
   - What's unclear: If the user has a thread open in the Federal tab and switches to State, should the State tab also show the thread? Or should each tab have independent `activePostId`?
   - Recommendation: Give each tab its own `activePostId` state using `useState` inside a per-tab wrapper, OR use a single `activePostId` + `activeTabForThread` pair in AppShell. The simplest correct approach is: each tab independently tracks its thread state (`Record<TabKey, string | null>`). This avoids the "thread bleeds across tabs" problem.

2. **Scroll container nesting in SliceFeedPanel**
   - What we know: `SliceFeedPanel` renders `<div className="relative h-full">` with inner `<div className={activePostId ? 'hidden' : 'flex flex-col h-full overflow-y-auto'}>`. The inner div is the actual scroll container.
   - What's unclear: When AppShell wraps SliceFeedPanel in its own `overflow-y-auto` div, which div is actually scrolling?
   - Recommendation: During 06-03 implementation, verify scroll behavior in the browser with DevTools before writing the `scrollTop` save/restore logic. The ref should target whichever element has `scrollTop > 0` when the user scrolls. Consider removing AppShell's outer overflow wrapper and letting SliceFeedPanel manage its own scroll.

3. **Member count display for non-Federal tabs**
   - What we know: The current tab bar shows member count only under the Federal tab. The Notification routing plan (06-04) confirms all four slice IDs and member counts are available.
   - What's unclear: Should N/L/S tabs also show member counts? The roadmap doesn't specify.
   - Recommendation: Show member count for all active tabs (it's free data from `useAllSlices`). Update `SliceTabBar` props to `memberCounts: Partial<Record<TabKey, number>>` in 06-01.

---

## Sources

### Primary (HIGH confidence)
- Live codebase — `src/components/AppShell.tsx`, `src/components/SliceTabBar.tsx`, `src/components/SliceFeedPanel.tsx`, `src/components/NotificationList.tsx`
- Live codebase — `src/hooks/useFederalSlice.ts`, `src/hooks/useBoostedFeed.ts`, `src/hooks/useNotifications.ts`
- Live migration — `supabase/migrations/20260328200000_phase5_moderation.sql` — `get_boosted_feed_filtered` RPC definition confirmed slice-agnostic
- Live migration — `supabase/migrations/20260328100000_phase4_notifications.sql` — `notify_on_reply` trigger confirmed stores `post_id` as `reference_id`
- `.planning/STATE.md` and `.planning/ROADMAP.md` — Phase 6 plan structure, Unified/Volunteer sentinel decisions

### Secondary (MEDIUM confidence)
- IntersectionObserver + CSS hidden behavior — standard browser behavior for `display: none` elements, widely documented

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing libraries confirmed in package.json
- Architecture: HIGH — all patterns derived from live codebase; RPC slice-agnosticism confirmed in migration SQL
- Pitfalls: HIGH — scroll container nesting and mount-not-unmount patterns verified against existing SliceFeedPanel implementation
- Notification routing: HIGH — trigger SQL confirms reference_id = post_id; tab resolution pattern is standard map lookup

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable — no fast-moving dependencies)
