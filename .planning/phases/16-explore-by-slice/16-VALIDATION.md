# Phase 16: Explore by Slice — Validation

**Written:** 2026-10-24
**Companion docs:** `16-DESIGN.md` (canonical), `16-CONTEXT.md` (the bar), `16-RESEARCH.md`
(the Validation Architecture section this collects), `16-SHARED.md` (the execution order,
the coverage matrix and the constraints every plan inherits).

This is the one place that answers *"how do we know?"* for Phase 16. Every claim the phase
makes is listed here with the thing that checks it and the plan that builds that thing. If a
row has no check, it says so and says why.

---

## The repo's constraint, stated once

🔴 **There is no frontend test framework.** No test script, no test files, no vitest, no
jest. `npm run build` (`tsc -b && vite build`) is the entire automated safety net, and
`CLAUDE.md` is explicit that this is the state of the world rather than an oversight.

Phase 16 therefore validates in four layers, in descending order of how much they prove:

| Layer | What it is | What it proves |
|---|---|---|
| **1. Pure checks** | `node --experimental-strip-types scripts/check-composition.mjs`, importing the **real** `src/lib/*.ts` | Logic. Every decision this phase makes lives in pure functions precisely so this layer can reach it. |
| **2. Browser checks** | `scripts/check-explore-gate.mjs`, `scripts/check-explore-rooms.mjs` — Playwright against `?dev=1` | Behaviour that only exists in a running page: the write gate, dead controls, hit-testability. |
| **3. Typecheck** | `npm run build` | Shapes and call sites. Necessary, never sufficient. |
| **4. Looked-at screenshots** | `scripts/shoot-explore.mjs` + a human | The four-way design standard. A clean run only proves the PNGs decoded. |

**Deliberately not added: a test framework.** `16-RESEARCH.md`'s Alternatives table reached
the same conclusion — the repo has no test convention, and introducing one inside a feature
phase makes the phase about the test framework. Every check above is a `scripts/` entry
alongside the existing `check-banner-drift.mjs`, `shoot-banners.mjs`, `shoot-app.mjs` and
`generate-geo-names.mjs`.

**Everything is committed.** No check lives in a scratchpad. A check only the author can
re-run is not a check; it is a memory.

### 🔴 The failure class this phase keeps hitting: a check that passes without exercising anything

Every one of these was found in review rather than by the check itself, which is the point.
When writing or reviewing any check in this phase, ask what would have to be true for it to
pass while the feature is broken:

| Shape | Example from this phase | Guard |
|---|---|---|
| **The thing was never on screen** | "zero textareas" on Federal, which has no Imagine card | Run on City too (16-05 Task 2); state the control case per tab |
| **A control exists only after an interaction** | the Imagine textarea is inside `{option && …}` and the default is `imagine: null` | Click a radio first (16-05 Task 6 Step 2) |
| **The page under test never loaded** | `getMockPostById` misses the new sibling post → `locatePost` 404s → the assertion runs on the home feed | Assert the precondition first (16-05 Task 6 Step 4) |
| **The data never exercised the code path** | every City topic mapped to an answered Compass id, so ranking is a no-op | Check over the real data, not synthetic (`check:composition` 41) |
| **The filter was shadowed by an earlier one** | `topicsForLevel` drops by `topic.level` before consulting flags, so a City topic proves nothing about Federal | Construct the input so only the code under test can exclude it (check 28) |
| **An id matches nothing** | an invented `compassTopicId` makes ranking and filtering silent no-ops | Verify every id against the live catalog (16-01 Task 3 Step 1, 16-07 Task 5 Step 3) |
| **The check never failed** | any of the above | Prove it can fail, per gate, one at a time (16-05 Task 6 Step 5; 16-08 Task 3 Step 3) |

---

## Commands

| Command | Added by | Needs | Runtime |
|---|---|---|---|
| `npm run build` | existing | — | ~20 s |
| `npm run check:composition` | 16-01 (41) → 16-04 (47) → 16-05 (55) → 16-06 (57) → 16-08 (62) | — | < 1 s |
| `npm run check:agenda-topics` | 16-06 | a committed fixture, no network | < 1 s |
| `npm run check:explore-gate` | 16-05 | `npm run dev` running | ~15 s |
| `npm run check:explore-rooms` | 16-08, extended by 16-09 | `npm run dev` running | ~15 s |
| `npm run shoot:explore` | 16-10 | `npm run dev` running | ~60 s |
| `npm run check:banners` | existing | network | ~2 min |

Playwright is a **global install, not a dependency** — `node_modules` is the wrong place to
look. Every script resolves it the way `scripts/shoot-app.mjs:75-93` does: `'playwright'`,
then `npm root -g`, reading `mod.chromium ?? mod.default?.chromium`, because the global
install's export shape differs between its CJS and ESM entry points.

None of the four new checks needs a credential. That is a deliberate property — they drive
`?dev=1`, which opens on the reserved `dev-guest` id with fixture slices and real public data
through the `/api` proxy. The one exception is called out under "Known gaps" below.

### Sampling rate

- **Per task commit:** `npm run build`.
- **Per plan:** `npm run build` plus whichever checks that plan touched.
- **Phase gate (16-10):** all four green, screenshots **looked at**, `check:banners` clean.

---

## The verification bar, and what checks each line

`16-CONTEXT.md`'s five lines. These are the phase's acceptance criteria.

### 1. Federal, State, City/County and Unified resolve to visibly different compositions

| Check | Layer | Where |
|---|---|---|
| `DEFAULT_MODULES` lists differ in **membership**, not only order; city === county | 1 | `check:composition` 6 |
| Federal has no `imagine` / `nearby` / `agenda`, and **does** have `featured` | 1 | 7 |
| Unified has no `races` / `coming-up` / `agenda` | 1 | 8 |
| `compositionKey` normalises the fixture's `'3711'` / `''` to the production key | 1 | 1, 2 |
| Each tab renders a distinct module list **in the running app** | 2 | 16-04 Task 6 Step 1; 16-10 Task 2 Step 1 reads them off `data-explore-module` |
| Each level's page reads as a different page to a human | 4 | 16-10 Task 2 |
| The generic pool and the module-owned topic sets are **disjoint** | 1 | `check:composition` 40 |
| **Ranking fires on real data** — `rankByCompass` over the real `GENERIC_TOPICS.city` reorders it | 1 | `check:composition` 41 |

### 2. Bloomington carries real agenda-derived content end to end

| Check | Layer | Where |
|---|---|---|
| The derivation over a **committed frozen fixture**: titles verbatim, no invented field, summary flagged generated, `suggestedTitle` ≤ 200, procedural items dropped | 1 | `check:agenda-topics`, 10 checks (16-06 Task 3) |
| Bespoke topics attach by **geoid**, not city name — a topic for geoid A is discarded when resolving geoid B | 1 | `check:composition`, added by 16-06 Task 4 |
| Two titles compared **character for character** against the published agenda | human | 16-06 Task 5 Step 1; 16-10 Task 4 Step 2 |
| The body is named as the record names it (Bloomington's is the **Common Council**) | human | 16-06 Task 4 Step 2 |
| An uncovered city and a blocked API are indistinguishable, and both honest | 2/human | 16-06 Task 5 Steps 2 and 4 |

### 3. A sibling shard shows Explore with no write affordance anywhere in it

The phase's highest-risk line: `CLAUDE.md` records that this repo shipped exactly half of
this kind of gate once already.

| Check | Layer | Where |
|---|---|---|
| All ten affordances, on **both** the Federal and City shards | 2 | `check:explore-gate`, 11 assertions × 2 tabs |
| The **control case** — the affordances are present on the member's own shard | 2 | assertion 1. Without it the other ten are vacuous. |
| Four affordances that exist **only on City/County** are actually exercised | 2 | the City shard, which 16-05 Task 2 adds to the fixture |
| Each gate can fail **independently** | 2 | 16-05 Task 6 Step 5 reverts five gates one at a time |
| "Switch back" is hit-testable, not merely rendered | 2 | assertion 7, `elementFromPoint` |
| Device-local controls still work (not over-gated) | 2 | assertion 9 |
| The resume decision table | 1 | `check:composition` 48–55 (`shouldResume`) |
| The resume **invariant** — never composing on a sibling | 2 | assertion 10, via a `/post/<sibling>` deep link |

### 4. A draft started on one tab cannot post to another jurisdiction

| Check | Layer | Where |
|---|---|---|
| Draft keys differ per `(sliceType, geoid)`; placeless types collapse to one | 1 | `check:composition` 9–11 |
| `parseDraftKey` round-trips, and `city\|\|x` yields `geoid: null` not `''` | 1 | 12–15 |
| `canPostDraft` accepts, refuses `moved`, refuses `no-slice`, accepts a signed-out key | 1 | 16–21 |
| A signed-out draft is re-keyed onto the member's slice at sign-in | 1 | 42–47 (`migrateSignedOutDrafts`) |
| Legacy `cs_explore_drafts` / `cs_explore_resume` are deleted, never mis-parsed | 2/human | 16-04 Task 6 Step 3 |
| A City draft posts to City; a State draft to State | human | 16-04 Task 6 Step 4 |

### 5. Light + dark, desktop + mobile all check out

| Check | Layer | Where |
|---|---|---|
| 28 screenshots across five tabs, two places, the view-only state, two themes, two viewports | 4 | `shoot:explore`, 16-10 Task 1 |
| **The images are opened and looked at** | human | 16-10 Task 2 — a clean run only proves they decoded |
| Contrast resolved **through a canvas**, not `getComputedStyle().color` | 2 | 16-10 Task 3 Step 2. Tailwind v4 emits `oklch()`; an `rgb()` parse reports confident nonsense. |
| Every primary control hit-tested at **both** viewports | 2 | 16-10 Task 3 Step 1. PR #92's bug was `md`-and-up only, so phones looked fine. |
| `prefers-reduced-motion` respected | 2 | 16-10 Task 3 Step 3 |

---

## The anti-goals, and what stops each

These make the work a failure even if it ships and functions, so they get their own column.

| Anti-goal | What stops it | Layer |
|---|---|---|
| **A post landing in the wrong jurisdiction** | `canPostDraft`, checks 16–21; the `handleStartConversation` refusal; the tab walk in 16-04 Task 6 | 1 + human |
| **Offering a write RLS can only reject** | `check:explore-gate`, 11 × 2; the `activeIsViewOnly` refusal; RLS itself as the backstop | 2 |
| **Invented civic record** | the mock-copy grep (16-01 Task 3 Step 3); verbatim-title checks (16-06 Task 3); `summaryIsGenerated` always set; no-fact rule on all nine reserved rooms (16-09) and assertions 12–16 | 1 + 2 + human |
| **Central editorial as the only path** | not a check — an architecture property. Bloomington's topics are written by its own council (16-06), and provenance is in the record from 16-01. | — |
| **Overwhelming the member** | assertion 17 caps rendered rooms per level; 16-09 Task 1 Step 3 forces a judgement call if a page reads as mostly promises | 2 + human |
| **A control that looks live and does nothing** | `check:explore-rooms` 3–8 and 12–14, including a proof that an *enabled* no-op handler is caught, not just a disabled button | 2 |

---

## Wave 0 — what had to exist before anything could be checked

`16-RESEARCH.md` listed five gaps. All five are closed by a plan, and three of them are
fixture work that would otherwise have made later checks silently vacuous.

| Gap | Closed by | Why it mattered |
|---|---|---|
| A pure, import-free module Node can run | 16-01 Task 2 (`src/lib/exploreComposition.ts`) | Otherwise every logic check tests a transcription, and a copy-test passes while the shipped code is wrong |
| A committed check script | 16-01 Task 5 | A scratchpad check cannot be re-run by anyone else |
| A dev-only way to reach Bloomington | 16-06 Task 1 (`?dev=1&place=bloomington`) | Asheville has **zero** meetings; without this the proof city needs a pasted production token |
| 🔴 A way to exercise the view-only gate where the controls are | 16-05 Task 2 (a **City** sibling) | The fixture sharded only Federal, and four of the ten affordances exist only on City/County. A Federal-only check would have reported "no textarea found" about a tab that never had one. |
| 🔴 A Compass fixture that can demonstrate the filter | 16-01 Task 4 | `MOCK_COMPASS_TOPICS` carried 8 topics, all flagged for all three levels, and **none** of the 6 local-only ones — so exclusion could never be observed on the dev id |
| The `elementFromPoint` pass | 16-05 assertion 7, 16-08 assertion 6, 16-10 Task 3 | PR #92 shipped a control that rendered perfectly and could not be clicked |

A sixth, not in the research and found during planning: **the generic topics must carry real
`compassTopicId`s** (16-01 Task 3). An invented UUID matches nothing, so `rankByCompass` and
`topicsForLevel` both become silent no-ops — locked decision 7 would have shipped inert with
nothing failing to tell us. 16-07 Task 5 Step 3 re-checks every mapped id against the live
catalog for exactly this reason.

---

## Known gaps — things this phase does not check, and why

Stated rather than hidden. Each is a judgement, not an oversight.

| Gap | Why | Mitigation |
|---|---|---|
| **The signed-out presentation is not reachable on a fresh clone.** With no `VITE_SUPABASE_URL`, `useAuth` enters dev-guest mode unconditionally (`useAuth.ts:219-225`), so dropping `?dev=1` does not sign you out. | A backend-configuration requirement, not a credential one. | 16-10 group B, opt-in, **skipped loudly** with the four missing presentations named. Never reported as a pass. |
| **The signed-in production pass** — the real `photoUrl` / credit precedence, real sibling shards, a real Compass token. | Needs a pasted `cs_token`; localhost has no login. | `scripts/shoot-app.mjs` after merge (16-10 Task 5 Step 4). The same place Phase 15 left its in-situ check. |
| **The races modules' populated state will become uncheckable.** Generals drop off the list on 1 January and no 2027 races exist yet. | The data has a calendar. | Verify the populated state **now**, while the 2026 cycle is live (16-07 Task 6). The empty state is checked permanently. |
| **Bloomington's "seeded" state rots between council sessions.** Outside 16-06's 45-day freshness window the agenda room appears and the seed invitation correctly shows. | The council meets every few weeks. | `check:explore-rooms` assertion 9 is conditional and prints a **SKIP**, not a failure; 16-10 labels the shot rather than retaking it. |
| **No check covers whether the reserved-room copy is any good.** | Prose quality is not mechanisable. | A human reads all nine consecutively and out loud (16-09 Task 1 Step 2), and assertions 14–15 catch the specific wrong shapes (apology, "coming soon", "for your area" when the gap is universal). |
| **The suspended-member and `inform`-tier gates are untouched.** Explore's Join is enabled for both. | 🔴 **Whether the goal's "never offered a write they cannot make" covers them is with the product owner.** It is a different gate (a tier check, not an RLS one) and this phase does not pre-empt the answer. | Noted in 16-05's Out of Scope; a revision if the answer changes anything. |
| **No automated check that a module never calls a hook.** | A lint rule would be the right tool and this phase adds no tooling. | A grep in 16-02's Verification section, plus the one-render guarantee living in `AppShell` by construction. |

---

## If a check fails

- **`check:composition`** — a bug in `src/lib/exploreComposition.ts`, not in the script. The
  script imports the shipped module; there is nothing else for it to be.
- **`check:explore-gate`** — read *which tab* failed. A City-only failure with Federal green
  is the half-a-gate shape, and it is the exact failure 16-05 Task 2 exists to expose.
- **`check:explore-rooms` assertion 7** — a control that renders and does nothing. Fix the
  handler, not the assertion.
- **A hit-test (`elementFromPoint`)** — fix the layering, then **toggle the suspect class off
  mid-run and re-test.** A fix that is load-bearing will put the bug straight back. If
  removing it changes nothing, you fixed something else and the real bug is still there.
- **A SKIP** — not a pass. Say which presentations were not checked.
