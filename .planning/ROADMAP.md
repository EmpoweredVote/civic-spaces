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
| 17. The Signed-Out Arrival | — | 0/? | Planning | — |
