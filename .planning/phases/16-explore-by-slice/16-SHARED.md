# Phase 16: Explore by Slice — shared plan context

**Read this once before 16-01, and keep it to hand.** The ten plan files reference it
rather than repeating it: the execution order, the coverage matrix, and the constraints
that apply to every task in the phase live here and nowhere else.

Each plan still repeats the two or three constraints that are sharpest for its own work,
inline, at the point where they bite. That duplication is deliberate — this file is the
canonical list, not a substitute for a warning next to the thing it warns about.

---

## The plan set

Ten plans. **Execute them strictly in order, 01 → 10. Do not parallelise any of them.**

`.planning/config.json` has `"parallelization": true`, which is correct for most phases and
wrong for this one: 16-02 through 16-08 all edit some subset of `AppShell.tsx`,
`registry.tsx`, `ExploreContext.ts`, `ExploreView.tsx` and `exploreData.ts`. Those five files
are the phase's spine. Two agents in them at once produces conflicts in the exact files
where a dropped hunk is a dropped gate. The "Depends on" line in each plan names its
*logical* prerequisite; the *execution* order is serial regardless.

| Plan | What lands | Logical prerequisite | Spine files it edits |
|---|---|---|---|
| **16-01** (this) | Scoped topic records, the pure resolver, the async seam | — | `exploreData.ts` |
| **16-02** | The registry contract and the content modules | 16-01 | `registry.tsx`, `ExploreContext.ts` |
| **16-03** | `ExploreView` renders a composition | 16-02 | `ExploreView.tsx`, `AppShell.tsx`, `exploreData.ts` |
| **16-04** | Explore follows the active tab; drafts re-key to `(sliceType, geoid, topicId)` | 16-03 | `ExploreView.tsx`, `AppShell.tsx` |
| **16-05** | The sibling-shard read-only gate, with its own browser check | 16-04 | all four |
| **16-06** | Bloomington end to end: agenda-derived topics + the dev fixture override | 16-05 | `registry.tsx`, `ExploreContext.ts`, `exploreData.ts`, `AppShell.tsx` |
| **16-07** | Races, debates and Compass ranking, from the member's *most local* area | 16-06 | `registry.tsx`, `ExploreContext.ts`, `exploreData.ts`, `AppShell.tsx` |
| **16-08** | The invitation to seed an unseeded place — shown **without** the vote | 16-07 | `registry.tsx`, `ExploreContext.ts`, `AppShell.tsx` |
| **16-09** | The reserved rooms, and the ev-accounts handoff document | 16-08 | `registry.tsx` |
| **16-10** | The four-way visual pass and the phase gate | all | — |

A fourth cross-plan dependency, on the committed pure check: **16-01 creates
`scripts/check-composition.mjs` with 41 assertions; 16-04 takes it to 47, 16-05 to 55,
16-06 to 57 and 16-08 to 62**, and 16-10 re-runs it as a phase gate. Each of those plans
edits the same file, which is one more reason the order is serial.

Three cross-plan dependencies that are easy to miss and are **not** optional:

- **16-06 and 16-05 both edit `src/lib/devMockData.ts`.** 16-05 adds a City sibling to
  `MOCK_SIBLINGS`; 16-06 adds the `?dev=1&place=` override to `MOCK_SLICES`. 16-05 goes
  first; 16-06 must not revert it.
- **16-08 Task 3 creates `scripts/check-explore-rooms.mjs`; 16-09 Task 2 extends it.**
- **16-08 Task 4 runs `scripts/check-explore-gate.mjs`, created by 16-05.**

### Coverage — every source item, and the plan that carries it

Nothing in the four source documents is dropped. Where an item cannot ship, the row says so
and names the handoff that asks for it.

| Source | Item | Plan |
|---|---|---|
| CONTEXT locked 1 | Each slice composes its own Explore | 16-01, 16-02, 16-03 |
| CONTEXT locked 2 | Bespoke per jurisdiction, keyed `(slice_type, geoid)` | 16-01, 16-06 |
| CONTEXT locked 3 | Explore follows the active tab | 16-04 |
| CONTEXT locked 4 | Read-only on a sibling shard — no Join buttons | 16-05 |
| CONTEXT locked 5 | A place's topics come from what its government is working on | 16-06 (agenda), 16-07 (races), 16-09 (the rest, as reserved rooms + asks) |
| CONTEXT locked 6 | Seeding is a vote, not a composer — **invitation in scope, vote not** | **16-08** builds the invitation. The vote (a write) stays out of scope and is its own later plan |
| CONTEXT settled 4 | *"Show it without the vote for now"*; no live-looking control that no-ops | 16-08, including the verification that tests that failure mode |
| CONTEXT locked 7 | Compass ranks topics; it does not produce them | 16-01 (pure ranking **and the real `compassTopicId`s that make it fire**), 16-07 (wiring), 16-08 (the copy trap) |
| CONTEXT locked 8 | Volunteer keeps no Explore | 16-01 (`levelFor` returns null) — behaviour unchanged |
| CONTEXT locked 9 | "Imagine a better neighborhood" stays, as a City/County module | 16-02 |
| CONTEXT fence | Re-keying Explore drafts | 16-04 |
| CONTEXT fence | Surfacing the races already in the elections response | 16-07 |
| CONTEXT fence | One real jurisdiction hand-seeded end to end — Bloomington, IN | 16-06 |
| CONTEXT correction | Federal "summary then tally" cannot ship | 16-09 — reserved room + handoff Ask 3 |
| CONTEXT correction | Ballot measures are not served at all | 16-09 — reserved room + handoff Ask 2 |
| CONTEXT correction | Races by the member's most local area, never state, never `('US','G4000')` | 16-01 (`racesAreaFor`), 16-07 |
| CONTEXT correction | Agenda items from `GET /api/meetings/:id/agenda-items`, most recent agenda | 16-06 |
| CONTEXT correction | Debate *recordings* are reachable; a debate *schedule* is not | 16-07 (recordings), 16-09 (schedule → reserved room + Ask 4) |
| CONTEXT correction | Key federal/unified/volunteer on `sliceType` alone | 16-01 (`compositionKey`) |
| CONTEXT settled 1 | Dev-only fixture override so Bloomington is visible on localhost | 16-06 |
| CONTEXT settled 2 | A "back to your own community" control inside Explore | 16-05 |
| CONTEXT settled 3 | A signed-out visitor sees the place-scale generic composition | 16-04 |
| DESIGN settled | A Unified-only member may post to Unified from Explore | 16-04 |
| DESIGN decision 9 | Tone: welcoming, not overwhelming, fun to contribute *a little* | 16-08 |
| DESIGN "left to builder" | The visual design of the invitation; run `ui-ux-pro-max` | 16-08 |
| DESIGN "shape" | Module registry with reserved rooms for the coming Connect features | 16-02 (mechanism), 16-09 (copy) |
| DESIGN "shape" | One route `GET /api/civic-spaces/explore?sliceType=&geoid=` | 16-09 — handoff Ask 1; 16-01 shapes the client seam to match |
| RESEARCH Finding 3.4 | A topic open on one tab must not render on the next | 16-03 |
| RESEARCH Finding 3.5 | Split `AdventureActivity` into Nearby (City/County) and Coming up | 16-02 |
| RESEARCH Finding 3.7 / Pitfall 11 | Featured photo must not duplicate the hero | 16-04 |
| RESEARCH Finding 3.8 | Break the type import cycle | 16-01 (Task 1) |
| RESEARCH Finding 5 | All ten write affordances, classified and handled | 16-05 |
| RESEARCH Finding 6 | Legislator votes / Senate tallies: reachable but partial | 16-09 — reserved, not built (Open Question 5 default) |
| RESEARCH Security V5 | Validate `http(s)` on any `href` taken from the API | 16-01 (`isHttpUrl`), used in 16-06 and 16-07 |
| Verification bar | All five items | 16-10, collected in `16-VALIDATION.md` |

Items deliberately absent, and why: Symposiums, Civic Listening, Common Grounds, Focused
Communities and slice action votes are DESIGN non-goals — their slots are reserved in 16-09
and nothing more. Content sourcing at scale and moderation workflow are CONTEXT "out of
scope". The seed **vote** is CONTEXT "out of scope" and explicitly sequenced after a real
write path exists; the seed **invitation** is in scope and is 16-08.

---

## Global Constraints

Copied from `CLAUDE.md`, `16-DESIGN.md` and `16-CONTEXT.md`. Every task in **every** plan of
this phase implicitly includes these; they are repeated in each plan file so no plan has to
be read with another open.

- **There is no frontend test framework.** No test script, no test files. `npm run build`
  (`tsc -b && vite build`) is the entire automated safety net. This phase therefore uses a
  typecheck-and-inspect cycle plus ad-hoc `node --experimental-strip-types` checks against
  the real source. **Do not add vitest.** "It compiles" is not verification — every task
  below ends in something you can read the output of.
- 🔴 **Every commit leaves the build green.** No task in this phase commits a red `tsc -b`.
  Where a change would break consumers, the task adds the new API **alongside** the old and a
  later task moves consumers and deletes the old in one commit. If you find yourself about to
  commit with known errors, the task boundary is in the wrong place — move it.
- 🔴 **`tsc -b`, never plain `tsc`.** The root `tsconfig.json` is a solution file
  (`"files": []` + `references`); plain `tsc` compiles zero files and Vite transpiles with
  esbuild without type-checking. A new `tsconfig.*.json` must be added to `references`.
- 🔴 **Never call a shared data hook inside `SliceFeedPanel`.** All five feed panels plus
  Volunteer mount at once and inactive ones are hidden with CSS, so a hook there fires 6×.
  Explore is rendered once, outside that map (`AppShell.tsx:1045-1074`). Keep it that way:
  resolve **one** composition for the active tab; do not mount Explore per tab.
- **Explore's content is read only through `src/lib/exploreData.ts`.** One file is the whole
  mock→fetch swap. Data no API serves yet lives in one module under `src/mocks/` and is
  listed in the PR under "Data this needs from the API".
- 🔴 **Never invent civic record.** No fabricated bills, votes, tallies, measures, meetings,
  debates, counts or quotes. A module with no real source ships as a **reserved empty room**
  that says what it is for — never as a placeholder fact. The `ILLUSTRATIVE, NOT CIVIC
  RECORD` banner at the top of `exploreContent.ts` is the standing rule.
- 🔴 **Never offer a write RLS can only reject.** Gate the feed, gate the thread, **and now
  gate Explore**. The repo shipped exactly half of this kind of gate once already.
- **Every colour needs its light and `dark:` counterpart written together.** Dark mode is
  class-based and dark is the default; a `dark:`-only colour is a bug. Light text is
  `gray-900 / 600 / 500`; in dark use `gray-400`, not `gray-500`. Tailwind v4 emits
  `oklch()`, so resolve contrast through a canvas, never by parsing
  `getComputedStyle().color` as `rgb()`.
- **A change is done only when it looks right in all four of** light desktop, dark desktop,
  light mobile, dark mobile.
- Use EV brand tokens (teal `#00657C`, coral `#FF5740`, yellow `#FED12E`); reuse the existing
  Explore vocabulary in `exploreUi.tsx` and `WidgetCard` for anything sidebar-shaped;
  `react-loading-skeleton` matching `FeedSkeleton`; `motion/react` for animation.
- **Every Supabase call is `.schema('civic_spaces')`.** This phase adds none — it is
  frontend-only and writes nothing.
- **This app never geocodes and never stores a location.**
- **Branch from `origin/main` after `git fetch`.** Local `main` runs tens of commits behind
  and does not diverge. `main` requires a passing `build` and one approving review; a PR
  whose files are *all* `.planning/**` or `*.md` auto-approves.
- 🔴 `tsconfig.app.json` sets **`noUncheckedIndexedAccess`**, **`noUnusedLocals`** and
  **`noUnusedParameters`**. Widening `TopicId` from a closed union to `string` means every
  `TOPICS[id]` lookup now yields `T | undefined` and must be guarded — that is the single
  largest source of compile errors in this phase, and it is working as intended.
- Commit after every task.

