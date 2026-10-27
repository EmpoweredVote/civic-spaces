# Phase 17: The Signed-Out Arrival — Validation

**Written:** 2026-10-26
**Companion docs:** `17-CONTEXT.md` (the 25 locked decisions), `17-RESEARCH.md` (the
Validation Architecture section this collects), `17-SHARED.md` (the phase boundary, the
execution order, the coverage matrix and the constraints every plan inherits).

This is the one place that answers *"how do we know?"* for Phase 17. Every claim the phase
makes is listed here with the thing that checks it and the plan that builds that thing. If a
row has no check, it says so and says why.

---

## The repo's constraint, stated once

🔴 **There is no frontend test framework.** No test script, no test files, no vitest, no
jest. `npm run build` (`tsc -b && vite build`) is the entire automated safety net, and
`CLAUDE.md` is explicit that this is the state of the world rather than an oversight.

Phase 17 validates in four layers, in descending order of how much they prove:

| Layer | What it is | What it proves |
|---|---|---|
| **1. Pure checks** | `node --experimental-strip-types` against the **real** `src/lib/*.ts` | Logic. The write gate and the place rules both live in import-free modules precisely so this layer can reach them. |
| **2. Browser checks** | Playwright against `?dev=1` and `?signedout=1`, with the API stubbed from committed fixtures | Behaviour that only exists in a running page: the gate, storage, the network, hit-testability. |
| **3. Typecheck** | `npm run build` | Shapes and call sites. Necessary, never sufficient. |
| **4. Looked-at screenshots** | `scripts/shoot-welcome.mjs` + a human | The four-way design standard, and whether the copy reads. A clean run only proves the PNGs decoded. |

**Deliberately not added: a test framework.** Introducing one inside a feature phase makes
the phase about the test framework. Every check below is a `scripts/` entry alongside the
seven that already exist.

**Everything is committed.** No check lives in a scratchpad. A check only its author can
re-run is not a check; it is a memory.

---

## 🔴 The failure class this repo keeps hitting: a check that passes without exercising anything

Phase 16 hit this five or more times, and every one was found in review rather than by the
check itself. When writing or reviewing **any** check in this phase, ask what would have to
be true for it to pass while the feature is broken.

Phase 17 is worse than Phase 16 for this, because **almost every assertion in it is about an
absence** — no composer, nothing stored, no request. All of those are true of a blank page.

| Shape | Where it bites in this phase | Guard |
|---|---|---|
| **The page under test never loaded** | an observer's "zero textareas" is true of a place that never resolved | assert the hero **named the place** and Explore rendered a non-empty module list, first (17-06 Task 3 Step 2) |
| **The control was never there to hide** | "no composer on the City tab" for a fixture that has no City tab | the control case, stated **per viewer**, and inverted explicitly where it has to be (17-02 Task 4 Step 2) |
| **A control exists only after an interaction** | the Imagine textarea is inside `{option && …}` and the persisted default is `null` | click a radio first — the existing script's click, reused, not re-derived (17-06 Task 3 Step 1) |
| **The branch is unreachable in the fixture** | no dev fixture lacked a slice, so the `no-slice` branch could not be observed | the `arden` fixture (17-02 Task 2) |
| **The assertion reads the tester's own input back** | the D-13 "not echoed" check sees the text still sitting in the picker | clear the input first, and use a nonsense token that cannot collide (17-05 Task 3 Step 3) |
| **The absence is enforced by a different mechanism than the one under test** | "no PostgREST request" passes because the user never got that far | assert the positive half too: at least one request happened, and `coordinate-lookup` fired **exactly once** (17-05 Task 3 Step 4) |
| **A `try`/`catch` that was never exercised** | the storage guards | actually throw from `Storage.prototype` via `addInitScript` — ⚠️ **scoped to `sessionStorage` keys beginning `cs_`**, which is exactly the set this phase added; a wholesale throw cannot be asked of a browser (17-05 Task 3, assertion 12, and the correction in Known gaps below) |
| **A stale fixture** | the browser check is green against an API shape that changed | `check-place-resolve.mjs --live` exits non-zero on drift (17-03 Task 4 Step 4) |
| **A contrast probe that reports nonsense** | reading `ctx.fillStyle` back returns the `oklch()` string | `fillRect` + `getImageData` one pixel (17-07 Task 3 Step 1) |
| **A "four-way" run that is two-way** | Playwright's `colorScheme` does nothing here | set the `ev_color_scheme` cookie **and assert `documentElement.classList`** every time |
| **The check never failed** | all of the above | 🔴 **prove it, per gate, one at a time** — every plan ends in a revert matrix |

🔴 **Every plan in this phase has a "Prove each gate separately" step, and it is not
optional.** Break the real source, watch the predicted assertion go red, restore, move on,
and record the matrix in the commit body. A check that has never failed has not been
verified.

Three of those reverts are expected to turn **nothing** red. Those are findings, not
oversights, and each plan says so in place:

| Revert | Why nothing goes red | Where it is recorded |
|---|---|---|
| adding a `tier === 'inform'` term to `whyNoWrite` | D-04 already holds by construction — an Inform account has no `slice_members` rows, so there is no consequence to observe, and the absence of one is the demonstration | 17-01 Task 3 Step 3 |

🔴 **That is the only one, and an earlier draft of this phase claimed three.** The other two
were conceded too early and are now assertions:

| Was conceded | Why the concession was wrong | Now covered by |
|---|---|---|
| leaving the per-tab feed gate as the old expression | it was routed to "`check:write-access` and a later visited-place run". Neither reaches it: the first exercises the function and never the call site, and 17-04 guards the whole `FEED_TABS.map` off while visiting, so no visited-place run renders a feed panel at all | the feed surface's notice-reason assertion on the existing `member-sibling-shard` viewer — 17-02 Task 4 Step 1b |
| pointing `repsData` at the member's own officials while visiting | *"no check can tell one real person's name from another's"* — true, and irrelevant. The revert is a **wrong source**, and a source is observable in a request body | 17-06 Task 3b, assertions 1–3; the human read in 17-07 Task 4 keeps **correctness**, which is a different question |

### 🔴 Three rows turned nothing red when they were actually run — 17-05

Added after the fact, because this is the shape the section above is about and the plan
predicting the pairing is not the same as observing it. Each of these was a **green check
over a broken app**, and each was found by running the revert rather than by reasoning about
it. 17-01's report had already mispaired a revert with an assertion number and sent the next
executor hunting a hole that did not exist; these are the opposite error — holes that did
exist behind predictions that read as reassuring.

| Revert | Predicted | Actually observed | What was wrong, and what closed it |
|---|---|---|---|
| storing the picker's raw query beside the geoids | D-13 assertion 1 | **nothing** | The check typed its tracer token FIRST and replaced it with "asheville" before choosing a row, so the string the picker held at the moment of choice was never the tracer. The tracer is now typed **second** and is the query in the box when the row is chosen. Row 1 then goes red on `D13-1` alone, as predicted |
| removing the conversations panel's `!isVisitingPlace` guard | the network assertion **and** assertion 3 | **assertion 3 only** | The conversations feed is `supabase.rpc('get_boosted_feed_filtered')` — a POST whose slice id is in the JSON **body** — so the single most important request in the phase was invisible to a query-string check. The network assertion now records request bodies and walks every string in the parsed JSON; the revert takes assertion 3 and **both** network assertions down together |
| `enterPlace` not clearing `activePostIds` | assertion 9 | **nothing** | Assertion 9 goes through `openPost` and says nothing about `enterPlace`. Closed by a new assertion `9b`, which starts from the state 9 leaves behind — the member's own thread open, no place on screen — enters a place, and asserts the thread AND the URL close |

**The rule this leaves behind:** *"no check can see this"* is a conclusion to reach **after**
looking for an observable consequence, not instead of looking. A reason that must be
computed to be displayed is observable; so is a request body, and so is a request count.

### 🔴 And three of 17-06's seven predicted pairings were wrong — all three in the other direction

17-05's three rows were *predicted red, observed green*. 17-06's are a different shape:
**the assertion the plan credited was the wrong assertion**, so the matrix would have read
as confirmation while the thing it named proved nothing. Each was found by running the
revert, never by reasoning about it.

| Revert | 17-06 predicted | Actually observed | Why the prediction was wrong |
|---|---|---|---|
| `repsData` left as `ownReps` while visiting | Step 3b assertions **1 and 2**, "and 4 when the network is up" | **assertion 14 alone** (`member-other-place #14`), deterministically | `usePlaceRepresentatives` fires for the visited place whether or not `AppShell` **passes** its result to the sidebar, so the by-area POST still carries `3702140` and assertion 1 (now 10) stays green. Only what the SIDEBAR RENDERS changes. The plan had conceded that half as uncheckable — "no script can tell one real person's name from another's" — which is true and irrelevant: by-area is now stubbed with a roster whose names encode the `geo_id` asked for, so the source is a string comparison with no network in it, and 17-07's human read keeps **correctness**, which is a different question |
| `usePlaceRepresentatives` called inside `SliceFeedPanel` | assertion **3** — "six `by-area` requests instead of one"; 17-VALIDATION called it *"the first assertion in the repo to pin this rule"* | assertions **10 and 13**, with **ZERO** requests after entry, not six | 🔴 **TanStack Query dedupes by `queryKey`**, so six components calling one hook with one key make ONE fetch — and since 17-04 **no feed panel mounts at a visited place at all**, so the hook fires zero times there. What actually goes red is the *caching* consequence: the panel's copy warms the cache at boot, so nothing is requested when the place is entered. 🔴 **The six-panel rule is still unpinned for a hook with a stable key, and the row in Known gaps claiming otherwise is withdrawn.** It remains enforced by the pattern and by review |
| the `isViewOnly` guard on `ImagineActivity`'s textarea | textareas on City-bearing viewers **only** | **nothing** (56 PASS, 0 FAIL) | Defence in depth, and the plan counted one layer. `ImagineModule` passes **no `onIdeaChange` handler at all** while view-only, so `{!isViewOnly && onIdeaChange && …}` has a second gate behind it and reverting either alone changes nothing — the same shape `check-explore-gate` assertion 14's own comment records for `ReplyCard`'s `canWrite`/`onReply` pair. 🔴 **This is not a hole: removing BOTH halves goes red on 3 and 5 across City, signed-out and member-other-place, and Federal stays green as predicted.** Run as a second revert rather than left as a concession |

Two more things the matrix turned up that are not pairings at all:

- 🔴 **`readNotOverGated` crashed the run instead of failing it.** Hiding "Save on this
  device" — the over-gating that assertion exists to catch — made every locator in it time
  out, and the unguarded throw killed the whole process: no FAIL line, no summary, no sign
  of which viewer had got that far. Guarded now, **and the `<dialog>` it opened is closed on
  the way out**, because leaving it open made the *next, unrelated* click time out several
  assertions later and point at the wrong thing entirely.
- **Assertion 12 (`/representatives/me` is not the live source) is structurally vacuous in
  this harness and is kept anyway.** The dev id is synthetic, so `useRepresentatives`
  short-circuits to `fetchDevRepresentatives` and never calls that endpoint at all, before
  or after the trip. It pins the production path and costs one line; the script says so
  where a reader will hit it rather than letting it read as a gate that caught something.

---

## Commands

| Command | Added by | Needs | Runtime |
|---|---|---|---|
| `npm run build` | existing | — | ~20 s |
| `npm run check:write-access` | 17-01 (**19**, not the 18 the plans predicted) | — | < 1 s |
| `npm run check:place-resolve` | 17-03 | committed fixtures, no network | < 1 s |
| `node scripts/check-place-resolve.mjs --live` | 17-03 | **network** | ~5 s |
| `npm run check:place-entry` | 17-05 (20) | `npm run dev` running | ~2 min |
| `npm run check:explore-gate` | existing; **extended** by 17-02, 17-04, 17-06 | `npm run dev` running | ~4 min at **four** viewers (56 assertions). 🔴 Four, not six — `observer-with-a-place` IS the `signed-out` viewer since 17-04 re-pointed it; see the script header |
| `npm run check:composition` | existing (62) | — | < 1 s |
| `npm run check:explore-rooms` | existing; **its failure text** touched and **assertion 21 added** by 17-06 | `npm run dev` running | ~90 s |
| `npm run check:agenda-topics` | existing | committed fixture | < 1 s |
| `npm run shoot:welcome` | 17-07 — **24 cells, 106 images** (one full-page strip per cell plus viewport frames, `shoot-explore`'s convention) | `npm run dev` running | ~3 min |
| `npm run shoot:welcome -- --audit` | 17-07 — the same run plus **144** contrast, hit-test and reduced-motion assertions. `--audit-only` skips the images | `npm run dev` running | ~1 min on its own |
| `npm run check:banners` | existing | **network** | ~2 min |

🔴 **Every one of these takes `-- --port <n>`, and 17-07 needed it.** Port 5173 was already
occupied by another dev server when the gate ran, Vite moved to 5174 without being asked,
and `check-place-resolve.mjs --live` defaults to **5173** — so it reported `LIVE ERROR fetch
failed` against a server that was not this checkout. `--origin http://localhost:<n>` for
that one, `--port <n>` for the rest. A live check pointed at the wrong port looks exactly
like contract drift.

Playwright is a **global install, not a dependency** — `node_modules` is the wrong place to
look. Every script resolves it the way `scripts/check-explore-gate.mjs:98-118` does:
`'playwright'`, then `npm root -g`, reading `mod.chromium ?? mod.default?.chromium`, because
the global install's export shape differs between its CJS and ESM entry points.

**No new check needs a credential.** That is deliberate and it is new for the signed-out
half: `?signedout=1` (17-01) makes the visitor state reachable without one, and the place
API is stubbed from committed fixtures. The two network commands are opt-in and are about
*other people's* contracts drifting, not about this phase's behaviour.

🔴 **Verifying the deploy: use a CONTENT TRACER, never a hash comparison.** The note in
memory says to check production by its cache-busted asset hash, and against a *previous
production* hash that is right. Against a **local** `dist/` hash it is not: production
builds in CI with different env (`VITE_SUPABASE_URL` and friends are set there and unset
here), so the bundles differ by content and therefore by hash even when the deploy has
landed perfectly. Doing it that way on 2026-10-27 read as *"production still serves the
old bundle"* when production had in fact already deployed, within ~2 minutes of the merge.

What works is a string only the new code can contain. Fetch `index.html` cache-busted,
pull the `assets/index-*.js` path out of it, fetch that, and grep for the tracer — for
#128 it was `lives where they claim`, confirmed first with `git log -S` to be absent from
the pre-merge tree. A tracer that predates the merge proves nothing, so check that before
you trust the answer.

### Sampling rate

- **Per task commit:** `npm run build`.
- **Per plan:** `npm run build` plus whichever checks that plan touched, **plus its revert
  matrix**.
- **Phase gate (17-07):** everything above green, every SKIP named, 24 screenshots **looked
  at**, contrast through a canvas, hit-tests at both viewports in both themes, and the copy
  read out loud.

---

## The verification bar, and what checks each line

Five lines, derived from `ROADMAP.md` § Phase 17 and `17-CONTEXT.md`. These are the phase's
acceptance criteria.

### 1. A signed-out visitor understands what this is, what an account is for, and which wall they are at — and never sees a placeless shell

| Check | Layer | Where |
|---|---|---|
| The signed-out state is reachable at all on localhost | 2 | 17-01 Task 1 — 🔴 without this, nothing in this row can be checked, and `16-VALIDATION.md` had already recorded it as a gap |
| The welcome screen renders signed out, and the `geoid: null` Explore is gone | 2 | `check:place-entry` 2 |
| The screen reads well in light + dark × desktop + mobile | 4 | `shoot:welcome` presentations 1–3; 17-07 Task 2 |
| The place picker is above the fold at 390×844 | 4 | 17-07 Task 2 Step 1 |
| Chris's line is on screen close to verbatim, **including "lives where they claim"** | human | 17-07 Task 2 Step 3 |
| 🔴 The copy claims nothing that is false today — no public conversations, no search, no *anonymous*, no "never leaves your browser" | human | 17-07 Task 2 Step 2, against D-25, D-17, D-16 and the phase boundary |
| Both walls are named — an account **and** an address | human | same step. An Inform account passes sign-in and lands on the no-jurisdiction state |
| Contrast ≥ 4.5:1 for text, ≥ 3:1 for meaningful icons, in both themes | 2 | 17-07 Task 3 Step 1, through a canvas |
| Every control is reachable by click at 1440 **and** 390, and by keyboard alone | 2 | `check:place-entry` 10 and 11; 17-07 Task 3 Step 2 |

### 2. Anyone — signed in or out — can name a place and see its Explore, banner, officials and calendar

| Check | Layer | Where |
|---|---|---|
| A search row resolves to the right geoids; 7/5/2-digit rows branch correctly; `G4110` **and** `G4120` are both places | 1 | `check:place-resolve` |
| 🔴 "No results" is an answer with a way forward, never a nearest match | 1 + 2 | `check:place-resolve` (the empty fixture); `check:place-entry` 7 |
| The tabs, banner and Explore follow the visited place | 2 | `check:place-entry` 1 |
| 🔴 An **unincorporated** place yields four tabs and reads as an answer, not an error | 2 | `check:place-entry` 6, on the `arden` fixture |
| 🔴 A place with **no slice row** — the common case at 15 rows in the whole product — shows the honest state and never an empty feed | 2 | `check:place-entry` 3 |
| `coordinate-lookup` fires **exactly once** per chosen place, never in the typeahead | 2 | `check:place-entry` 4 |
| 🔴 **No PostgREST request carries the visited geoid — from *any* of the four surfaces** | 2 | `check:place-entry`'s network assertion. Three surfaces query for the slice on screen (`FEED_TABS.map`, `ActiveHeroBanner`, `ActiveSliceSelector`), and the last two sit in the sticky tab bar **outside** the feed map. Both defences are needed: `useSiblingSlices` bails on the sentinel (returning **empty**, never `getMockSiblings`), and the selector and search are render-guarded |
| 🔴 **The banner states no member count it does not have** | 4 | `HeroBanner.memberCount` widens to `number \| null` and the stat is omitted (17-04 Step 5b). A sentinel slice would otherwise have rendered "0 members in this slice" about a real jurisdiction. Confirmed absent, not zero, in 17-07's presentations 4 and 6 |
| The place survives a reload and does not outlive the window | 2 | `check:place-entry` 4 and 5 |
| A signed-in member can enter a place from the shell and get back | 2 | `check:place-entry` 8 |
| A notification or `/post/` link clears the place and opens the member's own thread | 2 | `check:place-entry` 9 |
| 🔴 **Officials are the visited place's, not the viewer's** | **human** | 17-07 Task 4. No script can tell one real person's name from another's — 17-06 Task 4 names this gap deliberately rather than papering it |
| The place's banner is the right photo with the right credit | 1 + human | `check:banners` for drift; 17-07 Task 2 for the look |
| The ev-accounts endpoint shapes have not drifted under the fixtures | 2 | `check-place-resolve.mjs --live` |

### 3. No write is offered anywhere a write cannot land

The phase's highest-risk line, and the one `CLAUDE.md` records this repo getting half-right
once already.

| Check | Layer | Where |
|---|---|---|
| The predicate itself, over all four reasons, failing closed | 1 | `check:write-access`, 18 assertions |
| `canWriteIn` and `whyNoWrite` cannot drift apart | 1 | the loop over the whole table, `check:write-access` |
| 🔴 A sibling shard stays **readable** — the Phase 16 behaviour — while the place case does not | 1 | `check:write-access` 13, which goes red on its own if the read predicate is keyed on a slice id |
| Signed out: no write offered, feed **and** thread **and** Explore | 2 | `check:explore-gate`, viewer `signed-out` |
| A member with no slice for a tab: no write offered | 1 + 2 | `check:write-access` 5; `check:explore-gate`, viewer `member-no-slice` |
| A member visiting another place: no write offered | 2 | `check:explore-gate`, viewer `member-other-place` |
| An observer visiting a place: no write offered | 2 | `check:explore-gate`, viewer `observer-with-a-place` |
| **The control case** — the affordances **are** present on the member's own shard | 2 | `check:explore-gate` assertion 1, per viewer. Without it the rest are vacuous |
| 🔴 **Not over-gated** — device-local controls still work at a visited place | 2 | `check:explore-gate` assertion 8, extended by 17-06. A dead page fails D-18 from the other direction |
| The notice says **which** of the four reasons, and carries a way out | 2 | `check:explore-gate`, the notice-reason assertions on every viewer |
| The seed invitation does not open for someone who could not seed | 2 | `check:explore-gate`, viewers 5 and 6 |
| Each gate fails **independently** | 2 | every plan's revert matrix; 17-06 Task 4 is the widest |
| RLS as the backstop | — | unchanged. Every write path is closed and `slice_members` has no INSERT/UPDATE/DELETE policy at all. The bug was always the UI offering what the database refuses |

### 4. The address is never stored, never echoed, never logged by us

| Check | Layer | Where |
|---|---|---|
| 🔴 `ResolvedPlace` has exactly five keys and **no name field** — structurally unable to carry the input | 1 | `check:place-resolve`, the `Object.keys` assertion, which fails naming D-13 |
| Nothing resembling the input is in `localStorage` or `sessionStorage` after a lookup | 2 | `check:place-entry` D-13 assertion 1 |
| Nothing resembling the input is in the rendered text | 2 | `check:place-entry` D-13 assertion 2, with the picker's own input cleared first |
| The stored value is geoids only, and a corrupt one is dropped rather than thrown on | 1 | `check:place-resolve`, the round-trip group |
| 🔴 The address path is body-only, never a query string, never echoed, never logged | — | **Not ours to check.** The endpoint does not exist; `ACCOUNTS-HANDOFF.md` specifies the contract and names `/essentials/address-search`'s two violations so it is not proposed back |
| 🔴 The honest caveat: **census.gov sees the address regardless** | human | 17-07 Task 2 Step 2. D-16's claim is *geocoded once and never kept* and must not grow into *never leaves your browser* |
| Storage blocked throws nothing | 2 | `check:place-entry` 12, with `Storage.prototype` actually overridden to throw — ⚠️ **for `sessionStorage` keys beginning `cs_` only.** That is the whole set this phase added (`cs_viewed_place`, `cs_signed_out`, `cs_dev_place`), so the claim it supports is *"every new access is guarded"* and not *"the app survives blocked storage"*, which it does not. See the two rows in Known gaps |

### 5. Light + dark, desktop + mobile all check out

| Check | Layer | Where |
|---|---|---|
| 24 shots across six presentations, two themes, two viewports | 4 | `shoot:welcome`, 17-07 Task 1 |
| 🔴 **The images are opened and looked at** | human | 17-07 Task 2 — a clean run only proves they decoded |
| The theme asked for is the theme rendered | 2 | asserted on `documentElement.classList` before every shot and in every browser check |
| Contrast resolved **through a canvas**, with `fillRect` + `getImageData` | 2 | 17-07 Task 3 Step 1 |
| Every primary control hit-tested at **both** viewports and in **both** themes | 2 | 17-07 Task 3 Step 2; `check:place-entry` 10 |
| `prefers-reduced-motion` respected | 2 | 17-07 Task 3 Step 3 |
| No `dark:`-only colour anywhere new | human | 17-07 Task 2 Step 1 |

---

## The gate, walked — 17-07's answers, 2026-10-26

Written **after** the walk, from what was on screen, not from what the plans predicted.
Where an answer is qualified, the qualification is the finding.

**The suite, in one run, against a dev server on port 5174** (5173 was occupied by another
process; see the note under Commands):

```
npm run build                               ✓ tsc -b + vite build
npm run check:write-access                  19 PASS, 0 FAIL
npm run check:place-resolve                 42 PASS, 0 FAIL
npm run check:composition                   62 PASS, 0 FAIL
npm run check:agenda-topics                 13 PASS, 0 FAIL
npm run check:place-entry      -- --port    20 PASS, 0 FAIL
npm run check:explore-gate     -- --port    56 PASS, 0 FAIL, 2 SKIP (both named below)
npm run check:explore-rooms    -- --port    21 PASS, 0 FAIL
check-place-resolve.mjs --live --origin     42 PASS, 0 FAIL, 0 LIVE DRIFT
npm run check:banners                       all 232 banners match (not 227 — the library grew)
npm run shoot:welcome -- --audit            24 cells, 106 images; 144 PASS, 0 FAIL, 2 SKIP
```

**🔴 Every SKIP, by name, with what it does not cover** — `16-VALIDATION.md`'s rule, which
this phase inherits:

| SKIP | What is not covered | Is that all right? |
|---|---|---|
| `check:explore-gate` **FEDERAL #8** — *"Save on this device / Imagine radios — City/County only, by composition"* | the not-over-gated assertion on the Federal tab | Yes, and it is structural: `imagine` and `nearby` are not in Federal's composition, so there is no device-local control there to be over-gated. The same assertion runs green on City. |
| `check:explore-gate` **MEMBER-NO-SLICE #3** — *"assertions 2–5 on a tab with no slice"* | the no-composer assertions on a tab the member holds no slice for | Yes, and the script says why in place: `cs_active_tab` is planted as `city` and AppShell's "keep the active tab on a slice the member actually has" effect moves it to `county`, so the branch cannot be HELD on screen. The reason itself is covered in layer 1 by `check:write-access` 4 and 5. ⚠️ The plan's brief expected **one** SKIP in this script; there are **two**, and the Federal one is the older of them. |
| `shoot:welcome --audit` **officials light-390 / dark-390** | the officials roster read at mobile width | Yes — below `md` the roster lives inside the **collapsed** `SidebarMobile` disclosure, so its absence from `innerText` is a fact about a closed `<details>` and not about the officials. Read at 1440, where it is open. |

### 1. A signed-out visitor gets the welcome screen, and never a placeless Explore — **yes**

`?signedout=1` lands on `[data-welcome-screen]` in all four presentations;
`check:place-entry` 2 pins that the welcome screen is REPLACED by the real shell with no
`geoid: null` Explore in between, and 5 pins that a fresh window with no stored place lands
back on it. The picker is above the fold at **390×844** with the whole card and its help
line visible — measured, not eyeballed: input top 512, bottom 568, viewport 844.

### 2. Anyone can name a place and see its Explore, banner, officials and calendar — **yes, including a place with no slice row** — and the officials are **the visited place's**

Asheville has no `slices` row and renders the full place view: banner, five tabs, seven
Explore modules, upcoming elections, officials. 🔴 **The banner states no member count** —
confirmed ABSENT, not zero, in presentations 4 and 6: the stats read *Pop. 94.6K · 8 days ·
49°F*, and nothing about members.

🔴 **The officials half, read by a human on City and on Federal, which is the one line no
script covers:**

| | roster |
|---|---|
| the member's own spaces, Bloomington IN | Kerry Thomson *City Mayor*, Efrat Rosser *Bloomington Township Trustee*, Dorothy Granger *Township Board*, Sydney Zulich *City Common Council* |
| visiting Asheville · **City** | Esther E. Manheimer *Mayor*, Bo Hess, Maggie Ullman, Kim Roney, Sheneika Smith, Sage Turner, S. Antanette Mosley — *Council Members* |
| visiting Asheville · **Federal** | Donald J. Trump, J.D. Vance, **Ted Budd** *Senator*, **Thom Tillis** *Senator*, **Chuck Edwards** *U.S. Representative* |
| back on own spaces | Kerry Thomson *City Mayor*, … — the Bloomington roster again |

Those are Asheville's mayor and council, **North Carolina's** two senators and NC-11's
representative — the district Asheville sits in — and not Indiana's. The roster changes on
entry and changes back on leaving. ✅ **17-06 Task 4 named this gap; this is where it is
closed.**

### 3. No write is offered where a write cannot land — **yes for the four reasons the phase names; one state is over-gated instead**

`check:explore-gate`'s four viewers cover `signed-out`, `no-slice`, `other-place` and
`sibling-shard` across feed, thread and Explore, each with its control case, and
`check:place-entry` 3 and 14 add the conversations surface and the two slice-scoped
controls at a visited place. Read by eye in all 24 cells: no composer, no FAB, no Post
button, no reply box, and a notice naming the reason with a way out on every one.

🔴 **The qualification is the opposite failure, and it is new**: a member who enters **their
own** place from the strip is gated as a sibling shard. Item 4 of `deferred-items.md` and a
Known-gaps row above. Nothing unsafe is offered — it fails closed — but a resident is told
the conversations are not theirs.

### 4. The address is never stored, never echoed, never logged by us — **yes**

`check:place-resolve` 37–42 (the five-key `Object.keys` assertion, every parser, the round
trip, the corrupt value) and `check:place-entry` D13-1 and D13-2 with a tracer token typed
**second**, so it is the string in the box at the moment of choice. Read by eye: the picker
clears on success and every place name on screen is resolved from a geoid. 🔴 The honest
caveat holds in the copy — "geocoded **once**… and then it is gone: not stored, not shown
back to you, and not in any profile Civic Spaces holds", which scopes every clause to Civic
Spaces and never grows into *"never leaves your browser"*.

### 5. Light + dark, desktop + mobile all check out — **yes**

24 cells **opened and looked at**, not just written: all four presentations of the welcome
screen, the picker open and the picker empty-handed, the visited place on Explore and on
Conversations, and a member visiting. Zero horizontal overflow at 390 in any cell, zero
uncaught page errors, and the theme asserted on `documentElement.classList` before every
one of the 106 images. Contrast through a canvas: **144 PASS**, lowest reading 6.16:1
against a 3:1 floor for an icon and 6.82:1 against 4.5:1 for text. Every primary control
hit-tested at 1440 and 390 in both themes. Nothing animates under
`prefers-reduced-motion`, with the media query itself asserted first.

---

## The anti-goals, and what stops each

These make the work a failure even if it ships and functions.

| Anti-goal | What stops it | Layer |
|---|---|---|
| **A write offered where RLS can only refuse** | `whyNoWrite` failing closed; `check:explore-gate` across six viewers with its control case; RLS as the backstop | 1 + 2 |
| **A post landing in the wrong jurisdiction** | `canPostDraft(key, slices)` stays on the member's **own** slices — audited and commented in 17-04 Task 4 — plus `check:composition` 16–21 | 1 + human |
| 🔴 **An empty feed read as "nobody has said anything here"** | the conversations panel is guarded off for a visited place **in the same commit** that introduces `onScreenSlices`; `check:place-entry` 3 and the network assertion | 2 |
| 🔴 **A confident false fact about a jurisdiction nobody here holds** — "0 members in this slice", "This is the only slice in Portland so far" | 17-04 Step 5: the sentinel bail in `useSiblingSlices`, the render guards on the shard selector and the feed search, and the omitted member count | 2 + 4 |
| 🔴 **Fixture conversations shown as a real place's** | the sentinel bail returns **empty**, never `getMockSiblings`; and `'preview-guest'` is deleted rather than adopted, because `isSyntheticUserId` is the switch behind every fixture fallback in the app | structural |
| **A stranger shown a place as if it were theirs** | D-10: the welcome screen names no place; every place-scoped string is resolved from a geoid the visitor chose; `ActiveLocationCard` is hidden while visiting | human + 2 |
| **A placeless shell** | D-09: the `geoid: null` `ExploreView` is deleted in 17-04; a visitor sees a real place or the welcome screen | 2 |
| **A control that looks live and does nothing** | the address input does not render until `VITE_PLACE_RESOLVE_URL` is set; the picker ships in the same plan as the state it changes; `check:explore-rooms` stays green | 2 |
| **Over-gating — another place's Explore as a dead page** | `check:explore-gate` assertion 8, extended to visited places | 2 |
| **Copy that is true only after Phase 18** | the boxed note in 17-04; the out-loud read in 17-07 Task 2 against D-25, D-17, D-16 and the boundary | human |
| **The member roster, or "who lives where", reachable without a session** | `MemberDirectory` and Friends gated at their entry points; `slice_members` gets no `anon` anything in this phase because this phase writes no migration | 2 + structural |
| **A second instance of the storage-blocked boot bug** | every new storage access guarded; `check:place-entry` 12 throws from `Storage.prototype` to prove it, **scoped to `sessionStorage` keys beginning `cs_`** — which is every key this phase added | 2 |

---

## Wave 0 — what had to exist before anything could be checked

| Gap | Closed by | Why it mattered |
|---|---|---|
| 🔴 **A way for a committed check to be signed out** | 17-01 Task 1 (`?signedout=1`) | `useAuth` enters dev-guest mode unconditionally with no `VITE_SUPABASE_URL`, so on a fresh clone dropping `?dev=1` does not sign you out. ⚠️ On a machine with a `.env.local` the branch *is* reachable by hand — which is why this is still Wave 0 rather than why it is not: a check that passes only on machines carrying somebody's `.env.local` is a memory, not a check |
| **A pure, import-free module Node can run** | 17-01 Task 2 (`src/lib/writeAccess.ts`) | Otherwise every logic check tests a transcription, and a copy-test passes while the shipped code is wrong — `exploreComposition.ts`'s own header says so |
| 🔴 **A fixture with no slice for a level** | 17-02 Task 2 (`?dev=1&place=arden`) | No dev fixture lacked a slice, so the `no-slice` branch was unreachable and "no composer found" would have been a true statement about a tab that never had one. It is also a real answer: ev-accounts states that `city` is null for unincorporated addresses |
| **Committed API fixtures** | 17-03 Task 4 | A browser check bound to a live API is non-deterministic and offline-hostile; a fixture branch inside the app would be fake data shipped to production to serve a test |
| **Pure place rules** | 17-03 Task 1 (`src/lib/placeResolve.ts`) | The geoid derivation and both parsers are where the silent failures are — every geocoder failure is a `200` |
| **A viewer axis in `check:explore-gate`** | 17-02 Task 4 | The script was parameterised by tab only; an observer is a third viewer for that check, not a second check |

---

## Known gaps — things this phase does not check, and why

Stated rather than hidden. Each is a judgement, not an oversight.

| Gap | Why | Mitigation |
|---|---|---|
| 🔴 **Conversations for a visited place are not readable, so there is nothing to check.** The welcome screen's conversations paragraph and the visited-place conversations state are **Phase 18's to revise.** | Every `civic_spaces` grant is `TO authenticated` and `posts_select_sibling_slice` joins on `geoid`. D-22 put the one-way door in Phase 18. | ✅ **Confirmed present by 17-07, with the grep token and the line numbers, so Phase 18 opens three files and reads nothing else.** `grep -rn "PHASE 18" src/` returns exactly four hits in three files: **`WelcomeScreen.tsx:200`** (*"Conversations are for members right now, and reading them needs an account too"* — TRUE today and false the day the migration lands); **`AppShell.tsx:1803`** (the visited-place conversations card, *"For most places nobody has joined yet"*, deliberately worded so it is true whether or not a `slices` row exists, **because Phase 17 cannot tell the two apart and Phase 18 can**); and **`writeAccess.ts:168`**, which is not copy at all but the seam — `canReadConversationsIn`'s body becomes `true` and nothing else changes. |
| **Whether the officials are the *right people* is human-verified.** Their **source** is not a gap. | A script can prove the request carried the visited geoid and that `/representatives/me` was not consulted; it cannot know who represents Asheville. | Source: 17-06 Task 3b assertions 1–3, deterministic. Change-on-entry: assertion 4, which needs the live endpoint and **SKIPs loudly** rather than passing when a set is empty. Correctness: the human read in 17-07 Task 4, on City and on Federal. |
| **The address path is unverifiable end to end.** | `POST /api/civic-spaces/resolve` does not exist. | The client is written, typed, and covered by pure checks over a fixture response; `PLACE_RESOLVE_ENABLED` is false so no dead control ships; `ACCOUNTS-HANDOFF.md` is the ask. When it lands it is one env var and a re-run of `check:place-resolve --live`. |
| **The signed-in production pass** — real `photoUrl` / credit precedence, real sibling shards, a real Compass token. | Needs a pasted `cs_token`; localhost has no login, because `useAuth.ts` hardcodes the accounts-hub redirect to `civicspaces.empowered.vote`. | `scripts/shoot-app.mjs` (17-07 Task 5 Step 4). The same place Phases 15 and 16 left theirs. ✅ **The SIGNED-OUT half was walked on production 2026-10-27, straight after #128 merged as `5ccfe91`** — dark/1440 and light/390, against live ev-accounts rather than fixtures. The picker returned real rows (`Asheville, NC · City`, `Asherville, KS · City`, `Blytheville, AR · City`); entering Asheville gave the strip, the `signed-out` notice, the real banner credited *Bill McMannis · CC BY 2.0* and the real roster; **no address input rendered**, confirming `VITE_PLACE_RESOLVE_URL` is unset in production; and `cs_viewed_place` held `{"city":"3702140","county":"37021","state":"37","nation":"US","unified":"UNIFIED"}` — **geoids only, no name, no typed string, so D-13 is confirmed on production and not merely in a check.** Zero page errors in either run. ⏳ **The SIGNED-IN half is still open** and is the only part left: `photoUrl`/credit precedence and real sibling shards need a `cs_token` pasted from a logged-in production tab. Phase 16’s walk is outstanding too; they are one sitting. Delete `.auth-token.local` afterwards. 🔴 **`?signedout=1` does not exist on production**, which is fine — a fresh context with no `cs_token` simply IS a visitor there. |
| 🔴 **The six-panel hoisting rule is pinned NOWHERE, and this row's earlier claim is WITHDRAWN.** | A lint rule would be the right tool and this phase adds no tooling. | ⚠️ **This row used to say 17-06's "exactly one by-area request" assertion pinned it — "moving `usePlaceRepresentatives` into `SliceFeedPanel` shows six and goes red … the first assertion in the repo to pin this rule at all".** 17-06 ran that revert and it is not true, for two independent reasons: **TanStack Query dedupes by `queryKey`**, so six components calling one hook with one key make ONE fetch; and since 17-04 **no feed panel mounts at a visited place at all**, so the hook fires ZERO times there. The revert does go red (`member-other-place` 10 and 13) but on a *caching* consequence — the panel's copy warms the cache at boot — not on a count of six. The assertion is kept for what it does catch: an unstable query key, and a refetch loop. For a shared hook with a stable key the rule is **genuinely unobservable in the network**, and it stays enforced by the pattern and by review. ✅ **17-07 re-read this row and leaves it exactly as 17-06 rewrote it.** The withdrawal stands; nothing in this phase pins the rule, and `useToolCoverage` is still defined with no caller, which is the standing reminder of what the pattern asks for. |
| **Place-name search quality is not checked.** | It is ev-accounts' ranking, not ours. The fixtures pin the *shape*, not the ordering. | `--live` catches shape drift. Ordering changes are ev-accounts' to own, and the picker shows the area type so two Portlands are told apart regardless. |
| **The welcome screen's copy is not checked by a machine.** | Prose quality is not mechanisable. | Read out loud, in all four presentations, against a named list of six things it must not say (17-07 Task 2 Step 2). The literals that would violate the phase boundary are enumerated there rather than left to judgement. |
| **`cursor: default` on 196 of 416 controls.** | App-wide, Tailwind v4 Preflight, unowned. | Item 6 of `16-explore-by-slice/deferred-items.md`. Not made worse here; new controls get `cursor-pointer`. |
| **`useAuth.ts` reads and removes `cs_token` from `localStorage` unguarded.** | Offered in `17-CONTEXT.md` and not chosen. | Item 9 of the same file. 🔴 This phase adds **no second instance** — every new access is guarded, and `check:place-entry` 12 proves that for every key the phase added. ⚠️ It is also why that assertion stops at `sessionStorage`: **17-05 demonstrated the bug by accident.** `Storage.prototype` is shared between the two storages, so the first draft's `cs_`-prefix throw hit `cs_token` as well, and the page died on an uncaught `SecurityError` with nothing rendered — item 9, reproduced exactly, by a check that meant to test something else. The receiver test in `BLOCK_OUR_SESSION_KEYS` is what keeps the two apart. |
| 🔴 **A storage-blocked boot dies before any of our code runs — in `@supabase/supabase-js`.** Found by 17-04 doing its own Task 3 Step 7 hand-check. | `src/lib/supabase.ts` calls `createClient` at module scope, which constructs a `RealtimeClient` whose `Socket` touches `sessionStorage` unguarded. Every route, every environment, signed in or out; reproduced on `?dev=1` too. It is **not** something this phase introduced and it is not this phase's to fix. | Item 1 of this phase's `deferred-items.md`, with the captured stack. ✅ **17-05 adjusted `check:place-entry` 12, and this row now records what that assertion DOES rather than what it was first asked to do.** It overrides `Storage.prototype`'s three methods for real — not a mock — and throws a `SecurityError` for **`sessionStorage` keys beginning `cs_`**: `cs_viewed_place` (17-03), `cs_signed_out` (17-01) and `cs_dev_place`, which is the complete set of storage this phase touches. Every other key passes through, so the dependency boots and our guards are the only thing under test, and the assertion carries its own positive half (`probe.threw`, `probe.passthrough`, `probe.localUntouched`) so a block that failed to install cannot read as a pass. Our own guard is proved twice over: `check:place-resolve` 39–42 cover the round trip in Node. 🔴 **What it does NOT prove, and no browser assertion in this phase can: that the app survives storage blocked WHOLESALE. It does not, and the reason is in a dependency.** |
| ✅ **Explore's module copy addressed a visitor as a resident** — "Federal races where you live", "Questions for your community". **CLOSED by 17-06**, and now watched. | The DATA was right (`racesAreaFor` follows `onScreenSlices` as of 17-04); only the second person was wrong. | `ctx.isOwnPlace` (true for `null` **and** `'sibling-shard'` — a sibling IS the member's jurisdiction) branches `intro`, `questions` and `races`; six static `emptyState` strings are rewritten true of both readers, since an `emptyState` has no `ctx`. 🔴 **Checked, not remembered:** `check:explore-gate` assertions 9/10 on the two place viewers (`CLAIMS_THE_PLACE` over the rendered panel, list and topic page) and `check:explore-rooms` **21** over every rendered room. Forcing `isOwnPlace: true` turns both gate assertions red; restoring one room's "None of yours" turns 21 red. |
| **The second person survives in the topic CATALOGUE's questions**, and in `Sidebar`'s empty-roster nudge. | The catalogue's ~40 strings are conversation-starter QUESTIONS, where the second person is what makes them an invitation; changing that is a decision about voice. `Sidebar.tsx` is the one file 17-06 is forbidden to edit, because "it must not need editing" is the test of whether `usePlaceRepresentatives`' signature was right. | Item 3 of `deferred-items.md`, with file and line for each, and the boundary that was finally drawn: **a STATEMENT the page makes about the place is fixed; a QUESTION put to the reader is deferred.** 🔴 The most visible one left is the featured topic — "What should get built in **your** city, and where?" — the second-largest text on a visitor's screen. It is deliberately NOT in `CLAIMS_THE_PLACE`: widen that regex in the same commit that fixes it, never before. ✅ **17-07's four-way pass re-confirmed all ~40 on screen and left them deferred**, and found and fixed **one that was on the wrong side of that boundary**: the featured product update read *"A better way to discover **your** community"*, a STATEMENT, deferred only because it shares a FILE with the questions — the file boundary this item records itself correcting. Now "any community", with `discover your community` added to `CLAIMS_THE_PLACE` in the same commit. |
| **The shared-link arrival.** | Deferred; only D-08 changes the answer, and D-08 is Phase 18. | `cs_pending_post` keeps working unchanged, and 17-04 Task 3 Step 4 says so explicitly so it is not deleted by accident. |
| 🔴 **NOTHING CHECKS WHAT HAPPENS WHEN A MEMBER ENTERS THEIR OWN PLACE, and it is wrong today.** Added by 17-07. | `check:explore-gate`'s `member-other-place` viewer boots on `&place=bloomington` and visits Asheville, so it is genuinely somewhere else. There is no viewer for "the member visits a place they already hold", and before 17-05 shipped `PlaceStrip` there was no control that could produce one. | Item **4** of `deferred-items.md`, with the probe output. The sentinel id is not in `ownedSliceIds` while its `placeKey` IS in `ownedPlaceKeys`, so `whyNoWrite` takes branch 4 and answers `sibling-shard`: the notice renders *"You're exploring Slice **—** read-only"*, and the conversations surface tells a resident *"Conversations here belong to the people who live here"*. Fail-closed, so nothing unsafe is offered — but it is **over-gating**, the anti-goal two rows up. 🔴 Whichever fix Chris picks, that phase adds a **seventh** viewer for it. `scripts/shoot-welcome.mjs` fails its presentation-6 cell if the notice ever reads `sibling-shard` again. |
| ✅ **The D-10 read could not see the What's New card at all — CLOSED by 17-07, and it is the reason one violation shipped through 17-06's whole sweep.** | `WhatsNewModule` renders its card `md:hidden` when the sidebar is carrying it; `check-explore-gate` drives a DESKTOP viewport; and `innerText` on a rendered panel skips a `display:none` subtree. The sidebar's copy of the same card is outside `#forum-view-explore`. Invisible from both directions at once. | A third haystack, `WHATS_NEW_TEXT`, read by **`textContent`** — which does not care whether the node is rendered, and that is the point. Bounded: the card's `<dialog>` body is behind `{view && …}` and contributes nothing while closed. 🔴 **The lesson is wider than the string:** widening `CLAIMS_THE_PLACE` alone did **not** turn the assertion red. The regex was never the binding constraint; the **scope** was. Before trusting any "no bad copy anywhere" assertion, ask what it can actually read. |
| ✅ **The hit-test accepted a control covered by a transparent ANCESTOR — CLOSED by 17-07 before it was ever believed.** | A first draft of `shoot-welcome`'s probe allowed `at.contains(el)` beside `at === el || el.contains(at)`. An ancestor contains its own descendant by definition, so the clause reported every blocked control as reachable — which is **exactly** the PR #92 shape it exists to catch. | Found by running the revert, not by reasoning: with `pointer-events-none` on the picker input, the permissive clause reported **PASS** and the strict clause **FAIL**. `check-place-entry.mjs`'s own hit-test was already strict and is unaffected. |
| ✅ **A broken gate killed the audit instead of failing it — CLOSED by 17-07, and it is 17-06's `readNotOverGated` finding reproduced exactly.** | The `pointer-events-none` revert made `typeInto`'s click time out BEFORE the hit-test assertion it was aimed at, and the stack trace took the other three walks with it. A crashed run tells you less than a failed one. | The primary control is now hit-tested **first**, before anything has to click it, and every walk runs inside a `guarded()` that turns a thrown group into a FAIL line naming itself. 🔴 **This failure mode has now been found twice in two phases, in two different scripts.** It is worth assuming of any new browser check. |
| 🔴 **A contrast assertion MEASURED THE WRONG ELEMENT and reported a PASS under the right element’s name.** Found by the independent verification of 17-07, not by 17-07. | `WELCOME_ITEMS` probed the strapline as `header p:last-of-type`. `:last-of-type` is scoped to each element’s own SIBLINGS, not to the match set, so a *descendant* selector plus `:last-of-type` matched two nodes — and `querySelector` returns the first, which was the 18px “Civic Spaces” wordmark nested in a div, not the 14px strapline beneath it. It was therefore also scored against the 3:1 large-text floor instead of 4.5:1. In the same pass the **sign-in sentence** — the one carrying BOTH WALLS for a returning member, *“an account without one opens none yet”* — turned out to be probed by nothing at all: it shares a parent with the EV footer, so `:last-of-type` claimed the footer and no entry claimed it. | Proved, not reasoned: breaking the real strapline and the real sign-in sentence to **2.49:1 light / 2.66:1 dark** left all **140** assertions green. Fixed to `header > p:last-of-type` (the child combinator excludes the nested wordmark) and a new `> div > p:first-of-type` entry; the same break now produces **12 FAIL** across three items × four cells, at the correct 14px, and the clean suite is **144 PASS**. 🔴 **This is the vacuous pass in a new costume** — not a check that tests nothing, but one whose NAME does not match what it tests, which is worse, because the report reads as coverage. The rule now written at `WELCOME_ITEMS`: before trusting a PASS, confirm `document.querySelectorAll(sel).length === 1`. |

---

## If a check fails

- **`check:write-access`** — a bug in `src/lib/writeAccess.ts`, not in the script. The
  script imports the shipped module; there is nothing else for it to be.
- **`check:place-resolve`** — a bug in `src/lib/placeResolve.ts`, **or** a stale fixture. Run
  `--live` before touching the source: if the live shape differs from the fixture, the API
  moved and the fixture is the thing to fix.
- **`check:place-entry`'s D-13 assertions** — 🔴 do not relax them. If the input is on screen
  because the picker still holds it, clear the input in the check. If it is in storage, find
  what wrote it. There is no third explanation.
- **`check:place-entry`'s network assertion** — something is querying PostgREST for a visited
  place. In Phase 17 that returns zero rows rather than an error, so it would have shipped
  as "nobody has said anything here". Find the hook, not the assertion.
- **`check:explore-gate`** — read **which viewer** failed. One viewer red with the others
  green is the half-a-gate shape in its newest form, and the viewer name tells you which
  reason lost its gate.
- **A hit-test (`elementFromPoint`)** — fix the layering, then 🔴 **toggle the suspect class
  off mid-run and re-test.** A fix that is load-bearing will put the bug straight back. If
  removing it changes nothing, you fixed something else and the real bug is still there.
- **A contrast ratio near 1:1, or a whole page "failing"** — that is the `oklch()` bug, not a
  finding. The probe is reading `ctx.fillStyle` back instead of `fillRect` + `getImageData`.
  Fix the probe before you touch a colour.
- **A SKIP** — not a pass. Say which presentations or assertions were not checked.
