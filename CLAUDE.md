# Civic Spaces — working notes

Conventions that are not obvious from the code and that are expensive to get wrong. Keep this
short; if something needs a page, put it in `.planning/` and link it here.

Civic Spaces is the **Connect** pillar's forum: a member is placed into civic "slices"
(City, County, State, Federal, Unified, Volunteer) based on where they live, and each
slice has its own feed, posts and replies. Identity, location and representatives all come from
**ev-accounts** — this repo owns none of that, it reads it.

## Getting it running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build — the frontend's only real check
```

**A fresh clone needs no `.env`.** With no `VITE_SUPABASE_URL`, `npm run dev` opens straight
into local dev mode: a reserved `dev-guest` id, forum content (slices, posts, replies, friends)
from the fixtures in `src/lib/devMockData.ts`, and **real public data** — officials, elections,
meetings, compass topics — from the live ev-accounts API through the `/api` proxy in
`vite.config.ts` (`src/lib/evApi.ts`). The dev id's "Representing this community" list is the
real officials for the mock city (Asheville, NC), from the public by-area lookup.
`VITE_API_PROXY_TARGET` points the proxy at a local ev-accounts.

Forum content is members-only to **write**, and Volunteer is members-only to read at all; the
five public slice types became readable by anyone on 2026-11-02, through four RPCs and nothing
else. It stays synthetic locally either way. Extend `devMockData.ts`; never hardcode posts in components, and
never copy real members' posts or profiles into fixtures.

**The public read path is APPLIED (2026-11-02).** `anon` holds schema `USAGE` on
`civic_spaces` plus `EXECUTE` on exactly four RPCs — `get_public_slice`, `get_public_feed`,
`get_public_post`, `get_public_replies` — and **no table, view, column or sequence grant
anywhere**. Verified live: `/rest/v1/posts` as `anon` returns `401 permission denied for table`.
Reading City / County / State / Federal / Unified is open to anyone; **Volunteer stays
members-only**, and so does every future private slice type, because the gate is an allowlist
(D-28, `PUBLIC_SLICE_TYPES` in `src/lib/writeAccess.ts` and a literal array in the SQL — the two
are pinned against each other by `check:write-access`). Writing did not open and must not: a
visitor gets the read-only notice and no composer.

🔴 **`npm run check:anon-read` is a live-exposure test now, not a rehearsal.** 72 PASS / 0 FAIL
against production on 2026-11-02, all four authenticated viewers included — the first time
section 4 had ever run. A failure there means something is readable that should not be. Run it
after any migration touching `civic_spaces`, and periodically regardless. The four viewer JWTs
are minted from `SUPABASE_JWT_SECRET`; the fixture is synthetic and torn down after. The fixture
is committed at `scripts/rehearsal/18-02-section4-seed.sql` (+ teardown) — section 4 cannot run
against production data because production holds **zero friendships**, and D-49 is a claim about
one.

🔴 **Sections 1–3c are content-BLIND, and that is not a gap in the implementation — it is the
shape of the question they ask.** They assert the projection is narrow and the door is one door,
and every one of them is satisfied by a feed of invented people. On 2026-11-04 the guard read
44 PASS / 0 FAIL on a `federal:US` feed where **9 of the 11 posts anon was served were demo
personas** keyed `fake-author-N`, one making a voting claim about a named living politician.
**3d is the half that looks at who is talking**: every author of anon-visible content must have a
UUID-shaped `user_id`, because every `civic_spaces` row is keyed on the internal UUID. It is an
allowlist on shape, deliberately not a denylist of known fake prefixes. A failure is either
seeded content a visitor can read, or a WorkOS id meaning identity resolution broke for a real
member — the two are repaired differently and the guard says which it saw.

🔴 **Any SECURITY DEFINER function added to `civic_spaces` from now on is anon-callable the
moment it is created**, because Postgres grants EXECUTE to PUBLIC by default and `anon` now
resolves the schema. Revoke it beside its own `CREATE FUNCTION`, the way `20261030000100` does
for all six of its own. `check:anon-read` asserts the anon-executable DEFINER set is exactly
those four.

**`CREATE OR REPLACE` on an EXISTING function is the one case that is already safe** — it
preserves the ACL, so replacing a pre-Phase-18 trigger function does not re-open it. Write the
revoke anyway, as `20261102000300` does: it costs nothing, it is idempotent, and a reader
should not have to query the catalog to know the function is shut. Note that revoking from
`authenticated` does **not** break a trigger — Postgres checks EXECUTE on a trigger function at
`CREATE TRIGGER` time, not on each fire.

To work against the real backend instead, copy `.env.example` to `.env.local` and fill in
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; then `?dev=1` still opts into the dev id.
`VITE_SLICE_ASSIGNMENT_URL` is optional; without it the fire-and-forget slice-assignment POST
fails silently and you see the "no jurisdiction" state. `VITE_PLACE_RESOLVE_URL` is optional
too and is **not the same switch** — it turns on the signed-out *address* path, and the
endpoint it needs does not exist yet. Leave it unset. See "Talking to the rest of the
platform" below. ⚠️ It is missing from `.env.example`, which could not be edited from the
agent session that added it; add it there when you are next in that file.

The `?dev=1` token is unsigned and local-only. It is behind `import.meta.env.DEV` and is checked
last, after the hash, localStorage and silent-SSO paths, so a real session always wins.

**`?signedout=1` is the mirror of it, and is checked *first*.** Dev-only and session-scoped
(`sessionStorage`, like `cs_dev_place` — a fresh tab is signed in again), it makes this window
a signed-out visitor: it clears `cs_token` once per page load and keeps the window a visitor
even when another tab signs in. The reversed ordering is the whole point and is safe for one
reason: `?dev=1` **grants** a session, so it must never outrank a real one, whereas this only
ever **removes** one — there is no privilege it can confer and nothing it can mask. It is how
`check:explore-gate` reaches the signed-out screen on a fresh clone, where dropping `?dev=1`
does not sign you out (with no `VITE_SUPABASE_URL`, `useAuth` enters dev-guest mode
unconditionally).

🔴 **You still cannot log in by clicking Sign in.** `useAuth.ts` hardcodes the redirect to
`https://civicspaces.empowered.vote`, so the accounts hub sends you to production, not back to
localhost. The other way in is still to log in on production,
copy `cs_token` out of that tab's localStorage, and paste it into localhost's under the same key
(or pass an `access_token` in the URL hash).

**Member-only APIs still 401 for the dev id** (your own representatives, your compass answers).
Those panels fall back to fixtures for the dev id only; that is expected, not a bug.

**The frontend has no test framework.** No test script, no test files. What it has instead is
eleven `check:*` guard scripts, and **eight of them now run in CI** —
`.github/workflows/guards.yml`, two jobs: five pure Node checks that read the shipped modules,
and three that drive the real app through Playwright against a `npm run dev` server.
`check:banners` is the ninth and runs weekly on a schedule instead
(`.github/workflows/banner-drift.yml`), because drift there arrives with no commit to hang a
PR check off. `check:grants` and `check:anon-read` (tenth, eleventh) run by hand only: each needs a privileged
`SUPABASE_DB_URL` plus `psql`, which CI does not have (`db-surface.yml` is the manual-dispatch job ready for when it does).

🔴 **Running in CI is not the same as being required.** "Required to merge" is a
branch-protection setting on `main`. Since 2026-11-05 it lists **`build`, `Guards (pure)` and
`Guards (browser)`** — all three. Read it with
`gh api repos/EmpoweredVote/civic-spaces/branches/main/protection`. `enforce_admins` is `false`,
so an admin merges past all of it — which is how #139 landed, self-approval being impossible.

🔴 **None of it runs on a direct push to `main`.** Every workflow that gates a PR —
`guards.yml` and `build-check.yml` — triggers on `pull_request` only; neither has a `push`
or `workflow_dispatch` trigger. So a commit pushed straight to `main` skips review AND all
seven guards, and deploys to production ~3 minutes later. `enforce_admins: false` means the
push is accepted: the remote prints `- 3 of 3 required status checks are expected` and takes
it anyway, which is the only warning you get and reads like noise. This happened on
2026-11-05 — `gh pr merge --delete-branch` leaves you checked out on `main`, and the next
commit went there. Check `git branch --show-current` before `git commit`, not before the
push; by push time the commit exists and undoing it means force-pushing a shared branch.

`Guards (browser)` was promoted from advisory on 2026-11-05, after #133. The case was that
#133 deleted the `<PlaceStrip>` mount with `tsc -b` and `build` both green, and nothing
required could see it; `check:place-entry` found it by hand days later. Measured before the
change, not guessed: the job runs **4–5 minutes** (not the ~10 it can appear to take while you
watch it — that includes queue time), ~1 PR/day reaches `main`, and 40 runs held 28 success,
0 failures, 5 cancelled-by-superseding-push. It runs in parallel with `build`, so what it costs
is the PR's critical path, ~30s → ~5min.

🔴 Promote or demote a check with the **contexts** endpoint, never a `PATCH` of the protection
object — a PATCH replaces the whole config and silently drops anything you did not re-send
(`require_last_push_approval`, `strict`, the review count):

```bash
gh api --method POST   .../branches/main/protection/required_status_checks/contexts -f 'contexts[]=Guards (browser)'
gh api --method DELETE .../branches/main/protection/required_status_checks/contexts -f 'contexts[]=Guards (browser)'
```

If these three ever turn flaky, a required flaky check is worse than an advisory solid one —
but the fix is to harden the guard, or to keep only `check:place-entry` required (it is the
mount-deletion guard and the fastest of the three), not to demote the lot.

🔴 **Still run them by hand before you claim anything works.** CI runs them on a pull request;
it does not run them while you are working, and `npm run build` on its own has never been
enough. It cannot see a deleted mount: PR #133 removed the `<PlaceStrip>` mount and left
`enterPlace` with one call site that renders only when signed out, silently removing "look at
another place" for every member while `tsc -b` stayed green. `check:place-entry` caught it,
by hand, days later. That is what the guards are for and why they are worth the minute.

🔴 **The type-check depends on `tsc -b`.** The root `tsconfig.json` is a solution file
(`"files": []` plus `references`): plain `tsc` on it compiles zero files, and Vite transpiles
with esbuild without type-checking. If you add a `tsconfig.*.json`, add it to `references` or
nothing will check it.

**Branch from `origin/main`, after a `git fetch`** — local `main` here is routinely tens of
commits behind. It does **not** diverge (no local-only commits), so a plain fast-forward is
all a stale `main` needs — nothing to salvage. If checking out `main` looks like it reverted
files, that is a behind-by-N branch, not lost work; check the counts
(`git rev-list --left-right --count origin/main...main`) before reacting.

**Merging: `main` needs a passing `build` and one approving review.** A PR whose files are
*all* `.planning/**` or `*.md` is approved automatically by
`.github/workflows/docs-auto-approve.yml`; one non-doc file and it is a normal review. The
allowlist is the security boundary, so `.github/**` is excluded — a PR touching CI never
auto-approves, including one that edits that workflow. `build` is required either way, and
the `Guards` jobs run on every PR but are not yet required (see above).

🔴 **Slice assignment lives in the ev-accounts engine, not in this repo.** It was folded in
per ev-cto decision 0018 and is **canonical at `ev-accounts/backend/src/civic_spaces/`**,
endpoint `POST /api/civic-spaces/assign`. Any change to slice-assignment behaviour goes there.
The old standalone copy (`services/slice-assignment`) was deleted on 2026-10-26; it is in git
history if you need to read it. Its Render service, `civic-spaces-slice-assignment`, left the
Blueprint in ev-infra#4 (2026-11-09).

**The frontend half stays active.** `src/lib/sliceAssignment.ts` builds
`${VITE_SLICE_ASSIGNMENT_URL}/assign`; production points that env var at the engine base
`https://api.empowered.vote/api/civic-spaces`.

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

Layout is a nav rail plus a nested content grid: `lg:grid-cols-[240px_minmax(0,1fr)]` outside,
and `md:grid-cols-[minmax(0,1fr)_clamp(17rem,26%,20rem)]` inside for feed and sidebar, with the
hero banner spanning both on its own row. The sidebar track follows the space available rather
than the breakpoint — 272px on tablets and laptops, 320px only from ~1440px. Each is a rounded
card on a tinted page. The rail is pinned from `lg` up and becomes a slide-over drawer below
it, where `SliceTabBar` carries navigation instead. The right sidebar is hidden below `md`
(`SidebarMobile` takes over, above the feed) and hidden entirely on the Volunteer tab — where
the content grid also collapses to one column, or the sidebar track would survive as dead
space. Both side panels also collapse by choice, remembered in `localStorage` under
`cs_nav_collapsed` and `cs_sidebar_collapsed`: the rail to a 4rem icon-only track
(`lg:grid-cols-[4rem_minmax(0,1fr)]`, labels kept as `sr-only`), and the sidebar out of the
grid entirely from `md`, toggled from the end of the Explore / Conversations bar.

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
`useRepresentatives` and `useCompassData` are each called once there, and `Sidebar` /
`SidebarMobile` / Explore receive the results. `useToolCoverage` is **defined and still has no
caller** — the rule is right, that hook simply has no consumer yet, so hoist it when you give it
one rather than calling it from a panel. (`useCompassData` was in the same state until Phase
16-07 made Explore its first consumer.) Follow that pattern; do not call a shared hook
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

The old standalone service's `verifyToken.ts` (deleted, in git history) was **deliberately
not carried into the engine** — it 401'd every WorkOS member after the cutover. Do not use
it as the reference implementation.

The symptom of a mismatch: the member queries `user_id=eq.<WorkOS sub>`, matches zero rows,
and sits on "Setting up your civic spaces…" forever, because an empty membership list is
indistinguishable from a new account and `useEnsureSlices` keeps retrying.

**Supabase Third-Party Auth must trust the WorkOS issuer**, or every `/rest/v1/*` call
401s. That is project config, not SQL, and not in this repo. (The engine carries its own
issuer config.)

🔴 **`cs_token` is this app's key, `ev_token` is Compass's.** Same JWT, same auth hub, different
localStorage keys. Copying a snippet from CompassV2 that reads `ev_token` will silently find
nothing here.

**Scroll positions are restored manually** in `AppShell` via `scrollRefs` / `scrollPositions`.
If you restructure the feed column, that restoration is the thing most likely to break, and it
breaks quietly.

🔴 **A hero banner can change photographer with no diff on our side.** State, federal and
geoid-keyed county banners come from Essentials' shared bucket (`src/lib/banners.ts`), and
Essentials replaces one by swapping the bytes behind a stable URL. No path changes, so
`tsc -b`, the Vite build and every 404 check stay green while the credit we render beside
it becomes the wrong person's name — and attribution on a CC BY / CC BY-SA image is a
licence condition. Treasury Tracker published a wrong photographer for three weeks this
way. Run `npm run check:banners` (network, not in `npm run build`) when you touch banner
code and periodically regardless; it diffs the live bytes of all 232 assets against
`src/lib/banners.manifest.json` (`--rebuild` re-derives that from source).
All credits and paths live in `src/lib/banners.generated.ts` — **generated**, via
`npm run gen:banners`. It reads Essentials' `/banners.json` (credits, joined on bucket
**path**, never on a place name — Portland OR and Portland ME share a key and differ only
by filename) and `/coverage.json` (geoids). Never hand-edit it, never transcribe credits
from Essentials' comment block, and never copy another app's table: TT published a wrong
photographer for three weeks that way, and our own parser did it once too. Re-derive credits from `essentials/src/lib/buildingImages.js`
and verify each author on its Commons File: page — **never copy another app's table.**

**Every Supabase call is `.schema('civic_spaces')`** — 49 of them. The default `public` schema
is not this app's data.

🔴 **The migrations are not the grant surface; the catalog is.** `public` also carries twelve views
over these same tables (fifteen in all; the other three are `users_public` and two PostGIS
views), a second route in that the `civic_spaces` schema gate does not cover: `anon` has `USAGE`
on `public`, and since 2026-11-02 `USAGE` on `civic_spaces` too — though there it reaches four
RPCs and nothing else. Five of the views (`posts`, `replies`, `slices`, `slice_members`,
`connected_profiles`) were in no applied migration, and `anon` held all seven privileges on every
one, from Supabase's default privileges rather than any `GRANT` here, with only
`security_invoker` and RLS holding them shut. `20261030000000_reconcile_public_views.sql`
revoked all twelve from `anon` on 2026-11-02; it now reaches 3 of the 15 (`users_public` and the
two PostGIS views, left alone on purpose), while `authenticated` is unchanged at 15.
🔴 The default privileges that created the problem are still in place, so the NEXT view created
in `public` arrives anon-readable exactly as these did. `npm run check:grants` reads the catalog.
`public.users_public` is deliberately left alone: it reads a `users` table this app does not own.

## Talking to the rest of the platform

| Need | Source |
|---|---|
| Session / user id | `accounts-api.empowered.vote/api/auth/session`, or `cs_token` |
| Compass answers, representatives | `api.empowered.vote/api/...` (Bearer `cs_token`) |
| Setting or changing an address | link out to `app.empowered.vote/settings/location` |
| Posts, replies, slices, friends, notifications | Supabase, `civic_spaces` schema |

This app **never stores a location**, and **never geocodes for a member.** Those used to be
one sentence; Phase 17 narrowed the second half and left the first intact, so read them as
two rules.

**Never stores** survives whole, and is load-bearing. The resolved **geoids** may be held for
the session (`src/lib/viewedPlace.ts`, `sessionStorage`, `cs_viewed_place`); the typed string
is never persisted, never logged by us, and never rendered back. `ResolvedPlace` has no
`name` field *at all* — the display name is looked up **from the geoid** through
`geoNames.ts`, so a call site cannot echo the input even by accident. `npm run check:place-resolve`
asserts that key set structurally, and asserts that what reaches `sessionStorage` contains
none of a sample input string.

**Never geocodes for a member** is the other half, and it is unchanged where it was ever
about members. A member's location belongs in their ev-accounts profile, where it is
validated, encrypted and sits beside its privacy controls. If a member has no jurisdiction
the fix is still, always, to send them to the accounts app — **never to add address handling
to `LocationPrompt`.** An **observer** has no profile to put an address in, which is the one
case Phase 17 added: `src/lib/placeResolve.ts` + `src/hooks/usePlaceResolve.ts`, for someone
with no account at all.

🔴 **Three obvious ways to do that are wrong, all probed live 2026-10-26.** They are named
in `placeResolve.ts`'s header too, because each is attractive enough to be re-discovered:

| Tempting | Why not |
|---|---|
| `GET /api/essentials/address-search?address=…` | Public and one call, and it violates the no-echo rule twice: the address is in the **query string**, which Render's access log records, and `matchedAddress` comes **back** in the response. Also missing the place geoid outside ev-accounts' `PLACE_LOADED_STATES` |
| Browser `fetch()` to `geocoding.geo.census.gov` | **No CORS** — reproduced in real Chromium from the real origin. `vary: Origin` with no `access-control-allow-origin`, and the `OPTIONS` 200 is an Apache `Allow:`, which a browser reads as a failed preflight. 🔴 **Node's `fetch` does not enforce CORS, so every Node probe passes and the browser still fails.** Re-check in Chromium or do not claim it |
| JSONP to the same host | Works, and executes third-party script in our origin, reproduces only the first geocoder with none of ev-accounts' NAD fallbacks, and still puts the address in a query string. Last resort, not the plan |

The accepted shape is a **body-only POST** — Render's access log records the request line, not
the body. The place-name path (`location-search` → the committed gazetteer centroid →
`coordinate-lookup`) is CORS-clean and ships today, handling no address at all. The address
path is written in full and gated behind **`VITE_PLACE_RESOLVE_URL`**, which is deliberately
**not** `VITE_SLICE_ASSIGNMENT_URL`: the two point at the same ev-accounts base, so one
switch would turn the address path on for every deployment that had configured assignment.
Unset, no address input renders. The endpoint it waits on,
`POST /api/civic-spaces/resolve`, is specified in
`.planning/phases/17-the-signed-out-arrival/ACCOUNTS-HANDOFF.md`.

🔴 One honest caveat, because the privacy copy has to respect it: **census.gov sees the
address regardless** — `onelineaddress` is a GET on every path. The member path has the same
property. So the claim is *"geocoded once and never kept"*, never *"it never leaves your
browser"*.

## Design rules

**Beautiful is not optional.** The v3.0 redesign is the standard, and every change is judged on
both light and dark mode and on both desktop and mobile. A change that looks right in only one
of those four is not done.

- **Dark mode is class-based, and dark is the default.** `index.html` sets the `dark` class
  before first paint, reading the `ev_theme` cookie first and `localStorage['ev:color-scheme']`
  second. 🔴 **The cookie is `ev_theme`. It was `ev_color_scheme` here until 2026-10-27**, a name
  this repo alone used — essentials shipped `ev_theme` on 2026-05-05 and five other EV sites
  follow it, so a correctly built contract under the wrong name interoperated with nobody. The
  old name is still **read** for members who chose light before the rename, and never written. `prefers-color-scheme` is deliberately not consulted: only an explicit `light` opts out,
  which is why the bootstrap tests `s !== 'light'` rather than `s === 'dark'`. The cookie is
  scoped to `.empowered.vote` so the choice carries across EV subdomains — localStorage cannot,
  which is the whole reason it exists. See `src/lib/colorScheme.ts` and
  `.planning/research/ev-color-scheme-contract.md`. Never define a colour only inside a `dark:`
  variant — write the light value and the `dark:` counterpart together, every time.
- **Light-mode text runs `gray-900` / `gray-600` / `gray-500`.** `gray-400` is decoration only:
  on white it is 2.54:1, under both the 4.5:1 AA wants for text and the 3:1 for a meaningful
  icon. In dark mode `gray-500` is 3.67:1 on `gray-900` and fails too — use `gray-400` there.
  🔴 Tailwind v4 emits `oklch()`, so any contrast check that parses `getComputedStyle().color`
  as `rgb()` reports confident nonsense; resolve colours through a canvas instead — and
  **setting `fillStyle` is not resolving it.** Chromium accepts `oklch()` and hands it straight
  back from `ctx.fillStyle`, so a probe that reads `fillStyle` parses `0.446 0.03 256.802` as
  if it were RGB and reports ~1:1 for perfectly legible text. You must `fillRect` and
  `getImageData` one pixel. A ratio near 1:1, or a whole page "failing", is this bug, not a
  finding.
- 🔴 **Driving the app headless? Playwright's `colorScheme` option does nothing here.** The
  bootstrap in `index.html` ignores `prefers-color-scheme` on purpose and reads the
  `ev_theme` cookie, so a context asking for `light` still renders dark and a "four-way"
  run silently becomes two. Set the cookie on the browser context, and assert
  `documentElement.classList.contains('dark')` matches what you asked for before you shoot.
- Use the **EV brand tokens** (teal `#00657C`, coral `#FF5740`, yellow `#FED12E`) and the
  existing component vocabulary rather than inventing new colours or spacing.
- Reuse `WidgetCard` for anything sidebar-shaped, and `react-loading-skeleton` for loading
  states — match `FeedSkeleton`, do not invent a third loading style.
- Animation is `motion/react`, already used by `NotificationBell` and `SidebarMobile`.
- **The hero banner cannot be seen by clicking on localhost** (no local login — see above),
  so the four-way check runs against a harness: `npm run dev`, then
  `npm run shoot:banners -- --port <port>` writes light/dark x desktop/mobile PNGs to
  `banner-shots/` (gitignored). It mounts `HeroBanner` via `/banner-harness.html` with
  real `bannerFor()` output. **Look at the images** — a clean run only proves they
  decoded. Crop depends solely on the box's aspect ratio, never its pixel size, so the
  harness's narrower column crops exactly like the real feed column. It does not cover
  `AppShell`'s photoUrl/credit precedence; that still needs the `cs_token` paste.
- 🔴 **Playwright is a global install, not a dependency — `node_modules` is the wrong place
  to look.** `shoot:banners` resolves it from `npm root -g`, so searching `node_modules` and
  concluding this repo has no headless browser is wrong; it has one, with Chromium cached.
  Import it the way that script does — `mod.chromium ?? mod.default?.chromium` — because the
  global install's export shape differs between its CJS and ESM entry points.
- **The harness is for more than screenshots, and the difference matters.** Driving the same
  page with `document.elementFromPoint()` hit-tests the real box model, which is the only way
  to catch a control that renders perfectly and cannot be clicked. PR #92 shipped a photo
  credit whose licence link sat under the content layer's `md:pb-7` padding at `z-10`: a
  `z-index` that was correct while the credit was plain text, invisible to every PNG and to
  `tsc -b`, and broken only at `md` and up, so phones looked fine. Toggle the suspect class
  off mid-run and re-test — a fix that is load-bearing will put the bug straight back.
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
`phases/NN-name/` with `NN-RESEARCH.md`, `NN-MM-PLAN.md` and `NN-VERIFICATION.md`.
`ROADMAP.md` lists which phases and milestones have shipped. Read the relevant phase's
research doc before changing an area — it usually records why something is the way it is.

## Real data for design work

Volunteers and designers: build on live public data, never on invented data. Fetch through the
hooks in `src/hooks/` (public API calls use `EV_API_ORIGIN` from `src/lib/evApi.ts`). If a request
fails, say so and stop; do not swap in invented data. Data no API serves yet goes in one module under
`src/mocks/` (or `devMockData.ts` for forum content) and is listed in the PR under "Data this needs
from the API". Account and user data is off-limits. Use `@empoweredvote/ev-ui` components instead of
copies. The `ev-designer` skill in EmpoweredVote/ev-ui has the index of public routes.

## Render settings live in ev-infra

This repo's Render service (`civic-spaces-frontend`) is managed by the Render Blueprint in
[`EmpoweredVote/ev-infra`](https://github.com/EmpoweredVote/ev-infra) (`render.yaml`).

- Build and start commands, rewrites, headers, custom domains, plans, cron
  schedules and build filters change **only through a PR to ev-infra**. Render
  syncs its `main` branch automatically.
- A setting changed in the Render dashboard is **undone on the next sync**.
- Env var **values** are the exception: set them in the Render dashboard. Add a
  new variable's name to ev-infra (with `sync: false`) so the record stays complete.
- Do not add a `render.yaml` to this repo. Render does not read it.
