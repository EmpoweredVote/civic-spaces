# Civic Spaces — working notes

Conventions that are not obvious from the code and that are expensive to get wrong. Keep this
short; if something needs a page, put it in `.planning/` and link it here.

Civic Spaces is the **Connect** pillar's forum: a member is placed into civic "slices"
(Neighborhood, Local, State, Federal, Unified, Volunteer) based on where they live, and each
slice has its own feed, posts and replies. Identity, location and representatives all come from
**ev-accounts** — this repo owns none of that, it reads it.

## Getting it running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build — the frontend's only real check
```

Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. `VITE_SLICE_ASSIGNMENT_URL` is optional in dev; without it the
fire-and-forget slice-assignment POST fails silently and you see the "no jurisdiction" state.

**To see a signed-in screen locally, visit `http://localhost:5173/?dev=1`.** That mints an
unsigned, local-only token for a reserved `dev-guest` id, and the feed/thread/slice/reps/compass
hooks answer that id with fixtures from `src/lib/devMockData.ts`. It is behind
`import.meta.env.DEV` and is checked last, after the hash, localStorage and silent-SSO paths, so
a real session always wins.

🔴 **You still cannot log in by clicking Sign in.** `useAuth.ts` hardcodes the redirect to
`https://civicspaces.empowered.vote`, so the accounts hub sends you to production, not back to
localhost. `?dev=1` exists because of that. The other way in is still to log in on production,
copy `cs_token` out of that tab's localStorage, and paste it into localhost's under the same key
(or pass an `access_token` in the URL hash).

**Several APIs send no CORS headers for localhost** — the Compass API and the representatives
endpoint among them. That is why fixtures exist; without them those panels are permanently empty
in dev, which looks like a bug and is not one.

**The frontend has no test framework.** No test script, no test files. `npm run build` is the
whole safety net there — run it before you claim anything works.

🔴 **It only became a safety net on 2026-09-01, so distrust any "build passed" older than
that.** The script was `tsc && vite build`, but the root `tsconfig.json` is a solution file
(`"files": []` plus `references`), and plain `tsc` on one of those compiles **zero files**.
Vite transpiles with esbuild and does not type-check. So the build exited 0 with 25 type
errors outstanding, and had done for a long time — four of them predated the slice-taxonomy
work. It is `tsc -b` now, which actually builds the referenced project. If you add a
`tsconfig.*.json`, add it to `references` or nothing will check it.

**Branch from `origin/main`, after a `git fetch`** — local `main` here is routinely tens of
commits behind. It does **not** diverge: measured 2026-09-14, `git rev-list --left-right
--count origin/main...main` gave `22 0` (zero local-only commits) and `git merge --ff-only`
was clean. So a plain fast-forward is all a stale `main` ever needs — no stash-and-rebranch
dance, and nothing to salvage. If checking out `main` looks like it reverted files, that is
a behind-by-N branch, not lost work; check the counts before reacting.

**Merging: `main` needs a passing `build` and one approving review.** A PR whose files are
*all* `.planning/**` or `*.md` is approved automatically by
`.github/workflows/docs-auto-approve.yml`; one non-doc file and it is a normal review. The
allowlist is the security boundary, so `.github/**` is excluded — a PR touching CI never
auto-approves, including one that edits that workflow. `build` is required either way.

🔴 **`services/slice-assignment` is FROZEN — do not develop it.** It was folded into the
ev-accounts engine (ev-cto decision 0018) and is **canonical at
`ev-accounts/backend/src/civic_spaces/`**, endpoint `POST /api/civic-spaces/assign`. Any
change to slice-assignment behaviour goes there, not here. See
`services/slice-assignment/FROZEN.md`; the local copy still runs and still compiles, so
nothing stops you editing the wrong one.

**The frontend half stays active.** `src/lib/sliceAssignment.ts` still builds
`${VITE_SLICE_ASSIGNMENT_URL}/assign`; cutover is that one env var pointing at the engine
base `https://api.empowered.vote/api/civic-spaces`.

(The frozen service does still have vitest tests — `npm test` in that directory, a separate
npm project the root build does not reach. Run them only if you are forced to touch it.)

## Where things are on screen

`AppShell.tsx` is the frame and holds nearly all the state. Reading it first saves an hour.

| On screen | File |
|---|---|
| Top bar, tab bar, the whole grid | `components/AppShell.tsx` |
| Left nav rail (and its mobile drawer) | `components/NavSidebar.tsx` |
| Slice tabs (below `lg`, where the rail is a drawer) | `components/SliceTabBar.tsx` |
| Sibling-shard switcher | `components/SliceSelector.tsx` |
| No-jurisdiction empty state | `components/LocationPrompt.tsx` |
| One slice's feed (posts + composer) | `components/SliceFeedPanel.tsx` |
| A post / a reply / a thread | `components/PostCard.tsx`, `ReplyCard.tsx`, `ThreadView.tsx` |
| Banner above the feed | `components/HeroBanner.tsx` |
| Desktop right column | `components/Sidebar.tsx` |
| Mobile collapsible version of it | `components/SidebarMobile.tsx` |
| The sidebar widgets | `components/widgets/` |
| Profile page | `components/ProfilePage.tsx` + `Profile*.tsx` |

Layout is a nav rail plus a nested content grid: `lg:grid-cols-[240px_1fr]` outside, and
`md:grid-cols-[1fr_320px]` inside for feed and sidebar, with the hero banner spanning both on
its own row. Each is a rounded card on a tinted page. The rail is pinned from `lg` up and
becomes a slide-over drawer below it, where `SliceTabBar` carries navigation instead. The right
sidebar is hidden below `md` (`SidebarMobile` takes over, above the feed) and hidden entirely on
the Volunteer tab — where the content grid also collapses to one column, or the 320px track
would survive as dead space.

Routing is **wouter**, with two routes: `/profile/:userId` and `/post/:postId`. Everything else
is tab state inside `AppShell`, persisted to `localStorage` under `cs_active_tab`.

🔴 **A thread's URL is the only URL the feed has.** `/post/:postId` resolves through `locatePost`
in `useNotificationRouting`, which returns `own` / `sibling` / `unavailable` — one resolver behind
both notification clicks and shared links. `unavailable` is deliberately one outcome for
not-found, deleted and not-yours alike: splitting it would reveal whether a post the member
cannot read exists. A signed-out visitor's link is stashed at `localStorage['cs_pending_post']`
and replayed after login, because the accounts hub is sent a fixed redirect with no path.

## Landmines

🔴 **Every feed panel is mounted at once — a hook inside one fires 6×.** `AppShell` renders all
five `FEED_TABS` plus Volunteer simultaneously and hides the inactive ones with CSS `hidden`.
That is deliberate: it preserves scroll position and the React Query cache across tab switches.
The consequence is that any hook you add inside `SliceFeedPanel` runs six times on load.

**So sidebar and shell data hooks are hoisted to `AppShell` and passed down as props.**
`useRepresentatives`, `useToolCoverage` and `useCompassData` are each called once there, and
`Sidebar` / `SidebarMobile` receive the results. Follow that pattern; do not call a shared hook
inside a panel. Where a hook genuinely needs per-slice data, render its component only for the
active tab (`SliceSelector` does this) or wrap it so the hook still runs unconditionally
(`ActiveHeroBanner`, `SliceNewsWidget`).

🔴 **A member can READ other shards of their own jurisdiction, and must not be offered a write.**
Two permissive SELECT policies grant read access to posts and replies in any slice sharing
`(slice_type, geoid)` with one they belong to — see
`supabase/migrations/20260917000000_sibling_slice_read_access.sql`. Nothing crosses a
jurisdiction, because the join requires geoid equality, and every write path stays closed
(`slice_members` has no INSERT/UPDATE/DELETE policy at all).

The trap is the UI half. RLS rejects those inserts, so any control that offers one can only
produce an error — and gating it in the feed is not enough. **Gate the feed AND the thread.**
`isViewOnly` has to reach `SliceFeedPanel` (hides the FAB and composer) and `ThreadView`
(hides the reply composer, and passes `canWrite={canWrite && !isViewOnly}` plus no `onReply`
to `ReplyCard`). Shipping only the first half is exactly what happened once already.

🔴 **A member's id is NOT the token's `sub`.** The accounts platform accepts tokens from
two issuers since the WorkOS AuthKit cutover (2026-08-28, ev-accounts decision 0002).
Supabase `sub` is the internal UUID; **WorkOS `sub` is a WorkOS id (`user_01…`)** and the
internal UUID travels in the **`external_id`** claim. Every civic_spaces row is keyed on
the UUID.

Three places resolve identity and **all three must agree**, or a request authenticates as
one person and reads rows as another — which surfaces as missing data, not as an auth
error:

| layer | file |
|---|---|
| frontend | `decodeUserId` in `src/hooks/useAuth.ts` |
| service | `resolveInternalUserId` in **`ev-accounts`** `backend/src/lib/tokenIdentity.ts` |
| database | `civic_spaces.current_user_id()` — 21 RLS policies across 9 tables call it |

The frontend and the database are `external_id` first, then `sub`. Change them together.
An unlinked WorkOS account (no `external_id`) resolves to its own WorkOS sub, matches
nothing, and sees nothing — fail-closed by design.

🔴 **The service layer moved, and it does not use that rule.** Slice assignment is now the
ev-accounts engine (`POST /api/civic-spaces/assign`), whose `requireAuth` resolves through
`resolveInternalUserId` — which is **issuer-aware, not first-one-wins**: a Supabase token
takes `sub`, a WorkOS token takes `external_id` *and returns null if it is absent*. So an
unlinked WorkOS account is **rejected outright** there, rather than authenticating as its
WorkOS sub and reading nothing. Both fail closed; they fail closed differently, and only
one of them looks like an auth error.

The old `services/slice-assignment/src/middleware/verifyToken.ts` is **frozen and was
deliberately not carried into the engine** — it 401'd every WorkOS member after the
cutover. Do not use it as the reference implementation.

This broke production on 2026-09-02: a WorkOS member queried
`user_id=eq.user_01M14T3W1R72ZQM70KRXH4K5E8`, matched zero rows, and sat on "Setting up
your civic spaces…" forever, because an empty membership list is indistinguishable from a
new account and `useEnsureSlices` kept retrying.

**Both verifiers need the WorkOS issuer registered, or a WorkOS token is a 401:**
- The **frozen** `services/slice-assignment` needs `WORKOS_ISSUER` and `WORKOS_JWKS_URL`
  alongside the existing `ACCOUNTS_ISSUER` / `ACCOUNTS_JWKS_URL`. Defaults follow the
  WorkOS docs: `https://api.workos.com/user_management/<WORKOS_CLIENT_ID>` and
  `https://api.workos.com/sso/jwks/<WORKOS_CLIENT_ID>`. Take the client id from the
  `ev-accounts-api` Render env — it is not in the local accounts `.env`. This applies only
  while that service still serves traffic; the engine carries its own issuer config.
- **Supabase Third-Party Auth must trust the WorkOS issuer too**, or every `/rest/v1/*`
  call 401s. That is project config, not SQL, and not in this repo.

🔴 **`cs_token` is this app's key, `ev_token` is Compass's.** Same JWT, same auth hub, different
localStorage keys. Copying a snippet from CompassV2 that reads `ev_token` will silently find
nothing here.

**Scroll positions are restored manually** in `AppShell` via `scrollRefs` / `scrollPositions`.
If you restructure the feed column, that restoration is the thing most likely to break, and it
breaks quietly.

**Every Supabase call is `.schema('civic_spaces')`** — 49 of them. The default `public` schema
is not this app's data.

## Talking to the rest of the platform

| Need | Source |
|---|---|
| Session / user id | `accounts-api.empowered.vote/api/auth/session`, or `cs_token` |
| Compass answers, representatives | `api.empowered.vote/api/...` (Bearer `cs_token`) |
| Setting or changing an address | link out to `app.empowered.vote/settings/location` |
| Posts, replies, slices, friends, notifications | Supabase, `civic_spaces` schema |

This app **never geocodes and never stores a location.** If a member has no jurisdiction, the
fix is always to send them to the accounts app — never to add address handling here.

## Design rules

**Beautiful is not optional.** The v3.0 redesign is the standard, and every change is judged on
both light and dark mode and on both desktop and mobile. A change that looks right in only one
of those four is not done.

- **Dark mode is class-based, and dark is the default.** `index.html` sets the `dark` class
  before first paint, reading the `ev_color_scheme` cookie first and `localStorage['ev:color-scheme']`
  second. `prefers-color-scheme` is deliberately not consulted: only an explicit `light` opts out,
  which is why the bootstrap tests `s !== 'light'` rather than `s === 'dark'`. The cookie is
  scoped to `.empowered.vote` so the choice carries across EV subdomains — localStorage cannot,
  which is the whole reason it exists. See `src/lib/colorScheme.ts` and
  `.planning/research/ev-color-scheme-contract.md`. Never define a colour only inside a `dark:`
  variant — write the light value and the `dark:` counterpart together, every time.
- **Light-mode text runs `gray-900` / `gray-600` / `gray-500`.** `gray-400` is decoration only:
  on white it is 2.54:1, under both the 4.5:1 AA wants for text and the 3:1 for a meaningful
  icon. In dark mode `gray-500` is 3.67:1 on `gray-900` and fails too — use `gray-400` there.
  🔴 Tailwind v4 emits `oklch()`, so any contrast check that parses `getComputedStyle().color`
  as `rgb()` reports confident nonsense; resolve colours through a canvas instead.
- Use the **EV brand tokens** (teal `#00657C`, coral `#FF5740`, yellow `#FED12E`) and the
  existing component vocabulary rather than inventing new colours or spacing.
- Reuse `WidgetCard` for anything sidebar-shaped, and `react-loading-skeleton` for loading
  states — match `FeedSkeleton`, do not invent a third loading style.
- Animation is `motion/react`, already used by `NotificationBell` and `SidebarMobile`.
- The `ui-ux-pro-max` skill is installed in `.claude/skills/` — worth invoking while planning
  any layout change.

The design mockups this UI was built from are not in the repo; ask Chris for them rather than
guessing at intent.

## Stack

React 19 · TypeScript · Vite 6 · Tailwind v4 (via `@tailwindcss/vite`, no config file) ·
wouter · TanStack Query · motion · `@supabase/supabase-js` ·
`react-modal-sheet` · `sonner` · `@empoweredvote/ev-ui`.

## Planning

This repo uses the GSD workflow in `.planning/` — `ROADMAP.md` at the top, then
`phases/NN-name/` with `NN-RESEARCH.md`, `NN-MM-PLAN.md` and `NN-VERIFICATION.md`. Phases 1–13
are shipped (v1.0 forum, v2.0 all slices, v3.0 UI redesign). Read the relevant phase's
research doc before changing an area — it usually records why something is the way it is.
