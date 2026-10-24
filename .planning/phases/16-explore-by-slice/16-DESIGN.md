# Explore, per slice — design

**Date:** 2026-10-24
**Issue:** [#111](https://github.com/EmpoweredVote/civic-spaces/issues/111) — Explore is the same on every slice
**Status:** design agreed with Chris; not yet planned

---

## Intent

Explore shipped in #109 as one screen rendered once, bound to the member's most local
community. Every tab shows the same content: the State tab asks a member about their city's
sidewalks.

Fixing that is not re-pointing the data at a bigger place. The reason Explore exists at all
is **structure**. A forum with no shared starting point is a box where whoever posts first
sets the agenda, and new members arrive with nothing to react to and no sense of what this
space is for. Explore gives each slice a narrative focus — a few questions worth discussing,
something to understand, something to do — so joining is a reaction rather than a blank page.

It is also where the Connect pillar's coming features land: Symposiums, Civic Listening,
Common Grounds, Focused Communities, and votes on what a slice should actually do about its
topics. **Reserving the room for those is most of the work.** None of them needs building
here. What matters is that when each arrives it has somewhere obvious to go, on the slices
where it makes sense, without re-opening this design.

---

## Goals

- Each slice feels like itself. A member on Federal is asked about federal things; a member
  in Los Angeles is not asked Bloomington's questions.
- Nobody at Empowered Vote has to author convincing local content for places they have never
  lived. The design must make that unnecessary, not merely difficult.
- Every coming Connect feature has a reserved place in the structure.
- A slice nobody has seeded yet is a welcome, not a dead end.
- Contributing is small, inviting, and a bit fun.

## Non-goals

- Building Symposiums, Civic Listening, Common Grounds, Focused Communities, or slice action
  votes. This design reserves their slots and stops.
- Settling how local content gets sourced at scale. Three sources are plausible (below) and
  the shape must admit all three; choosing between them is later work.
- Moderation, review or promotion workflow for member-contributed topics.
- Any change to the Conversations feed, threads, or the composer beyond where a draft lands.

## Anti-goals

These make the work a failure even if it ships and functions:

- **Central editorial as the only path to content.** Chris: *"I struggle to tell you the local
  issues of places I'm not from."* A design where EV staff must write Peoria's questions is a
  design that will be wrong about everywhere.
- **A post landing in the wrong jurisdiction.** A NATO question must not post to a city feed.
- **Offering a write a member cannot make.** See the sibling-shard rule below.
- **Overwhelming the member.** If contributing looks like a form, a commitment, or a job, it
  has failed its own purpose.
- **Inventing local facts.** No invented proposals, votes, meetings, counts or quotes — the
  standing rule in `CLAUDE.md` and the `ILLUSTRATIVE, NOT CIVIC RECORD` banner at the top of
  `src/components/explore/exploreContent.ts`.

---

## What Chris decided

Taken as decided, in the words they were decided in.

**1. Each slice composes its own Explore.** Not one fixed frame that every slice fills in
differently. Federal leads with a vote broken down; City leads with something to go do;
Unified is its own thing entirely. (Chose option B over option A in the mockups.)

**2. Bespoke per jurisdiction, not per slice type.** *"The people of Los Angeles care about
different issues than the people in Bloomington, IN — so the topics that show up need to be
bespoke to that area."* California's State slice differs from Missouri's, and from every other
state's.

**3. Sibling shards of one jurisdiction are identical.** *"If there are multiple Los Angeles
Slices … THOSE slices can look consistent."* When LA passes 3,000 members and splits, LA 1 and
LA 2 are set up the same.

→ Therefore the content key is **`(slice_type, geoid)`**. Not `slice_id`, or the two LA shards
drift apart. Not `slice_type` alone, or LA inherits Bloomington's agenda. This is already the
key the sibling-read RLS policy uses
(`supabase/migrations/20260917000000_sibling_slice_read_access.sql`), and `SliceInfo` already
carries `sliceType` and `geoid`.

**4. Explore follows the active tab.** It currently binds to `homeSlice`, which is why
`destination` pins every draft to the member's most local space. That pinning was deliberate —
a draft must not land in whichever shard happens to be showing — but with per-place content it
produces the absurd case of a federal question posting to a city feed. Following the tab is
correct; the pinning intent is preserved by rule 5 instead.

**5. On a sibling shard, Explore is read-only — no Join buttons.** A member may read another
shard of their own jurisdiction and every write path there is closed by RLS. Explore is
wall-to-wall invitations to start a conversation, so without this every one of them is a
button that can only produce an error. This is the third half of the landmine already recorded
in `CLAUDE.md`: gate the feed, gate the thread, **and now gate Explore.**

**6. An unseeded jurisdiction shows an invitation to seed it** — *"make that the welcoming
part"* — alongside a few topics that come up most places, weighted by the members' Compass
answers. Compass is what lets a place be seeded without anyone pretending to know it: the
questions surface because the members there actually care about them.

**7. Content sourcing, over time.** Hand-authored to start; derived from what the city council
or state legislature is actually working on; and sourced from nonpartisan civic organisations
with local chapters — League of Women Voters, Braver Angels. The third is the one that scales,
because it puts people who live somewhere in charge of that place's questions. All three must
be able to coexist on one page, which is why provenance is part of the record from day one.

**8. What belongs at which level.**
- **Federal** — questions on federal issues; debates for the member's Senate and US House
  races; recent federal votes with a plain-language summary of the bill and then the tally;
  the Compass issues federal leaders attend to, such as foreign policy.
- **State** — what a governor or state legislator would care about: *"In California, it might
  be discussing the proposed Wealth Tax."* Ballot measures and the state's own calendar.
- **City / County** — as built. Walkable, visitable, a real agenda to read. "Imagine a better
  neighborhood" (`ExploreActivities.tsx`, `IMAGINE_OPTIONS`) is place-scale by construction and
  stays, as a City/County module. It is not retired and not generalised: a crosswalk game on
  the Federal tab is exactly the mismatch this phase exists to remove.
- **Unified** — *"the place to discuss world events with people from all over the world."*
- **Volunteer** — no Explore, unchanged (`hasExplore = activeTab !== 'volunteer'`). It is the
  existing precedent for a space that opts out.

**9. Tone.** Welcoming and not overwhelming. Fun to contribute a little. "A little" is load-
bearing: the unit of contribution must be small enough that a member does it on the way past.

**10. A place's topics come from what that place's government is working on.** This is the
answer to "where does LA's bespoke content come from," and it supersedes hand-authoring as the
primary source:

- **Los Angeles (City)** — what the LA City Council is working on, and the measures on the LA
  city ballot.
- **California (State)** — what the California Legislature is working on, what is on the
  California state ballot, and what the state's own officers, the Governor among them, are
  focused on.

**11. Seeding a place is a vote, not a composer.** Pressing the invitation shows the member the
prominent issues for this place and asks which they focus on, with room to request a topic of
their own. *"They're voting on the issues that could arrive."*

This resolves the tension the three obvious answers all failed. It is small enough to do on the
way past, so it meets the "fun to contribute a little" bar. It cannot mis-seed the feed, because
nothing is posted. And it needs no moderation or promotion workflow, because a vote is not
publication — the topics being voted on already exist as candidates.

Where the candidates come from is decision 10: the governing body's agenda items for places with
coverage, the by-level generic list elsewhere, with Compass ranking them. A requested topic is a
member-provenance candidate that can be voted on in turn.

Worth noticing: this is the same mechanic as the "votes on what we should do about this slice's
topics" named as a future module. One voting primitive, used at two moments — before a topic
arrives, and after. Build it once.

The generalisation: for any slice, the agenda of the body that governs it plus the measures on
its ballot. That is bespoke by construction and requires nobody to know the place — the
council's own agenda knows it. It also makes Compass's role much smaller: Compass is a ranking
and framing signal for topics that already exist, not the mechanism that produces them.

---

## Constraints

From the codebase, not negotiable without a separate decision:

- **All five feed panels plus Volunteer mount simultaneously** and are hidden with CSS, so any
  hook inside `SliceFeedPanel` runs six times. Explore is rendered once, outside that map.
  Per-slice data must either stay hoisted in `AppShell` or render only for the active tab.
  Making Explore per-tab-mounted is a decision with a real cost — six compositions resolving
  at once — and should be justified, not assumed.
- **Explore's content is read only through `src/lib/exploreData.ts`.** One file is the whole
  mock→fetch swap. Keep it that way.
- Data no API serves yet lives in **one module under `src/mocks/`** and is listed in the PR
  under "Data this needs from the API".
- **There is no topics table in `civic_spaces` and posts carry no topic id.** "Join the
  conversation" opens the create-post composer with an editable draft; it never resolves to an
  existing post.
- **`CompassTopic` carries no level or jurisdiction field** (`src/types/compass.ts`). Tagging
  Compass topics by level of government is a Compass-side change in another repo. This design
  must not block on it.
- Every Supabase call is `.schema('civic_spaces')`.
- This app never geocodes and never stores a location.
- `npm run build` (`tsc -b && vite build`) is the frontend's only automated check.
- Four-way design standard: light and dark, desktop and mobile. A change correct in three of
  the four is not done.

---

## The shape this implies

Offered as the starting point, not as a specification. The builder owns the details.

**A composition per `(slice_type, geoid)`** — an ordered list of modules, resolved when the
active tab changes. Modules are the reserved rooms: featured, questions, a vote broken down,
races and debates, something to do nearby, world questions, the invitation to seed, and
placeholders for Symposiums, Civic Listening, Common Grounds, Focused Communities and slice
action votes. A slice's composition names the modules it has and their order; everything else
is simply absent, which is what makes Federal differ from City structurally and not just in
its text.

**Topics gain a scope and a provenance.** Today an `ExploreTopic` has no slice dimension at
all and every one of them is neighbourhood-scale. It needs at minimum the level it belongs to,
the geoid it is bespoke to (null meaning "applies anywhere"), and who put it there — staff, a
local chapter, derived from an agenda or roll call, or a member. Provenance is what lets the
three sources mix without the page becoming a mess, and what lets the UI say honestly where a
question came from.

**Resolution order:** bespoke topics for this exact `(slice_type, geoid)`; failing that, the
generic topics for this level, ranked by what this slice's members have told Compass; and the
invitation to seed, which is present in the empty case and should probably be present in the
seeded case too, quietly.

**One route, not three.** `src/mocks/civicSpacesExplore.ts` currently stands in for three
routes (`explore/topics`, `explore/suggestions`, `updates`). Since the composition itself now
varies by slice, a single `GET /api/civic-spaces/explore?sliceType=&geoid=` returning the
whole composition is the more natural signature. "What's new" is product release notes, not
slice content, and stays separate.

---

## Left to the builder

- The module registry and its contract — what a module declares so `ExploreView` can render it
  without knowing each one.
- Default compositions for City, County, State, Federal and Unified beyond the content Chris
  named above.
- How Compass answers rank generic topics for an unseeded slice, and the minimum number of
  answered members below which the ranking means nothing (`MIN_SPOKES` is the existing
  precedent for refusing to draw a conclusion from too little).
- The visual design of the invitation to seed, against the four-way standard and the "fun to
  contribute a little" bar. Worth running `ui-ux-pro-max` while planning it.
- Whether Explore mounts per tab or resolves one composition for the active tab, weighed
  against the six-mount constraint above.
- Mock file structure under `src/mocks/`, and which fields the PR lists as needed from the API.

---

## What actually serves decision 10 today

Checked against the code, because the gap between what decision 10 asks for and what any API
serves is the single biggest risk to this phase. The anti-goal stands: a module with no real
source ships as a reserved empty room, never as invented civic record.

| What decision 10 wants | Source today | State |
|---|---|---|
| City council agendas | `useUpcomingMeetings` → `api.empowered.vote/api/meetings`, public, no auth | **Real, and already wired** — the `local-proposal` topic lists real agendas via `usesMeetingSources`. But coverage is only where the on-the-record pipeline runs: **Bloomington, IN, as of 2026-09-24.** Not Los Angeles. |
| Races and candidates on the ballot | `useNextElection` → the elections API | **Served and discarded.** `ElectionRecord` notes "Races and candidates are ignored here" — this app reads only the election's name and date. The races are already in the response. |
| Ballot measures (city or state) | — | Unconfirmed. The elections API may or may not carry measures; worth asking ev-accounts before designing around them. |
| State legislature's focus | — | No source. |
| Federal roll calls, bill summaries, debate schedules | — | No source. Named first in decision 8 and served by nothing. |

Two consequences worth stating plainly:

- **The one city with real agenda coverage is Bloomington, not LA.** The example Chris used for
  "bespoke" is the one that cannot be bespoke yet, and the example he used for "generic" is the
  one that can. That inverts the natural demo and it should be built and shown with Bloomington.
- **The races are free.** Surfacing the candidates already present in the elections response is
  the cheapest real content in this table, and it serves the "debates for your Senate and US
  House races" half of decision 8 without any new route.

## Settled in review

Calls made while checking this document against the code. Each is a builder-level decision, not
something Chris chose — reverse any of them freely.

- **This phase is frontend-only.** The composition resolver, the module registry and the
  per-slice content all live behind `src/lib/exploreData.ts` with samples under `src/mocks/`,
  and the route and record shape go out as a handoff document for ev-accounts. Phase 15 set
  this precedent with `TT-HANDOFF.md` and `ACCOUNTS-HANDOFF.md`. Nothing here waits on another
  repo to merge — **with one exception.** Decision 11's seed vote is a write, and it is the one
  piece that cannot be honestly mocked: a vote that evaporates on reload is worse than no vote,
  and a member who is told their voice counted when nothing was stored has been lied to. So the
  seed vote is its own plan, sequenced after a real write path exists. The structural work —
  per-slice compositions, scoped topics, sibling gating, draft re-keying — ships first and does
  not depend on it.
- **The pass bar is structural.** "Each slice feels like itself" is verified as: Federal,
  State, City/County and Unified resolve to visibly different compositions, *and* at least one
  real jurisdiction carries hand-authored bespoke topics as proof the bespoke layer works
  end to end. Asheville, NC is the natural choice — it is already the dev fixture city. Seeding
  LA, Bloomington and the rest is content work, which the non-goals defer.
- **Explore drafts are re-keyed to `(sliceType, geoid, topicId)`.** Today `cs_explore_drafts`
  and `cs_explore_resume` key on `TopicId` alone, and a draft binds to one slice on first save.
  Once a generic topic can appear on two tabs, one key with one binding is the path by which a
  federal question reaches a city feed. In-flight drafts are dropped rather than migrated:
  Explore shipped 2026-10-22, the drafts are local to one browser, and a migration for a
  two-day-old key costs more than it saves.
- **No geoid means the generic composition.** A signed-out visitor and a signed-in member with
  no local jurisdiction both render Explore today (`destination={null}`). Both get the
  by-level generic composition with no bespoke layer and no seed invitation, since neither can
  seed a place the app cannot name.
- **A Unified-only member may post to Unified from Explore.** Today they are told they need a
  local community. That falls out of decision 4 and is a fix, not a regression: Unified is a
  space they genuinely belong to.

## Known open questions

Carried deliberately rather than guessed:

- **Whether the elections API carries ballot measures**, as opposed to only races and
  candidates. Decision 10 asks for measures at both city and state level. Ask ev-accounts
  before designing a module around them.
- Compass aggregation is **no longer load-bearing** after decision 10, which is a relief: the
  design no longer needs a slice-wide view of members' political answers, and the privacy
  question that came with it does not have to be opened. Compass ranks and frames topics the
  governing body's agenda has already produced.
- Tagging Compass topics by level of government is a Compass-side change. Until it exists, the
  level tag can live on the Explore topic record and reference a `compassTopicId`, which keeps
  this repo unblocked.
- Whether a partner chapter (LWV, Braver Angels) is a kind of author or a kind of account is
  unsettled, and does not need settling to ship the shape — provenance is a string either way.
