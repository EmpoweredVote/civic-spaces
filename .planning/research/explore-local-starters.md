# Explore: local conversation starters at scale

2026-11-04. What Explore can say about a place, where each piece comes from, and the
order to grow it in. Written alongside commit `47eb625` (place-named starters and the
"Who represents {place}" module).

## 🔴 SUPERSEDED IN PART, 2026-11-04: the officials module is gone from Explore

Chris, reviewing #133: *"I do not like the real living officials in the middle section — I
don't mind them on a border — but having a big list of elected officials in the middle isn't
helpful."*

So the `officials` module was removed from `DEFAULT_MODULES` on all four levels, and
`officialsTopics.ts`, `OfficialsModule.tsx`, the `officialTopics` context field and the
`officials` prop chain into Explore were deleted with it. The middle column is for
conversation, not for a roster.

**Who represents a place is still on screen, and always was** — `RepresentativesWidget`
in the right sidebar ("Representing this community"), desktop and mobile, on every
non-Volunteer tab. That is the border treatment this decision is fine with. Nothing was
moved and nothing was added; the middle column simply stopped repeating it.

What this does NOT change: the rule in the next section still governs every other source,
and the by-area officials lookup is still the only national-coverage local source we have.
If a future starter wants to use it, the constraint to design against is the one that was
just rejected — a module that reads as a list of names rather than as an invitation to
talk. The deleted code is recoverable from this branch's history (`47eb625`, `30a9949`).

## The rule every layer follows

A starter may use a **local fact only if a real source returned it for this exact
place**, and it must say which source. Everything else is a general question, labelled
as general. No layer may invent news, events, decisions or positions — the
`ExploreTopic.provenance` field is how the UI keeps that promise, and each new source
gets its own provenance value rather than borrowing one.

## What exists today (checked 2026-11-04)

| Source | Real? | Coverage | Used for | Provenance |
|---|---|---|---|---|
| Public officials, by area (`/api/essentials/browse/by-area`) | Yes | **National** — any address with districts. Asheville returns mayor, council, county, governor, legislators, Congress | ~~"Who represents {place}" starters~~ — **removed 2026-11-04, see above**; still shown in the sidebar widget | ~~`derived-from-officials`~~ |
| Resolved place name (`useJurisdictionName`, geoid → name) | Yes | National | **New:** "your city" → "Asheville" in general starters | `staff` (unchanged) |
| Published council agendas (`useAgendaItems`) | Yes | **One city** (Bloomington, IN) | Agenda module, one starter per item | `derived-from-agenda` |
| Elections and races (`useNextElection`, races) | Yes | National, **only while an election is scheduled** (none right now — 3 Nov just passed) | Races and debates modules | — (module, not starters) |
| Recorded debates / forums (race media) | Yes | Sparse | Debates module | — |
| Compass topic catalog + the member's own answers | Yes | National | **Ranks** general starters for one member; never produces content (locked decision 7) | — |
| Population, weather, banner photo | Yes | National | Banner context only | — |
| Roll-call votes, ballot measures | No source | — | Reserved rooms | `derived-from-vote` reserved |

## Recommended order of a place's Explore page

1. **This place's published record** — agenda items, then roll calls and ballot
   measures when sources exist. Most specific, so first. (Bloomington today.)
2. **Who represents it** — shipped. The one local source that reaches every place now.
3. **What is on the ballot** — races and debates, when an election is scheduled.
   *Next step:* one starter per race ("What do you want the candidates for NC-11 to
   talk about?") built from the race record, the same way officials starters are.
4. **Local partners** (`chapter`) and **member-requested** topics (`member`), once
   either has a way in.
5. **General questions, named for the place and labelled general** — always present,
   so no page is ever empty. Ordered by the member's own Compass answers.

The page should never show more than about three cards from any one layer above the
general questions; the officials layer already caps itself at one card per office group
(at most three per level).

## How this scales without hand-writing places

Today the layers are assembled in the browser (`useExploreComposition` in
`src/lib/exploreData.ts`). That file was built as the seam for a server route, and the
route is the scaling step:

`GET /api/civic-spaces/explore?sliceType=&geoid=` → `{ generic, bespoke }`

- The server joins the sources per `(sliceType, geoid)` once and caches it, instead of
  every browser fetching agendas and officials separately.
- New sources (agenda pipeline cities, roll calls, ballot measures) are added there,
  and the frontend changes nothing — `resolveComposition` already discards any bespoke
  topic stamped with a different geoid, so a server bug cannot put one city's content
  on another's page.
- Officials starters can stay client-side until then; they are a pure function
  (`officialsTopics`) and move to the server unchanged.

## What Chris would need to provide

1. **The explore route** above, returning topics in the `ExploreTopic` shape. The
   handoff for it is 16-09 "Ask 1".
2. **A topic reference on posts.** `civic_spaces.posts` has no topic column, so a
   conversation started from a topic is not linked back to it ("Conversations aren't
   linked to topics yet" on the topic page). Needs a nullable `topic_id` on `posts`,
   and the same field from `get_public_feed`.
3. **More agenda coverage.** The agenda layer is the richest source and reaches one
   city. Which cities the meetings pipeline covers next decides where Explore feels
   most local.
4. **Ballot measures and roll calls**, when there is a source — both have reserved
   rooms and provenance values waiting.

## Local environment note

On the machine this was written on, `accounts-api.empowered.vote` intermittently fails
to resolve (`getaddrinfo ENOTFOUND`) while `api.empowered.vote` — the same Render
service — resolves. The `/api` dev proxy targets `accounts-api` by default, so every
live-data call (officials, meetings, elections, Compass) 500s locally when it happens,
and Explore silently loses its local layers. `VITE_API_PROXY_TARGET=https://api.empowered.vote`
in `.env.local` works around it.
