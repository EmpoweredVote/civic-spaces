# Phase 17: The Signed-Out Arrival

> **This file is the PR body, written but not opened.** 17-07's executor was asked to stop
> before `gh pr create`; opening the PR, pushing the branch and merging are Chris's. Paste
> this as the description when you open it, or `gh pr create --body-file` it.
>
> Branch `feat/signed-out-arrival`, 42 commits, 61 files. Closes the Phase 17 scope in
> `.planning/ROADMAP.md`.

**Anyone may look anywhere; only your own slices accept your voice.**

Today a guest gets one grey sentence — *"Log in to view your civic community."* — and then
580 words of Explore that call a place they have never been *your community*. This replaces
that with a welcome screen that says what Civic Spaces is and which wall the reader is
standing at, and with a place-entry mechanism that opens **any** city, town or county's
civic space — its agenda, its officials, its calendar, its next election — with no account
at all.

---

## 🔴 `supabase/migrations/` is untouched, and that is the point

Not a policy, not a grant, not a function. `git diff --name-only origin/main...HEAD | grep
supabase/migrations` returns nothing.

Phase 17 is deliberately the **reversible** half of the original scope. It ships entirely
against endpoints that were already anonymous — `/essentials/location-search`,
`/essentials/coordinate-lookup`, `/essentials/browse/by-area`, meetings, elections, compass
topics — plus the committed gazetteer in `public/geo/`. If any of it is wrong, it is a
revert.

**Phase 18 — The Public Square — is the one-way door**: schema `USAGE` and column grants for
`anon`, `get_public_feed`, four RLS policies, Realtime gating, and the `display_name`
exposure decision. Once the PostgREST endpoint is publicly queryable it cannot be made
private again, so it is split off and sized separately.

### The consequence that decides a lot of the copy

**In Phase 17, conversations are still members-only.** Every `civic_spaces` grant is `TO
authenticated`, and `posts_select_sibling_slice` joins on `geoid` — so an observer reads
zero forum rows, and so does a *signed-in member* looking at another city. Both are the same
state and both are Phase 18's to change.

So a visited place gets an honest state instead of a feed:

> **Conversations here belong to the people who live here**
> Posting, replying and voting in a civic space belong to the people who live under that
> government.
> For most places nobody has joined yet — these spaces open as people arrive. An Empowered
> Vote account with an address set opens the ones where you live, and you can be the first
> voice in them.

An empty feed returned by RLS would have rendered as *"nobody has said anything here"* — a
false statement delivered silently, about a real jurisdiction. That is the single thing this
phase most carefully does not do.

🔴 **Every word shipped here is true on the day it ships.** Nothing claims conversations are
public, open or readable by anyone; nothing says *anonymous* or *untraceable* (the honest
claim is **private from other members** — there is a paper trail, and it is how mis- and
disinformation sources are identified); nothing implies a post will be findable or indexed
(no SSR, no prerender, no `robots.txt`, one static set of `og:` tags — and even after Phase
18 the exposure is the **PostgREST endpoint**, not these pages); and the address claim is
*geocoded once and never kept*, never *"your address never leaves your browser"*, because
census.gov sees the address on every path and the member path has the same property.

The one paragraph and one empty state Phase 18 must revise are marked in source so that
phase can grep rather than re-read:

```
grep -rn "PHASE 18" src/
  src/components/WelcomeScreen.tsx:200   the conversations paragraph
  src/components/AppShell.tsx:1803       the visited-place conversations card
  src/lib/writeAccess.ts:168             the seam — canReadConversationsIn's body becomes true
```

---

## The four reasons a write is refused, and that `check:explore-gate` now pins all four

The line this replaces, `AppShell.tsx:840`:

```ts
const activeIsViewOnly = !!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id
```

🔴 **It fails open.** With no `activeSlice` the whole expression is `false` — *"not gated"* —
so the composer, the FAB and the reply box were offered to someone RLS can only refuse. It
was written when the only non-writable state was *a sibling of a slice you hold*, where
absence of a slice meant "no tab" rather than "a tab you cannot write in". This phase adds a
third state — another place entirely — where absence of a slice is the **common** case.

It is now one exported pure function in an import-free `src/lib/writeAccess.ts`, so
`node --experimental-strip-types` runs the **shipped** code rather than a transcription:

| reason | who | what the notice says |
|---|---|---|
| `signed-out` | a visitor, **and an Inform account** | *"…belong to the people who live under that government. An Empowered Vote account with an address set opens your own civic spaces."* + Sign in |
| `no-slice` | a member with no slice at that level — an unincorporated address has no city space | *"You have no community at this level… that is an answer, not an error"* + check your address |
| `other-place` | a member looking at a city they are not in | *"You're looking at a place you're not a member of"* + Back to my spaces |
| `sibling-shard` | Phase 16's case, readable and not writable | *"You're browsing Slice N read-only"* + Switch back |

🔴 **There is no `tier` term and there must never be one.** An Inform account holds no
`slice_members` rows, so it lands in the guest branch *by construction* — D-04 is satisfied
by the data rather than by a rule someone has to remember to write, and therefore by a rule
nobody can later delete. Adding `if (tier === 'inform')` turns nothing in the check green or
red, which is the demonstration.

🔴 **Gate the feed, the thread AND Explore.** `CLAUDE.md` records this repo shipping exactly
half of this kind of gate once already. `check:explore-gate` now runs **four viewers × 56
assertions** across all three surfaces, each with its control case — without the control
case ("the affordances ARE present on the member's own shard") every other assertion is
vacuous.

---

## What this adds

- **A welcome screen** quoting the primer rather than inventing a vocabulary: *"We don't
  need to know who you are. We need to be sure that **each person has exactly one voice** —
  and lives where they claim."* 🔴 Both walls are named, because "make an account" is only
  the first: Civic Spaces needs the **Connected** tier, and Connected means an address has
  been set. An Inform account passes sign-in and lands on the no-jurisdiction empty state.
  And the ceiling is on screen before anything is pressed — *"You cannot post here **yet** —
  that is what an account is for."*
- **One `PlacePicker`, two entry points.** The welcome screen mounts `size="hero"`; a
  `PlaceStrip` under the banner mounts `size="compact"`. One mechanism, not two features —
  slice hopping is not guest-only, and a signed-in member can look at another city and get
  back.
- **A visited place gets its own everything**: five tabs, its hero banner, its calendar, and
  **its own officials** via the public by-area endpoint — not the viewer's.
- **The address is structurally unable to escape.** `ResolvedPlace` has **no name field at
  all**, so a call site could not render the typed string by accident; the display name is
  looked up *from the geoid*. Only geoids reach `sessionStorage`, every access is
  `try`/`catch`-wrapped, and the picker clears on success so the string does not survive the
  interaction it was typed for.
- `CLAUDE.md` and `LocationPrompt.tsx` updated per D-14: the **never stores** half survives
  whole; only **never geocodes** narrows, for observers, who have no profile to put an
  address in.

---

## Data this needs from the API

🔴 **One endpoint, and it does not exist yet: `POST /api/civic-spaces/resolve`** (ev-accounts).
Specified in full in [`phases/17-the-signed-out-arrival/ACCOUNTS-HANDOFF.md`](.planning/phases/17-the-signed-out-arrival/ACCOUNTS-HANDOFF.md),
modelled line-for-line on `essentialsCoordinateLookup.ts`.

It must be a **body-only POST**. Three obvious alternatives were probed live on 2026-10-26
and all three are rejected, which is why the handoff names them:

| Tempting | Why not |
|---|---|
| `GET /api/essentials/address-search?address=…` | Public and one call, and it breaks the no-echo rule twice: the address is in the **query string**, which Render's access log records, and `matchedAddress` comes **back** in the response |
| Browser `fetch()` to `geocoding.geo.census.gov` | **No CORS** — reproduced in real Chromium from the real origin. 🔴 Node's `fetch` does not enforce CORS, so every Node probe passes and the browser still fails |
| JSONP to the same host | Executes third-party script in our origin, reproduces only the first geocoder with none of ev-accounts' NAD fallbacks, and still puts the address in a query string |

**The client is already written, typed and covered by pure checks over a fixture response.**
It is gated behind **`VITE_PLACE_RESOLVE_URL`** — deliberately **not**
`VITE_SLICE_ASSIGNMENT_URL`, because the two point at the same ev-accounts base and one
switch would turn the address path on for every deployment that had configured assignment.
Unset, **no address input renders at all** — not a disabled one, not a "coming soon", because
a control that promises a path that cannot run is the dead-control failure
`check:explore-rooms` exists to catch.

When the endpoint lands it is one env var and a re-run of `check:place-resolve --live`.

### ⚠️ What Chris needs to do, because nobody else can

1. 🔴 **Add `VITE_PLACE_RESOLVE_URL=` to `.env.example`.** A global deny rule blocks that
   file from every agent session that has needed it, including this one — so it is still
   missing, and `CLAUDE.md` carries a ⚠️ saying so. `origin/main` has since touched
   `.env.example` (#126), so check whether that already did it; if so, drop the ⚠️ from
   `CLAUDE.md` in the same commit.
2. **Sync `main` into the branch before asking for review.** 🔴 An approval stops counting
   after any push, *including* a `main`-sync. `origin/main` moved `1096e7a → 1fe663e` while
   this branch was being built (#123, #124, #125, #126). A real trial merge in a throwaway
   worktree is **clean** — no conflicts; `CLAUDE.md` and `src/hooks/useSiblingSlices.ts`
   auto-merge, and the sentinel bail and #126's comment update both survive. (`git
   merge-tree` lies about conflicts on git 2.52 — that result is from an actual merge.)
3. **Walk production after merge.** `main` deploys in ~3 minutes and there is no deploy
   workflow in the repo; verify by a cache-busted asset hash, then walk the arrival signed
   out, both themes, phone and desktop. 🔴 That is the only place the real `photoUrl`/credit
   precedence and real sibling shards exist, and `?signedout=1` does not exist there — which
   is fine, because signing out on production is simply signing out.

---

## How it was checked

🔴 **There is no frontend test framework.** `npm run build` plus purpose-built committed
`.mjs` checks is the whole safety net. Everything below is committed; nothing lives in a
scratchpad.

```
npm run build                               ✓
npm run check:write-access                  19 PASS, 0 FAIL      pure, over the shipped module
npm run check:place-resolve                 42 PASS, 0 FAIL      pure, over committed fixtures
npm run check:composition                   62 PASS, 0 FAIL      unchanged by this phase
npm run check:agenda-topics                 13 PASS, 0 FAIL      unchanged by this phase
npm run check:place-entry      -- --port    20 PASS, 0 FAIL      browser
npm run check:explore-gate     -- --port    56 PASS, 0 FAIL      browser, four viewers
npm run check:explore-rooms    -- --port    21 PASS, 0 FAIL      browser
check-place-resolve.mjs --live --origin     42 PASS, 0 LIVE DRIFT  network: ev-accounts contract
npm run check:banners                       232/232 match        network: licence attribution
npm run shoot:welcome -- --audit            24 cells, 106 images; 140 PASS, 0 FAIL
```

🔴 **Three SKIPs, named, because a SKIP is not a pass.** `check:explore-gate` FEDERAL #8
(no device-local control exists in Federal's composition — the same assertion runs green on
City) and MEMBER-NO-SLICE #3 (AppShell re-points the active tab onto a slice the member
holds, so the branch cannot be held on screen; the reason is covered in layer 1 by
`check:write-access` 4 and 5). `shoot:welcome --audit` skips the officials roster at 390,
where it lives inside the collapsed `SidebarMobile` disclosure.

### 🔴 Every check was made to fail before it was believed

`17-VALIDATION.md` lists eight shapes of "a check that passes without exercising anything",
because Phase 16 hit that class five or more times. Every plan in this phase ends in a
revert matrix: break the real source, watch the predicted assertion go red, restore. Three
of 17-05's predicted pairings turned out to be **green over a broken app**, and three of
17-06's named the **wrong assertion** — all six found by running the revert rather than by
reasoning about it, and all six written down.

17-07's own matrix found two holes in its own new check: a hit-test that accepted a control
covered by a transparent **ancestor** (which is precisely the PR #92 shape it exists to
catch — proved both ways: with the permissive clause, PASS; without it, FAIL), and a revert
that **killed** the run instead of failing it, which is 17-06's `readNotOverGated` finding
reproduced exactly. Both closed.

### The four-way pass

24 cells — six presentations × light/dark × 1440×1000 and 390×844 — **opened and looked
at**, not merely written. A clean screenshot run only proves the PNGs decoded.

🔴 **The theme is asserted on `documentElement.classList` before every image and encoded in
the filename.** Playwright's `colorScheme` option does nothing in this app: `index.html`
reads the `ev_color_scheme` cookie before first paint and ignores `prefers-color-scheme`. An
unasserted run silently produces 24 dark images and reports a four-way pass. Dropping the
cookie was run as a revert; every light walk refuses rather than shooting.

Contrast is resolved by **`fillRect` + `getImageData` on one pixel**, with alpha recovered
by painting each colour over black and over white, and the backdrop composited from every
ancestor — because half this app's surfaces are translucent. Reading `ctx.fillStyle` back is
**not** resolving it: Chromium returns the `oklch()` string and an `rgb()` parse of
`0.446 0.03 256.802` reports ~1:1 for perfectly legible text. Lowest real reading: 6.16:1
against a 3:1 floor for an icon, 6.82:1 against 4.5:1 for text.

### The one line no script can answer

Whether the officials are the *right people*. Read by a human, on City **and** on Federal:

| | roster |
|---|---|
| own spaces, Bloomington IN | Kerry Thomson *City Mayor*, Efrat Rosser, Dorothy Granger, Sydney Zulich |
| visiting Asheville · City | Esther E. Manheimer *Mayor*, Bo Hess, Maggie Ullman, Kim Roney, Sheneika Smith, Sage Turner, S. Antanette Mosley |
| visiting Asheville · Federal | Ted Budd *Senator*, Thom Tillis *Senator*, **Chuck Edwards** *U.S. Representative* |
| back on own spaces | the Bloomington roster again |

Asheville's own mayor and council, **North Carolina's** senators and NC-11's representative
— the district Asheville sits in — and not Indiana's. Changes on entry, changes back on
leaving.

---

## Known, deliberate, and written down

Full detail in [`phases/17-the-signed-out-arrival/deferred-items.md`](.planning/phases/17-the-signed-out-arrival/deferred-items.md)
and `17-VALIDATION.md` § Known gaps.

- 🔴 **A member who enters their OWN place from the strip is gated as a sibling shard** —
  *"You're exploring Slice **—** read-only"*, with an em-dash where the number should be, and
  the honest conversations state telling a resident the conversations are not theirs. It
  fails **closed**, so nothing unsafe is offered; it is the opposite error, over-gating.
  Needs a product decision (don't enter at all vs enter-but-don't-gate) before a fix, and a
  **seventh** `check:explore-gate` viewer after it. Item 4.
- The ~40 conversation-starter **questions** still use the second person at a visited place
  — *"What should get built in **your** city, and where?"*. Deferred on purpose: they are
  data with no `ctx` where they are authored, `check-composition` keys fixtures off their
  titles, and the second person is what makes a starter an invitation rather than a survey
  item. A call about the product's voice. Item 3. The one **statement** on the wrong side of
  that boundary — the featured product update, *"A better way to discover **your**
  community"* — was fixed here, and `CLAIMS_THE_PLACE` widened in the same commit, never
  before.
- `@supabase/supabase-js` constructs a `RealtimeClient` at module scope whose `Socket`
  touches `sessionStorage` unguarded, so a storage-blocked boot dies before any of our code
  runs — every route, every environment, signed in or out. Not introduced here and not fixed
  here; item 1, with the captured stack. Our own new storage is guarded and proved so.
- App-wide and unowned: `cursor: default` on 196 of 416 controls; `useAuth.ts:100`.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
