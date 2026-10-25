# Phase 16: Explore by Slice - Research

**Researched:** 2026-10-24
**Domain:** Per-jurisdiction composition of an existing React/TypeScript forum surface, fed by the public ev-accounts API (elections, meetings, politicians, Compass)
**Confidence:** HIGH on code structure and live API shapes (read directly); MEDIUM on backend causes (inferred from ev-accounts source, not confirmed with its owners)

Verification labels used throughout:

- `[VERIFIED: live <call>]` - I called the public API on 2026-10-24 and read the response. Calls are listed in the appendix.
- `[VERIFIED: code <path:line>]` - read in this repo at `origin/main` fb32425.
- `[VERIFIED: ev-accounts <path>]` - read from `origin/master` ed387ed39 (2026-10-24) with `git show` / `git grep`. Working trees were not touched.
- `[ASSUMED]` - my inference. Listed again in the Assumptions Log.

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied from `16-CONTEXT.md`. Where CONTEXT and `16-DESIGN.md` disagree, the design wins (CONTEXT says so). I found one such disagreement - see "Contradictions" item 7.

### Locked Decisions

These came from the user and are not open for the planner to revisit:

1. **Each slice composes its own Explore** - an ordered set of modules per slice, not one shared frame filled in differently.
2. **Bespoke per jurisdiction, keyed `(slice_type, geoid)`.** LA != Bloomington. California != Missouri. Sibling shards of one jurisdiction are identical.
3. **Explore follows the active tab**, replacing today's `homeSlice` binding.
4. **Read-only on a sibling shard - no Join buttons.** Gate the feed, gate the thread, gate Explore.
5. **A place's topics come from what its government is working on** - the council's agenda and the city's ballot measures; the legislature, the state ballot, the Governor.
6. **Seeding an unseeded place is a vote, not a composer.** Show prominent issues, let the member pick what they focus on, let them request their own.
7. **Compass ranks topics; it does not produce them.** No slice-wide aggregate of members' political answers is needed, and none should be designed.
8. **Volunteer keeps no Explore.** Unchanged.
9. **"Imagine a better neighborhood" stays, as a City/County module.**

Scope fences - in scope: per-slice composition resolution keyed on `(slice_type, geoid)`; a module registry so `ExploreView` renders modules without knowing each one; scoped topic records carrying level, geoid and provenance; Explore following the active tab and the sibling-shard read-only gate; re-keying Explore drafts to `(sliceType, geoid, topicId)`; surfacing the races already present in the elections response; one real jurisdiction hand-seeded end to end as proof - **Bloomington, IN**.

Constraints the planner must respect: all five feed panels plus Volunteer mount simultaneously (Explore renders once, outside that map); Explore content is read **only** through `src/lib/exploreData.ts`; data no API serves lives in one module under `src/mocks/` and is listed in the PR under "Data this needs from the API"; no topics table in `civic_spaces` and posts carry no topic id ("Join the conversation" opens the composer with an editable draft); `npm run build` is the only automated check; four-way design standard (light + dark, desktop + mobile); this phase is frontend-only with a handoff doc for ev-accounts (precedent: `15-tool-deep-links/TT-HANDOFF.md`, `ACCOUNTS-HANDOFF.md`).

Anti-goals (failure even if it ships working): central editorial as the only path to content; a post landing in the wrong jurisdiction; offering a write RLS can only reject; overwhelming the member; **invented civic record** - a module with no real source ships as a reserved empty room.

Verification bar: Federal, State, City/County and Unified resolve to visibly different compositions; Bloomington carries real agenda-derived content end to end; a sibling shard shows Explore with **no** write affordance anywhere in it; a draft started on one tab cannot post to another jurisdiction; light + dark, desktop + mobile all check out.

### Claude's Discretion

CONTEXT.md has no discretion section. `16-DESIGN.md` "Left to the builder" is the equivalent:

- The module registry and its contract - what a module declares so `ExploreView` can render it without knowing each one.
- Default compositions for City, County, State, Federal and Unified beyond the content Chris named.
- How Compass answers rank generic topics for an unseeded slice, and the minimum number of answered members below which the ranking means nothing (`MIN_SPOKES` is the precedent).
- The visual design of the invitation to seed.
- Whether Explore mounts per tab or resolves one composition for the active tab.
- Mock file structure under `src/mocks/`, and which fields the PR lists as needed from the API.

### Deferred Ideas (OUT OF SCOPE)

- Building Symposiums, Civic Listening, Common Grounds, Focused Communities, or slice action votes. Reserve their slots and stop.
- Solving content sourcing at scale.
- Moderation, review or promotion workflow for member-contributed topics.
- **The seed vote itself** - it is a write, and a vote that evaporates on reload is worse than no vote. It is sequenced as its own plan once a real write path exists. The structural work must not depend on it.
</user_constraints>

## Project Constraints (from CLAUDE.md)

Directives the plan must honour (CLAUDE.md has the same authority as locked decisions):

- **Hoisting landmine.** Every feed panel is mounted at once; a hook inside `SliceFeedPanel` runs 6x. Shared data hooks live in `AppShell` or in a component rendered once for the active tab (`ActiveEventsWidget`, `SliceSelector`).
- **Three-half view-only gate.** `isViewOnly` must reach `SliceFeedPanel` and `ThreadView`; Phase 16 adds Explore as the third half.
- **Every Supabase call is `.schema('civic_spaces')`.** Phase 16 adds none (frontend-only, no writes).
- **App never geocodes and never stores a location.** The elections lookup is by geoid + MTFCC, which is compliant; do not add address handling.
- **No invented data; fixtures only in `src/lib/devMockData.ts` / one module under `src/mocks/`**, listed in the PR under "Data this needs from the API". Never copy real members' posts or profiles into fixtures.
- **`npm run build` (`tsc -b && vite build`) is the only automated check.** No test framework; do not add one casually.
- **Design standard.** Light + dark x desktop + mobile; never define a colour only inside `dark:`; light text `gray-900/600/500` (`gray-400` is decoration); dark `gray-400` not `gray-500` for small text; resolve contrast through a canvas (Tailwind v4 emits `oklch()`); use EV brand tokens, `WidgetCard`, `react-loading-skeleton`, `motion/react`.
- **`cs_token` is this app's key, not `ev_token`.**
- **Branch from `origin/main` after `git fetch`; `main` needs passing `build` + one review.** A PR touching only `.planning/**` / `*.md` auto-approves.
- Run `ui-ux-pro-max` while planning any layout change (design doc says the same for the seed invitation).

## Summary

The design is buildable, and the cheapest real content is better than the design assumed in one place and worse in two. **Better:** Bloomington's council agenda is available as structured items with plain-language summaries, legislation references and source links through a *public, unauthenticated* sub-route that the app does not call today (`GET /api/meetings/:id/agenda-items`). Recorded debates and candidate forums are linked to races by `raceIds` and join cleanly to the elections response. Per-politician bills and roll-call votes exist for some state legislators and some senators. **Worse:** the elections API carries **no ballot measures at all** (no field, no table, none in 548 distinct race names), federal roll calls arrive without bill titles or summaries, and nothing anywhere carries a plain-language bill summary. The elections endpoint also behaves in a way the existing app code (and the design's "the races are free") does not expect: asked about a *state* it returns every congressional district and omits statewide races, so the Federal and State modules must query by the member's most local area.

Structurally, `ExploreView` is a fixed five-section page with module-level content constants and a closed `TopicId` union, so the module registry is a real refactor, not a wrapper. The good news is the precedent for the hard part already exists in `AppShell`: `ActiveEventsWidget` and `ActiveAboutWidget` render once, for the active tab only, so resolving one composition for the active tab (not six) matches how the shell already works. The write surface to gate is larger than "the Join button": three code paths reach the composer and six more controls write drafts to localStorage. Draft storage is small (four keys, one map) and re-keying touches 14 call sites in two files plus `AppShell`.

**Primary recommendation:** Build the registry and per-tab composition first with the seam in `exploreData.ts` shaped as an async hook from day one; ship Bloomington as the proof city using the real agenda-items route (falling back to the most recent agenda, because no upcoming meeting is published today); source the Federal and State races from the member's most local area, not their state; and ship ballot measures, bill summaries and Federal debate *schedules* as reserved empty rooms with a handoff asking ev-accounts for them.

## Contradictions with the design (read this first)

Each of these is a place where a live API or the code disagrees with `16-DESIGN.md` or `16-CONTEXT.md`. I have not re-opened any decision; these change *how to build*, or what a "no source" row should say.

| # | Design / CONTEXT says | Evidence says | Effect |
|---|---|---|---|
| 1 | Ballot measures: "Unconfirmed... ask ev-accounts" | **Answered: not served.** No `measures` key on any of 8 live responses; no table (042 schema + a grep of all migrations and `backend/src` for ballot/measure/referendum/proposition table or column names returns nothing); 0 measure-like names in 548 distinct `position_name`s. Only product-vision and campaign-finance prose mentions measures. | The ballot-measures module is a reserved empty room. Add to handoff. |
| 2 | "State legislature's focus - No source"; "Federal roll calls, bill summaries, debate schedules - No source" | **Partly wrong.** Public per-politician routes `/api/essentials/politicians/:id/{votes,bills,legislative-summary}` exist. Of 12 members probed, 5 had votes, 5 had bills (details in Finding 6). Roll-call tallies exist; **no bill summary exists anywhere** (`summary` empty on all ~350 bill rows sampled). Federal votes have no bill title. Nothing is slice-scoped. Debates: recorded `debate`/`forum` media exist with `raceIds` (45 rows), but **no upcoming debate is published** - so "schedule" is still no source, "recordings" is a source. | "Federal: summary then tally" is unreachable (no summary). "State: how your legislators voted" is reachable for some states. Debates: "watch past debates for races on your ballot" is reachable. |
| 3 | "`useUpcomingMeetings`... Real, and already wired" and the meeting record may carry agenda items (research Q2) | The meetings *list* has no items (title, kind, date, `sourceUrl`, ...). Items are a **separate public route** with the fields decision 5 needs. But the hook returns **zero rows today**: the newest scheduled Bloomington meeting is 2026-10-14, ten days before today. | Decision 5 is fully reachable for Bloomington, but "upcoming" is empty right now and will be about half the time. Derive from the most recent agenda, not only the next. |
| 4 | "The races are free"; `electionAreaFor` asks about the member's state for Federal/Unified (`useNextElection.ts:41-53`, comment: "the ballot where their federal races appear") | **State-area queries return the wrong set.** Indiana state area: all 9 US House districts. Bloomington city area: only District 9. State-area also **omits statewide races**: NC state area has no `U.S. Senate North Carolina` (Asheville city area has it); California state area has 0 `STATE_EXEC` rows - no Governor (LA city area has it). Federal geoid `US` -> HTTP 500. | Races modules (Federal and State) must query by the member's most local area. Never pass `('US','G4000')`. |
| 5 | "`CompassTopic` carries no level or jurisdiction field" (design Constraints; `src/types/compass.ts`) | The live API **does** send `applies_federal`, `applies_state`, `applies_local`, `applies_judicial`, `applies_school`, `roles[].role_scope`, `categories`. The TS type just does not declare them. But they are coarse: 45 of 60 topics are flagged Federal+State+Local (including "Ukraine Support"). | Fields can *exclude* (6 local-only topics must not appear on Federal) but cannot *select* "what federal leaders attend to". The design's plan (level tag on the Explore topic record + `compassTopicId`) is still right. |
| 6 | Dev fixture and production agree on keys | `MOCK_SLICES.federal.geoid` is `'3711'` and `unified` is `''` (`src/lib/devMockData.ts`). Production is `'US'` and `'UNIFIED'` (ev-accounts `CC_0039`, `sliceAssigner.ts:15`; repo `20260902000100_slice_taxonomy.sql:88`). | Key federal/unified/volunteer on `sliceType` alone, or local dev resolves a different composition than production. |
| 7 | DESIGN "Settled in review": proof jurisdiction is **Asheville, NC**. CONTEXT scope fence: **Bloomington, IN**. (CONTEXT says design wins on conflict.) | Asheville has **0** meetings (`/api/meetings?city=Asheville`), 2 races loaded, and is the dev fixture city. Bloomington has 4 scheduled agendas, 20 races, a candidate forum, and 8 ordinance/resolution items with plain-language summaries on its latest agenda. The dev id's city is Asheville, so **Bloomington cannot be seen locally** without a fixture change or a real token. | Needs the owner's call. Research recommends Bloomington (agreeing with CONTEXT and the "builds and shows with Bloomington" paragraph in DESIGN) and a dev-only way to point the fixture at it. See Open Question 1. |
| 8 | `CLAUDE.md`: `useRepresentatives`, `useToolCoverage`, `useCompassData` are "each called once" in `AppShell` | On `origin/main`, only `useRepresentatives` is called (`AppShell.tsx:419`). `useCompassData` and `useToolCoverage` are defined and never called; `CompassWidget` imports only a type. | "Compass ranks topics" has **no running consumer**. Hoist `useCompassData` deliberately (it needs the member token; it 401s for the dev id). CLAUDE.md is stale here. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve composition for `(sliceType, geoid)` | Browser / Client (`src/lib/exploreData.ts`) | API / Backend (later: `GET /api/civic-spaces/explore`) | Phase is frontend-only; the seam in one file is the swap point. |
| Races, candidates | API / Backend (elections-by-area) | Browser (filter, group, label) | Served today; client must filter `candidate_status` and group across elections. |
| Agenda-derived topics (Bloomington) | API / Backend (meetings + agenda-items) | Browser (derive topic records) | Source is structured; client maps items to `ExploreTopic` without inventing text. |
| Debates / forums for a race | API / Backend (`meetings`, joined on `raceIds`) | Browser | Join key is the elections response's `race_id`. |
| Legislator votes/bills | API / Backend (politician routes) | Browser | Per-member, uneven; optional module. |
| Ranking generic topics | Browser (member's own Compass answers) | — | Decision 7: no slice aggregate. Own answers already reachable client-side. |
| Sibling read-only gate | Browser (AppShell state -> Explore) | Database (RLS is the real control) | UI only offers what RLS permits; RLS remains the backstop. |
| Draft persistence | Browser (localStorage) | — | No topics table, no server draft (design). |
| Seed vote (write) | API / Backend + Database | — | Out of scope this phase; reserve slot only. |
| Level-appropriate topic filter | Browser | — | Uses `applies_*` from the Compass catalog already fetched client-side. |

## Standard Stack

No new packages are needed. Everything below is already installed. [VERIFIED: code package.json]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.4 | UI | Existing |
| typescript | ^5.7.3 | `tsc -b` is the only check; `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` | Existing |
| vite | ^6.2.4 | Build + `/api` dev proxy | Existing |
| @tanstack/react-query | ^5.95.2 | All remote reads; dedupes by key across banner, events widget and Explore | Existing; elections already keyed `['next-election', geoid, mtfcc, userId]` |
| tailwindcss | ^4.2.2 | Styling (no config file) | Existing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| wouter | ^3.9.0 | Routing (`/profile/:userId`, `/post/:postId`) | Do not add Explore routes; the design keeps Explore as tab state |
| motion | ^11.18.2 (`motion/react`) | Animation | Seed invitation / module transitions |
| @empoweredvote/ev-ui | ^0.15.0 | Shared components | Prefer over copies (CLAUDE.md) |
| react-loading-skeleton | ^3.5.0 | Loading states | Match `FeedSkeleton`; do not invent a third style |
| sonner | ^2.0.7 | Toasts | Already used by `handleStartConversation` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module-level `TOPICS` constants | React Query hook behind `exploreData.ts` | Hook is required: a real route is async, and module constants evaluate at import (`exploreContent.ts:48-52`). Do it now with a synchronous mock `queryFn`. |
| A test framework (vitest) | `node --experimental-strip-types` ad-hoc checks | The repo has no test convention; do not add one for this phase (see Validation). |

**Installation:** none.
**Version verification:** declared ranges read from `package.json`; no package is being added, so the registry/legitimacy gate does not apply.

## Package Legitimacy Audit

No external packages are recommended or installed in this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Finding 1 - What the elections API actually returns

**Called:** `POST https://api.empowered.vote/api/essentials/browse/elections-by-area` with body `{"geo_id","mtfcc"}` for: Bloomington `1805860/G4110` (17 KB), Monroe County `18105/G4020`, Indiana `18/G4000`, Los Angeles `0644000/G4110`, California `06/G4000` (456 KB), Asheville `3702140/G4110`, Buncombe `37021/G4020`, North Carolina `37/G4000`, Missouri `29/G4000`, and `US/G4000` (HTTP 500 twice, a third attempt timed out: `{"code":"INTERNAL_ERROR","message":"Failed to fetch election data"}`). [VERIFIED: live]

**Shape (identical across all 9 successful responses; key paths walked programmatically):**

```
{ elections: [ {
    election_id, election_name, election_date 'YYYY-MM-DD', election_type, jurisdiction_level,
    races: [ {
      race_id, position_name, primary_party (null), seats, district_type, provisional_until (null),
      candidates: [ { candidate_id, full_name, first_name, last_name, photo_url|null,
                      is_incumbent, candidate_status, result (null), is_write_in, politician_id } ]
    } ] } ] }
```

**Races and candidates: yes. Ballot measures: no.** [VERIFIED: live + ev-accounts `backend/migrations/042_election_schema.sql`, `backend/src/lib/electionService.ts`, `backend/src/routes/essentialsBrowse.ts:108-142`]

- No `measures`/`propositions`/`referendums` key at any level. The schema is exactly three tables: `elections`, `races`, `race_candidates`. A grep of every migration and `backend/src` for ballot-measure/question/initiative/referendum/proposition table or column names returned nothing.
- 682 race rows (548 distinct `position_name`s) scanned for `prop|measure|referend|ballot question|amendment|bond|levy|initiative|question|retention`: **zero matches**. Measures are not modelled as races either.
- `GET /api/essentials/voter-info` is address-keyed (Google Civic) and returns polling places and sample-ballot URLs only; unusable here (this app never takes an address). [VERIFIED: ev-accounts `routes/essentials.ts:199-222`]
- No planned work found: the only repo mentions are product vision (`8_Connect_Civil-Civics_Equal-Slices-detailed.md`) and campaign-finance prose.

**What the response is good for:**

| Area asked | Result (observed) | Note |
|---|---|---|
| Bloomington city (G4110) | 1 election, 20 races: township board/trustee, 2 circuit judges, 7 county offices, 3 school board, 2 State House districts, **US House District 9 only (3 candidates)**, Secretary of State, Comptroller, Treasurer | District-correct. No city election (none in 2026). |
| Monroe County (G4020) | 48 races | same election |
| Indiana state (G4000) | 53 races incl. **all 9 US House districts**; no `STATE_EXEC` | wrong for "your" race |
| Los Angeles city | 2 elections (2026 LA County General: 12 races incl. Mayor, City Attorney; CA Statewide General: 35 races incl. Governor, AG, 13 State Assembly) | merge across elections |
| California state | 3 elections, 493 races, **no Governor** | 456 KB payload |
| Asheville city / Buncombe | 2 races: NC-11 + `U.S. Senate North Carolina` | no state, county or local races loaded |
| NC state | 14 US House races, **no Senate race** | |
| Missouri state | 3 races (of 8 districts) | sparse |

**Quirks the planner must plan for:**

1. **Withdrawn candidates are returned** (`candidate_status` was `active` 1486, `withdrawn` 4). Filter to `active` client-side; `getCandidateById` filters server-side but the list route does not. [VERIFIED: live]
2. **`district_type` is unreliable for statewide offices.** `Comptroller (Auditor of State)` and `Treasurer of State` are `LOCAL`; `Secretary of State` is `STATE_EXEC`. Do not classify state-level races by `district_type` alone. [VERIFIED: live]
3. `result` is `null` and `primary_party` is `null` on every row (general election, pre-vote). After 2026-11-03 results may appear; the existing hook documents that generals stay listed until Jan 1 (`useNextElection.ts:71-75`). **The races content disappears after the 2026 cycle**, and no 2027 races were present. The races module needs an honest empty state, and verification of it is only possible while the cycle is live. [VERIFIED: live + code]
4. `electionAreaFor` (`useNextElection.ts:46-53`) falls back to the *state* area for Federal/Unified/Volunteer. That is correct for "when is the next election" (every area returned `2026-11-03`) and wrong for "which races are mine" (Contradiction 4). `useElectionsQuery` is keyed by `(geoid, mtfcc, userId)` (`:104`), so a second query for the member's local area costs one extra request, shared with the hero banner and events widget when the area matches.
5. The cause of the state-area omission is probably that `stateAbbrev` is resolved from a `geofence_boundaries` row for the queried area and statewide races are matched only when it is non-null (`getOverlappingGeoIdsForArea`, `getElectionsByGeoIds`). `[ASSUMED]` - observed behaviour is verified, the cause is my reading of the source. Raise it with ev-accounts in the handoff either way.

**What this app reads today:** `election_id`, `election_name`, `election_date`, `election_type` only (`ElectionRecord`, `useNextElection.ts:27-33`). The type is a subset, not the contract. Extending `ElectionRecord` to carry `jurisdiction_level` and `races[]` is additive and does not disturb `pickNextElection`.

## Finding 2 - What the meetings API actually returns, and its coverage

**Called:** `GET /api/meetings?status=scheduled` (4 rows), `GET /api/meetings` (171 rows, published only), `GET /api/meetings/upcoming` (`[]`), `GET /api/meetings?city=Bloomington[&state=IN][&status=scheduled]`, `GET /api/meetings?city=Asheville`, `GET /api/meetings?raceId=<uuid>`, `GET /api/meetings/:id/agenda-items` (x5), `/votes`, `/summary`, `GET /api/agenda-items/:id`. All public, no auth. CORS allows `https://civicspaces.empowered.vote`. [VERIFIED: live]

### The list record (27 fields; the hook keeps 7)

`id, title, eventKind, city, state, date, meetingType, durationSeconds, videoUrl, audioSource, status, segmentCount, speakerCount, createdAt, updatedAt, chamberId, raceIds, sourceUrl, playbackKind, clipStartSeconds, clipEndSeconds, slug, processingMetadata, summaryPreview, thumbnailUrl, startsAt, timezone`. **No agenda items on the list record.** The hook ignores `city`, `state`, `raceIds`, `summaryPreview`, `slug` (`useUpcomingMeetings.ts:15-24`).

### Agenda items: yes, via a second public route

`GET /api/meetings/:id/agenda-items` returns an array; each item: `id, meetingId, position, itemNumber, titleRaw, kind, legislationRef, summaryPlain, decisionPlain, stage, publicComment, publicCommentNote, status, outcome, segmentStartSeconds, segmentEndSeconds, continuedFromItemId, sourceUrl`. `GET /api/agenda-items/:id` adds `meeting`, `votes`, `speakers`, `continuedFrom`. [VERIFIED: live + ev-accounts `migrations/1481_agenda_items_and_scheduled_meetings.sql`, `routes/meetings.ts`, `routes/agendaItems.ts`]

Observed on the four scheduled Bloomington meetings (items per meeting: 15, 24, 18, 24):

| Field | Reality |
|---|---|
| `kind` | `ordinance`, `resolution`, `appointment`, `report`, `procedural`, `minutes`, `public-comment`, `proclamation`, `other` (closed vocabulary, CHECK-constrained) |
| `titleRaw` | **Verbatim agenda title** (migration comment: "preserved for provenance") |
| `legislationRef` | e.g. `Ordinance 2026-22`; "extracted from the agenda, never invented" (migration comment); populated on roughly 6-8 items per meeting |
| `stage` | e.g. `First reading`, `Second reading - final vote`; "adapter-encoded body rules, never LLM-inferred" (migration comment) |
| `summaryPlain`, `decisionPlain` | Plain-language text; populated on only 5-10 of 15-24 items per meeting, never on procedural/minutes. The migration header calls it a "plain-language interpretation", i.e. written by the pipeline, not quoted from the agenda. Treat as machine-written (`[ASSUMED]` on the model; the route does not name one). |
| `status` / `outcome` | **Not reliable.** The 2026-10-14 meeting is in the past but all 24 items are `status: upcoming`, `outcome: null`. The 2026-09-02 meeting has 5 `passed` outcomes with `status: upcoming`. Do not gate on `status`. |
| `sourceUrl` | `https://bloomington.in.gov/onboard/meetingFiles/<n>/download` (the agenda file) |

Substantive items on the latest agenda (2026-10-14), real examples of what a derived topic would carry: `Ordinance 2026-22` (ban on automated license plate readers; second reading, final vote), `Appropriation Ordinance 2026-02` (2027 budget and tax rates), `Ordinance 2026-30` (general obligation bonds), `Resolution 2026-22` (ADA transition plan), `Ordinance 2026-21` (commission representation). 8 of 24 items are ordinance/resolution with a `legislationRef` and a `summaryPlain`.

Votes: `GET /api/meetings/:id/votes` returns real roll-call tallies for *published* meetings (e.g. `"Continued 8-0"`, `voteType: "roll call"`); empty for scheduled ones. `GET /api/meetings/:id/summary` returns `executiveSummary`, `keyDecisions`, `sections`.

### Coverage today (2026-10-24)

- **Scheduled (the only status the hook asks for): 4 rows, all Bloomington IN, dates 2026-08-05, 09-02, 09-16, 10-14.** `status` stays `scheduled` after the date passes; the client filters by time (`useUpcomingMeetings.ts:43-45`). **All four are in the past, so the hook returns zero upcoming meetings right now** (verified by running the hook's own filter against the live response). The next agenda will be published days before the next session.
- **Asheville: 0 rows. Los Angeles: 0 council rows.**
- Published Bloomington council meetings (8, plus 1 forum) mostly have `state: null`, so the hook's `state=IN` filter never matches them; only the `scheduled` rows carry `state: IN`. Query by city *and* state for scheduled, but do not assume `state` is populated elsewhere. The hook keys on a city *name* (from `useJurisdictionName`) plus a state abbreviation derived from the geoid (`AppShell.tsx:218-219`), not on a geoid, so two cities with one name in one state would collide. `[ASSUMED]` low risk today.
- Coverage by place across all 171 published rows: 138 have no city (news clips, podcasts, press conferences); named places are Texas, Bloomington, Los Angeles (3 debates), California (3 debates), Scottsdale (2 debates), Fort Worth, Boone/Lawrence/Monroe County, Indianapolis (1 council, 2026-01-14).

### Debates and forums (a source the design says does not exist)

`eventKind` values across the 171 published rows: `news_clip` 72, `podcast` 30, `debate` 26, `forum` 19, `press_conference` 8, `council` 9, `community_meeting` 2, `other` 4, `floor` 1. 157 rows carry `raceIds`. **The join works:** race ids from the Bloomington elections response matched 4 meeting rows (`LWV Candidate Forum: House District 61 and Monroe County Commissioner`, 2026-03-23; a 2026-03-30 forum for Prosecuting Attorney and Clerk), and `GET /api/meetings?raceId=<Commissioner D1 race id>` returned exactly that forum. LA city races matched 8 rows including the Bass vs Raman mayoral debates (2026-05-05, 2026-08-19) and the CNN California Governor debate (2026-09-30). **All are `published` recordings. No upcoming debate is published**, so a "schedule" has no source; a "watch the recording" does. [VERIFIED: live]

This also connects to decision 7: an LWV candidate forum is already in the data.

## Finding 3 - Existing Explore structure and what a registry must accommodate

### What ExploreView is today

`ExploreView` (`ExploreView.tsx:86-304`) is one component with five hard-coded sections in fixed order, plus a "page mode" that replaces the whole view:

| Section | Lines | Data it reads | Coupling a registry must break |
|---|---|---|---|
| A. Intro | 198-208 | none | Copy says "your community" - fine; static |
| B. Featured topic | 211-243 | `TOPICS[FEATURED_TOPIC]`, `featuredPhoto` | `Sample topic` badge hard-coded (226-228); drawn `WalkingScene` fallback is street-scale (224) |
| C. Imagine | 246-254 | `IMAGINE_OPTIONS`, `ui.imagine`, `draftFor`, `saveDraft`, `startConversation` | Reads and writes drafts; owns topic ids (`o.topic`) |
| D. Questions | 257-288 | `QUESTION_TOPICS.map(TOPICS[id])` | `· Sample` suffix hard-coded (277); icon chosen by **index** (`i === 0` heart, else book, 271-273) so position, not content, picks the icon |
| E. Adventure | 292-298 | `meetings?.[0]`, `elections?.[0]`, `ADVENTURE_OPTIONS`, `ui.adventure` | City-scale copy; mixes place activities with real events |
| F. What's new | 301 | `PRODUCT_UPDATES` | none - product notes, not slice content |
| Topic detail ("page mode") | 165-189, 320-477 | `TOPICS[ui.openTopic]`, `meetings` | Replaces the entire view whenever `ui.openTopic` is set |

`TOPICS[...]` is dereferenced directly in six places (`ExploreView.tsx:93, 148, 165, 192, 261, 344`).

### What blocks independent composition (concrete)

1. **Module-level constants evaluated at import.** `exploreContent.ts:48` calls `getExploreTopics()` once; `TOPICS` (50), `FEATURED_TOPIC` (52), `QUESTION_TOPICS` (53), `IMAGINE_OPTIONS` (59-114), `ADVENTURE_OPTIONS` (138), `PRODUCT_UPDATES` (161) are all fixed at module load. A per-slice or async source cannot feed them.
2. **`TopicId` is a closed literal union** (`exploreContent.ts:22-30`, 8 members) used as a `Record` key, a prop type, a storage key type and a function parameter (34 lines mention it across 6 files: `AppShell`, `ExploreView`, `ExploreActivities`, `exploreContent`, `exploreStorage`, the mock; `useCompassData.ts` has an unrelated local name). A bespoke, agenda-derived or member-requested topic cannot be a member of it. It must become `string`.
3. **Content modules reference topics by id.** `IMAGINE_OPTIONS[].topic` and `ADVENTURE_OPTIONS[].topic` name `trees-shade`, `safer-crossings`, etc. If topics resolve per composition, a composition could omit one. The Imagine module should own its topics (self-contained, as a City/County module), not look them up in the composition's list.
4. **One global UI-state record** `cs_explore_ui = {openTopic, imagine, adventure}` (`exploreStorage.ts:33-37, 39`) is not scoped to a composition. **If a topic is open and the member changes tab, `ExploreView` renders that topic on the new tab** (the `ui.openTopic && TOPICS[ui.openTopic]` check at `:165` passes). With per-slice topics that is a federal screen showing a city topic. `openTopic` must be keyed by composition or cleared on tab change.
5. **`AdventureActivity` fuses two things** (`ExploreActivities.tsx:251-368`): place-scale suggestions (`15m`, `1h`) and a real event slot (`evening` -> next meeting, else next election, 272-273). The real-event half is not City-only: `fromElection` (225-249) is meaningful on State/Federal. Split into "Explore nearby" (City/County) and a "Coming up" calendar module. `fromMeeting` (199-223) copy is city-specific; `fromElection` step text says "race or measure" (244) although no measure is served (Contradiction 1) - copy only, but it should not promise one.
6. **`ActiveExplore` binds to `homeSlice`** (`AppShell.tsx:297-351`): `useJurisdictionName(homeSlice)`, `useUpcomingMeetings(city...)`, `useUpcomingElections(electionAreaFor(homeSlice...))`, `useHeroBanner(photoSource)`, and `destination` from `homeSlice.id` (334-337). All four must re-key on the active slice. The panel is rendered at `AppShell.tsx:1052-1062`, with a no-slice fallback at 1064-1071.
7. **The featured photo logic assumes Explore is not on the active tab.** `photoSliceFor` (`AppShell.tsx:284-295`) deliberately returns a slice *other than* `activeTab` so the featured card never repeats the hero banner (which is always `slices[activeTab]`, `:941-950`). Once Explore follows the tab, "this slice's photo" **is** the hero. The featured module needs a different image source or the drawn fallback. (This is the duplicate-banner issue from #110(1).)
8. **Type import cycle risk.** `src/mocks/civicSpacesExplore.ts:12` imports types from `components/explore/exploreContent.ts`, which imports values from `lib/exploreData.ts`, which imports the mock. It works only because the mock's import is type-only. Move the shared types to a neutral file (e.g. `src/types/explore.ts`) when widening them.

### What a module needs from its host (the contract)

From the five modules plus topic-detail, the shared state `ExploreView` owns and passes is:

- composition key `(sliceType, geoid)` and the resolved topic list
- `destination` (where a post lands) and `isAuthenticated`
- **`isViewOnly`** (new)
- draft API: `draftFor`, `saveDraft`, `discard`, `rebind`
- actions: `openTopic(id)`, `startConversation(id)`, `onScrollTop`, `onGoToView`
- data: `meetings`, `elections/races`, `featuredPhoto`, and (new) agenda items, debates, Compass ranking

A single `ExploreContext` (or one `ctx` prop) carrying those, with each module a component `(ctx) => JSX | null` plus a pure `available(composition, data)`, avoids re-threading eight props through each module. Returning `null` for "no source" is what implements the reserved-empty-room rule, and a registry entry that *declares* an empty state (rather than hiding) is what lets the planner reserve the Symposiums/Civic Listening/Common Grounds/Focused Communities/slice-vote slots visibly in the composition without building them.

### Reusable as-is

`CARD`, `FOCUS`, `PrimaryButton`, `SecondaryButton`, `CategoryLabel`, `StarterTag`, `ArrowIcon` (`exploreUi.tsx`); `WhatsNewCard` (props `className`, `onGoTo`; also mounted in the sidebar at `AppShell.tsx:1146`, so it is shared and slice-independent); `NeighborhoodScene`/`WalkingScene` (pure SVG); the `<dialog>` pattern in `AdventureDetail`. `StarterTag`'s default and the badge texts must become provenance-driven (decision: provenance is part of the record), because "Conversation starter - not an official proposal" (`ExploreView.tsx:368`) is false-by-omission for an agenda-derived topic and would be wrong to hide for a staff-authored one.

### Mount strategy (the design's open call)

**Resolve one composition for the active tab; do not mount per tab.** Evidence: the shell already does exactly this for slice-dependent sidebar data - `ActiveEventsWidget` (`AppShell.tsx:204-229`), `ActiveAboutWidget` (236-261) and `ActiveLocationCard` render once and re-key on `slices[activeTab]`, with React Query caching by key. Explore is already a single instance (rendered at `:1045-1074`, outside the `FEED_TABS.map` at `:1084`), CSS-hidden rather than unmounted when Conversations shows (`:1050`), so hooks inside `ActiveExplore` run once, not six times. Per-tab mounting would resolve six compositions and fan out 6x the agenda-item requests. Switching tabs costs cache lookups for data already fetched (elections are shared with the banner at `AppShell.tsx:443`).

## Finding 4 - Draft and resume storage

**Stored today** (`exploreStorage.ts:39-46`), all `localStorage`, all wrapped to survive private windows (`read`/`write`, 48-66), with a same-tab `cs-explore-storage` CustomEvent because the native `storage` event fires only in other tabs (61):

| Key | Shape | Bound where |
|---|---|---|
| `cs_explore_drafts` | `Partial<Record<TopicId, ExploreDraft>>`, one draft per topic. `ExploreDraft = {title, body, sliceId: string\|null, tab: TabKey\|null, communityName: string\|null, updatedAt}` (19-31, 68) | **First save while signed in**: `saveDraft` computes `bind = !current.sliceId && destination` and stamps `destination.sliceId/tab/name` (`ExploreView.tsx:105-117`). `destination` is `homeSlice` (`AppShell.tsx:334-337`). Signed-out drafts keep `sliceId: null` and bind after sign-in. |
| `cs_explore_ui` | `{openTopic, imagine, adventure}` (33-37) | Nothing (global) |
| `cs_explore_resume` | **bare `TopicId` string** (42, 89-95) | Nothing; set when a signed-out visitor presses Join (`AppShell.tsx:676`), consumed after sign-in (`ExploreView.tsx:145-163`, 24 h expiry via `RESUME_MAX_AGE_MS`, 28) |
| `cs_saved_adventures` | `AdventureDuration[]` (44, 97-104) | Nothing (device-local bookmark) |

`read()` is an unchecked `JSON.parse(...) as T` (48-55): old-shape data at a reused key does not throw, it is silently mis-typed. `readResume()` would return the old bare string where an object is now expected.

### Every call site that must change for `(sliceType, geoid, topicId)`

`AppShell.tsx`: 30 (import), **676** `writeResume(topicId)`, **683** `ALL_TAB_KEYS.find(t => slices[t]?.id === draft.sliceId)` (the only place a draft's slice is resolved back to a tab), 688 (`tab !== activeTab` branch - dead once drafts follow the tab, except for resume), **705** `onPosted: () => writeDraft(topicId, null)`, **706-709** `onDraftChange` (`readDrafts()[topicId]` -> `writeDraft`).

`ExploreView.tsx`: 87-88 (hooks); 90-101 `draftFor` (default title reads `TOPICS[topicId].suggestedTitle`); 105-119 `saveDraft` (binding); 121-128 `startConversation`; 130-136 `openTopic` -> `setUi`; **145-163** resume effect (`readResume`, `readDrafts`, `writeResume`, `TOPICS[topicId]`); 165 `ui.openTopic && TOPICS[...]`; 174-186 `onChange` / `onRebind` / `onDiscard` (`writeDraft(ui.openTopic!, ...)`); 191, 249-250 Imagine `ideaText`/`onIdeaChange` (draft body); 252 `onShareIdea`; 350-351 `movedFrom` (compares `draft.sliceId` to `destination.sliceId`); 469 `hasDraft`.

`exploreStorage.ts`: `DraftMap` (68), `readDrafts` (70), `writeDraft` (74-79), `readResume`/`writeResume` (89-95), `useExploreDrafts` (107-122; returns the **whole map for every composition**, so consumers must filter by key).

`ExploreActivities.tsx:403, 410` use `readSavedAdventures`/`writeSavedAdventures` (not draft-related; unchanged).

In total: about a dozen separate sites in `ExploreView.tsx`, four in `AppShell.tsx`, and the storage module itself. `ExploreActivities.tsx` touches drafts only indirectly, through the `ideaText`/`onIdeaChange`/`onShareIdea` props.

### Recommended re-key

- Draft key `${sliceType}|${geoid ?? ''}|${topicId}`; for `federal`/`unified`/`volunteer` normalise `geoid` to the type (Contradiction 6). Drop `sliceId` and `tab` from the stored draft: a member holds at most one slice per type (`slices` is `Partial<Record<SliceType, SliceInfo>>`, `useAllSlices.ts:7-10, 51-60`), so the destination is derived at post time as `slices[sliceType]` and the draft is refused unless `slices[sliceType].geoid` still equals the stored geoid. This replaces the `movedFrom` machinery (`ExploreView.tsx:350-351, 442-450`) and line 683.
- **Use new storage key names** (`cs_explore_drafts_v2`, `cs_explore_resume_v2`) and delete the old keys on first load. This satisfies the design's "dropped rather than migrated" and avoids the silent mis-typing above. `cs_explore_ui` and `cs_saved_adventures` may keep their keys if `openTopic` is also scoped by composition key.
- **The resume marker must carry the full key**, not a topic id, and a signed-out visitor needs a defined level (Open Question 3): they have no tab, so a draft on a generic topic needs the `sliceType` they were viewing so that after sign-in it binds to `slices[sliceType]`.

## Finding 5 - The sibling / view-only mechanism

### How `isViewOnly` is computed and threaded

- State: `viewingSlices: Record<TabKey, SiblingSlice|null>` (`AppShell.tsx:434`, initial at 381). It is **per tab and independent of the Explore/Conversations toggle** (`forumView`, 441).
- Active-tab flag: `activeIsViewOnly = !!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id` (`:720-722`).
- Per panel: `isViewOnly = !!viewing && viewing.id !== slice.id` (`:1089`) -> `SliceFeedPanel isViewOnly` (`:1095`).
- Set by: `handleViewSlice` (`:536-543`, `null` when the chosen sibling is the member's own), `openPost` for `sibling` results (`:578-581`), cleared by `handleStartConversation` (`:690`).
- `SliceFeedPanel` consumes it at `:173-200` (amber banner with a "Switch back" button via `onReturnToOwnSlice`), `:265-271` (FAB hidden, not disabled) and `:273-282` (`PostComposer` not mounted); passes it on to `ThreadView` (`:299`).
- `ThreadView` consumes it at `:258-274` (hides "Join the conversation", shows an amber notice), `:302` (`canWrite && !isViewOnly`) and `:304` (`onReply` undefined). `ReplyCard` renders its reply control only when `canWrite && depth === 0 && onReply` (`ReplyCard.tsx:64`).
- The tab-bar `PostButton` is hidden while view-only (`AppShell.tsx:1006-1010`).
- **`ActiveSliceSelector` (the only control that switches shard) renders only when `effectiveView === 'conversations'`** (`AppShell.tsx:968-982`).

### What this means for Explore (three findings the gate must handle)

1. **Today Explore is safe by construction, not by a gate.** `handleStartConversation` resets the tab's view to the member's own shard (`:690`) and closes any open sibling thread (`:693-697`) before calling `compose`. `SliceFeedPanel.handleCompose` itself does **not** check `isViewOnly` (`SliceFeedPanel.tsx:115-130` checks only suspended and `inform` tier). So Explore's Join works from a sibling view today by snapping back. Decision 4 changes the behaviour (no Join at all there), so the gate belongs in the Explore UI; keep `:690` as the backstop and add an `isViewOnly` assertion in `handleStartConversation` so a replayed resume cannot slip through.
2. **The state is shared across views and the escape hatch is hidden.** A member who browses a sibling in Conversations and toggles to Explore arrives view-only with **no selector in the bar** (`:968-982`). The Explore gate needs its own "Switch back to your community" control wired to `handleViewSlice(activeTab, ownSlice, ownSlice.id)` (the same call the feed banner uses, `:1098-1100`), or the member is stranded in a read-only Explore.
3. **The programmatic path.** The resume effect (`ExploreView.tsx:145-163`) calls `startConversation` with no button press. It must be gated too.

### Every write affordance reachable from Explore today

| # | Control | Where | What it writes | RLS-rejectable? |
|---|---|---|---|---|
| 1 | "Join the conversation" (submit) | `ExploreView.tsx:466-468` | -> `onJoin` -> `startConversation` -> `handleStartConversation` -> `compose()` | **Yes** (the real one) |
| 2 | "Share an idea" / "Sign in to share" | `ExploreActivities.tsx:127-129` | -> `onShareIdea` -> same path | **Yes** |
| 3 | Resume-after-sign-in effect | `ExploreView.tsx:145-163` | -> `startConversation`, no click | **Yes** |
| 4 | Title input | `ExploreView.tsx:422-428` | localStorage draft | No (local) |
| 5 | "Your thoughts" textarea | `ExploreView.tsx:432-439` | localStorage draft | No |
| 6 | Imagine idea textarea | `ExploreActivities.tsx:110-117` | localStorage draft via `saveDraft` | No |
| 7 | "Discard draft" | `ExploreView.tsx:469-471` | clears draft | No |
| 8 | "Post it in X instead" (rebind) | `ExploreView.tsx:445-449` | rewrites a draft's destination | No |
| 9 | "Save on this device" | `ExploreActivities.tsx:495-505` | `cs_saved_adventures` | No (device bookmark) |
| 10 | Imagine/adventure/topic selection | `setUi` (`ExploreView.tsx:132, 248, 294`) | `cs_explore_ui` | No (view preference) |

Not writes: "Explore this topic", WhatsNew buttons (navigation only, `WhatsNewCard.tsx:176-178`).

**Decision needed (Open Question 2):** the verification bar says "no write affordance **anywhere**". #1-3 are the RLS-rejectable ones and must be removed. #4-8 are inputs that invite a post the member cannot make from this view; hide or replace them (a read-only topic detail, not a form) to meet the bar as written. #9-10 are device-local preferences, not posts; I recommend leaving them, but the phrase is the owner's to interpret. Signed-out visitors (no `isViewOnly`) keep the sign-in variants of #1-2.

Two adjacent write gates Explore does not know about and that are not in scope but will surprise a tester: `is_suspended` members get a toast from `handleCompose` (`SliceFeedPanel.tsx:116-122`), and `inform`-tier members get the upgrade prompt (`:123-126`). Explore's Join button is enabled for both.

## Finding 6 - Does the EV stack serve state legislature or federal roll-call activity?

**Called:** `GET /api/essentials/browse/federal/officials` (574 officials), `GET /api/essentials/browse/states/IN/officials` (52), `POST /api/essentials/browse/by-area` for Bloomington and Los Angeles, then `GET /api/essentials/politicians/:id/{votes,bills,legislative-summary}?limit=` for 12 members. Routes confirmed in ev-accounts `routes/essentialsPoliticians.ts:85-229`; legislative data comes from LegiScan (states) and Congress.gov (federal) per `lib/legiscan/*` and the congress.gov verification-tier spec. [VERIFIED: live + ev-accounts]

**There is no slice-scoped route** ("what is the legislature working on"). There is no federal or state bill *list*, no bill search, no calendar. The only legislative data is per politician id. A slice-level "recent votes" would be N calls over the member's reps (which the app already holds via `useRepresentatives`, `AppShell.tsx:419`, and `by-area`).

| Member (office) | votes | bills | Freshest | Titles / summaries |
|---|---|---|---|---|
| Todd Young (US Senate, IN) | 100 | 0 | **2026-03-02** | `bill_title` empty on all; question text only (`On Cloture on the Motion to Proceed H.R. 7147 RC# 39`) |
| Alex Padilla (US Senate, CA) | **0** | 0 | — | — |
| Erin Houchin (US House, IN-9) | **0** | 100 (all `In Committee`) | bills 2026-02-25 | `title` empty on all |
| Maxine Waters (US House, CA) | **0** | 100 | bills 2026-02-25 | `title` empty |
| Mike Braun (IN Governor; Senate votes to 2024) | 100 | 0 | 2024-12-21 | empty |
| Matt Pierce (IN House) | 100 | 34 | 2026-02-27 | titled (e.g. `SB0239 Various education matters.`), LegiScan URLs |
| Shelli Yoder (IN Senate) | votes + bills present | | | titled |
| Mark Gonzalez (CA Assembly) | 100 | 100 | **2026-09-01** | titled |
| Ben Allen (CA Senate) | **0** | 0 | — | — |
| Sydney Zulich (Bloomington council) | 0 | 0 | — | — |
| Blumenfield (LA council), Bass (LA mayor) | 0 | 0 | — | — |

Vote row: `{id, bill_id, bill_number, bill_title, vote_question, position, vote_date, result, yea_count, nay_count, session_id, bill_url}`. Bill row: `{id, number, title, summary, status_label, raw_status, jurisdiction, session_name, introduced_at, passed_at, signed_at, topic_tags, url, is_sponsor}`.

**Findings:**

- A roll-call **tally exists** (`yea_count`, `nay_count`, `result`) for some members; the member's own `position` too.
- **A bill summary does not exist anywhere:** `summary` was empty on every sampled bill and `topic_tags` null. Decision 8's "plain-language summary of the bill and then the tally" is unreachable for Federal. State bills have a short title only.
- **Federal vote rows have no bill title or number** - only the roll-call question string.
- **Federal data is stale** in this sample (newest Senate vote 2026-03-02; no House votes at all) while the CA Assembly is current to 2026-09-01. Whether that is ingestion lag or by design is `[ASSUMED]`.
- Coverage is **per member, not per place**, so which modules show for a given jurisdiction is not predictable from `(slice_type, geoid)`.
- LA council: votes are per council file (`GET /api/council-files/:fileNumber[/votes]`, `routes/councilFiles.ts`), not listable by place; there is no way to ask "what is LA council working on".
- Nothing serves the Governor's priorities.

**Net for the design:** federal roll calls with summaries, state-legislature agenda, Governor focus and ballot measures remain reserved empty rooms. A "How your state legislators voted" module (State) and "Recent Senate votes" (Federal, tally only) are *possible* but partial, uneven, and unlabelled-by-bill for Federal. I recommend reserving them as optional modules in the registry and not building them in this phase unless the owner wants them; do not build them off the fixture.

## Architecture Patterns

### System Architecture Diagram

```
 active tab  ──►  slices[activeTab] ──► (sliceType, geoid)  [federal->'US', unified->'UNIFIED' normalised]
      │                                      │
      │                                      ▼
      │                          resolveComposition()  (src/lib/exploreData.ts, async hook, mock queryFn today)
      │                                      │      ordered module ids + bespoke topics (staff/chapter/derived/member)
      │                                      │      falls back to generic-by-level when no geoid or no bespoke set
      ▼                                      ▼
 isViewOnly ◄─ viewingSlices[activeTab]   ActiveExplore  (renders ONCE, re-keys on active slice)
      │                                      │
      │      ┌───────────────────────────────┼─────────────────────────────────────────┐
      │      ▼                               ▼                                         ▼
      │  data hooks (hoisted here)     member-local area                        Compass catalog + own answers
      │   useUpcomingMeetings(city,st)  elections-by-area (city/county area,    GET /api/compass/topics (public)
      │   -> /meetings/:id/agenda-items   NOT state)  -> races -> /meetings?raceId   useCompassData (member token)
      │      │                               │                                         │
      │      └───────────────┬───────────────┴──────────────────┬──────────────────────┘
      ▼                      ▼                                  ▼
 ExploreContext { key, destination, isAuthenticated, isViewOnly, drafts, openTopic, startConversation, data }
                              │
                              ▼
                   module registry: for id in composition.modules -> registry[id].render(ctx) | reserved-empty-room
                              │
          write path ─────────┴──► handleStartConversation (AppShell)  ──►  panelRefs[tab].compose()
          (only when !isViewOnly, destination = slices[sliceType], draft key = (sliceType, geoid, topicId))
```

### Recommended Project Structure

```
src/
├── types/explore.ts             # ExploreTopic (id: string), Provenance, ModuleId, Composition  (breaks the import cycle)
├── lib/exploreData.ts           # THE seam: useExploreComposition(sliceType, geoid) - mock now, fetch later
├── lib/exploreComposition.ts    # pure: key normalisation, resolution order, level filter, draft key  (node-checkable)
├── mocks/civicSpacesExplore.ts  # ONE module: generic-by-level topics, Asheville + Bloomington bespoke samples
├── components/explore/
│   ├── ExploreView.tsx          # renders composition.modules via registry; owns drafts + view-only gate
│   ├── modules/                 # one file per module: Featured, Questions, Imagine, Nearby, Agenda, Races, ...
│   ├── registry.ts              # id -> { render, available }
│   └── exploreStorage.ts        # re-keyed, versioned keys
```

### Pattern 1 - the seam is a hook from day one
**What:** `exploreData.ts` exports `useExploreComposition(sliceType, geoid)` returning `{ data, isLoading }`. Today its `queryFn` returns the mock synchronously; the later `GET /api/civic-spaces/explore?sliceType=&geoid=` swap changes only that function.
**Why:** the current getters are synchronous and consumed at import (`exploreContent.ts:48`); an async source breaks every consumer unless the signature is async-shaped first.

### Pattern 2 - resolution order (the design's, made concrete)
1. bespoke topics for this exact key (`sliceType|geoid`); 2. else generic topics for the level, filtered by the Compass `applies_*` flag and ranked by the member's own answers; 3. the seed invitation slot, present when (1) is empty and quiet when not. No geoid (signed out, or no slice for the tab) => generic only, no bespoke, no invitation.

### Pattern 3 - derive topics from agenda items without inventing text
Map `kind in {ordinance, resolution}` with a non-empty `summaryPlain` to a topic: `title` = `titleRaw`, `summary` = `summaryPlain`, a `stage` chip, `legislationRef`, `sourceUrl`. The `question` and `suggestedTitle` are templated from `legislationRef` (e.g. "What would you want to know about Ordinance 2026-22?") - template text is not a civic fact. `whyItMatters` is not derivable, so make it optional in the type (`exploreContent.ts:32-46` currently requires it). Provenance `derived-from-agenda` plus the meeting date and the source link, and a label that `summaryPlain` is a machine-written summary.

### Anti-Patterns to Avoid
- **Passing a slice's geoid straight to elections-by-area.** `US` -> HTTP 500, `UNIFIED` is not a place, and a state area returns the wrong races (Contradiction 4).
- **Keying content on `slice_id`.** Sibling shards would drift; the key is `(sliceType, geoid)`.
- **Calling data hooks inside a module that is mounted per tab.** Stay in `ActiveExplore`.
- **Gating on agenda `status`.** Unreliable (Finding 2).
- **Trusting `district_type` to classify state offices.**
- **Matching topics to posts by title** (`exploreContent.ts` header forbids it; posts carry no topic id).
- **Hiding an empty module silently.** An empty reserved room should say what it is for; a module with no source must never render placeholder civic facts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Remote reads, dedupe, staleness | `useEffect` + `fetch` | `@tanstack/react-query` with the existing key shapes | Elections already shared by banner, events widget, Explore via `['next-election', geoid, mtfcc, userId]` |
| Date math for elections/meetings | new date helpers | `localIsoDate`, `daysUntil`, `pickNextElection` (`useNextElection.ts:56-81`), `meetingWhen` (`ExploreActivities.tsx:141-148`) | `'2026-11-03'` parsed as UTC is a day early in the US; the existing helpers avoid it |
| Place names / state abbrev | lookups | `geoidToDisplayName`, `useJurisdictionName`, `stateAbbrevFromGeoid` (`src/lib/stateAbbrev.ts:25`) | Static shards shipped with the app |
| Draft storage + same-tab sync | a new store | the existing `read`/`write`/`CHANGE_EVENT` wrapper in `exploreStorage.ts` | Already survives private windows and sign-in |
| View-only banner and "Switch back" | a new pattern | the amber notice from `SliceFeedPanel.tsx:173-200` / `ThreadView.tsx:258-274` | Same vocabulary; reuse the markup and the `handleViewSlice` call |
| Level-appropriate Compass topics | a hand-written level map | Compass `applies_federal/state/local` (public catalog) | Already served; exclusion is exactly what it is good for |
| Slice-wide Compass aggregates | any aggregation | nothing - decision 7 | Out of design; no endpoint exists |
| Modal / dialog | a library | the native `<dialog>` already used by `AdventureDetail` | Consistency and focus handling |

**Key insight:** the expensive part of this phase is not any one module; it is that content is currently a set of module constants. Once content flows through one async seam and one registry, every source (hand-authored, agenda, chapter) is just another provider of the same record.

## Runtime State Inventory

Phase 16 is not a rename, but it re-keys persisted data, which has the same failure mode (old state silently survives a code change). Answered explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Browser `localStorage`: `cs_explore_drafts` (map keyed by `TopicId`), `cs_explore_resume` (bare `TopicId` string), `cs_explore_ui` (`openTopic` is a global `TopicId`), `cs_saved_adventures`. Explore shipped 2026-10-22, so these are 2 days old and per-browser. No server-side Explore state exists (verified: no topics table, posts carry no topic id). | **Data migration: none** (design: drop). **Code edit:** new key names for drafts and resume (`_v2`) and delete the old keys on load; scope `openTopic` by composition key. |
| Live service config | None - verified: ev-accounts has no `/api/civic-spaces/explore*` route (live 404 on `/explore?sliceType=city&geoid=1805860`, `/explore/topics`, `/updates`) and `civic_spaces/` contains only the assignment engine. | None; the handoff document specifies the new route. |
| OS-registered state | None - verified: frontend-only, no scheduler/process registrations. | None |
| Secrets / env vars | None new. `VITE_API_PROXY_TARGET` already proxies `/api`. | None |
| Build artifacts / installed packages | None. No package or generated file carries Explore topic ids. `banners.generated.ts` is unrelated. | None |

## Common Pitfalls

### Pitfall 1: A topic open on one tab shows on the next
**What goes wrong:** the member opens a City topic, switches to State; `ExploreView` still renders it (`ui.openTopic` passes the `TOPICS[...]` guard at `:165`), and the Join button would target a different jurisdiction's composition.
**Why it happens:** `cs_explore_ui` is one global record.
**How to avoid:** key `openTopic` by composition or clear it on tab change; `TopicDetail` must verify the topic belongs to the current composition.
**Warning signs:** a topic page whose category does not match the tab.

### Pitfall 2: Federal and State races for the wrong people
**What goes wrong:** asking elections-by-area with the state geoid lists every congressional district and drops the Governor/Senate races.
**How to avoid:** query the member's most local area (city, else county) and filter by `district_type`; use the state area only for "next election date". Never send `US`/`UNIFIED`.
**Warning signs:** a Federal tab listing nine House races; a California State tab with no Governor.

### Pitfall 3: "Upcoming" is empty on demo day
**What goes wrong:** the agenda module is blank because no meeting is scheduled after today (true now). Items for a past meeting still carry `status: upcoming`.
**How to avoid:** derive from the most recent agenda within a window (e.g. 45 days), label "From the {date} agenda", and show an honest empty state beyond it. Do not filter on `status`.

### Pitfall 4: Presenting machine-written summaries as the agenda's own words
**What goes wrong:** `summaryPlain` reads authoritatively; `titleRaw`/`legislationRef` are verbatim, `summaryPlain` is an interpretation.
**How to avoid:** carry per-field provenance and label the summary; link `sourceUrl`. This is the anti-goal "invented civic record" in its quietest form.

### Pitfall 5: Local dev resolves a different composition than production
**What goes wrong:** `MOCK_SLICES.federal.geoid = '3711'`, `unified = ''`.
**How to avoid:** normalise federal/unified/volunteer keys to the slice type; also fix or ignore the fixture geoids.

### Pitfall 6: The old drafts are read as the new shape
**What goes wrong:** same key, new shape, unchecked cast (`exploreStorage.ts:48-55`) - `readResume()` returns a string where an object is expected.
**How to avoid:** new key names; delete old keys.

### Pitfall 7: Gating only the visible Join button
**What goes wrong:** the resume effect and "Share an idea" still reach `compose`; textareas still invite writing.
**How to avoid:** gate at `ExploreContext` (`isViewOnly`) so every module inherits it, and add the assertion in `handleStartConversation`. This is the same "shipped half the gate once already" lesson as CLAUDE.md.

### Pitfall 8: A view-only member stranded in Explore
**What goes wrong:** no shard selector is rendered in Explore (`AppShell.tsx:968-982`).
**How to avoid:** a "Switch back" control in the Explore notice.

### Pitfall 9: Withdrawn candidates and misclassified offices shown
**How to avoid:** filter `candidate_status === 'active'`; classify statewide offices by name/office, not `district_type`.

### Pitfall 10: Heavy payloads
**What goes wrong:** the California state-area elections response is 456 KB (493 races).
**How to avoid:** use the city/county area (about 17-50 KB) for races; do not fetch the state area just for races.

### Pitfall 11: Featured photo duplicates the hero
**What goes wrong:** once Explore follows the tab, `photoSliceFor` logic returns the hero's own photo.
**How to avoid:** the featured module takes an explicit image source or the drawn fallback; do not reuse `slices[activeTab]`'s banner (also a licensing/attribution concern, CLAUDE.md banner section).

## Code Examples

These are sketches derived from the findings above, not copied from a library.

### Resolve an area for races (member-local, never the slice geoid)
```ts
// Source: derived from useNextElection.ts:14-19 + Finding 1. Use the most local own slice.
const MTFCC = { city: 'G4110', county: 'G4020', state: 'G4000' } as const
export function racesAreaFor(slices: Partial<Record<SliceType, SliceInfo>>): ElectionArea | null {
  for (const t of ['city', 'county', 'state'] as const) {
    const s = slices[t]
    if (s?.geoid) return { geoid: s.geoid, mtfcc: MTFCC[t] }
  }
  return null // signed out / no jurisdiction: no races module
}
```

### Normalised composition key and draft key
```ts
// Source: Finding 4 + Contradiction 6. Pure; no imports, so node --experimental-strip-types can run it.
const PLACELESS = new Set(['federal', 'unified', 'volunteer'])
export function compositionKey(sliceType: string, geoid: string | null): string {
  return PLACELESS.has(sliceType) ? sliceType : `${sliceType}|${geoid ?? ''}`
}
export const draftKey = (sliceType: string, geoid: string | null, topicId: string) =>
  `${compositionKey(sliceType, geoid)}|${topicId}`
```

### The view-only gate belongs in one place
```tsx
// Source: AppShell.tsx:720-722 (computed) -> pass into ExploreContext, same value the feed uses.
const activeIsViewOnly = !!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id
// In handleStartConversation, alongside the existing reset at :690:
if (activeIsViewOnly) return // defence in depth; Explore must not offer it, RLS would reject it
```

### Agenda items for the latest meeting
```ts
// Source: live GET /api/meetings?city=Bloomington&state=IN&status=scheduled, then
//         GET /api/meetings/:id/agenda-items. Both public.
const meetings = (await getJson(`/api/meetings?${params}`)) as MeetingRecord[]
const latest = meetings.sort((a, b) => b.date.localeCompare(a.date))[0]
const items = (await getJson(`/api/meetings/${latest.id}/agenda-items`)) as AgendaItem[]
const topics = items.filter(i => (i.kind === 'ordinance' || i.kind === 'resolution') && i.summaryPlain)
```

### Compass level filter
```ts
// Source: live GET /api/compass/topics: applies_federal 46, applies_state 47, applies_local 52, is_live 43 of 60.
const forLevel = (t: CompassTopicApi, level: 'federal' | 'state' | 'local') =>
  t.is_live && (level === 'federal' ? t.applies_federal : level === 'state' ? t.applies_state : t.applies_local)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One federal slice per congressional district (`geoid` `'3711'`) | `federal` keyed `'US'`; districts decide *which representative*, not which room | slice taxonomy cut, 2026-09-02 (`20260902000100_slice_taxonomy.sql`) | Federal composition is one nation-wide key; the member's races/reps come from their local area. Dev fixture still has the old value. |
| Local meeting list only | Item-centric civic coverage: `meetings.agenda_items` with plain-language fields | migration 1481 (Bloomington item-centric spec, July 2026) | Real agenda topics are reachable without authoring. |
| "Compass has no level" | Compass catalog carries coarse `applies_*` flags | already live | Use for exclusion only. |

**Deprecated/outdated:** `services/slice-assignment` is FROZEN (CLAUDE.md); nothing in this phase touches it. CLAUDE.md's "hoisted `useCompassData`/`useToolCoverage`" claim is stale (Contradiction 8).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | State-area elections omit statewide races because `stateAbbrev` is unresolved for a G4000 area | Finding 1 | Low: behaviour is verified; only the stated cause is inferred. Wrong cause means the ev-accounts ask is worded wrongly, not that the plan changes. |
| A2 | `summaryPlain`/`decisionPlain` are LLM-written | Finding 2 | Medium: if they are human-edited, the "machine-written" label is wrong (conservative direction). |
| A3 | Compass `applies_*` flags mean role eligibility, not "this level attends to the topic" | Contradiction 5 | Medium: if they are meant as relevance, Federal could filter more tightly than I recommend. Evidence: "Ukraine Support" flagged for state and local. |
| A4 | Federal vote staleness (newest 2026-03-02) is ingestion lag, not by design | Finding 6 | Low: only affects whether a Federal votes module is worth reserving. |
| A5 | Bloomington's next agenda will be published days before its next session, so empty-upcoming is a normal cycle, not an outage | Pitfall 3 | Low: the fallback to the most recent agenda is safe either way. |
| A6 | Two cities with the same name in one state would collide in the meetings query | Finding 2 | Low today (only Bloomington is covered). |
| A7 | "No write affordance anywhere" is meant to include device-local controls (#9-10 in the table) | Finding 5 | Medium: decides whether two controls stay. Owner's call. |
| A8 | The mock/Asheville fixture can stay the dev id's city while a dev-only override reaches Bloomington | Open Question 1 | Medium: depends on the owner's choice of proof city. |

## Open Questions — ALL RESOLVED (2026-10-24, during planning)

All six are settled. Each is answered below with where the answer lives and which plan
carries it. Nothing in this section is still open; it is kept for the reasoning, not as a
list of things to decide.

| # | Question | Answer | Settled in | Built by |
|---|---|---|---|---|
| 1 | Asheville or Bloomington as the proof jurisdiction? | **Bloomington**, plus a dev-only fixture override so it is reachable on localhost | `16-CONTEXT.md` "Settled after research" 1; `16-DESIGN.md` "Settled in review" corrected in Bloomington's favour | **16-06** (`?dev=1&place=bloomington`) |
| 2 | Does "no write affordance anywhere" include device-local controls and draft inputs? | **Gate #1–8** (the three composer paths and the five draft controls). **Keep #9–10** — device-local preferences that never touch Supabase are not writes. Matches the research's own recommendation. | `16-CONTEXT.md` "Settled after research" 2 | **16-05** |
| 3 | What level does a signed-out visitor see, and where does their draft bind? | **The place-scale (city) generic composition** — *not* the stored `cs_active_tab`, which is what this section recommended. A visitor has no tab UI on that screen. Their draft is stored with no geoid and binds to the member's most-local slice on sign-in. | `16-CONTEXT.md` "Settled after research" 3 — **overrides the recommendation here** | **16-03** (the render site), **16-04** (the binding, incl. `migrateSignedOutDrafts` for the header-sign-in path this section did not consider) |
| 4 | Should the seed invitation exist while the vote is out of scope? | **Yes.** Chris, 2026-10-24: *"show it without the vote for now."* The recommendation here — reserve the slot, or render non-actionable copy — was **overruled**. It ships with one real control (opening the first candidate topic) and no control that no-ops. The **vote** remains out of scope. | `16-CONTEXT.md` "Settled after research" 4 | **16-08** |
| 5 | Are optional modules for legislators' votes and Senate tallies wanted? | **No — reserve, do not build.** The research's default stands: reachable but partial (5 of 12 probed members had votes), nothing slice-scoped, federal data stale to 2026-03-02. `legislator-votes` is a reserved room and handoff **Ask 5**. | planning decision, recorded in `16-09-PLAN.md` | **16-09** (room + ask) |
| 6 | Raise the elections state-area behaviour with ev-accounts now? | **Yes, as a bug report with evidence** — handoff **Ask 6**, separated from the feature asks. Flagged as affecting Treasury Tracker, which consumes the same endpoint family. Civic Spaces does not wait on it: `racesAreaFor` queries the most local area and returns `null` rather than falling back to a state. | planning decision, recorded in `16-09-PLAN.md` | **16-01** (`racesAreaFor`), **16-07** (use), **16-09** (the ask) |

Two of the six resolved **against** the recommendation written here (3 and 4). Both are kept
above in the original wording so the direction of the error is visible.

The original text follows.

1. **Asheville or Bloomington as the proof jurisdiction?**
   - Known: DESIGN "Settled in review" says Asheville (dev fixture); CONTEXT scope says Bloomington; CONTEXT says design wins; the DESIGN's own "What actually serves decision 10" says build and show with Bloomington. Asheville has 0 meetings and 2 races.
   - Unclear: whether DESIGN's Asheville line was superseded.
   - Recommendation: Bloomington, plus a dev-only fixture override (e.g. `?dev=1&city=1805860`, behind `import.meta.env.DEV`) so it is verifiable without a pasted token. Ask the owner to confirm before planning tasks around either.
2. **Does "no write affordance anywhere" include device-local controls and draft inputs?** Recommendation in Finding 5 (hide #1-8, keep #9-10).
3. **What level does a signed-out visitor see, and where does their draft bind after sign-in?** They have no tab. `AppShell` defaults `cs_active_tab` to `federal` (`:430`). Recommend: honour a stored `cs_active_tab` if present, else Federal, and store the `sliceType` in the draft and resume key.
4. **Should the seed invitation exist in this phase if the seed vote is out of scope?** The invitation's action is the vote (a write). Recommendation: reserve the slot and render the invitation as non-actionable copy, or omit until the write path exists. Do not render a button that stores nothing.
5. **Are optional modules for state legislators' votes and Senate roll-call tallies wanted?** Reachable but partial (Finding 6). Default: reserve, do not build.
6. **Does the owner want the elections state-area behaviour raised with ev-accounts now?** It affects other apps too (Treasury Tracker consumes the same endpoint family).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | `npm run build`, ad-hoc `--experimental-strip-types` checks | yes | v24.13.0 | — |
| `api.empowered.vote` public API | live data, dev proxy | yes (all calls above 200 except `US` elections 500) | — | Dev-id fixtures are offline fallback only |
| `gh` CLI | issue #111 | yes | 2.96.0 | — |
| Playwright (global) + Chromium | four-way screenshots / `elementFromPoint` hit-tests | yes (`playwright/` in `npm root -g`; `chromium-1234`, `chromium-1248`, `chromium_headless_shell-*` cached) | not queried | — |
| ev-accounts clone `C:\EV-Accounts` | reading backend source | yes (read-only via `origin/master`) | ed387ed39 | — |
| A real `cs_token` | `shoot-app.mjs`, member-only APIs (Compass answers, `representatives/me`) | not checked; needs the owner | — | Dev id: fixtures; Compass answers 401 for the dev id by design |
| Local ev-accounts | optional proxy target | not checked | — | production proxy default |

**Missing dependencies with no fallback:** none. **Note:** Bloomington cannot be seen as the dev id without a fixture override (Open Question 1).

## Validation Architecture

`.planning/config.json` has no `workflow.nyquist_validation` key, so this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | none (CLAUDE.md: "The frontend has no test framework") |
| Config file | none - do not add one for this phase |
| Quick run command | `npm run build` (`tsc -b && vite build`) |
| Full suite command | `npm run build`, then ad-hoc checks below, then the four-way pass |

### Phase Requirements -> Test Map

No requirement IDs were provided; keyed to the CONTEXT verification bar.

| Bar item | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| Composition differs by type | Federal/State/City/Unified resolve to different module lists | ad-hoc pure check | `node --experimental-strip-types check-composition.mjs` (script in the scratchpad, imports `src/lib/exploreComposition.ts` with a `.ts` extension) | Wave 0 |
| Key normalisation | `federal`+`'3711'` and `federal`+`'US'` produce one key; sibling shards produce one key | ad-hoc pure check | same | Wave 0 |
| Draft cannot cross jurisdictions | draft key differs per `(sliceType, geoid)`; a draft for geoid A is refused when `slices[type].geoid` is B | ad-hoc pure check | same | Wave 0 |
| Old drafts dropped | legacy keys removed, new keys empty | browser | Playwright against `npm run dev`, set legacy keys, reload | Wave 0 |
| Bloomington agenda content | topics derive from real items; none for a non-covered city | live + ad-hoc | `curl` the two routes; run the derivation on the saved response | Wave 0 |
| Sibling gate | no write affordance anywhere in Explore when view-only | browser | `?dev=1` has a federal sibling (`MOCK_FEDERAL_SIBLING_ID`, `devMockData.ts:232`); pick it in Conversations, toggle to Explore, `elementFromPoint`/DOM query for `button[type=submit]`, textareas, "Share an idea" | Wave 0 |
| Resume cannot post while view-only | resume effect does not call `compose` when view-only | browser | set `cs_explore_resume_v2`, load while view-only, assert no composer | Wave 0 |
| Light/dark x desktop/mobile | four-way | manual + screenshots | extend `scripts/shoot-app.mjs` (needs token) or a harness page like `src/dev/BannerHarness.tsx`; contrast via canvas, not `getComputedStyle` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build`.
- **Per wave merge:** build + the pure-function ad-hoc script.
- **Phase gate:** build green, ad-hoc script green, sibling-gate browser check, four-way screenshots *looked at* (CLAUDE.md: a clean run only proves they decoded), before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/exploreComposition.ts` - pure functions with no imports, so Node can run the real source (the memory note on ad-hoc TS checks: import the `.ts` directly, do not test a copy; `tsconfig.app.json` has `allowImportingTsExtensions`).
- [ ] A scratchpad check script (do not commit stray test files to a repo with no test convention).
- [ ] A dev-only fixture override to reach Bloomington (Open Question 1).
- [ ] A way to exercise the view-only gate on Explore in dev (fixture already exists for Federal).
- [ ] The harness `elementFromPoint` pass for any control inside a module (PR #92 lesson, CLAUDE.md).

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no change to auth) | — |
| V3 Session Management | no | `cs_token` handling unchanged |
| V4 Access Control | **yes** | RLS is the real control; Explore's view-only gate is a UI courtesy that must match it (Finding 5). Never offer a write RLS rejects. |
| V5 Input Validation | **yes** | Draft title <=200 and body <=10000 already enforced in the form (`ExploreView.tsx:425, 435`); `createPostSchema` is the authority. Render all API text as text, never HTML. Validate `http(s)` on any `href` taken from the API (`sourceUrl`, `bill_url`, `url`): the meetings URL goes straight into an `<a href>` today (`ExploreView.tsx:391`) and React does not block `javascript:` URLs. The data is first-party but scraped from city sites. |
| V6 Cryptography | no | — |
| V8 Data Protection | **yes** | App never geocodes or stores a location; the elections query is geoid + MTFCC only. No slice-wide aggregate of members' Compass answers (decision 7). Do not store account/user data in fixtures. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A post lands in the wrong jurisdiction | Tampering | Derive destination from `slices[sliceType]` at post time; refuse on geoid mismatch (Finding 4) |
| UI offers a write RLS rejects | Elevation of privilege (attempted) | Gate at `ExploreContext` plus the assertion in `handleStartConversation` |
| Existence oracle for unreadable posts | Information disclosure | Unchanged: `locatePost` returns one `unavailable` outcome (CLAUDE.md) |
| Unsafe `href` from API data | Tampering / XSS | `isHttpUrl` guard; `rel="noopener noreferrer"` (already used) |
| Presenting generated text as the record | Spoofing (provenance) | Per-field provenance + label (Pitfall 4) |
| Re-identification via per-place Compass aggregates | Information disclosure | Not built (decision 7) |

## Sources

### Primary (HIGH confidence)
- Live `api.empowered.vote` calls, 2026-10-24 (appendix). Responses saved in the session scratchpad.
- This repo at `origin/main` fb32425: `src/components/explore/*`, `src/lib/exploreData.ts`, `src/mocks/civicSpacesExplore.ts`, `src/hooks/useNextElection.ts`, `useUpcomingMeetings.ts`, `useAllSlices.ts`, `useCompassData.ts`, `src/components/AppShell.tsx`, `SliceFeedPanel.tsx`, `ThreadView.tsx`, `ReplyCard.tsx`, `src/lib/devMockData.ts`, `src/types/*`, `package.json`, `tsconfig.app.json`.
- ev-accounts `origin/master` ed387ed39: `backend/migrations/042_election_schema.sql`, `1481_agenda_items_and_scheduled_meetings.sql`, `365_meeting_topics.sql`, `CC_0039_connected_profiles_city_state_nation.sql`; `backend/src/routes/{essentialsBrowse,essentials,essentialsPoliticians,meetings,agendaItems,councilFiles}.ts`; `backend/src/lib/{electionService,essentialsBrowseService}.ts`; `backend/src/civic_spaces/services/sliceAssigner.ts`; `backend/src/index.ts` route mounts.
- GitHub issue #111; `16-DESIGN.md`; `16-CONTEXT.md`; `CLAUDE.md`.

### Secondary (MEDIUM confidence)
- Memory notes on ad-hoc TS checks, thread deep links, geo stack (cross-checked against code where cited).

### Tertiary (LOW confidence)
- None used for claims. Items I could only infer are tagged `[ASSUMED]`.

## Appendix - exactly what I called

All unauthenticated, from `curl`, 2026-10-24. No account or user data was read.

- `POST /api/essentials/browse/elections-by-area` x10 (geoids above; `US/G4000` returned 500 twice).
- `POST /api/essentials/browse/by-area` (`1805860/G4110`, `0644000/G4110`); `GET /api/essentials/browse/federal/officials`; `GET /api/essentials/browse/states/IN/officials`.
- `GET /api/meetings`, `?status=scheduled`, `?city=Bloomington`, `?city=Bloomington&state=IN[&status=scheduled]`, `?city=Asheville[&state=NC&status=scheduled]`, `?raceId=<uuid>`; `GET /api/meetings/upcoming`; `GET /api/meetings/:id/{agenda-items,votes,summary}` (5 meetings); `GET /api/agenda-items/:id`.
- `GET /api/essentials/politicians/:id/{votes,bills,legislative-summary}` for 12 members.
- `GET /api/compass/topics` (60 topics).
- `GET /api/civic-spaces/explore?sliceType=city&geoid=1805860`, `/explore/topics`, `/updates` - all 404.
- Source reads: `git show` / `git grep` against `origin/master` of `C:\EV-Accounts` (read-only; no checkout, no commit).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - nothing new; declared versions read.
- Architecture: HIGH for the structure and call sites (read with line numbers); MEDIUM for the registry contract (a recommendation, the design leaves it to the builder).
- API findings: HIGH (live responses, key paths walked programmatically); MEDIUM for backend causes.
- Pitfalls: HIGH where tied to a line or a response; flagged `[ASSUMED]` otherwise.

**Research date:** 2026-10-24
**Valid until:** 2026-10-31 for API state (meetings, elections and legislative freshness change daily; the races disappear after the 2026 cycle); 2026-11-23 for code structure unless `AppShell.tsx` or `explore/*` changes on `main`.
