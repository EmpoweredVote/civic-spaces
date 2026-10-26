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
| **A `try`/`catch` that was never exercised** | the storage guards | actually throw from `Storage.prototype` via `addInitScript` (17-05 Task 3, assertion 12) |
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

**The rule this leaves behind:** *"no check can see this"* is a conclusion to reach **after**
looking for an observable consequence, not instead of looking. A reason that must be
computed to be displayed is observable; so is a request body, and so is a request count.

---

## Commands

| Command | Added by | Needs | Runtime |
|---|---|---|---|
| `npm run build` | existing | — | ~20 s |
| `npm run check:write-access` | 17-01 (18) | — | < 1 s |
| `npm run check:place-resolve` | 17-03 | committed fixtures, no network | < 1 s |
| `node scripts/check-place-resolve.mjs --live` | 17-03 | **network** | ~5 s |
| `npm run check:place-entry` | 17-05 (14) | `npm run dev` running | ~30 s |
| `npm run check:explore-gate` | existing; **extended** by 17-02, 17-04, 17-06 | `npm run dev` running | ~45 s at six viewers |
| `npm run check:composition` | existing (62) | — | < 1 s |
| `npm run check:explore-rooms` | existing; **its failure text** touched by 17-06 | `npm run dev` running | ~15 s |
| `npm run check:agenda-topics` | existing | committed fixture | < 1 s |
| `npm run shoot:welcome` | 17-07 (24 shots) | `npm run dev` running | ~60 s |
| `npm run check:banners` | existing | **network** | ~2 min |

Playwright is a **global install, not a dependency** — `node_modules` is the wrong place to
look. Every script resolves it the way `scripts/check-explore-gate.mjs:98-118` does:
`'playwright'`, then `npm root -g`, reading `mod.chromium ?? mod.default?.chromium`, because
the global install's export shape differs between its CJS and ESM entry points.

**No new check needs a credential.** That is deliberate and it is new for the signed-out
half: `?signedout=1` (17-01) makes the visitor state reachable without one, and the place
API is stubbed from committed fixtures. The two network commands are opt-in and are about
*other people's* contracts drifting, not about this phase's behaviour.

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
| Storage blocked throws nothing | 2 | `check:place-entry` 12, with `Storage.prototype` actually overridden to throw |

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
| **A second instance of the storage-blocked boot bug** | every new storage access guarded; `check:place-entry` 12 throws from `Storage.prototype` to prove it | 2 |

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
| 🔴 **Conversations for a visited place are not readable, so there is nothing to check.** The welcome screen's conversations paragraph and the visited-place conversations state are **Phase 18's to revise.** | Every `civic_spaces` grant is `TO authenticated` and `posts_select_sibling_slice` joins on `geoid`. D-22 put the one-way door in Phase 18. | Both are marked in source with a Phase 18 comment so that phase can grep rather than re-read. 17-07 Task 5 Step 1 confirms the markers are still there. |
| **Whether the officials are the *right people* is human-verified.** Their **source** is not a gap. | A script can prove the request carried the visited geoid and that `/representatives/me` was not consulted; it cannot know who represents Asheville. | Source: 17-06 Task 3b assertions 1–3, deterministic. Change-on-entry: assertion 4, which needs the live endpoint and **SKIPs loudly** rather than passing when a set is empty. Correctness: the human read in 17-07 Task 4, on City and on Federal. |
| **The address path is unverifiable end to end.** | `POST /api/civic-spaces/resolve` does not exist. | The client is written, typed, and covered by pure checks over a fixture response; `PLACE_RESOLVE_ENABLED` is false so no dead control ships; `ACCOUNTS-HANDOFF.md` is the ask. When it lands it is one env var and a re-run of `check:place-resolve --live`. |
| **The signed-in production pass** — real `photoUrl` / credit precedence, real sibling shards, a real Compass token. | Needs a pasted `cs_token`; localhost has no login. | `scripts/shoot-app.mjs` after merge (17-07 Task 5 Step 4). The same place Phases 15 and 16 left theirs. |
| **The six-panel hoisting rule is pinned at exactly one hook, not in general.** | A lint rule would be the right tool and this phase adds no tooling. | 🔴 17-06 Task 3b assertion 3 asserts **exactly one** `by-area` request per place change, so moving `usePlaceRepresentatives` into `SliceFeedPanel` shows six and goes red. That is the first assertion in the repo to pin this rule at all. Every **other** shared hook is still enforced by the pattern and by review. |
| **Place-name search quality is not checked.** | It is ev-accounts' ranking, not ours. The fixtures pin the *shape*, not the ordering. | `--live` catches shape drift. Ordering changes are ev-accounts' to own, and the picker shows the area type so two Portlands are told apart regardless. |
| **The welcome screen's copy is not checked by a machine.** | Prose quality is not mechanisable. | Read out loud, in all four presentations, against a named list of six things it must not say (17-07 Task 2 Step 2). The literals that would violate the phase boundary are enumerated there rather than left to judgement. |
| **`cursor: default` on 196 of 416 controls.** | App-wide, Tailwind v4 Preflight, unowned. | Item 6 of `16-explore-by-slice/deferred-items.md`. Not made worse here; new controls get `cursor-pointer`. |
| **`useAuth.ts:100` writes `localStorage` unguarded.** | Offered in `17-CONTEXT.md` and not chosen. | Item 9 of the same file. 🔴 This phase adds **no second instance** — every new access is guarded and `check:place-entry` 12 proves it by actually throwing. |
| **The shared-link arrival.** | Deferred; only D-08 changes the answer, and D-08 is Phase 18. | `cs_pending_post` keeps working unchanged, and 17-04 Task 3 Step 4 says so explicitly so it is not deleted by accident. |

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
