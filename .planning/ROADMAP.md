# Roadmap: Civic Spaces

## Milestones

- ✅ **v1.0 Foundation & Full Forum** — Phases 1–5 (shipped 2026-03-28)
- ✅ **v2.0 All Slices** — Phases 6–8 (shipped 2026-04-04)
- ✅ **v3.0 UI/UX Redesign** — Phases 9–13 (shipped 2026-04-10)
- ✅ **Slice Taxonomy** — Phase 14 (shipped 2026-09-02)

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
