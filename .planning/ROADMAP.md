# Roadmap: Civic Spaces

## Milestones

- ✅ **v1.0 Foundation & Full Forum** — Phases 1–5 (shipped 2026-03-28)
- ✅ **v2.0 All Slices** — Phases 6–8 (shipped 2026-04-04)
- 🚧 **v3.0 UI/UX Redesign** — Phases 9–12 (in progress)

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

---

### 🚧 v3.0 UI/UX Redesign (In Progress)

**Milestone Goal:** Rebuild the slice UI around Krishna's mockup — geo-grounded hero banners, two-column layout, and a fully-wired community sidebar. Every slice becomes a visually distinct, community-anchored space.

**Design Standard (v3.0 non-negotiable):**
- Beautiful, polished UI is a first-class deliverable — not a nice-to-have
- Light AND dark mode required across all new components
- Desktop and mobile must each be exceptional — separate flows are acceptable if they produce a superior experience for each context
- Reference: `C:\Civic Spaces\Screengrabs\` (6 Krishna mockup screengrabs) for layout, tone, and visual hierarchy
- Use `/ui-ux-pro-max` skill during planning phases to validate component design decisions before implementation

#### Phase 9: Hero Banner & Layout Shell

**Goal**: Users see a full-width, identity-rich hero banner above their feed on every slice tab, and desktop users see the two-column layout shell ready to receive a sidebar.

**Depends on**: Phase 8

**Requirements**: HERO-01, HERO-02, HERO-03, LAYOUT-01, LAYOUT-02

**Success Criteria** (what must be TRUE):
1. Each slice tab displays a full-width hero banner with the slice name, tagline, pill badges (level, jurisdiction, member count, slice number), and a two-sentence description overlaid on a photo
2. Switching slice tabs swaps the hero photo to the photo for that slice (even before jurisdiction-specific photos are uploaded — placeholder is acceptable)
3. The active tab in the tab bar is visually highlighted in brand teal
4. On desktop, the page renders a two-column grid with feed occupying ~65% width left and a sidebar placeholder occupying ~35% width right
5. On mobile, the sidebar is hidden and the feed is full-width single column; tab-switch scroll preservation still works correctly

**Plans**: 3 plans

Plans:
- [ ] 09-01-PLAN.md — Two-column layout grid, teal pill tabs, dark mode setup
- [ ] 09-02-PLAN.md — HeroBanner component + static slice copy data
- [ ] 09-03-PLAN.md — Hero wiring into AppShell + visual verification

---

#### Phase 10: Photos & Storage

**Goal**: Jurisdiction-specific hero photos are stored in Supabase Storage and served via CDN URL into the Phase 9 hero banner, giving Bloomington pilot slices authentic local imagery.

**Depends on**: Phase 9

**Requirements**: PHOTO-01, PHOTO-02

**Success Criteria** (what must be TRUE):
1. A Supabase Storage bucket exists with correct RLS policies allowing public CDN reads and service-role writes
2. Bloomington pilot slices display location-specific photos: courthouse image for Civil Civics/District slice, Indiana State Capitol for State, White House for Federal
3. Each geo slice type (Neighborhood, Local, State, Federal, Unified, Volunteer) has at least one curated hero photo loaded and resolving via CDN URL — no broken image states

**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md &mdash; Storage bucket + migration + photo_url column + HeroBanner wiring
- [ ] 10-02-PLAN.md &mdash; Bloomington photo upload + DB seeding + visual verification

---

#### Phase 11: Sidebar Widgets

**Goal**: The sidebar is populated with three live widgets — Issue Alignment Compass, Representing This Community, and Tools for This Community — with sidebar hook architecture established at AppShell level to prevent 6x firing.

**Depends on**: Phase 10

**Pre-conditions** (must verify before coding):
- CORS: `civicspaces.empowered.vote` confirmed in `api.empowered.vote` allowlist
- Sidebar hooks hoisted to AppShell level (not inside SliceFeedPanel) to prevent 6× firing across simultaneously-mounted panels
- Recharts installed

**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05

**Success Criteria** (what must be TRUE):
1. If the user has a valid `ev_token` SSO cookie and has answered 3+ compass topics, the sidebar shows a live Recharts radar chart of their civic compass
2. If `ev_token` is absent or the compass is uncalibrated (<3 answered topics), the sidebar shows a "Set up your Civic Compass" prompt card with a "Calibrate Now" link to `compassv2.empowered.vote/results`
3. The sidebar shows a "Representing This Community" widget with rep cards for officials relevant to the current slice's jurisdiction level — each card displays name, title, party badge, jurisdiction badge, and a View Profile link; the widget filters correctly when the user switches slice tabs
4. The sidebar shows a "Tools for This Community" widget with icon cards for Fallacy Finders, Treasury Tracker, Read & Rank, and Civic Trivia; tools not yet live degrade gracefully (no broken links or console errors)

**Plans**: 2 plans

Plans:
- [ ] 11-01: CORS verification + AppShell sidebar hook architecture
- [ ] 11-02: Compass widget (Recharts radar + calibration prompt)
- [ ] 11-03: Representatives widget (accounts API proxy + rep cards)
- [ ] 11-04: Tools widget (icon grid + graceful degradation)

---

#### Phase 12: Cleanup

**Goal**: Two dead props from the v2.0 codebase are removed, leaving a zero-warning TypeScript build and no vestigial interfaces.

**Depends on**: Phase 11

**Requirements**: CLEAN-01, CLEAN-02

**Success Criteria** (what must be TRUE):
1. `MutualFriendsList` no longer accepts or types a `friendCount` prop; all call sites pass no such prop; `tsc` produces zero errors
2. `NotificationListProps` no longer includes `onNavigateToThread`; all call sites are clean; `tsc` produces zero errors

**Plans**: 2 plans

Plans:
- [ ] 12-01: Dead prop removal (CLEAN-01 + CLEAN-02) + full tsc verification

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
| 10. Photos & Storage | v3.0 | 0/2 | Not started | — |
| 11. Sidebar Widgets | v3.0 | 0/4 | Not started | — |
| 12. Cleanup | v3.0 | 0/1 | Not started | — |
