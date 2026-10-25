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
offered a write they cannot make
**Plans**: 10 plans, executed **strictly in order** — they share five files, so despite
`parallelization: true` in config this phase is serial. See the plan-set table in `16-01`.

Plans:
- [ ] `16-01-PLAN.md` — Scoped topic records, the pure resolver, the async seam
- [ ] `16-02-PLAN.md` — The registry contract and the content modules
- [ ] `16-03-PLAN.md` — `ExploreView` renders a composition
- [ ] `16-04-PLAN.md` — Explore follows the active tab; drafts re-key to `(sliceType, geoid, topicId)`
- [ ] `16-05-PLAN.md` — The sibling-shard read-only gate, with its own browser check
- [ ] `16-06-PLAN.md` — Bloomington end to end: agenda-derived topics + the dev fixture override
- [ ] `16-07-PLAN.md` — Races, debates and Compass ranking, from the member's most local area
- [ ] `16-08-PLAN.md` — The invitation to seed an unseeded place, shown without the vote
- [ ] `16-09-PLAN.md` — The reserved rooms, and the ev-accounts handoff
- [ ] `16-10-PLAN.md` — The four-way visual pass and the phase gate

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
| 16. Explore by Slice | — | 0/10 | Planned, not started | — |
