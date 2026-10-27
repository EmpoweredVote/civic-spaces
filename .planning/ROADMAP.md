# Roadmap: Civic Spaces

## Milestones

- ✅ **v1.0 Foundation & Full Forum** — Phases 1–5 (shipped 2026-03-28)
- ✅ **v2.0 All Slices** — Phases 6–8 (shipped 2026-04-04)
- ✅ **v3.0 UI/UX Redesign** — Phases 9–13 (shipped 2026-04-10)
- ✅ **Slice Taxonomy** — Phase 14 (shipped 2026-09-02)
- ✅ **Tool Deep Links** — Phase 15 (shipped 2026-09-08)

## Phases

<details>
<summary>✅ v1.0 Foundation & Full Forum (Phases 1–5) — SHIPPED 2026-03-28</summary>

### Phase 1: Foundation
**Goal**: Schema, auth integration, and slice assignment service operational
**Plans**: 2 plans

### Phase 2: Core Forum
**Goal**: Federal Slice forum active with cursor-paginated feed, posts, and replies
**Plans**: 2 plans

### Phase 3: Social Graph
**Goal**: Mutual friends and Empowered follow active with friend-boosted feed
**Plans**: 2 plans

### Phase 4: Notifications & Realtime
**Goal**: Reply, friend request, and accepted-friendship notifications delivered live
**Plans**: 2 plans

### Phase 5: Moderation & Safety
**Goal**: Flagging, moderation queue, and block operational before public launch
**Plans**: 2 plans

</details>

<details>
<summary>✅ v2.0 All Slices (Phases 6–8) — SHIPPED 2026-04-04</summary>

### Phase 6: Hub Expansion
**Goal**: All six slice tabs mounted and forum-capable in the multi-tab hub
**Plans**: 5 plans

Plans:
- [x] 06-05: Hub expansion execution

### Phase 7: Special Slices
**Goal**: Unified and Volunteer slices auto-assigned, role-gated, and forum-active
**Plans**: 2 plans

### Phase 8: Profile Pages
**Goal**: Display name tappable from all surfaces; profile anchors civic identity
**Plans**: 3 plans

Plans:
- [x] 08-01: Profile page scaffold
- [x] 08-02: Stats, memberships, mutual friends
- [x] 08-03: Social actions (friend request, follow)

</details>

<details>
<summary>✅ v3.0 UI/UX Redesign (Phases 9–13) — SHIPPED 2026-04-10</summary>

- [x] Phase 9: Hero Banner & Layout Shell (3/3 plans) — completed 2026-04-05
- [x] Phase 10: Photos & Storage (2/2 plans) — completed 2026-04-06
- [x] Phase 11: Sidebar Widgets (4/4 plans) — completed 2026-04-07
- [x] Phase 12: Cleanup (1/1 plan) — completed 2026-04-09
- [x] Phase 13: v3.0 Tech Debt Sprint (1/1 plan) — completed 2026-04-10

See archive: `.planning/milestones/v3.0-ROADMAP.md`

</details>

### Phase 14: Slice Taxonomy
**Goal**: A slice is a government a member lives under — city, county, state, federal —
not a constituency they vote in
**Plans**: 1 plan (8 tasks)

`federal` was keyed on the member's congressional district and `state` on their state
senate district, so two neighbours on opposite sides of a district line could not talk to
each other about the country or the state they both live in. `neighborhood` held a school
district while being labelled "Local", and `local` held a county while being labelled
"County" — that gap between name and label is where the mapping hid.

Districts still decide *which* representative a member sees (`TAB_DISTRICT_TYPES`); they no
longer fragment the conversation. Spans two repos: the jurisdiction geoids come from
ev-accounts#323.

### Phase 15: Tool Deep Links
**Goal**: A sidebar tool row opens the member's *own* jurisdiction, or it does not appear
**Plans**: 1 plan (6 tasks)

The Tools box showed two fixed home-page links, identical on every tab. The Essentials row
now deep-links to the active tab's own city, county, state or federal view, and the two
hand-drawn icons are replaced with the real EV brand symbols.

Matching turned out to need nothing new: Essentials' public `/coverage.json` keys cities by
7-digit place FIPS and counties by 5-digit county FIPS — exactly what `slices.geoid` already
stores — so it is an exact geoid match with no Census call and no `useJurisdictionName`.

The governing rule is **no deep link, no row**: no home-page fallback, and never another
jurisdiction's link. That came from Treasury Tracker resolving an unrecognised `?entity=`
slug to Bloomington, IN's budget — a real budget for the wrong place, which is worse than
no link at all.

Coverage is genuinely sparse (170 cities, 26 counties, 50 states), so City and County tabs
correctly show no Essentials row for most members; State and Federal always do.

**Not shipped:** the Treasury Tracker row. TT stores no geoid at all, so it needs its own
coverage catalog first — specified for that repo in
`phases/15-tool-deep-links/TT-HANDOFF.md`. Also outstanding: the in-situ visual check,
which needs a signed-in session.

### Phase 16: Explore by Slice
**Goal**: Each slice's Explore is bespoke to that jurisdiction — and a member is never
offered a write that RLS would reject
**Plans**: 10 plans, executed **strictly in order** — they share five files, so despite
`parallelization: true` in config this phase is serial. See the plan-set table in `16-01`.

Plans:
- [x] `16-01-PLAN.md` — Scoped topic records, the pure resolver, the async seam
- [x] `16-02-PLAN.md` — The registry contract and the content modules
- [x] `16-03-PLAN.md` — `ExploreView` renders a composition
- [x] `16-04-PLAN.md` — Explore follows the active tab; drafts re-key to `(sliceType, geoid, topicId)`
- [x] `16-05-PLAN.md` — The sibling-shard read-only gate, with its own browser check
- [x] `16-06-PLAN.md` — Bloomington end to end: agenda-derived topics + the dev fixture override
- [x] `16-07-PLAN.md` — Races, debates and Compass ranking, from the member's most local area
- [x] `16-08-PLAN.md` — The invitation to seed an unseeded place, shown without the vote
- [x] `16-09-PLAN.md` — The reserved rooms, and the ev-accounts handoff
- [x] `16-10-PLAN.md` — The four-way visual pass and the phase gate

Shared context: `16-SHARED.md` — the execution order, the coverage matrix and the
constraints every plan inherits. Read it before `16-01`.

Validation: `16-VALIDATION.md` — how every claim in the phase is checked, which commands
run it, and the gaps it knowingly leaves.

Explore shipped in #109 bound to `homeSlice`, so every tab showed the same content and the
State tab asked members about their city's sidewalks. The fix is not re-pointing the data:
the content key is `(slice_type, geoid)` — bespoke per *jurisdiction*, identical across
sibling shards — and each slice composes its own set of modules rather than filling a shared
frame.

A place's topics come from what that place's government is working on: the council's agenda
and the city's ballot measures, the legislature and the state ballot and the Governor. That
makes bespoke content possible without anyone knowing the place, which is the anti-goal the
design is built around.

Explore follows the active tab and is read-only on a sibling shard — the third half of the
gate-the-feed / gate-the-thread landmine.

Design agreed and merged in #114: `phases/16-explore-by-slice/16-DESIGN.md`.
Shipped in #120 (`1096e7a`), 2026-10-25. Closes #111.

**Not shipped**, and recorded in `phases/16-explore-by-slice/deferred-items.md`:

- The five reserved rooms are reserved — `symposiums`, `civic-listening`, `common-grounds`,
  `focused-communities`, `slice-action-votes` render as held-open rooms, not as features.
- The seed invitation ships **without the vote** (16-08). A member is invited; nothing counts it.
- Five API gaps and one bug are an ev-accounts ask, specified in
  `phases/16-explore-by-slice/EXPLORE-HANDOFF.md` — including the debates join, which
  downloads 234 KB for a 45-row answer because `/api/meetings` has no `eventKind` filter.
- App-wide and deliberately out of scope: Tailwind v4's Preflight leaves `cursor: default`
  on 196 of 416 controls, and `useAuth.ts:100` writes `localStorage` unguarded, so the app
  never boots with storage blocked.
- Reserved rooms and real modules' empty states are styled identically, so a reader cannot
  tell "will fill" from "held open".
- Outstanding: the in-situ visual check. `photoUrl`/credit precedence and real sibling
  shards exist only in production, signed in.

---

### Phase 17: The Signed-Out Arrival
**Goal**: A visitor who is not signed in understands what Civic Spaces is, what an account
gets them, and which wall they are standing at — and is never shown a place as if it were
already theirs

A guest or incognito visitor today gets one grey sentence — "Log in to view your civic
community." — a button, and then 580 words of Explore that talk to them as though they
were already a member of somewhere. Measured signed out, four ways, at `1096e7a`:

- The page opens **"WELCOME TO YOUR CIVIC SPACE / Discover what's happening in your
  community."** It is nobody's community: this is the generic city composition with
  `geoid: null`, and the app cannot name the visitor's place because it has no account to
  ask. The same error #111 was raised for — content addressed to a place the reader is not
  in — pointed at strangers instead of at the State tab.
- "What your local government is working on", "Questions for your community", "Nothing is
  on the public calendar **for your area** right now". The reserved rooms' own copy rules
  forbid "for your area" precisely because it asserts a place; the real modules say it to a
  visitor who has none.
- The five reserved rooms render in full, promising what "this space becomes" to someone
  who has no space.
- Nothing anywhere says an account is needed, what kind, or what it would give them.
- On mobile the sign-in strip is a thin line at the top of a 4,475px page.

**There are two walls, and the copy only knows about the first.** Account tier is child-record
presence, not a flag (ev-accounts `accountMeService.ts`, confirmed 2026-09-13):

1. **Not signed in** — today's signed-out branch, `AppShell.tsx:1063`.
2. **Signed in at the Inform tier** — a real, authenticated account with no
   `connect.connected_profiles` row, so no encrypted coordinates and therefore no slices.
   They pass sign-in and land on the no-jurisdiction empty state. Civic Spaces needs the
   **Connect** tier specifically, and Connect means *an address has been set*, because
   slice assignment runs off encrypted coordinates. "Make an account" is not the whole
   instruction and will strand anyone who stops there.

And a third failure that is this phase's by subject rather than by scope: with site data
blocked, `useAuth.ts:100` writes `localStorage` unguarded and the app never boots at all —
so the explainer never renders for exactly the privacy-minded visitor most likely to be
browsing that way. Logged as item 9 of `phases/16-explore-by-slice/deferred-items.md`,
orphaned until now.

Constraint inherited from #111: never show a stranger a place as if it were theirs. The
generic composition stays — browsing without an account is deliberate, and drafting already
survives the trip through sign-in — but it must be framed as an example of what a Civic
Space looks like, not as *their* civic space.

**Scope (split after research, 2026-10-26).** This phase is the reversible half: the welcome
screen, place navigation, and the write gate. It ships against endpoints that are **already**
anonymous — `/essentials/location-search`, `/coordinate-lookup`, `/browse/by-area`, meetings,
elections, compass topics — and the committed gazetteer. **It must not touch
`supabase/migrations/`.** Opening conversations to `anon` is Phase 18.

- Welcome screen: the Connect Pillar introduction, the privacy pitch, and what an observer
  cannot do *yet*. Copy follows `empowered-vote-primer.md` § The Three Pillars rather than
  inventing a vocabulary.
- Place entry, both paths. The place-name path (`location-search` → `public/geo/` centroid →
  `coordinate-lookup`) is CORS-clean and shippable today. The address path needs one new
  anonymous body-only endpoint from ev-accounts, modelled line-for-line on
  `essentialsCoordinateLookup.ts` — **the Census Geocoder sends no
  `Access-Control-Allow-Origin` and cannot be called from a browser**, and
  `/essentials/address-search` is rejected because it puts the address in the query string
  and echoes `matchedAddress` back. Ship behind the place-name path; the address path lands
  when ev-accounts does.
- 🔴 `isViewOnly` **fails open today.** `AppShell.tsx:840` is
  `!!activeSlice && !!activeViewing && …`, so a viewer holding no slice of that type reads as
  *not* view-only. And `viewingSlices` stores a `SiblingSlice` — a shard index — which cannot
  represent another *place* at all. Rewrite it to fail closed, add the observer and the
  non-member-place cases to `check:explore-gate`, and extract a `canWriteIn()` predicate as
  the seam D-21 asks for.
- Explore, banner, sidebar and representatives for a visited place. `useRepresentatives`
  cannot follow one; `POST /essentials/browse/by-area` already can.
- `CLAUDE.md` and `LocationPrompt.tsx`'s 🔴 comment updated per D-14 — the "never stores"
  half survives, the "never geocodes" half is narrowed for observers only.
- The ev-accounts handoff for `POST /api/civic-spaces/resolve`.

**Plans**: 7 plans, executed **strictly in order** — 17-02, 17-04, 17-05 and 17-06 all edit
`AppShell.tsx`, and three of them (17-02, 17-04, 17-06) edit
`scripts/check-explore-gate.mjs`, so despite `parallelization: true` in config this phase is
serial. See the plan-set table in `17-SHARED.md`.

Plans:
- [x] `17-01-PLAN.md` — Reaching the signed-out app, and the write predicate (`canWriteIn`)
- [x] `17-02-PLAN.md` — The gate fails closed; the notices learn which of four reasons
- [x] `17-03-PLAN.md` — Resolving a place with no account, and the rule D-14 narrows
- [x] `17-04-PLAN.md` — The welcome screen, and a named place on screen
- [x] `17-05-PLAN.md` — The second entry point, the way back, and the place-entry check
- [x] `17-06-PLAN.md` — Officials, the sidebar and Explore for a visited place
- [x] `17-07-PLAN.md` — The four-way visual pass and the phase gate

Shared context: `17-SHARED.md` — the phase boundary, the execution order, the three viewer
states, the coverage matrix and the constraints every plan inherits. Read it before `17-01`.

Validation: `17-VALIDATION.md` — how every claim in the phase is checked, which commands
run it, and the gaps it knowingly leaves.

Research: `17-RESEARCH.md` (`4991a00`). Context and locked decisions: `17-CONTEXT.md`.

**The phase in one line:** *anyone may look anywhere; only your own slices accept your
voice.*

Shipped on `feat/signed-out-arrival`, 2026-10-26. 🔴 **`supabase/migrations/` is untouched —
not a policy, not a grant, not a function** — which is what makes this half reversible: it
ships entirely against endpoints that were already anonymous (`location-search`,
`coordinate-lookup`, `browse/by-area`, meetings, elections, compass topics) plus the
committed gazetteer in `public/geo/`.

**Shipped.** A welcome screen that names both walls and the word *yet*, quoting the primer's
own line — *"each person has exactly one voice — and lives where they claim"* — with the
privacy pitch beside it. Place entry by name, through **one** `PlacePicker` mounted at two
entry points (the welcome screen and a `PlaceStrip` under the banner), so a member can look
at another city and get back. A visited place gets its Explore, its hero banner, its
calendar and **its own** officials through the public by-area endpoint. The fail-open
`isViewOnly` expression at `AppShell.tsx:840` is replaced by `canWriteIn()` / `whyNoWrite()`
in an import-free `src/lib/writeAccess.ts` — four reasons, failing closed, with no tier term
because an Inform account lands in the guest branch by construction. The address string is
never stored, never echoed and never rendered back: `ResolvedPlace` has **no name field at
all**, so a call site could not echo the input if it tried, and only geoids reach
`sessionStorage`. `CLAUDE.md` and `LocationPrompt.tsx` are updated per D-14 — "never stores"
survives whole, "never geocodes" is narrowed to observers only.

Four new or extended checks, all committed and all made to fail before they were believed:
`check:write-access` (19), `check:place-resolve` (42, plus a `--live` contract-drift mode),
`check:place-entry` (20) and `check:explore-gate` grown to **four viewers / 56 assertions**.
`shoot:welcome` adds 24 looked-at cells and a 144-assertion audit — contrast resolved
through `fillRect` + `getImageData`, hit-tests at 1440 and 390 in both themes, and
`prefers-reduced-motion`.

**Not shipped**, and recorded in `phases/17-the-signed-out-arrival/deferred-items.md`:

- 🔴 **The address path is written, typed and switched off.** It is gated behind
  **`VITE_PLACE_RESOLVE_URL`** — deliberately *not* `VITE_SLICE_ASSIGNMENT_URL`, because the
  two point at the same ev-accounts base and one switch would turn the address path on for
  every deployment that had configured assignment. Unset, **no address input renders at
  all** — not a disabled one, not a "coming soon". It waits on
  `POST /api/civic-spaces/resolve`, specified in `phases/17-the-signed-out-arrival/ACCOUNTS-HANDOFF.md`.
  ⚠️ `.env.example` is missing the variable and could not be edited from the agent session
  that found it.
- 🔴 **Conversations stay members-only.** Every `civic_spaces` grant is `TO authenticated`,
  so an observer reads zero forum rows — and so does a signed-in member looking at another
  city. A visited place therefore gets an honest *"Conversations here belong to the people
  who live here"* state rather than an empty feed, because an empty feed returned by RLS
  reads as "nobody has said anything here", which is a lie told silently. **Phase 18 opens
  it**; the one paragraph and one empty state it revises are marked in source — `grep -rn
  "PHASE 18" src/` finds them in `WelcomeScreen.tsx`, `AppShell.tsx` and `writeAccess.ts`.
- A member who enters **their own** place from the strip is gated as a sibling shard, with
  an em-dash where the shard number should be. Fail-closed, so nothing unsafe is offered,
  but over-gated — item 4, needing a product decision before a fix.
- The ~40 conversation-starter **questions** in the topic catalogue still use the second
  person at a visited place ("What should get built in *your* city, and where?"). Item 3:
  they are data with no `ctx` where they are authored, `check-composition` keys fixtures off
  their titles, and the second person is what makes a starter an invitation — a call about
  the product's voice, not a pronoun swap. The one **statement** on the wrong side of that
  boundary was fixed in 17-07.
- Still outstanding, as in Phases 15 and 16: the signed-in production pass. Real
  `photoUrl`/credit precedence and real sibling shards exist only in production, and
  localhost has no login.
- App-wide and unowned: `cursor: default` on 196 of 416 controls, and a storage-blocked boot
  that now has **two** causes — `useAuth.ts:100`, and `@supabase/supabase-js` constructing a
  `RealtimeClient` at module scope, which dies before any of our code runs.

### Phase 18: The Public Square
**Goal**: Civic Spaces' conversations are readable by anyone, as a public town square — and
the one-way door is walked through deliberately, with the exposure measured first

The irreversible half of #17. Chris's rule: *"it is after all, a public square"* — Inform and
Guest observe, only Connect and Empowered post, vote or impact.

🔴 **This phase is not reversible.** Once the PostgREST endpoint is publicly queryable, it is
permanently, scriptably public. Its failures are also silent: an over-wide grant publishes the
member roster and nothing turns red.

**The gate is not RLS.** `civic_spaces` has no `GRANT USAGE ON SCHEMA … TO anon`, so PostgREST
cannot resolve the schema before a policy is ever consulted. Both feed RPCs fail independently
of policy: `get_feed_filtered` welds `AND p.slice_id IN (SELECT slice_id FROM slice_members
WHERE user_id = current_user_id())` into its body, and `get_boosted_feed_filtered` is
`SECURITY INVOKER` and reads `friendships` / `follows` / `blocks` as the caller. This is a
grants-and-a-new-RPC job.

- Schema `USAGE`, **column-level** grants (`useThread` does `select('*')`, so a table grant
  publishes `edit_history`), a narrow `get_public_feed`, and an author-scoped
  `connected_profiles` policy — `USING (true)` there publishes the whole member roster in one
  query.
- One policy, not two: D-18 makes the rule identical for `anon` and for an authenticated
  non-member.
- `scripts/check-anon-read.mjs` with an explicit **must-fail** list: `slice_members`,
  notifications, friends, drafts, anything keyed to a person.
- Realtime gating, and the `CLAUDE.md` "members-only by design" correction.
- `locatePost` gains a fourth outcome — once posts are public, a signed-out visitor on
  `/post/:postId` can simply be shown the post, which partly dissolves the deferred
  shared-link arrival. `unavailable`'s deliberate conflation still earns its keep for deleted
  posts and suspended authors.
- **Not in this phase:** search-engine indexing and link unfurling. No SSR, no prerender, no
  `robots.txt`, one static set of `og:` tags. Crawlable ≠ indexed, and the copy must not
  overclaim.

**The display-name question is answered.** Measured in production 2026-10-26, aggregates only:
11 connected profiles, **0** matching a real-name shape, **0** with an avatar, 12 live posts
and 8 replies by 7 authors. Accepted risk, signed off by Chris with the number in front of
him. Two riders: re-run the aggregate immediately before the migration, and add handle
validation in ev-accounts so the next real name cannot arrive silently.


---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | — | Complete | 2026-03-28 |
| 2. Core Forum | v1.0 | — | Complete | 2026-03-28 |
| 3. Social Graph | v1.0 | — | Complete | 2026-03-28 |
| 4. Notifications & Realtime | v1.0 | — | Complete | 2026-03-28 |
| 5. Moderation & Safety | v1.0 | — | Complete | 2026-03-28 |
| 6. Hub Expansion | v2.0 | — | Complete | 2026-04-04 |
| 7. Special Slices | v2.0 | — | Complete | 2026-04-04 |
| 8. Profile Pages | v2.0 | 3/3 | Complete | 2026-04-04 |
| 9. Hero Banner & Layout Shell | v3.0 | 3/3 | Complete | 2026-04-05 |
| 10. Photos & Storage | v3.0 | 2/2 | Complete | 2026-04-06 |
| 11. Sidebar Widgets | v3.0 | 4/4 | Complete | 2026-04-07 |
| 12. Cleanup | v3.0 | 1/1 | Complete | 2026-04-09 |
| 13. v3.0 Tech Debt Sprint | v3.0 | 1/1 | Complete | 2026-04-10 |
| 14. Slice Taxonomy | — | 1/1 | Complete | 2026-09-02 |
| 15. Tool Deep Links | — | 1/1 | Complete | 2026-09-08 |
| 16. Explore by Slice | — | 10/10 | Complete | 2026-10-25 |
| 17. The Signed-Out Arrival | — | 7/7 | Complete | 2026-10-26 |
| 18. The Public Square | — | 0/? | Not planned | — |
