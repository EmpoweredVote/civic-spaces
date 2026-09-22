# Domain Pitfalls: Civic Spaces v3.0 UI/UX Redesign

**Domain:** Cross-app API integration + layout redesign on existing React civic forum
**Researched:** 2026-04-05
**Scope:** Specific to v3.0 work — hero banners, sidebar widgets, external API integration, Supabase Storage

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or user-visible regressions.

---

### Pitfall 1: Sidebar API Calls Fire 6x Simultaneously on App Load

**What goes wrong:**
`SliceFeedPanel` components are all mounted simultaneously in `AppShell` (lines 223-245 of `AppShell.tsx`). The `className={activeTab === tabKey ? ... : 'hidden'}` pattern keeps all 6 panels in the DOM. Any hook called inside `SliceFeedPanel` — including a new sidebar widget hook — fires once per panel on mount. A hook that fetches from the Compass API (`api.empowered.vote/api/compass/...`) or the accounts API would trigger 6 parallel requests on every app load, even though the sidebar is only visible on one tab at a time.

**Why it happens:**
CSS `display:none` hides elements visually but does not prevent React from mounting them or running their `useEffect` and `useQuery` hooks. React Query's deduplication only collapses requests with the **same query key** issued within the same render cycle. If 6 panels each call `useCompassScore(userId)` with the same key, React Query will deduplicate to 1 in-flight request — but only if `staleTime > 0`. With the default `staleTime: 0`, each panel mounts, sees a stale cache, and triggers its own background refetch, potentially resulting in 6 sequential refetches as panels settle.

**Consequences:**
- 6x API calls on load to external cross-origin services (Compass, accounts)
- Rate limiting or slow response compounds: if one call takes 800ms, all 6 are in-flight simultaneously
- Unnecessary load on `api.empowered.vote` from every Civic Spaces page load
- Network tab shows 6 duplicate requests, confusing future developers

**Prevention:**
Hoist sidebar widget data hooks **out of `SliceFeedPanel`** and into `AppShell` or a shared context provider that sits above the panel loop. Pass data down as props. Alternatively, use a single `useSidebarData()` hook called once in `AppShell` and pass results via context. If the hook must live inside the panel (e.g., for per-slice data), set `staleTime: Infinity` or `staleTime: 5 * 60 * 1000` so React Query serves cached data to panels 2-6 without refetching. Do not set `enabled: activeTab === tabKey` as a workaround — this defeats the CSS-hidden mount pattern and will break scroll preservation.

**Warning signs:**
- Network tab shows repeated calls to `api.empowered.vote` on first load
- React Query DevTools shows 6 separate query instances for the same key
- `useQuery` hook appears inside `SliceFeedPanel` body rather than above it

**Phase that should address it:** Phase that implements sidebar widgets (hero + sidebar phase)

---

### Pitfall 2: Token Key Mismatch — `cs_token` vs `ev_token`

**What goes wrong:**
Civic Spaces stores the auth JWT in `localStorage` under the key `cs_token` (see `useAuth.ts` line 86, `supabase.ts` line 10). EV-CompassV2 uses the key `ev_token` (see `C:/EV-CompassV2/src/lib/auth.js` line 2, `TOKEN_KEY = 'ev_token'`). These are two different localStorage entries. When Civic Spaces calls the Compass API or accounts API using its sidebar widget hooks, it must read `cs_token` — not `ev_token`. If the sidebar code is copy-pasted from EV-CompassV2, it will silently read `ev_token`, find `null`, and send unauthenticated requests. The Compass API (`publicFetch`) will succeed with no user data. The accounts API (`apiFetch`) will redirect to login.

**Why it happens:**
EV-CompassV2's `lib/auth.js` `apiFetch` function automatically reads `ev_token`. Copy-pasting that utility into Civic Spaces without adaptation means it reads the wrong key. This is a silent failure — no error thrown, just no user identity in the API response.

**Consequences:**
- Sidebar widgets show anonymous/empty state even for logged-in users
- If accounts API returns 401 and EV-CompassV2's `apiFetch` is used, it calls `redirectToLogin()`, which navigates away from Civic Spaces entirely
- Extremely hard to debug because the user IS authenticated (cs_token is valid), but sidebar calls appear unauthenticated

**Prevention:**
Do not import `apiFetch` or `publicFetch` from EV-CompassV2. Write new fetch utilities in Civic Spaces that read `cs_token`. Verify the token key in every cross-app API call during implementation. The `cs_token` and `ev_token` are the same JWT issued by `accounts.empowered.vote` — the underlying user identity is the same, only the localStorage key differs.

**Warning signs:**
- Sidebar widgets show empty/guest state while user is clearly logged in
- Network requests to `api.empowered.vote` are missing `Authorization` header
- Any import path referencing `EV-CompassV2/src/lib/auth` in Civic Spaces source

**Phase that should address it:** API integration design phase — establish Civic Spaces-native fetch utility before building any sidebar widget

---

### Pitfall 3: Layout Change Breaks Scroll Position Preservation

**What goes wrong:**
The existing scroll preservation system (HUB-08) depends on a specific DOM structure. `AppShell` maintains `scrollRefs` — one `RefObject<HTMLDivElement>` per tab — that point to the scrollable container inside each `SliceFeedPanel`. These refs are passed as `scrollRef` props to `SliceFeedPanel`, which attaches them to the `div` that has `overflow-y-auto` (line 102 of `SliceFeedPanel.tsx`). Adding a sidebar changes the layout wrapping that scrollable div. If the two-column layout wraps the feed in a new container that itself becomes the scroll root, the `scrollRef` will point to the wrong element and scroll restoration will silently fail.

**Why it happens:**
The `overflow-y-auto` responsibility must stay on exactly the element the `scrollRef` tracks. Introducing a CSS Grid or flexbox wrapper for the sidebar without carefully preserving where `overflow` is set will shift the scroll root. The `requestAnimationFrame` in `AppShell`'s `useEffect` (line 89) restores `scrollTop` on the tracked ref — if the ref points to a non-scrolling element, `scrollTop` reads 0 always and the restore is a no-op.

**Consequences:**
- All 6 tabs lose their scroll position on tab switch (regression of HUB-08)
- Users who scroll deep into Federal feed, switch to Neighborhood, and return find Federal reset to top
- Bug is invisible in development if testing with short feeds (no scrolling needed)

**Prevention:**
When implementing the two-column layout, keep the scrollable feed column as a self-contained flex column with `overflow-y-auto` on the **same element** the `scrollRef` tracks. Do not make the sidebar or its wrapper the scroll container for the whole panel. Use a two-column grid on the panel wrapper with the feed column preserving its own `overflow-y-auto` and the sidebar column using `overflow-y-auto` independently. Test scroll restoration explicitly: scroll feed panel 500px down, switch tab, return, verify position restored.

**Warning signs:**
- After adding sidebar, switching tabs resets feed to top
- `scrollRef.current.scrollTop` logs as 0 when it should be non-zero
- The element with `className="flex flex-col h-full overflow-y-auto"` in `SliceFeedPanel` is no longer the scroll container

**Phase that should address it:** Layout/sidebar structural implementation — must be validated before any other sidebar content

---

### Pitfall 4: Hero Images Break Feed Load Performance

**What goes wrong:**
Hero images are large (full-width geographic photos). If served without explicit `width`/`height` and without `loading="lazy"` or `fetchpriority` management, they cause Cumulative Layout Shift (CLS) as the image loads and pushes feed content down. More critically: because all 6 panels are mounted simultaneously, 6 hero images will be requested in parallel on app load — even though 5 of them are in `display:none` panels. This creates an unnecessary image fetch storm on every page load.

**Why it happens:**
Browsers initiate `<img>` fetches for all `src` attributes in the DOM, including those in `display:none` containers. The CSS-hidden mount pattern that preserves scroll does so at the cost of triggering all sub-resources for all panels.

**Consequences:**
- 6x hero image requests on load, 5 of which render for no user-visible purpose
- CLS if images lack explicit dimensions
- Slow perceived first-load if hero image appears above the fold of the active panel
- Supabase Storage egress charges for images never seen

**Prevention:**
Do not place hero `<img>` tags unconditionally in `SliceFeedPanel`. Either: (a) conditionally render the hero only for the active tab using `activeTab === tabKey` guard in `AppShell` (breaking the pure CSS-hidden pattern is acceptable for hero images since they do not need scroll preservation), or (b) use CSS `content-visibility: hidden` on the hero specifically within hidden panels while keeping the feed `display:none`. Always include explicit `width` and `height` attributes or `aspect-ratio` CSS. Use `loading="lazy"` for non-active heroes if they must be in the DOM. Set `fetchpriority="high"` only for the active tab's hero.

**Warning signs:**
- Network tab shows 5-6 simultaneous image requests to Supabase Storage on load
- Lighthouse CLS score degrades after hero is added
- Hero images appear in network log before any user has seen them

**Phase that should address it:** Hero banner implementation phase — image strategy must be decided before wiring up `<img>` tags

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

---

### Pitfall 5: Supabase Storage RLS Fails With External JWT Role Claim

**What goes wrong:**
The existing Civic Spaces RLS system uses `civic_spaces.current_user_id()` which calls `auth.jwt() ->> 'sub'` because external JWTs do not populate `auth.uid()`. If hero photo upload/management uses Supabase Storage's `storage.objects` table with RLS policies that reference `auth.uid()` (which Supabase Studio generates by default in policy templates), those policies will silently fail for all external JWT users. The `role` claim in the JWT must be `"authenticated"` — if the external JWT uses a custom value, Supabase Storage will deny all operations.

**Why it happens:**
Supabase Storage policy templates in Studio default to `auth.uid()`. The Civic Spaces JWT is issued by `accounts.empowered.vote`, not Supabase Auth, so `auth.uid()` returns NULL. The `role` claim must literally be the string `"authenticated"` to match the PostgreSQL role — custom values like `"user"` or `"member"` will cause a "permission denied to set role" error (confirmed in Supabase discussion #33852).

**Consequences:**
- Admin hero photo uploads fail with 403 even though the user is authenticated
- Default Studio-generated storage policies look correct but silently deny all operations
- Debugging is confusing because Supabase logs show the JWT is valid but the role claim triggers a PostgreSQL error

**Prevention:**
Write storage.objects RLS policies using `auth.jwt() ->> 'sub'` instead of `auth.uid()`. Verify the `role` claim in the external JWT is exactly `"authenticated"`. Use public bucket access for hero photos (read-only public, write restricted to admin service role via server-side upload) to avoid RLS complexity on reads entirely. For write operations (admin uploading heroes), use the Supabase service role key from a trusted backend — do not rely on client-side storage uploads with the external JWT unless the JWT's role claim is verified.

**Warning signs:**
- Storage uploads return 403 with message about row-level security
- `storage.objects` policy uses `auth.uid()` in any expression
- Studio-generated policy used without modification

**Phase that should address it:** Supabase Storage bucket setup phase — verify auth.jwt() ->> 'sub' works in storage policies before building upload UI

---

### Pitfall 6: Public Hero Bucket URL Cache Busting on Photo Update

**What goes wrong:**
Supabase Storage CDN caches public bucket URLs aggressively. If a hero photo for a slice is replaced with a new image using the same filename (e.g., `federal-hero.jpg`), the CDN continues serving the old image to all users until the cache expires — even if the database record is updated. Users clearing their browser cache does not help because the CDN cache is upstream. This is a known Supabase Storage behavior documented in GitHub discussion #5737.

**Why it happens:**
Public bucket objects are cached by the Supabase CDN (Cloudflare) with long TTLs. The CDN serves by URL path, so same-path = same cached object. There is no automatic CDN invalidation when a file is overwritten in Supabase Storage.

**Consequences:**
- Updated hero photos appear stale for hours or days
- No user-visible error — the old photo simply continues showing
- If slice-to-photo mapping is by filename, updates require a coordination dance between file upload and database record

**Prevention:**
Use unique filenames for each hero photo version (e.g., append a timestamp or UUID: `federal-hero-1712345678.jpg`). Store the full URL or storage path in the database record for the slice. When updating a hero, upload a new file with a new name, update the DB record, then optionally delete the old file. This eliminates CDN cache problems entirely. Do not rely on "replace in place" for public bucket assets.

**Warning signs:**
- Hero photo management design assumes overwriting same filename
- No versioning strategy in the storage path scheme
- Database schema stores only the slice name, not the specific photo path

**Phase that should address it:** Supabase Storage schema design phase — filename/path strategy must be decided before any photos are uploaded

---

### Pitfall 7: CORS Preflight Failures From Civic Spaces to Compass/Accounts APIs

**What goes wrong:**
Civic Spaces (`civicspaces.empowered.vote`) will make cross-origin requests to `api.empowered.vote` for sidebar widget data. If the API's CORS configuration does not explicitly allow `civicspaces.empowered.vote` as an origin, all requests will fail with CORS errors — and crucially, requests with an `Authorization` header trigger a preflight `OPTIONS` request, which must also be allowed. The existing EV-CompassV2 app (`compass.empowered.vote`) likely IS in the CORS allowlist. Civic Spaces may not be.

**Why it happens:**
CORS `Access-Control-Allow-Origin: *` (wildcard) cannot be used with credentialed requests (`Authorization` header). The API must enumerate allowed origins explicitly. Adding a new consumer app (`civicspaces.empowered.vote`) requires an explicit backend change to `api.empowered.vote`.

**Consequences:**
- All sidebar API calls silently fail in production (work fine locally if API is dev mode with permissive CORS)
- Network tab shows CORS errors, not 401/403 — may be misdiagnosed as auth failures
- `publicFetch` calls (no Authorization header) may also fail if wildcard is not set

**Prevention:**
Before implementing any sidebar API calls, verify that `api.empowered.vote` allows `civicspaces.empowered.vote` as an origin. This is a backend change in EV-Accounts/EV-CompassV2 infrastructure — coordinate with the API team. Test with the production origin (not localhost) using a staging deploy or curl with `Origin: https://civicspaces.empowered.vote` header. Make this a prerequisite for the sidebar API integration phase.

**Warning signs:**
- API calls succeed in development (localhost) but fail on staging/production
- Browser console shows "CORS policy: No 'Access-Control-Allow-Origin' header"
- First test of sidebar widget is done in production rather than verifying CORS first

**Phase that should address it:** API integration prerequisite phase — CORS verification before any sidebar widget code is written

---

### Pitfall 8: Sidebar Causes IntersectionObserver to Miss Sentinel

**What goes wrong:**
`SliceFeedPanel` uses an `IntersectionObserver` watching a sentinel `div` at the bottom of the feed list to trigger infinite scroll (lines 51-63). The observer uses `{ threshold: 0.1 }` with no explicit `root`, defaulting to the viewport. When a sidebar is added and the feed column becomes narrower or gains a different scroll container, the IntersectionObserver may fire incorrectly (sentinel is "visible" in viewport even when the feed isn't scrolled near the bottom) or stop firing entirely (sentinel is outside the new scroll root).

**Why it happens:**
The IntersectionObserver root defaults to the viewport when no `root` is specified. After a layout change where the feed column has its own scroll container (required for sidebar layout), the viewport-relative observer no longer accurately detects when the user has scrolled to the bottom of the feed column's scroll area.

**Consequences:**
- Infinite scroll stops working — no more posts load even when user scrolls to bottom
- Or infinite scroll fires too eagerly — loads next page immediately on tab switch
- Bug only manifests with the sidebar layout, not in isolation

**Prevention:**
When implementing the two-column layout, update the `IntersectionObserver` in `SliceFeedPanel` to use `root: scrollRef.current` (the feed's scroll container) instead of the viewport default. Pass the `scrollRef` prop (already exists in the component interface) as the observer root. This correctly detects intersection within the scrollable feed column regardless of sidebar presence.

**Warning signs:**
- After sidebar addition, feed loads all posts at once without scrolling
- After sidebar addition, "Load more" never triggers
- IntersectionObserver constructor does not specify `root` option

**Phase that should address it:** Layout implementation phase — must fix IntersectionObserver root when changing scroll container structure

---

### Pitfall 9: Mobile Layout Regression From Desktop-First Sidebar Implementation

**What goes wrong:**
The sidebar is a desktop-only feature (two-column at desktop, single-column at mobile). If the sidebar is implemented with hardcoded layout classes rather than responsive Tailwind breakpoints, mobile users see a broken layout: sidebar and feed stacked in an unusable way, or the feed column too narrow on medium-width devices.

**Why it happens:**
It is faster to implement desktop layout first and add mobile as an afterthought. In a CSS-hidden mount system, the same component renders for both desktop and mobile — there is no separate mobile component. Forgetting to add `md:grid-cols-[1fr_300px]` and testing only at desktop width means the regression ships.

**Consequences:**
- Mobile users see two cramped columns instead of single-column feed
- FAB (floating action button) may be obscured by sidebar on narrow screens
- Scroll preservation may behave differently between layouts if not tested

**Prevention:**
Design sidebar layout mobile-first. The base case (no breakpoint prefix) should be single-column. The sidebar column should use `hidden md:block` to disappear below the breakpoint. The feed column should be `w-full` by default, `col-span-1` at desktop. Write the Tailwind classes for the two-column wrapper as `grid grid-cols-1 md:grid-cols-[1fr_theme(spacing.80)]` or equivalent. Test at 375px, 768px, and 1280px before considering layout complete.

**Warning signs:**
- Layout implementation tested only in a maximized browser window
- Sidebar wrapper uses fixed pixel widths without responsive variants
- No visual test at mobile viewport before merging

**Phase that should address it:** Layout implementation phase — mobile and desktop must be tested together, not sequentially

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 10: Compass Score Widget Shows Stale Data After User Answers Questions

**What goes wrong:**
The Compass score widget in the sidebar fetches from `api.empowered.vote/compass/answers` (or a summary endpoint). If the user has Empower Compass open in another tab and updates their answers, the Civic Spaces sidebar continues showing the old score until the page is refreshed. This is cosmetically wrong but not harmful.

**Prevention:**
Set an appropriate `staleTime` and `refetchOnWindowFocus: true` on the compass score query so it refreshes when the user returns to the Civic Spaces tab. Do not set `staleTime: Infinity` for user-specific compass data.

**Phase that should address it:** Sidebar widget implementation phase

---

### Pitfall 11: Hero Photo Missing State Causes Layout Jump

**What goes wrong:**
If a slice has no hero photo yet (no record in the DB, or Supabase Storage URL is null), the hero banner area collapses to zero height, then snaps to full height if a default placeholder is shown. This causes CLS and a jarring visual pop.

**Prevention:**
Always render the hero banner area with a fixed height regardless of whether a photo is loaded. Use a solid color fallback (the slice's brand color or a neutral gradient) as the default state. Never conditionally render the banner container — always render the container, conditionally render the image inside it.

**Phase that should address it:** Hero banner implementation phase

---

### Pitfall 12: Supabase Storage `getPublicUrl` Returns HTTP in Local Dev

**What goes wrong:**
`supabase.storage.from('hero-photos').getPublicUrl('...')` returns URLs based on `VITE_SUPABASE_URL`. In local development, this is `http://127.0.0.1:54321`, not `https://`. If the frontend is served on HTTPS (or deployed), mixed-content browser policy blocks HTTP image requests. Hero images load locally but fail on staging/production.

**Prevention:**
Ensure `VITE_SUPABASE_URL` in production points to the HTTPS Supabase project URL. In local dev, be aware that storage URLs are HTTP — this is expected and not a bug to fix in code. Do not hardcode `http://` → `https://` URL replacement in application code; fix the environment variable instead.

**Phase that should address it:** Supabase Storage setup and environment configuration phase

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Sidebar widget hooks | 6x API calls on mount (Pitfall 1) | Hoist hooks above panel loop |
| Cross-app API integration | Token key mismatch cs_token vs ev_token (Pitfall 2) | Write Civic Spaces-native fetch utility |
| Cross-app API integration | CORS not configured for civicspaces origin (Pitfall 7) | Verify CORS before writing code |
| Layout restructure | Scroll preservation regression (Pitfall 3) | Test tab-switch scroll restore immediately |
| Layout restructure | IntersectionObserver root mismatch (Pitfall 8) | Specify root: scrollRef.current |
| Hero banner | 6x image requests for hidden panels (Pitfall 4) | Conditional hero or CSS content-visibility |
| Hero banner | Missing state causes CLS (Pitfall 11) | Fixed-height banner container always rendered |
| Supabase Storage setup | RLS policy using auth.uid() fails (Pitfall 5) | Use auth.jwt() ->> 'sub' |
| Supabase Storage setup | Cache busting on photo update (Pitfall 6) | Unique filenames with timestamp/UUID |
| Supabase Storage setup | getPublicUrl returns HTTP locally (Pitfall 12) | Environment variable hygiene |
| Responsive layout | Mobile regression from desktop-first (Pitfall 9) | Mobile-first Tailwind, test at 375px |
| Sidebar compass widget | Stale score after answer update (Pitfall 10) | refetchOnWindowFocus: true |

---

## Sources

- Codebase: `C:/Civic Spaces/src/components/AppShell.tsx` (CSS-hidden panel pattern, scroll ref system)
- Codebase: `C:/Civic Spaces/src/components/SliceFeedPanel.tsx` (IntersectionObserver, scroll container)
- Codebase: `C:/Civic Spaces/src/hooks/useAuth.ts` (cs_token key, token storage)
- Codebase: `C:/Civic Spaces/src/lib/supabase.ts` (accessToken: cs_token)
- Codebase: `C:/EV-CompassV2/src/lib/auth.js` (ev_token key, apiFetch, publicFetch)
- Codebase: `C:/Civic Spaces/supabase/migrations/20260327000002_rls.sql` (auth.jwt() ->> 'sub' pattern)
- [Supabase Storage Bucket Fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) — public vs private bucket access (HIGH confidence)
- [Supabase Storage CDN Fundamentals](https://supabase.com/docs/guides/storage/cdn/fundamentals) — cache eviction, per-region behavior (HIGH confidence)
- [Supabase Storage RLS + Third-Party JWT](https://github.com/orgs/supabase/discussions/33852) — role claim must be "authenticated", auth.uid() returns NULL for external JWTs (MEDIUM confidence)
- [TanStack Query deduplication](https://github.com/TanStack/query/discussions/608) — same-key deduplication behavior, staleTime impact on refetch (HIGH confidence)
- [Supabase CDN cache busting discussion](https://github.com/orgs/supabase/discussions/5737) — overwriting same filename does not bust CDN cache (MEDIUM confidence)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — RLS on storage.objects (HIGH confidence)
