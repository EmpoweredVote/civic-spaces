# Phase 9: Hero Banner & Layout Shell - Research

**Researched:** 2026-04-05
**Domain:** Tailwind v4 CSS grid layout, hero banner with image overlay, dark mode, scroll preservation in two-column context
**Confidence:** HIGH

## Summary

Phase 9 has three interleaved concerns: (1) a full-width hero banner with image overlay and pill badges per slice tab, (2) a responsive two-column desktop layout shell (65/35 feed/sidebar), and (3) active tab highlighting in brand teal. All work happens inside the existing Vite + React + Tailwind v4 project — no new libraries are needed.

The scroll preservation system (CSS-hidden `SliceFeedPanel` divs, `scrollRef` on a specific DOM node) is the most dangerous constraint in this phase. The two-column grid wrapper must not change how the feed panel fills its column. The critical rule: the grid item containing each `SliceFeedPanel` must use `overflow: hidden` + `display: flex` + `flex-direction: column`, and the existing scroll container inside `SliceFeedPanel` continues to use `overflow-y-auto h-full`. The grid itself must be bounded (`h-full` or `h-screen` minus header/tabbar) so columns do not expand to intrinsic content height, which would break independent scroll.

The hero banner is a pure presentational component receiving slice data as props. In Phase 9 it uses static/hardcoded data and a placeholder photo — real photos come in Phase 10. The mockups show: full-width hero image with a dark gradient overlay from bottom-left to center-right, white text hierarchy (large name → tagline → pill badges row → two-sentence description), and aspect ratio approximately 16:5 on desktop. On mobile it crops to approximately 16:9.

The brand teal color is Tailwind's `teal-600` (oklch 60% 0.118 184.704 / approx #0d9488) — the mockups show a filled teal pill/capsule for the active tab, white text inside, with inactive tabs showing plain text on white background. This differs from the current `border-b-2 border-blue-600` highlight — Phase 9 replaces it.

**Primary recommendation:** Build in order: (1) two-column grid shell as a wrapper in AppShell with scroll preservation verified, (2) HeroBanner component with static data, (3) tab highlight update + slice data wiring.

## Standard Stack

No new libraries needed. All tools are already installed.

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.2.2 | Two-column grid, hero overlay, dark mode via `@custom-variant` | Already in project; v4 bracket syntax handles custom 65/35 split natively |
| react | 19.2.4 | Component tree for HeroBanner, layout shell | Already in project |
| @tanstack/react-query | 5.95.2 | `useAllSlices` already returns `SliceInfo` with geoid, memberCount, siblingIndex | Already in project |

### No New Installations Required

```bash
# Nothing to install for Phase 9
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind grid with bracket `grid-cols-[65%_35%]` | CSS custom property `--grid-cols` in `@theme` | Both valid; bracket is simpler for a single use, CSS variable better if the split is reused across components. Use bracket syntax for Phase 9, promote to `@theme` if Phase 11 sidebar needs the same token. |
| Placeholder `bg-gray-200` photo | `next/image` or `<img>` with actual URL | Phase 10 will introduce real URLs; use a bare `<img>` or `bg-[url(...)]` so Phase 10 can swap the src/class with minimal diff |
| Inline `style={{ backgroundImage }}` | Tailwind arbitrary `bg-[url(...)]` | Both work; `style` prop is cleaner when the URL is dynamic (a variable), which it will be in Phase 10. Use `style` prop from the start. |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── AppShell.tsx          # Add two-column grid wrapper here (Phase 9)
│   ├── SliceTabBar.tsx       # Update active tab to teal pill style (Phase 9)
│   ├── HeroBanner.tsx        # NEW: full-width hero component (Phase 9)
│   └── SliceFeedPanel.tsx    # Unchanged — receives scrollRef as before
```

### Pattern 1: Two-Column Grid Shell in AppShell

**What:** The two-column grid wraps the area below the tab bar. Left column = feed (65%), right column = sidebar placeholder. The grid is bounded so it never exceeds viewport height, enabling independent column scroll.

**When to use:** Desktop only (`md:grid-cols-[65%_35%]`); mobile collapses to single column (`grid-cols-1`).

**Critical constraint from prior decisions:** The CSS-hidden tab panels (`display:none` via Tailwind `hidden` class) must continue to work. The grid item containing the feed panels must pass `overflow: hidden` + `display: flex` down to its children so the `scrollRef` target DOM node retains correct scroll behavior. The `hidden` class on an inactive panel hides it within the grid item — the grid item itself is always in the DOM and always occupies its column.

**Example:**
```typescript
// In AppShell.tsx, replace the current <main> content area with:
// (The outer grid is bounded to fill remaining viewport height)

<div className="flex flex-col flex-1 overflow-hidden"> {/* existing flex column from h-screen */}
  <SliceTabBar ... />

  {/* Two-column shell */}
  <div className="grid grid-cols-1 md:grid-cols-[65%_35%] flex-1 overflow-hidden min-h-0">

    {/* LEFT: Feed column — bounded, flex, overflow:hidden so scroll works */}
    <div className="flex flex-col overflow-hidden min-h-0">
      {/* HeroBanner goes here, above the CSS-hidden panels */}
      <HeroBanner slice={activeSlice} />

      {/* CSS-hidden panels — unchanged logic */}
      {FEED_TABS.map((tabKey) => {
        const slice = slices[tabKey]
        if (!slice) return null
        return (
          <div
            key={tabKey}
            className={activeTab === tabKey
              ? 'flex flex-col flex-1 overflow-hidden min-h-0'
              : 'hidden'}
          >
            <SliceFeedPanel ... />
          </div>
        )
      })}
    </div>

    {/* RIGHT: Sidebar placeholder — desktop only */}
    <div className="hidden md:flex flex-col border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
      {/* Phase 11 widgets mount here */}
      <div className="p-4 text-sm text-gray-400">Sidebar coming in Phase 11</div>
    </div>
  </div>
</div>
```

**Why `min-h-0` on grid items:** CSS Grid items have `min-height: auto` by default, which allows them to expand to their content size and overflow the grid. `min-h-0` (Tailwind for `min-height: 0`) overrides this, letting `overflow: hidden` actually constrain the column. Without it, the scroll container inside `SliceFeedPanel` expands to full content height and the viewport-level scroll (not the inner scroll) drives the feed. This breaks scroll position preservation.

### Pattern 2: HeroBanner Component

**What:** Full-width presentational component. Receives slice data props and renders a background photo with gradient overlay and text hierarchy.

**When to use:** Rendered once per tab above the feed. Changes when `activeTab` changes.

**Design from mockups (HIGH confidence, directly observed):**
- Aspect ratio: approximately 16:5 desktop (roughly 200–220px tall), 16:9 mobile
- Background: photo fills full width, `bg-cover bg-center`
- Overlay: dark gradient from bottom-left toward center-right — `from-black/70 to-transparent bg-gradient-to-r` (or `bg-[linear-gradient(...)]` for precise control)
- Text layout: absolute positioned over image, bottom-left anchored, ~24px padding
- Text hierarchy: slice name (large, bold, white), tagline (medium, white/80), pill badges row (outlined white pills), two-sentence description (small, white/70)
- Pill badges (4 pills per mockup): Level ("Local Level", "State Level"), Jurisdiction name, member count ("25,647 verified residents"), Slice number ("Slice 12 of 60 in Indiana")

**Example:**
```typescript
// src/components/HeroBanner.tsx
// Source: mockup analysis + Tailwind v4 official docs

interface HeroBannerProps {
  sliceName: string
  tagline: string
  description: string
  photoUrl: string | null  // null = use placeholder gradient
  level: string            // "Local Level" | "State Level" etc.
  jurisdiction: string     // "Bloomington, IN" | "Indiana" etc.
  memberCount: number
  siblingIndex: number
  siblingTotal: number     // for "Slice X of Y" pill — TBD from data
  sliceType: SliceType
}

export default function HeroBanner({
  sliceName, tagline, description, photoUrl,
  level, jurisdiction, memberCount, siblingIndex, siblingTotal, sliceType
}: HeroBannerProps) {
  return (
    <div
      className="relative w-full aspect-[16/5] min-h-[160px] max-h-[240px] bg-cover bg-center flex-shrink-0"
      style={{
        backgroundImage: photoUrl
          ? `linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.30) 60%, rgba(0,0,0,0) 100%), url(${photoUrl})`
          : undefined,
      }}
    >
      {/* Placeholder background when no photo */}
      {!photoUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900 to-teal-700" />
      )}

      {/* Text overlay — bottom-left anchored */}
      <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">{sliceName}</h2>
        <p className="text-sm md:text-base text-white/80 mt-1">{tagline}</p>

        {/* Pill badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[level, jurisdiction, `${memberCount.toLocaleString()} verified residents`, `Slice ${siblingIndex} of ${siblingTotal}`].map((badge) => (
            <span key={badge} className="px-2 py-0.5 rounded-full border border-white/60 text-white/90 text-xs font-medium">
              {badge}
            </span>
          ))}
        </div>

        {/* Two-sentence description */}
        <p className="text-xs md:text-sm text-white/70 mt-2 max-w-xl leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>
    </div>
  )
}
```

### Pattern 3: Active Tab as Teal Pill (SliceTabBar update)

**What:** The active tab renders as a filled teal capsule/pill with white text. Inactive tabs are plain text on white background.

**Design from mockups (HIGH confidence, directly observed):**
- Active: `bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold` — filled green-teal pill
- Inactive: `text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-4 py-2`
- The current `border-b-2 border-blue-600` style is replaced entirely

**Example:**
```typescript
// In SliceTabBar.tsx, update the renderTab className logic:
className={[
  'flex flex-col items-center px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors',
  isActive
    ? 'bg-teal-600 text-white font-semibold'
    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800',
].join(' ')}
```

### Pattern 4: Dark Mode in Tailwind v4

**What:** Tailwind v4 uses `@custom-variant dark (...)` in CSS instead of `darkMode: 'class'` in config.

**Setup required in `index.css`:**
```css
@import "tailwindcss";

/* Add this line to enable class-based dark mode */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-civic-teal: oklch(60% 0.118 184.704);   /* teal-600 */
  /* existing tokens... */
}
```

**Usage:** Standard `dark:` prefix on Tailwind utilities works normally once the variant is declared. Toggle `.dark` class on `<html>` element via JavaScript. No dark mode toggle is built in Phase 9 — but all new components should include `dark:` variants so Phase 12 can add the toggle.

### Anti-Patterns to Avoid

- **Wrapping `SliceFeedPanel` in a new flex column without `min-h-0`:** Grid items grow to intrinsic height by default. Without `min-h-0`, the scroll target DOM node (`scrollRef`) gets unlimited height, so `scrollTop` is always 0 and position is never preserved.
- **Conditionally mounting `HeroBanner` only for the active tab:** The banner should render once outside the CSS-hidden panel loop, driven by `activeTab`, not mounted/unmounted per panel. This keeps the hero swap instant.
- **Using `bg-[url(...)]` Tailwind class for dynamic photo URLs:** Dynamic URLs require template literals that Tailwind cannot generate at build time (no JIT for runtime values). Use `style={{ backgroundImage: ... }}` for the dynamic URL.
- **Putting `HeroBanner` inside `SliceFeedPanel`:** The banner must be outside the CSS-hidden wrapper, above the panel loop. If inside, it would be hidden when its tab is inactive (correct) but also remounted when coming back (wrong — loses transition state). More importantly, putting it inside would mean 6 banners mount simultaneously, which defeats the purpose of swapping on tab change.
- **Making sidebar column scrollable with `overflow-y-scroll` on the grid container:** Scroll must be on the column child, not the grid container. The grid container itself must be `overflow-hidden`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 65/35 column split | Custom CSS class or inline style on wrapper | `grid-cols-[65%_35%]` Tailwind bracket syntax | Tailwind v4 supports arbitrary bracket values natively; no custom CSS needed |
| Responsive hide sidebar on mobile | JavaScript resize listener or CSS-hidden div | `hidden md:flex` on sidebar column | Pure CSS, no JS, zero re-renders |
| Background image + overlay | Two stacked `<div>` elements | Single `style={{ backgroundImage: 'linear-gradient(...), url(...)' }}` | Multiple backgrounds in one CSS property; fewer DOM nodes, no z-index wrestling |
| Dark mode detection | `window.matchMedia` listener | Tailwind v4 `dark:` variant with `@custom-variant` | Handled by CSS; JS only needed for the toggle button, not for applying styles |

**Key insight:** This phase is almost entirely CSS layout work. The only real React logic is (a) which slice data to pass to HeroBanner based on activeTab, and (b) the `min-h-0` property that unlocks grid scroll. Don't overcomplicate it.

## Common Pitfalls

### Pitfall 1: Grid Item Scroll Breakage

**What goes wrong:** Feed scroll stops working after two-column grid is added. `scrollRef.current.scrollTop` stays 0 regardless of scroll position. Tab-switch scroll preservation appears broken.

**Why it happens:** The grid item containing the feed column does not have `min-h-0`. The grid item expands to fit its full content height. The `overflow-y-auto` container inside `SliceFeedPanel` is scrollable, but the scrollable region equals the full content height (no overflow), so `scrollTop` is always 0.

**How to avoid:** Add `min-h-0` to every flex/grid ancestor in the chain from `<html>` down to the `scrollRef` DOM node. The chain is: `body (h-screen) → AppShell div (flex flex-col h-screen) → main (flex-1 overflow-hidden) → two-column grid (flex-1 overflow-hidden min-h-0) → left column (flex flex-col overflow-hidden min-h-0) → active panel div (flex-1 overflow-hidden min-h-0) → SliceFeedPanel → scrollRef div (overflow-y-auto h-full)`.

**Warning signs:** After adding grid, the feed renders but does not appear to scroll (content overflows visibly), or tab-switch no longer restores scroll position.

### Pitfall 2: Hero Banner Inside CSS-Hidden Panel

**What goes wrong:** Hero banner swaps correctly when tab changes, but is invisible when a tab is active because its parent has `display:none`.

**Why it happens:** HeroBanner placed inside the `activeTab === tabKey ? 'flex...' : 'hidden'` conditional wrapper.

**How to avoid:** HeroBanner renders outside the CSS-hidden panel loop, directly reading `slices[activeTab]`. It sits between `<SliceTabBar />` and the panel loop.

**Warning signs:** Hero shows on first load but disappears when switching away and back.

### Pitfall 3: `siblingTotal` Not Available in `SliceInfo`

**What goes wrong:** The "Slice X of Y in [State]" pill badge cannot be rendered because `SliceInfo` only has `siblingIndex`, not the total sibling count.

**Why it happens:** `SliceInfo` comes from `useAllSlices` which queries only the user's own slices — total sibling count requires a separate query or a `slices` table aggregate.

**How to avoid:** Two options: (a) query `count(*)` on `civic_spaces.slices` where `slice_type = $type AND geoid LIKE '$state%'` — adds a DB call; (b) omit the "of Y" part in Phase 9 and show only "Slice X" with a TODO comment. Option (b) is safer for Phase 9; Phase 10 can add the count alongside the photo metadata. Document the TODO clearly.

**Warning signs:** TypeScript error `Property 'siblingTotal' does not exist on type SliceInfo`.

### Pitfall 4: Background Image URL Empty During Phase 9

**What goes wrong:** `style={{ backgroundImage: `url(${photoUrl})` }}` renders as `url()` or `url(null)` when no photo is loaded, which may cause a subtle network error in some browsers.

**Why it happens:** Phase 9 has no real photos yet. The component receives `null` for `photoUrl`.

**How to avoid:** Guard with a conditional: use the placeholder gradient background when `photoUrl` is null or empty. Use `style={{ backgroundImage: photoUrl ? `linear-gradient(...), url(${photoUrl})` : undefined }}` and render a CSS-only placeholder div when null.

**Warning signs:** Network tab shows a request for `url(null)`.

### Pitfall 5: Tailwind v4 Dark Mode Not Wired

**What goes wrong:** `dark:` prefix classes on new components have no effect in the browser.

**Why it happens:** Tailwind v4 defaults to OS preference media query. The project has no `@custom-variant dark` declared in `index.css`, so class-based toggling doesn't work.

**How to avoid:** Add `@custom-variant dark (&:where(.dark, .dark *));` to `index.css`. No dark toggle button is needed in Phase 9 (the `.dark` class won't be set anywhere yet), but the variant must be declared for the `dark:` utility classes to compile correctly for Phase 12.

**Warning signs:** `dark:` classes in Tailwind v4 with the default media query strategy still work for OS-preference users, but class-based toggling won't. The more common warning: all `dark:` classes have zero effect in Chromium DevTools dark mode simulation (which doesn't set OS preference).

### Pitfall 6: Sidebar Column Visible on Mobile

**What goes wrong:** Sidebar column is visible and squeezing the feed column on mobile, breaking the full-width single-column mobile layout.

**Why it happens:** Sidebar column renders without `hidden md:flex`.

**How to avoid:** Sidebar column must be `hidden md:flex flex-col`. The grid itself switches from `grid-cols-1` (mobile) to `grid-cols-[65%_35%]` (desktop) via `md:` prefix. Both are needed — the grid breakpoint AND the `hidden md:flex` on the sidebar column are belt-and-suspenders insurance.

## Code Examples

Verified patterns from official sources:

### Tailwind v4 Custom Column Split (Two-Column 65/35)
```typescript
// Source: https://tailwindcss.com/docs/grid-template-columns
// Bracket notation for custom grid-template-columns values

<div className="grid grid-cols-1 md:grid-cols-[65%_35%] flex-1 overflow-hidden min-h-0">
  <div className="flex flex-col overflow-hidden min-h-0">
    {/* feed */}
  </div>
  <div className="hidden md:flex flex-col overflow-hidden min-h-0">
    {/* sidebar */}
  </div>
</div>
```

### Tailwind v4 Dark Mode Configuration
```css
/* Source: https://tailwindcss.com/docs/dark-mode */
/* index.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-civic-teal: oklch(60% 0.118 184.704);
  /* teal-600 — use for active tab, CTA elements in v3.0 */
}
```

### Hero Banner: Multiple Backgrounds in style Prop
```typescript
// Source: https://tailwindcss.com/docs/background-image (arbitrary value pattern)
// Using style prop because URL is dynamic (runtime variable)

<div
  className="relative w-full bg-cover bg-center flex-shrink-0"
  style={{
    aspectRatio: '16/5',
    backgroundImage: photoUrl
      ? `linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.30) 60%, rgba(0,0,0,0) 100%), url(${photoUrl})`
      : undefined,
  }}
>
```

### Grid Item Scroll Fix (min-h-0 pattern)
```typescript
// Source: https://medium.com/@adrishy108/fixing-grid-layout-overflow-making-a-grid-item-scrollable-without-breaking-everything-e4521a393cae
// Critical: grid items have min-height:auto by default; min-h-0 overrides this

<div className="grid grid-cols-1 md:grid-cols-[65%_35%] flex-1 overflow-hidden min-h-0">
  <div className="flex flex-col overflow-hidden min-h-0">   {/* min-h-0 is the key */}
    <div className="flex-1 overflow-y-auto">               {/* scrollable inner */}
      {/* content */}
    </div>
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` with `darkMode: 'class'` | `@custom-variant dark (...)` in CSS | Tailwind v4.0 | Config file approach is gone; dark mode is CSS-first |
| `theme.extend.gridTemplateColumns` for custom splits | `grid-cols-[65%_35%]` bracket syntax in className | Tailwind v3.2+ | No config needed; arbitrary values work inline |
| `bg-gradient-to-*` + separate overlay `<div>` | Single `style` prop with `linear-gradient(...), url(...)` | CSS multi-background (long-standing) | Fewer DOM nodes, no z-index conflict |

**Deprecated/outdated:**
- `tailwind.config.js` `darkMode` option: replaced by `@custom-variant` in CSS. The config file doesn't exist in this project (`@tailwindcss/vite` plugin, CSS-only config).
- `border-b-2 border-blue-600` active tab highlight: replaced by teal pill per v3.0 design standard. Update `SliceTabBar`.

## Open Questions

1. **`siblingTotal` for the "Slice X of Y" pill badge**
   - What we know: `SliceInfo` has `siblingIndex` but not total count. The DB has this data but no hook fetches it.
   - What's unclear: Is it worth adding a `useSiblingCount(sliceType)` hook in Phase 9, or defer to Phase 10 when real slice metadata is loaded anyway?
   - Recommendation: Defer to Phase 10. Phase 9 shows "Slice {siblingIndex}" without the "of Y" part. Add a `// TODO Phase 10: add siblingTotal` comment.

2. **Tagline and description copy per slice**
   - What we know: Each slice in the mockups has unique tagline text ("Discuss local issues with verified residents...") and a two-sentence description. This copy is not in the DB.
   - What's unclear: Where does this copy live? Options: (a) hardcoded constants in HeroBanner, (b) new `tagline`/`description` columns on the `slices` table, (c) a static map keyed by `sliceType`.
   - Recommendation: Use a static TypeScript map keyed by `SliceType` for Phase 9 (no schema change). Phase 10 can promote to DB if per-GEOID copy is needed.

3. **Brand teal vs. existing `civic-blue`**
   - What we know: Current UI uses `blue-600` (#2563eb) for branding. Mockups clearly show teal (#0d9488 / `teal-600`) for the active tab. The design standard says teal is the brand color for v3.0.
   - What's unclear: Does ALL existing `blue-600` usage get updated to teal in Phase 9, or only the tab bar?
   - Recommendation: Phase 9 only updates `SliceTabBar`. Global brand color migration is a Phase 12 cleanup item unless it's trivially simple. Document in `@theme` by adding `--color-civic-teal` so future phases can use `text-civic-teal` instead of `text-teal-600`.

## Sources

### Primary (HIGH confidence)
- https://tailwindcss.com/docs/grid-template-columns — Verified bracket syntax `grid-cols-[65%_35%]` for custom column splits
- https://tailwindcss.com/docs/dark-mode — Verified `@custom-variant dark (&:where(.dark, .dark *))` syntax for class-based dark mode in v4
- https://tailwindcss.com/docs/background-image — Verified `bg-[url(...)]` and multi-background pattern; confirmed dynamic URLs need `style` prop
- https://tailwindcss.com/docs/colors — Verified teal-600 = `oklch(60% 0.118 184.704)` in Tailwind v4
- `C:\Civic Spaces\Screengrabs\` (6 Krishna mockup JPGs) — Directly observed: teal pill tabs, hero layout, pill badge content, gradient overlay direction, aspect ratio, text hierarchy

### Secondary (MEDIUM confidence)
- https://medium.com/@adrishy108/fixing-grid-layout-overflow-making-a-grid-item-scrollable-without-breaking-everything-e4521a393cae — Grid item scroll fix with `min-h-0`; consistent with widely-documented CSS flexbox/grid behavior
- WebSearch + multiple sources agreeing on `min-h-0` as the critical fix for grid overflow

### Tertiary (LOW confidence)
- Approximate teal hex #0d9488 from community color reference sites — use the OKLCH value from official Tailwind docs instead

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new libraries; all tools verified in package.json
- Architecture patterns: HIGH — Tailwind v4 docs verified, scroll constraint is well-understood CSS behavior, mockup analysis direct
- Pitfalls: HIGH — `min-h-0` grid issue is documented from official CSS behavior; others from direct codebase analysis
- Open questions: MEDIUM — `siblingTotal` gap confirmed from codebase; copy strategy is a design decision not a technical uncertainty

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable domain — Tailwind v4 and CSS grid are stable)
