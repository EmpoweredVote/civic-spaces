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

🔴 **You cannot log in locally by clicking Sign in.** `useAuth.ts` hardcodes the redirect to
`https://civicspaces.empowered.vote`, so the accounts hub sends you to production, not back to
localhost. To see any signed-in screen, log in on production, copy the `cs_token` value out of
that tab's localStorage, and paste it into localhost's localStorage under the same key. The app
reads the token from there (or from an `access_token` in the URL hash).

**The frontend has no test framework.** No test script, no test files. `npm run build` is the
whole safety net there — run it before you claim anything works.

🔴 **It only became a safety net on 2026-09-01, so distrust any "build passed" older than
that.** The script was `tsc && vite build`, but the root `tsconfig.json` is a solution file
(`"files": []` plus `references`), and plain `tsc` on one of those compiles **zero files**.
Vite transpiles with esbuild and does not type-check. So the build exited 0 with 25 type
errors outstanding, and had done for a long time — four of them predated the slice-taxonomy
work. It is `tsc -b` now, which actually builds the referenced project. If you add a
`tsconfig.*.json`, add it to `references` or nothing will check it.

**`services/slice-assignment` does have tests** — vitest, `npm test` in that directory. It is
a separate npm project with its own `tsconfig.json`; the root build does not reach it, so run
both when you touch the service.

## Where things are on screen

`AppShell.tsx` is the frame and holds nearly all the state. Reading it first saves an hour.

| On screen | File |
|---|---|
| Top bar, tab bar, the whole grid | `components/AppShell.tsx` |
| Slice tabs | `components/SliceTabBar.tsx` |
| One slice's feed (posts + composer) | `components/SliceFeedPanel.tsx` |
| A post / a reply / a thread | `components/PostCard.tsx`, `ReplyCard.tsx`, `ThreadView.tsx` |
| Banner above the feed | `components/HeroBanner.tsx` |
| Desktop right column | `components/Sidebar.tsx` |
| Mobile collapsible version of it | `components/SidebarMobile.tsx` |
| The three sidebar widgets | `components/widgets/` |
| Profile page | `components/ProfilePage.tsx` + `Profile*.tsx` |

Layout is `md:grid-cols-[82%_18%]` — feed left, sidebar right. The sidebar column is hidden on
mobile (`SidebarMobile` takes over, above the feed) and hidden entirely on the Volunteer tab.

Routing is **wouter**, and there is exactly one route: `/profile/:userId`. Everything else is
tab state inside `AppShell`, persisted to `localStorage` under `cs_active_tab`.

## Landmines

🔴 **Every feed panel is mounted at once — a hook inside one fires 6×.** `AppShell` renders all
five `FEED_TABS` plus Volunteer simultaneously and hides the inactive ones with CSS `hidden`.
That is deliberate: it preserves scroll position and the React Query cache across tab switches.
The consequence is that any hook you add inside `SliceFeedPanel` runs six times on load.

**So sidebar and shell data hooks are hoisted to `AppShell` and passed down as props.**
`useCompassData` and `useRepresentatives` are called once there, and `Sidebar` /
`SidebarMobile` receive `compassData`, `repsData` and `activeTab`. Follow that pattern; do not
call a shared hook inside a panel.

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
| service | `internalUserId` in `services/slice-assignment/src/middleware/verifyToken.ts` |
| database | `civic_spaces.current_user_id()` — 21 RLS policies across 9 tables call it |

All three are `external_id` first, then `sub`. Change them together. An unlinked WorkOS
account (no `external_id`) resolves to its own WorkOS sub, matches nothing, and sees
nothing — fail-closed by design.

This broke production on 2026-09-02: a WorkOS member queried
`user_id=eq.user_01M14T3W1R72ZQM70KRXH4K5E8`, matched zero rows, and sat on "Setting up
your civic spaces…" forever, because an empty membership list is indistinguishable from a
new account and `useEnsureSlices` kept retrying.

**Both verifiers need the WorkOS issuer registered, or a WorkOS token is a 401:**
- `services/slice-assignment` needs `WORKOS_ISSUER` and `WORKOS_JWKS_URL` alongside the
  existing `ACCOUNTS_ISSUER` / `ACCOUNTS_JWKS_URL`. Defaults follow the WorkOS docs:
  `https://api.workos.com/user_management/<WORKOS_CLIENT_ID>` and
  `https://api.workos.com/sso/jwks/<WORKOS_CLIENT_ID>`. Take the client id from the
  `ev-accounts-api` Render env — it is not in the local accounts `.env`.
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

- **Dark mode is class-based.** `index.html` sets the `dark` class before first paint from
  `localStorage['ev:color-scheme']`, falling back to the system preference. `useTheme()` reads
  and toggles it. Never define a colour only inside a `dark:` variant — write the light value
  and the `dark:` counterpart together, every time.
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
wouter · TanStack Query · motion · recharts (Compass radar) · `@supabase/supabase-js` ·
`react-modal-sheet` · `sonner` · `@empoweredvote/ev-ui`.

## Planning

This repo uses the GSD workflow in `.planning/` — `ROADMAP.md` at the top, then
`phases/NN-name/` with `NN-RESEARCH.md`, `NN-MM-PLAN.md` and `NN-VERIFICATION.md`. Phases 1–13
are shipped (v1.0 forum, v2.0 all slices, v3.0 UI redesign). Read the relevant phase's
research doc before changing an area — it usually records why something is the way it is.
