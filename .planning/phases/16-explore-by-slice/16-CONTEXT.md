# Phase 16: Explore by Slice — Context

**Source:** this context is derived from `16-DESIGN.md`, agreed with Chris on 2026-10-24 and
merged in PR #114. **That document is canonical.** Where this file and the design disagree, the
design wins. Read it before planning — it carries the reasoning, not just the conclusions.

**Issue:** [#111](https://github.com/EmpoweredVote/civic-spaces/issues/111)

---

## The goal in one line

Each slice's Explore is bespoke to that jurisdiction, and a member is never offered a write that
**RLS would reject**.

**Narrowed by Chris, 2026-10-25.** The earlier wording was "a write they cannot make", which
read onto the tier gates as well. It is RLS-scoped only: the sibling-shard case, where the
database refuses the insert. The suspended-member and `inform`-tier gates in
`SliceFeedPanel.handleCompose` are a different mechanism and stay as they are — PR #112 already
examined the `inform` case and judged it acceptable, because the draft survives for a member who
upgrades. Nothing in the plan set changes as a result; 16-05 was written to this scope already.

## Locked decisions

These came from the user and are not open for the planner to revisit:

1. **Each slice composes its own Explore** — an ordered set of modules per slice, not one shared
   frame filled in differently.
2. **Bespoke per jurisdiction, keyed `(slice_type, geoid)`.** LA ≠ Bloomington. California ≠
   Missouri. Sibling shards of one jurisdiction are identical.
3. **Explore follows the active tab**, replacing today's `homeSlice` binding.
4. **Read-only on a sibling shard — no Join buttons.** Gate the feed, gate the thread, gate
   Explore.
5. **A place's topics come from what its government is working on** — the council's agenda and
   the city's ballot measures; the legislature, the state ballot, the Governor.
6. **Seeding an unseeded place is a vote, not a composer.** Show prominent issues, let the member
   pick what they focus on, let them request their own.
7. **Compass ranks topics; it does not produce them.** No slice-wide aggregate of members'
   political answers is needed, and none should be designed.
8. **Volunteer keeps no Explore.** Unchanged.
9. **"Imagine a better neighborhood" stays, as a City/County module.**

## Scope fences

**In scope for this phase:**
- Per-slice composition resolution keyed on `(slice_type, geoid)`.
- A module registry so `ExploreView` renders modules without knowing each one.
- Scoped topic records carrying level, geoid and provenance.
- Explore following the active tab, and the sibling-shard read-only gate.
- Re-keying Explore drafts to `(sliceType, geoid, topicId)`.
- Surfacing the races already present in the elections response.
- One real jurisdiction hand-seeded end to end as proof — **Bloomington, IN**, the only city
  with real agenda coverage.

**Out of scope:**
- Building Symposiums, Civic Listening, Common Grounds, Focused Communities, or slice action
  votes. Reserve their slots and stop.
- Solving content sourcing at scale.
- Moderation, review or promotion workflow for member-contributed topics.
- **The seed vote itself** — it is a write, and a vote that evaporates on reload is worse than no
  vote. It is sequenced as its own plan once a real write path exists. The structural work must
  not depend on it.

## Anti-goals — failure even if it ships working

- Central editorial as the only path to content. *"I struggle to tell you the local issues of
  places I'm not from."*
- A post landing in the wrong jurisdiction.
- Offering a write RLS can only reject.
- Overwhelming the member; contribution that looks like a job.
- **Invented civic record.** No fabricated bills, votes, tallies, measures, meetings or debates.
  A module with no real source ships as a reserved empty room.

## Constraints the planner must respect

- All five feed panels plus Volunteer mount simultaneously; a hook inside `SliceFeedPanel` runs
  six times. Explore renders once, outside that map. Per-slice data stays hoisted or renders only
  for the active tab.
- Explore content is read **only** through `src/lib/exploreData.ts` — one file is the whole
  mock→fetch swap.
- Data no API serves yet lives in one module under `src/mocks/`, listed in the PR under "Data
  this needs from the API".
- No topics table in `civic_spaces`; posts carry no topic id. "Join the conversation" opens the
  composer with an editable draft.
- `CompassTopic` has no level field — that is a Compass-side change this design routes around.
- `npm run build` (`tsc -b && vite build`) is the only automated check in this repo.
- Four-way design standard: light + dark, desktop + mobile.
- This phase is frontend-only. The route and record shape go out as a handoff doc, following the
  `TT-HANDOFF.md` / `ACCOUNTS-HANDOFF.md` precedent from Phase 15.

## Source reality — checked, and it inverts the obvious demo

| Wanted | Source | State |
|---|---|---|
| City council agendas | `useUpcomingMeetings`, public, no auth | Real and already wired. Coverage: **Bloomington, IN** as of 2026-09-24. **Not LA.** |
| Races and candidates | `useNextElection` | Served and discarded — `ElectionRecord`: "Races and candidates are ignored here". Cheapest real content available. |
| Ballot measures | — | Unconfirmed. Research should establish this. |
| State legislature focus | — | No source. |
| Federal roll calls, bill summaries, debates | — | No source. Reserved empty rooms. |

## Settled after research (2026-10-24)

The research raised four questions. Three are answered here; the fourth is with Chris.

1. **Proof city: Bloomington, IN.** The DESIGN said Asheville and this file said Bloomington —
   my inconsistency, now resolved in the design in Bloomington's favour, on the evidence.
   Asheville has zero meetings. Bloomington needs a **dev-only fixture override** so it is
   visible on localhost without a pasted token; that override is in scope.
2. **"No write affordance on a sibling shard" means no path that RLS would reject.** The three
   composer paths — including the resume effect that reaches it with no button — are gated, and
   so are the draft textareas, since a draft that cannot be posted is a trap. Device-local
   preferences that never touch Supabase (saved adventure, selections) stay: they are not
   writes. Explore must also carry a "back to your own community" control, because the shard
   selector lives in the Conversations toolbar and is not reachable from Explore.
3. **A signed-out visitor sees the place-scale generic composition** — what ships today, and the
   most legible thing to a stranger. Their draft is stored with no geoid and binds to the
   member's own most-local slice on sign-in, which is today's behaviour and keeps the existing
   pending-post path intact.
4. **Does the seed invitation render while the vote behind it is out of scope? Yes — Chris's
   call, 2026-10-24: "show it without the vote for now."** The invitation is in scope for this
   phase; the vote remains its own later plan.

   The concern raised and overruled: an invitation with nothing behind it edges toward the
   "coming soon" dead end goal 6 forbids. Chris reaffirmed, so it ships. The way it ships
   honestly: the invitation renders as the welcoming element of an unseeded place and says what
   this space will become, and any affordance it shows states plainly that choosing what matters
   here arrives next. **It must not present a live-looking control that no-ops** — that is the
   one version that is genuinely the dead end, and it is the failure mode to verify against.

## Corrections the planner must carry

- Federal's "plain-language summary, then the tally" **cannot ship as specified** — no bill
  summary exists anywhere in the stack and federal votes carry no bill title. Reserved room plus
  a handoff ask. Do not invent one.
- Ballot measures are **not served at all**. Reserved room plus a handoff ask.
- Races must be queried by the member's **most local** area. A state-area query omits statewide
  races and returns every congressional district; `('US','G4000')` returns HTTP 500.
- Agenda items come from `GET /api/meetings/:id/agenda-items`, a public route this app does not
  call yet. Derive from the **most recent** agenda — `useUpcomingMeetings` is empty much of the
  time, and is empty today.
- Debate and forum **recordings** are reachable and join to races by `raceIds`; a debate
  *schedule* is not published anywhere.
- Key federal / unified / volunteer compositions on `sliceType` alone: the dev fixture uses
  `'3711'` and `''` where production uses `'US'` and `'UNIFIED'`, so a geoid key would resolve
  differently on localhost than in production.

## Verification bar

Not "it compiles". Phase 16 is done when:

- Federal, State, City/County and Unified resolve to **visibly different** compositions.
- Bloomington carries real agenda-derived content end to end, proving the bespoke layer.
- A sibling shard shows Explore with **no** write affordance anywhere in it.
- A draft started on one tab cannot post to another jurisdiction.
- Light + dark, desktop + mobile all check out.
