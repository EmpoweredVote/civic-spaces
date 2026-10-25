# ev-accounts — request from Civic Spaces: one Explore route, five gaps, and a bug

**From:** Civic Spaces (`C:\Civic Spaces`), Phase 16 — Explore by slice
**Written:** 2026-10-25
**Audience:** whoever works `C:\EV-Accounts` next
**Companion docs:** `16-DESIGN.md` (the product decisions this comes from) and
`16-RESEARCH.md` (every call behind the claims below, with the responses) in this
directory. `15-tool-deep-links/TT-HANDOFF.md` is the precedent for the shape.

**Nothing in Civic Spaces is blocked on any of this.** Phase 16 is frontend-only by
decision, not by accident: everything below either already ships against a public route
or ships as a reserved empty room that says what it is for. We are writing it down
because four reserved rooms in Explore stay empty until something here changes,
and because Ask 6 is a live bug that affects consumers who have never heard of Civic Spaces.

Each ask has the same three parts: **what we want**, **what we checked**, and **what
this repo does once it lands**. Claims marked *verified live 2026-10-25* are ours, made
today through the `/api` proxy against `api.empowered.vote`. Claims attributed to
`16-RESEARCH.md` were made on 2026-10-24 and are cited rather than re-run.

---

## First: what is already working, and it is more than we expected

Two of this design's three content sources turned out to exist, and one of them we had
written off entirely. That is worth saying before anything else.

**`GET /api/meetings/:id/agenda-items` carries exactly what this design needed.** It is
public, unauthenticated, and this app was not calling it at all. Bloomington's latest
Common Council agenda arrives as structured items with **verbatim titles** (the migration
comment says "preserved for provenance"), `legislationRef` ("extracted from the agenda,
never invented"), `stage` ("adapter-encoded body rules, never LLM-inferred"),
plain-language summaries, and a `sourceUrl` pointing at the agenda PDF. That is the whole
of this design's decision 10 — *"a place's topics come from what that place's government
is working on"* — reachable from one route.

The consequence is the one we most wanted and least expected: **Bloomington's Explore is
bespoke to Bloomington, and nobody at Empowered Vote wrote a word about Bloomington.**
The council's own agenda knows the place. Whoever built that pipeline built the thing
that makes this design possible without central editorial, which was its hardest anti-goal.

**Debate and forum recordings join to races by `raceIds`.** `16-DESIGN.md` listed
candidate debates under "no source". They exist: 26 `debate` and 19 `forum` rows, 45 of
them carrying `raceIds` that join cleanly to the elections response (verified live
2026-10-25). *"Watch the debate for your race"* shipped in Phase 16 because of it. One of
those rows is an **LWV candidate forum**, which is decision 7's nonpartisan-partner
sourcing model already present in the data.

The asks below are the gaps around those two, not a complaint about them.

---

## Why Civic Spaces is asking

Each member is placed into civic slices — City, County, State, Federal, Unified — and as
of Phase 16 each slice's Explore is **bespoke to its jurisdiction**, keyed on
`(slice_type, geoid)`. LA is not Bloomington; California is not Missouri; two shards of
one city are identical. The content a slice needs is *what that place's government is
working on*: the council's agenda, the races on its ballot, the measures on it.

We built everything reachable from the public API. These are the pieces that are not, and
one endpoint that answers the wrong question.

---

## Ask 1 — one route that returns the whole composition

```
GET /api/civic-spaces/explore?sliceType=<city|county|state|federal|unified>&geoid=<fips|null>
```

returning the ordered module ids, the topics with their level, geoid and provenance, and
the bespoke layer already resolved server-side.

**What we checked.** `/api/civic-spaces/explore` returns `404 Cannot GET` today, as do
`/explore/topics` and `/updates` (verified live 2026-10-25). `civic_spaces/` in
ev-accounts currently contains the slice-assignment engine and nothing else.

### Why one route, not the three our mock stands in for

`src/mocks/civicSpacesExplore.ts` stands in for three routes — `explore/topics`,
`explore/suggestions` and `updates` — because that is how the page was built before it
varied by slice. It does now, so a single response is the natural signature: **the
composition itself is the thing that differs between Federal and City**, not merely the
text poured into a fixed frame. Returning the module list and the topics together means
one request per tab change and no way for the two halves to disagree.

"What's new" is the exception and should stay separate: it is product release notes, not
slice content, and it is identical on every slice.

### The record shape

This is not a sketch. It is `src/types/explore.ts`, which is already written, already the
contract between our mock and our UI, and already carries every field the rendered page
reads. Copied verbatim so there is nothing to infer:

```ts
export type ExploreLevel = 'federal' | 'state' | 'county' | 'city' | 'unified'

export type TopicProvenance =
  | 'staff'                 // written at Empowered Vote. A conversation starter.
  | 'chapter'               // a nonpartisan local chapter (LWV, Braver Angels).
  | 'derived-from-agenda'   // built from a published agenda item. Verbatim title.
  | 'derived-from-vote'     // built from a published roll call.
  | 'member'                // requested by a member of this place.

export interface ExploreTopic {
  id: string
  category: string
  title: string
  summary: string
  whyItMatters?: string          // optional: an agenda item does not carry one,
                                 // and writing one for it would be inventing record
  question: string
  suggestedTitle: string         // pre-filled, editable post title; <= 200 chars
  blurb?: string
  usesMeetingSources?: boolean

  level: ExploreLevel
  geoid: string | null           // null = "applies anywhere at this level"
  provenance: TopicProvenance

  sourceLabel?: string           // e.g. "Ordinance 2026-22 · Second reading"
  sourceUrl?: string             // the published document
  sourceDate?: string
  summaryIsGenerated?: boolean   // see below — this one is not optional to us
  compassTopicId?: string        // a REAL id from GET /api/compass/topics
}

export interface ExploreComposition {
  key: string                    // normalised (sliceType, geoid)
  level: ExploreLevel
  geoid: string | null
  modules: ModuleId[]            // ordered — this is the point of the route
  topics: ExploreTopic[]
  featuredTopicId: string | null
  questionTopicIds: string[]
  isUnseeded: boolean            // no bespoke topic exists for this exact key
}

export type ModuleId =
  | 'intro' | 'featured' | 'questions' | 'imagine' | 'nearby' | 'coming-up'
  | 'agenda' | 'races' | 'debates' | 'whats-new' | 'seed-invitation'
  | 'legislator-votes' | 'ballot-measures' | 'federal-votes' | 'debate-schedule'
  | 'symposiums' | 'civic-listening' | 'common-grounds' | 'focused-communities'
  | 'slice-action-votes'
```

### 🔴 `provenance` is not optional, and neither is the generated-summary flag

Decision 7 of this design is that **three content sources have to coexist on one page**:
Empowered Vote staff, a nonpartisan local chapter such as the League of Women Voters, and
a government body's own published agenda. The third is the one that scales, because it
puts the people who live somewhere in charge of that place's questions. The UI has to be
able to say honestly which is which, on each card, or the page becomes a mess in which a
staff-written prompt and a council ordinance look the same.

So `provenance` rides on the record from day one, and we render it: "Conversation
starter", "From the Common Council's agenda of 14 October 2026", "From a local partner
organization", "Suggested by a member here".

**The specific sub-ask: flag a machine-written summary as one.** `summaryPlain` on an
agenda item is a plain-language *interpretation*, not the agenda's words — the migration
header says so, and we infer it from that comment. We then render, under every such card:
*"The title and the reference above are the source's own. The summary was written
automatically from that record, not by the source."* We would much rather read a field
than a migration comment. A boolean on the response (`summaryIsGenerated`, or whatever
you call it) makes that honest by contract instead of by our reading of your SQL.

### What Civic Spaces does once Ask 1 lands

`src/lib/exploreData.ts` is the seam, deliberately shaped async from day one so this
would be a swap and not a rewrite. The change is **one `queryFn`**:

```ts
// today
queryFn: (): ExploreCompositionPayload => ({ sliceType, geoid, generic: GENERIC_TOPICS[level], bespoke })
// after
queryFn: () => fetch(`${EV_API_ORIGIN}/api/civic-spaces/explore?sliceType=${…}&geoid=${…}`).then(r => r.json())
```

and then `src/lib/agendaTopics.ts` and `src/hooks/useAgendaItems.ts` are **deleted
outright** — they exist only because we derive the bespoke layer client-side today. Two
client-side requests per tab collapse into one.

---

## Ask 2 — ballot measures

**What we want:** the measures on a member's ballot for a given area, alongside the races
already returned.

**What we checked.** This is the one `16-DESIGN.md` listed as "unconfirmed — research
should establish this". It is established, and the answer is that nothing anywhere in
ev-accounts serves them:

- **No `measures`, `propositions` or `referendums` key** at any level of any elections
  response. Re-verified live 2026-10-25 on four areas (Asheville city, North Carolina,
  LA city, California): every `elections[]` object has exactly the keys `election_id`,
  `election_name`, `election_date`, `election_type`, `jurisdiction_level`, `races`.
- **No table.** The election schema is exactly three tables — `elections`, `races`,
  `race_candidates` (`backend/migrations/042_election_schema.sql`) — and a grep of every
  migration and of `backend/src` for ballot-measure / question / initiative / referendum
  / proposition table or column names returns nothing (`16-RESEARCH.md` Finding 1).
- **Not modelled as races either.** 548 distinct `position_name`s scanned for
  `prop|measure|referend|ballot question|amendment|bond|levy|initiative|retention`:
  **zero matches** (`16-RESEARCH.md` Finding 1). Re-checked live today on the four areas
  above: zero again, across 556 race rows and 502 distinct `position_name`s.
- `GET /api/essentials/voter-info` is address-keyed (Google Civic) and returns polling
  places and sample-ballot URLs only. Unusable here — **this app never takes an address,**
  by design, and never will.

**We are not asking for a timeline.** We are asking whether ballot measures are on
anyone's map at all, because the answer changes nothing about what we ship: the room
stays reserved either way, and we would simply rather know. If the answer is "not
planned", that is a useful answer and we will record it as settled.

**What Civic Spaces does once it lands:** the `ballot-measures` module, already reserved
on City, County and State, becomes a real module. Per measure we would render the
question as it appears on the ballot, and — this is the part that makes it worth
reading — **what a yes and a no would each do**, in the words of whoever publishes it.
We will not write that ourselves.

---

## Ask 3 — a plain-language summary of a bill. The highest-value single ask here.

Worth saying plainly: if only one thing in this document gets done, we would pick this
one. It is the only ask that unblocks a module Chris named **first** when describing what
Federal should be.

**What we want:** a plain-language account of what a bill does, attached to the bill — or,
failing that, **a bill title on the federal vote row**. Even the title alone changes what
we can build.

**What we checked** (verified live 2026-10-25, Todd Young, US Senate IN,
`GET /api/essentials/politicians/:id/votes?limit=100`):

| Field | Reality |
|---|---|
| `yea_count` / `nay_count` / `result` / `position` | **Present and good.** `84 / 6 / passed`, with the member's own position. |
| `bill_title` | **Empty on all 100 rows.** |
| `vote_question` | The only text there is: `"On the Cloture Motion H.R. 6644 RC# 44"` |
| newest `vote_date` | 2026-03-02 |
| `bills` for the same member | **0 rows** |

And `16-RESEARCH.md` Finding 6, over ~350 sampled bill rows across 12 members: `summary`
**empty on every one**, `topic_tags` null. State bills carry a short title and nothing
more.

So decision 8 of `16-DESIGN.md` — *"recent federal votes with a plain-language summary of
the bill and then the tally"* — **cannot ship as specified, and the half that is missing
is the half that makes it worth reading.** A tally on its own is a number nobody can act
on: 84–6 on "the Cloture Motion H.R. 6644 RC# 44" tells a member nothing they could form
a view about. We will not write the summary ourselves; inventing an account of what a
bill does is invented civic record in the form that is hardest for a reader to detect.

So the module ships as a reserved room whose copy says, in full:

> **A recent vote, explained** — A tally is only worth reading beside a plain-language
> account of the bill it settled, and no such account exists in our data yet — so the
> number waits here for one.

**What Civic Spaces does once it lands:** the `federal-votes` module becomes the lead of
the Federal tab, exactly as decision 8 asks — the summary, then the tally, then "what do
you think". With a **title only**, we would ship a reduced version: the bill's name, the
tally, and a link out, which is worth considerably more than the roll-call question
string and considerably less than the summary.

---

## Ask 4 — a debate that has not happened yet

**What we want:** notice of a scheduled debate or candidate forum, the way
`?status=scheduled` already works for council meetings.

**What we checked** (verified live 2026-10-25, `GET /api/meetings`): 171 rows, **every
single one `status: "published"`**, and **zero** with a `startsAt` in the future. 45 of
them are `debate` or `forum` rows carrying `raceIds`, and they are excellent — we use
them. They are all recordings.

So *"watch the debate for your race"* shipped, and *"the debate for your race is on
Thursday"* has no source. Those are different products: the first is a thing to catch up
on, the second is a reason to be somewhere at a particular time, which is the one a civic
space actually wants.

Worth noting what is already in the data on the partner side: one of those rows is an
**LWV Candidate Forum** for House District 61 and Monroe County Commissioner. The
nonpartisan-partner model `16-DESIGN.md` decision 7 describes is not hypothetical; it is
already producing content. Scheduling is the piece that is missing from it.

**What Civic Spaces does once it lands:** `debate-schedule`, reserved on Federal today,
renders upcoming debates for the member's own races, beside the recordings module that
already works. If a scheduled row simply gained a future `startsAt` and a non-`published`
status, that is all we need — no new route.

---

## Ask 4b — a cheaper way to find the debates we already use

Small, concrete, and the only performance ask in this document.

**What we want:** either of

```
GET /api/meetings?eventKind=debate,forum
GET /api/meetings?raceIds=<uuid>,<uuid>,…
```

**What we checked** (verified live 2026-10-25). To render "the debates recorded for your
races", we download the **entire published meetings list — 234,381 bytes, 171 rows — and
keep the 45 that are `debate` or `forum` with `raceIds`.** Those 45 rows are 58,419
bytes: a **75% reduction** for the exact same answer.

That download is the plan's own choice and it is the better of the two options available
today — the alternative, `GET /api/meetings?raceId=<uuid>`, is one request per race and a
member has 10–20 races. There is no third option in the API: `/api/meetings` takes
`city`, `state`, `status` and `raceId`, and nothing else.

⚠ **`?eventKind=debate` is currently accepted and silently ignored** — it returns the
identical 234,381-byte body as the unfiltered call. An unknown query parameter that
returns everything rather than erroring is its own small trap; a consumer who assumes it
worked ships a 234 KB request believing it is 8 KB.

**What Civic Spaces does once it lands:** one line in `src/hooks/useRaceMedia.ts` and the
Federal and State tabs get 176 KB lighter.

---

## Ask 5 — something slice-scoped about a legislature

**What we want:** any route that answers *"what is this legislature working on"* for a
jurisdiction. A bill list, a search, a calendar — any of them.

**What we checked** (`16-RESEARCH.md` Finding 6, plus live spot-checks 2026-10-25):

- **There is no slice-scoped route at all.** No federal or state bill list, no bill
  search, no legislative calendar. The only legislative data is **per politician id**, so
  a slice-level view would be N requests across the member's representatives.
- **Coverage is per member, not per place,** which means which modules a jurisdiction can
  show is *not predictable from `(slice_type, geoid)`* — and that key is the whole basis
  of this design. Of 12 members probed, 5 had votes and 5 had bills. Live today: Todd
  Young (IN) has 100 votes; **Thom Tillis (NC) has 0 votes and 0 bills**, and NC is our
  dev fixture's state.
- **Staleness is uneven.** Federal votes stop at **2026-03-02**; the CA Assembly runs to
  **2026-09-01** (`16-RESEARCH.md` Finding 6). Our research flagged the cause as an
  assumption, not a finding — **is that ingestion lag, or is it by design?** We would
  rather record your answer than our inference.
- LA council votes are per council file (`GET /api/council-files/:fileNumber`), not
  listable by place. Nothing serves a Governor's priorities.

**We are deliberately not building on the partial data.** A "How your legislators voted"
module that works for Indiana and is blank for North Carolina is worse than one that is
honestly empty everywhere, because the member in the blank state concludes the app is
broken or that their representatives do not vote. So the `legislator-votes` room says:

> **How your legislators voted** — Roll-call records exist for some of the people who
> represent you and not for others, and a page that answers for half of them answers for
> nobody — so this space waits until the record is even.

**What Civic Spaces does once it lands:** `legislator-votes` becomes a real State module.
If the answer is "coverage will stay uneven", we would rather know that too — the module
is then a permanent non-goal and we will stop reserving room for it.

---

# 🔴 Ask 6 — a bug report: a state-area elections query is wrong in both directions

This one is a different kind of thing from the asks above. It is not a missing feature; it
is a live endpoint returning a confidently wrong answer, and **it affects consumers who
have never heard of Civic Spaces.** It is separated here for that reason.

`POST /api/essentials/browse/elections-by-area`, body `{ "geo_id", "mtfcc" }`.
**All rows re-verified live on 2026-10-25**, through the `/api` proxy to
`api.empowered.vote`:

| Query | Result | Why it is wrong |
|---|---|---|
| North Carolina state `37 / G4000` | 14 races — **all 14 `U.S. Representative District N`**, and **no `U.S. Senate North Carolina`** | A member has one House district, not fourteen. And the Senate seat is statewide — it is on *every* NC member's ballot. |
| Asheville city `3702140 / G4110` | 2 races: `U.S. Representative District 11` **and `U.S. Senate North Carolina`** | Correct. The **city** area has the statewide race the **state** area omits. |
| California state `06 / G4000` | 3 elections, 493 races, 456 KB — **no Governor** | Same omission, different state. |
| Los Angeles city `0644000 / G4110` | 47 races — **including Governor** | Again, the city area has what the state area lacks. |
| `US / G4000` | **HTTP 500** — `{"code":"INTERNAL_ERROR","message":"Failed to fetch election data"}` | A federal-level lookup is not an unreasonable thing to attempt, and a 500 gives a caller nothing to handle. |

So a state-area query is wrong **in both directions at once**: it returns races that are
not the member's, *and* it omits the statewide races that are. The failure is quiet —
every response is a 200 with plausible-looking content, and a consumer rendering "races on
your ballot" from a state area shows a Californian a ballot with no Governor on it.

**Probable cause, offered as a lead rather than a claim.** `stateAbbrev` appears to be
resolved from a `geofence_boundaries` row for the queried area, and statewide races are
matched only when it is non-null (`getOverlappingGeoIdsForArea`, `getElectionsByGeoIds`).
That would explain both halves in one. 🔴 **The behaviour above is verified; this cause is
our reading of your source, not a finding.** Please treat it as a starting point.

### 🔴 Blast radius: Treasury Tracker consumes the same endpoint family

Any consumer asking a **state-level** question about races is getting the same wrong
answer, and unlike us they may not have noticed — nothing about the response looks like a
failure. We found it only because our design put a member's own US House race on screen
and the wrong districts showed up.

**Civic Spaces is not blocked**, and the shape of the workaround is worth knowing because
it costs us something. `racesAreaFor` (`src/lib/exploreComposition.ts`) asks about the
member's **city, else their county, else nothing at all** — there is deliberately no state
fallback and `('US','G4000')` is never sent. So a member who has no city and no county
slice gets **no races module**, which is the honest answer today: fourteen House races a
member cannot choose between is worse than none. We are reporting this because it is not
only ours.

**What Civic Spaces does once it is fixed:** nothing immediately — and that is the point of
having routed around it. Later we delete that no-state-fallback rule, and **a member with
only a State slice gets their statewide races**, which today they cannot have at all.

---

## What Civic Spaces does once each of these lands — one line each

| Ask | What changes here |
|---|---|
| **1** — one Explore route | One `queryFn` in `src/lib/exploreData.ts` becomes a fetch; `agendaTopics.ts` and `useAgendaItems.ts` are deleted; two requests per tab become one. |
| **1b** — `summaryIsGenerated` on the wire | We stop inferring "machine-written" from a migration comment and start reading a field. |
| **2** — ballot measures | `ballot-measures` becomes a real module on City, County and State: the question as it appears on the ballot, and what a yes and a no would each do. |
| **3** — a bill summary | `federal-votes` becomes the lead of the Federal tab — summary, tally, then the conversation. With a bill **title** only, a reduced version ships instead. |
| **4** — a scheduled debate | `debate-schedule` renders upcoming debates for the member's own races, beside the recordings that already work. |
| **4b** — an `eventKind` filter | One line in `useRaceMedia.ts`; Federal and State get 176 KB lighter. |
| **5** — slice-scoped legislative activity | `legislator-votes` becomes a real State module. A "coverage will stay uneven" answer retires it instead, which is also useful. |
| **6** — the state-area bug | Nothing immediately — we already route around it. Later, a State-only member gets their statewide races. |

## Acceptance, from the consumer side — for Ask 1 specifically

What a response has to do before we switch `exploreData.ts` over:

1. `GET /api/civic-spaces/explore?sliceType=city&geoid=1805860` returns **200** with
   `modules`, `topics`, `featuredTopicId`, `questionTopicIds` and `isUnseeded`, and every
   `ModuleId` in `modules` is one of the twenty in the union above. An unknown id must be
   an error we can see, not a module we silently skip.
2. **The key is `(slice_type, geoid)` and nothing else.** Two shards of one city must
   return byte-identical compositions; `slice_id` must not reach the response. This is
   already the key the sibling-read RLS policy uses
   (`supabase/migrations/20260917000000_sibling_slice_read_access.sql`).
3. **`federal` and `unified` key on `sliceType` alone.** Our dev fixture uses geoid
   `'3711'` for federal and `''` for unified where production uses `'US'` and `'UNIFIED'`;
   if the route keys those two on geoid, localhost resolves a different composition than
   production and we will not notice until it ships.
4. 🔴 **A jurisdiction with nothing bespoke returns the generic set for its level with
   `isUnseeded: true` — it does not 404.** A 404 and an unseeded place are different
   things and the UI treats them differently: a 404 is an error state, an unseeded place
   is a *welcome* — it leads with the invitation to seed it and shows the by-level topics
   underneath. Returning 404 for Peoria would turn the single most common case in the
   product into an error page.
5. Every `topic.compassTopicId` is a **real** id from `GET /api/compass/topics`. An
   invented one matches nothing, so Compass ranking and the level filter both become
   silent no-ops and nothing fails to tell anyone.
6. Every `topic.sourceUrl` is `http`/`https`. We validate before rendering — those URLs
   are first-party but scraped — but a `javascript:` URL arriving from this route would
   mean something upstream is wrong.

---

## One coverage note, which is not an ask

The agenda pipeline runs in **one city nationally** (Bloomington, IN — 4 scheduled
agendas; Asheville and Los Angeles have zero council rows). That makes the agenda room
*what almost every member sees*, and it is why that room's copy had to be written as a
welcome rather than a shrug.

**We are not asking for a particular city.** The pipeline runs where it runs, and that is
content work rather than API work. We are saying it so that whoever reads this knows
which lever matters: for decision 10 — *"a place's topics come from what its government is
working on"* — **the API is not the limiting factor. Coverage is.** Ask 1 would make the
route right; a second city would make the product real.

---

Questions on any of this go to Chris. The consumer-side design is `16-DESIGN.md` in this
directory, and `16-RESEARCH.md`'s Appendix lists every call made, with its response.
