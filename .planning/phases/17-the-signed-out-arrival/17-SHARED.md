# Phase 17: The Signed-Out Arrival — shared plan context

**Read this once before 17-01, and keep it to hand.** The seven plan files reference it
rather than repeating it: the execution order, the coverage matrix, the phase boundary and
the constraints every task inherits live here and nowhere else.

Each plan still repeats the two or three constraints that are sharpest for its own work,
inline, at the point where they bite. That duplication is deliberate — this file is the
canonical list, not a substitute for a warning next to the thing it warns about.

**The phase in one line:** *anyone may look anywhere; only your own slices accept your
voice.*

---

## 🔴 The phase boundary, which is also a one-way door

`17-CONTEXT.md` D-22 splits what used to be one phase. **Phase 17 is the reversible half.**

| In this phase | In Phase 18 — The Public Square |
|---|---|
| The welcome screen | Schema `USAGE` and column grants for `anon` |
| Place entry and shell-level place navigation | `get_public_feed`, the four RLS policies |
| `isViewOnly` rewritten to fail closed; `canWriteIn()` | Realtime gating |
| Explore / banner / sidebar / officials for a visited place | `scripts/check-anon-read.mjs` and its must-fail list |
| The ev-accounts handoff for `POST /api/civic-spaces/resolve` | The `display_name` exposure decision (D-24) |
| `CLAUDE.md` + `LocationPrompt.tsx` per D-14 | The `CLAUDE.md` "members-only by design" correction |

🔴 **No plan in this phase touches `supabase/migrations/`.** Not a policy, not a grant, not
a function. If a task appears to need one, you have crossed the seam — stop, and say so in
the plan rather than writing it. Every endpoint Phase 17 ships against is **already**
anonymous today: `/essentials/location-search`, `/essentials/coordinate-lookup`,
`/essentials/browse/by-area`, meetings, elections, compass topics, and the committed
gazetteer in `public/geo/`.

🔴 **A consequence that decides a lot of copy: in Phase 17, conversations are still
members-only.** Every `civic_spaces` grant is `TO authenticated`, so an observer reads zero
forum rows, and `posts_select_sibling_slice` requires `geoid` equality, so a *signed-in
member* reads zero rows in another city too. **Both of those are the same state and both are
Phase 18's to change.**

So: **every word this phase ships must be true on the day it ships.** Do not write copy
that promises public conversations, and do not render a conversations feed for a visited
place — an empty feed returned by RLS reads as "nobody has said anything here", which is a
lie told silently. 17-05 builds the honest state instead. One paragraph of welcome-screen
copy and one empty state are Phase 18's to revise; both are named in `17-VALIDATION.md`
under "Known gaps" so the next phase can find them.

---

## The plan set

Seven plans. **Execute them strictly in order, 01 → 07. Do not parallelise any of them.**

`.planning/config.json` has `"parallelization": true`, which is right for most phases and
wrong for this one: 17-02, 17-04, 17-05 and 17-06 all edit `AppShell.tsx`, and 17-02 and
17-06 both edit `scripts/check-explore-gate.mjs`. Two agents in those files at once drops
hunks in the exact places where a dropped hunk is a dropped gate. The "Depends on" line in
each plan names its *logical* prerequisite; the *execution* order is serial regardless.

| Plan | What lands | Logical prerequisite | Spine files it edits |
|---|---|---|---|
| **17-01** | Reaching the signed-out app at all, and the write predicate | — | `useAuth.ts`, `lib/writeAccess.ts` (new) |
| **17-02** | The gate fails closed; the notices learn why | 17-01 | `AppShell.tsx`, `ViewOnlyNotice.tsx`, `SliceFeedPanel.tsx`, `devMockData.ts`, `check-explore-gate.mjs` |
| **17-03** | Resolving a place with no account — and the rule that narrows | 17-01 | `lib/placeResolve.ts`, `lib/viewedPlace.ts`, `hooks/usePlaceSearch.ts` (all new), `CLAUDE.md`, `LocationPrompt.tsx` |
| **17-04** | The welcome screen, and a named place on screen | 17-03 | `WelcomeScreen.tsx`, `PlacePicker.tsx` (new), `AppShell.tsx` |
| **17-05** | The second entry point, and what must **not** follow a place | 17-04 | `AppShell.tsx`, `NavSidebar.tsx`, `check-place-entry.mjs` (new) |
| **17-06** | Officials, the sidebar and Explore for a visited place | 17-05 | `AppShell.tsx`, `hooks/usePlaceRepresentatives.ts` (new), `registry.tsx`, `check-explore-gate.mjs`, `check-explore-rooms.mjs` |

🔴 **17-04 carries `viewedPlace` and `onScreenSlices` as well as the screen, deliberately.**
A picker that sets a state nothing reads is a control that looks live and does nothing —
the exact failure `check:explore-rooms` was written to catch in Phase 16. So the plan that
ships the picker also ships the thing it changes. 17-05 then adds the *second* entry point
(D-19) and audits the four places research Q3.4 says the shell conflates "on screen" with
"mine".
| **17-07** | The four-way visual pass and the phase gate | all | `scripts/shoot-welcome.mjs` (new) |

### Cross-plan dependencies that are easy to miss and are not optional

- 🔴 **17-01 creates `?signedout=1`. Nothing before it can see a signed-out screen at all.**
  `useAuth.ts:219-225` enters dev-guest mode unconditionally when `VITE_SUPABASE_URL` is
  absent, so on a fresh clone dropping `?dev=1` does **not** sign you out. This is the gap
  `16-VALIDATION.md` recorded as "the signed-out presentation is not reachable on a fresh
  clone", and in Phase 16 it was a tolerable blind spot. In this phase the signed-out screen
  **is the deliverable**, so it is a Wave 0 blocker, not a gap.
- 🔴 **17-02 adds the `signed-out` and `no-slice` cases to `check-explore-gate.mjs`;
  17-06 adds `other-place` and re-points the `signed-out` case** at the welcome screen's
  place view, which does not exist until 17-05. Both edit the same script. 17-02 first.
- **17-02 adds a no-city dev fixture (`?dev=1&place=arden`); 17-05 and 17-06 both rely on
  it.** An unincorporated address is a real, common answer — ev-accounts states it
  outright: *"`city` is null for unincorporated addresses. That is an answer, not a
  failure."* Today no fixture exercises it, so the `activeSlice`-is-undefined branch at
  `AppShell.tsx:1283` is unreachable in dev and unverifiable.
- **17-04 creates `PlacePicker`; 17-05 mounts the same component as the shell control.**
  One mechanism, two entry points (D-19). Not two components.
- **17-03 creates `scripts/fixtures/place-search-*.json`; 17-05's browser check serves them
  through Playwright route interception.** Capture them from the live API in 17-03 and
  commit them, or 17-05's check is network-bound and non-deterministic.
- 🔴 **17-06 changes a predicate that `check-explore-rooms.mjs` quotes in its failure text.**
  `scripts/check-explore-rooms.mjs:471-476` tells a future debugger that
  `seed-invitation`'s `available()` is `isUnseeded && !!placeName`. The assertion stays
  green (the dev guest passes the new terms) and the sentence goes stale silently — which is
  worse, because it is the first thing read when that assertion ever does fail. 17-06 Task 1
  Step 1b updates it.

---

## 🔴 The three viewer states, and the two predicates that tell them apart

This is the phase's core model. Get it wrong and everything downstream is wrong.

| State | Can read conversations? | Can write? | Shipped |
|---|---|---|---|
| **Own shard** — the member's own `slices[tab]` | yes | **yes** | today |
| **Sibling shard** — same `(slice_type, geoid)`, different `sibling_index` | yes, via `posts_select_sibling_slice` | no | Phase 16 |
| **Another place** — a different `geoid`, or no account at all | **no, until Phase 18** | no | this phase |

Two pure predicates in `src/lib/writeAccess.ts` (17-01), and they are **not** the same
question:

- `canWriteIn(viewed, ownedSliceIds)` — collapses sibling shard and another place and
  signed out and Inform-tier into one `false`. Fails **closed**.
- `canReadConversationsIn(viewed, ownedPlaceKeys)` — true for the own shard **and** the
  sibling shard (both share `(slice_type, geoid)`), false for another place. 🔴 Phase 18
  changes this function's body to `true` and nothing else changes. That is the seam.

The line being replaced, `AppShell.tsx:840`:

```ts
const activeIsViewOnly = !!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id
```

It **fails open**: with no `activeSlice` the whole expression is `false` — "not gated" — so
the composer, the FAB and the reply box are offered to someone RLS can only refuse. It was
written when the only non-writable state was *a sibling of a slice you hold*, where absence
of a slice meant "no tab", not "a tab you cannot write in". It is the single highest-risk
line in the phase.

---

## Coverage — every source item, and the plan that carries it

Nothing in the four source documents is dropped. Where an item belongs to Phase 18 the row
says so; nothing is silently deferred.

| Source | Item | Plan |
|---|---|---|
| CONTEXT **D-01** | Inform / Guest observe only | 17-01, 17-02 |
| CONTEXT **D-02** | Connect posts, votes, contributes from public anonymity | 17-04 (copy), 17-05 |
| CONTEXT **D-03** | Empowered trades the handle for transparency | 17-04 (copy only — the tier is not built) |
| CONTEXT **D-04** | Treat Inform as untrusted, equal to a guest | 17-01 — `whyNoWrite()` has **no tier term**: an Inform account holds no `slice_members` rows, so it lands in the guest branch by construction |
| CONTEXT **D-05** | A public town square, not 4chan | 17-04 |
| CONTEXT **D-06** | A dedicated welcome screen | 17-04 |
| CONTEXT **D-07** | Observation covers Explore **and** conversations | 17-05, 17-06 ship the Explore half. 🔴 **The conversations half is Phase 18** — see the boundary above |
| CONTEXT **D-08** | Fully public and scrapable | **Phase 18.** 17-04's copy must not promise it (D-25) |
| CONTEXT **D-09** | The generic blank Explore goes | 17-04 (the welcome screen replaces it), 17-05 (a real place or the welcome screen — never a placeless shell) |
| CONTEXT **D-10** | Neutral copy until it is theirs | 17-04, 17-05, 17-06 |
| CONTEXT **D-11** | Say what they cannot do, and that it is *yet* | 17-02 (the notices), 17-04, 17-05 (the conversations state) |
| CONTEXT **D-12** | Both paths, address first | 17-03 builds both; the place-name path ships, the address path lands behind one env var. 17-04 is the entry UI |
| CONTEXT **D-13** | Never store it, never show it back | 17-03 (the module + the pure check), 17-05 (the browser storage assertion) |
| CONTEXT **D-14** | This narrows a standing rule rather than ignoring it | 17-03, as two explicit tasks |
| CONTEXT **D-15** | The privacy pitch is in scope | 17-04 |
| CONTEXT **D-16** | What the pitch says | 17-04 |
| CONTEXT **D-17** | Do not oversell — *private*, never *anonymous* | 17-04, re-read aloud in 17-07 |
| CONTEXT **D-18** | Observation is the expected default, for everyone | 17-05 — one mechanism serving both viewers |
| CONTEXT **D-19** | Slice hopping is NOT guest-only | 17-04 (welcome entry point) + 17-05 (shell entry point), **one component** |
| CONTEXT **D-20** | Connect posts only in their own slices | 17-01, 17-02, 17-06 |
| CONTEXT **D-21** | Empowered reach is the exception — leave the seam | 17-01: the gate is **one exported pure function**, consumed everywhere, never written inline at a call site |
| CONTEXT **D-22** | The phase splits at the one-way door | this file; every plan's **Out of Scope** |
| CONTEXT **D-23** | Build now; "parked until November" does not block | recorded, no task |
| CONTEXT **D-24** | The display-name exposure is sized and accepted | **Phase 18** |
| CONTEXT **D-25** | Crawlable ≠ indexed; the copy must not overclaim | 17-04, re-read in 17-07 |
| ROADMAP scope | Welcome screen copy follows `empowered-vote-primer.md` § The Three Pillars | 17-04 |
| ROADMAP scope | Place entry, both paths; place-name is CORS-clean and ships today | 17-03, 17-04 |
| ROADMAP scope | 🔴 `isViewOnly` fails open; rewrite fail-closed | 17-02 |
| ROADMAP scope | `viewingSlices` cannot represent another place | 17-05 — a separate `viewedPlace`, never an overloaded `SiblingSlice` |
| ROADMAP scope | Add the observer and non-member-place cases to `check:explore-gate` | 17-02 (two cases), 17-06 (two more) — **extend, never fork** |
| ROADMAP scope | Extract a `canWriteIn()` predicate as D-21's seam | 17-01 |
| ROADMAP scope | Explore, banner, sidebar and representatives for a visited place | 17-05, 17-06 |
| ROADMAP scope | `CLAUDE.md` and `LocationPrompt.tsx` updated per D-14 | 17-03 |
| ROADMAP scope | The ev-accounts handoff for `POST /api/civic-spaces/resolve` | 17-03 |
| RESEARCH Q1.1 | The Census Geocoder has **no CORS** — a browser `fetch()` cannot use it | 17-03 (why the address path is a server ask) |
| RESEARCH Q1.3 | Every geocoder failure is a `200` with zero matches, including for real addresses | 17-03 |
| RESEARCH Q1.5 | `/essentials/address-search` is **rejected** — two D-13 violations | 17-03, named as rejected so nobody finds it later |
| RESEARCH Q1.6 | The place-name path is fully solvable today, CORS-clean | 17-03 |
| RESEARCH Q1.7 | `POST /api/civic-spaces/resolve`, modelled on `essentialsCoordinateLookup.ts` | 17-03 (the handoff) |
| RESEARCH Q1.8 | D-13 honestly: no persistence ✓, no echo ✓, no EV logging ✓, census.gov sees it | 17-03, 17-04 (the pitch must not grow into "never leaves your browser") |
| RESEARCH Q2 | The whole anon read surface | **Phase 18** |
| RESEARCH Q3.1 | `useAllSlices` is membership-first and never runs for an observer | 17-05 |
| RESEARCH Q3.2 | `federal` = `'US'` and `unified` = `'UNIFIED'` are literals, free | 17-05 |
| RESEARCH Q3.3 | 🔴 The unseeded place is the **common** case — 15 slice rows exist in the product | 17-05 (the honest state), 17-06 (the `seed-invitation` guard) |
| RESEARCH Q3.4 | The four places the shell conflates "on screen" with "mine" | 17-02 (item 1), 17-05 (items 3, 4), 17-06 (officials) |
| RESEARCH Q3.5 | `SliceSelector` is the wrong home — two axes, one menu | 17-05 |
| RESEARCH Q3.6 | Where "one author, one slice" is baked in; only the UI gate is ours | 17-01 |
| RESEARCH Q4 | The `display_name` exposure | **Phase 18** |
| RESEARCH Q5 | The canonical pillar language, quoted verbatim from the primer | 17-04 |
| RESEARCH Q6 | Split at the one-way door | this file |
| RESEARCH Pitfall 1 | The gate fails open for exactly the new case | 17-01, 17-02 |
| RESEARCH Pitfall 2 | Shipping half the gate, again | 17-02, 17-06 |
| RESEARCH Pitfall 6 | Treating the geocoder's `200` as success | 17-03 |
| RESEARCH Pitfall 7 | Testing a cross-origin endpoint in Node and concluding it works | 17-03 |
| RESEARCH Pitfall 8 | "No slice row" handled as an error | 17-05 |
| RESEARCH Pitfall 9 | `useRepresentatives` silently following the viewed place | 17-06 |
| RESEARCH Pitfall 10 | Unguarded storage | 17-01, 17-03 |
| RESEARCH Pitfall 11 | Promising search-engine visibility | 17-04 |
| RESEARCH Pattern 1 | Derive the write gate once, fail closed, in a pure module | 17-01 |
| RESEARCH Pattern 4 | The resolver mirroring an existing privacy contract | 17-03 (the handoff) |
| RESEARCH Security V5 | Length-cap, trim and reject HTML in the place/address input | 17-03 |
| RESEARCH Security V13 | Rate-limit the new anonymous endpoint | 17-03 (handoff — ev-accounts' side) |
| Verification bar | All five lines | 17-07, collected in `17-VALIDATION.md` |

**Items deliberately absent, and why.** The shared-link arrival stays deferred — CONTEXT
says re-examine it *only because D-08 may change the answer*, and D-08 is Phase 18; the
`cs_pending_post` stash at `AppShell.tsx:799` must keep working unchanged and 17-04 is
explicit about that. The storage-blocked boot failure (`useAuth.ts:100`) stays as item 9 of
`16-explore-by-slice/deferred-items.md` — this phase must not add a **second** instance of
it, which is why every new storage access is `try`/`catch`-wrapped. `cursor: default` on 196
controls stays item 6. Handles stay deferred, and the exposure that made that urgent is
D-24, which is Phase 18's first task.

---

## Global Constraints

Copied from `CLAUDE.md`, `17-CONTEXT.md` and `17-RESEARCH.md`. Every task in **every** plan
of this phase implicitly includes these; they are repeated in each plan file so no plan has
to be read with another open.

- 🔴 **No migration, no grant, no policy.** See the boundary above. This phase is
  frontend-plus-documents.
- 🔴 **No new npm packages.** The research confirmed none are needed, and reached for one is
  a signal the plan has drifted: the platform's geocoding rule is Census + NAD, never Google,
  and both are HTTP services, not libraries.
- **There is no frontend test framework.** No test script, no test files. `npm run build`
  (`tsc -b && vite build`) is the entire automated safety net, plus purpose-built `.mjs`
  checks in `scripts/`. **Do not add vitest.** "It compiles" is not verification.
- 🔴 **Every check you write must be made to fail before you believe it.** Break the real
  source, watch the assertion go red, put it back. Phase 16 hit the vacuous-pass failure
  class five or more times — a check that has never failed has not been verified.
  `17-VALIDATION.md` lists the shapes it takes.
- 🔴 **Every commit leaves the build green.** No task in this phase commits a red `tsc -b`.
  Where a change would break consumers, add the new API **alongside** the old and let a
  later task move consumers and delete the old in one commit.
- 🔴 **`tsc -b`, never plain `tsc`.** The root `tsconfig.json` is a solution file
  (`"files": []` + `references`). A new `tsconfig.*.json` must be added to `references`.
- 🔴 `tsconfig.app.json` sets **`noUncheckedIndexedAccess`**, **`noUnusedLocals`** and
  **`noUnusedParameters`**. Every `record[key]` yields `T | undefined` and must be guarded.
- 🔴 **Never call a shared data hook inside `SliceFeedPanel`.** All five feed panels plus
  Volunteer mount at once and inactive ones are hidden with CSS, so a hook there fires 6×.
  Hoist to `AppShell` — `useRepresentatives` and `useCompassData` are the pattern. Where a
  hook needs per-tab data, render its component only for the active tab (`SliceSelector`) or
  wrap it so the hook still runs unconditionally (`ActiveHeroBanner`).
- 🔴 **Gate the feed, the thread, AND Explore.** The repo shipped exactly half of this kind
  of gate once already. `scripts/check-explore-gate.mjs` holds 21 assertions pinning the
  existing gate — **extend it; do not write a second script for the same subject.**
- 🔴 **This app never stores a location, and now geocodes for observers only.** D-14 narrows
  the rule; D-13's "never stores" half survives intact and is load-bearing. The resolved
  **geoids** may be held for the session; the typed string never is, never reaches
  `localStorage`, and is never rendered back.
- 🔴 **Every storage access is `try`/`catch`-wrapped**, the way `resolveDevPlace()` in
  `devMockData.ts` does it. A private window throws, and the privacy-minded visitor this
  phase is written for is the one most likely to be in one.
- **Every Supabase call is `.schema('civic_spaces')`.** This phase adds none.
- **Every colour needs its light and `dark:` counterpart written together.** Dark mode is
  class-based and dark is the default; a `dark:`-only colour is a bug. Light text is
  `gray-900 / 600 / 500`; `gray-400` is decoration only. In dark use `gray-400`, never
  `gray-500`.
- 🔴 **Tailwind v4 emits `oklch()`.** A contrast probe must `fillRect` + `getImageData` a
  single pixel. Setting `ctx.fillStyle` and reading it back hands you the `oklch()` string,
  which an `rgb()` parse turns into confident nonsense — a ratio near 1:1 for legible text.
- 🔴 **Playwright's `colorScheme` option does nothing in this app.** `index.html` reads the
  `ev_color_scheme` cookie before first paint and ignores `prefers-color-scheme`. Set the
  cookie on the context **and assert `documentElement.classList.contains('dark')` matches
  what you asked for**, or a four-way run is silently a two-way run.
- 🔴 **Playwright is a GLOBAL install, not a dependency.** `node_modules` is the wrong place
  to look. Resolve via `npm root -g` and import as `mod.chromium ?? mod.default?.chromium`
  — the global package's export shape differs between its CJS and ESM entry points.
  `scripts/check-explore-gate.mjs:98-118` is the pattern to copy.
- **A change is done only when it looks right in all four of** light desktop, dark desktop,
  light mobile, dark mobile. A clean screenshot run only proves the PNGs decoded — **look
  at the images.**
- **Hit-test, do not merely render.** `document.elementFromPoint()` at a control's centre is
  the only thing that catches a control that renders perfectly and cannot be clicked. PR #92
  shipped exactly that, at `md` and up only, so phones looked fine and every screenshot
  passed. When you fix one, **toggle the suspect class off mid-run and re-test** — a fix
  that is load-bearing puts the bug straight back.
- **Use EV brand tokens** (teal `#00657C` / `brand`, button `brand-btn`, hover `brand-hover`,
  tint `brand-muted`, light `brand-light`, coral `#FF5740` / `brand-coral`, coral text
  `brand-coral-text`, yellow `#FED12E`). Reuse `WidgetCard` for anything sidebar-shaped, the
  Explore vocabulary in `exploreUi.tsx` (`CARD`, `PrimaryButton`, `SecondaryButton`,
  `SectionHeader`), `react-loading-skeleton` matching `FeedSkeleton`, and `motion/react` for
  animation. Do not invent a third loading style.
- 🔴 **Never invent civic record, and never invent a place.** An address or a name that does
  not resolve produces the honest empty state and stops — never a guess, never a nearby
  fallback. Treasury Tracker resolving an unknown slug to Bloomington, IN's budget is the
  precedent: a real answer for the wrong place is worse than no answer.
- **Windows, PowerShell / Git Bash, no Python.** Every check is a committed `.mjs` file run
  with `node`. Never an inline `node -e`.
- **Branch from `origin/main` after `git fetch`.** This phase's branch is
  `feat/signed-out-arrival`. `main` requires a passing `build` and one approving review; a PR
  whose files are *all* `.planning/**` or `*.md` auto-approves, and `.github/**` never does.
- **Commit after every task.** Each plan is independently committable and leaves the app
  shippable.
