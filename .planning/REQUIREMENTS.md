# Requirements: Civic Spaces

**Defined:** 2026-04-05
**Milestone:** v3.0 — UI/UX Redesign
**Core Value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.

## v3.0 Requirements

### Hero Banner

- [x] **HERO-01**: User sees a full-width hero banner at the top of each slice tab — geo photo with slice name, tagline, pill badges (level, jurisdiction, member count, slice number), and a 2-sentence description overlaid
- [x] **HERO-02**: Hero photo changes when user switches slice tabs
- [x] **HERO-03**: Active slice tab is visually highlighted (brand teal) in the tab bar

### Layout

- [x] **LAYOUT-01**: On desktop, slice content uses a two-column layout — feed (~65%) left, sidebar (~35%) right
- [x] **LAYOUT-02**: On mobile, sidebar is hidden and feed is full-width single column

### Sidebar

- [ ] **SIDE-01**: If user is authenticated with the Empower Compass (ev_token available via SSO cookie), they see a live radar chart of their calibrated civic compass in the sidebar
- [ ] **SIDE-02**: If ev_token is unavailable or compass is uncalibrated (fewer than 3 answered topics), the widget shows a prompt card: "Set up your Civic Compass" with a "Calibrate Now" link to compassv2.empowered.vote/results
- [ ] **SIDE-03**: User sees a 'Representing This Community' widget listing elected officials relevant to this slice's jurisdiction level
- [ ] **SIDE-04**: Each rep card shows name, title, party badge, jurisdiction level badge, and a 'View Profile' link
- [ ] **SIDE-05**: User sees a 'Tools for This Community' widget with icon cards for Fallacy Finders, Treasury Tracker, Read & Rank, and Civic Trivia (links to EV ecosystem; gracefully degraded if tool not yet live)

### Photos

- [ ] **PHOTO-01**: Jurisdiction-specific hero photos are stored in a Supabase Storage bucket and served via CDN URL
- [ ] **PHOTO-02**: Each slice type (Neighborhood, District, State, Federal, Unified, Volunteer) has at least one curated hero photo; Bloomington-pilot slices get location-specific imagery (courthouse, capitol, White House, etc.)

### Cleanup

- [x] **CLEAN-01**: `friendCount` dead prop removed from `MutualFriendsList`
- [x] **CLEAN-02**: `onNavigateToThread` vestigial prop removed from `NotificationListProps`

---

## Future Requirements (v4.0+)

### Sidebar Integrations (deeper)

- **COMP-01**: Issue Alignment Compass compares user priorities vs. a specific rep's positions (side-by-side overlay)
- **COMP-02**: User can open a full-page compass comparison view
- **TOOLS-01**: Tools widget shows live status (available / coming soon) pulled from EV platform registry

### Visual Polish

- **VIS-01**: Animated hero banner transitions on tab switch
- **VIS-02**: Skeleton loading states for sidebar widgets
- **VIS-03**: Dark mode support across all new components

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time rep data sync | Accounts API owns rep data; Civic Spaces is a consumer — no local rep DB |
| User-uploadable slice photos | Moderation complexity; curated imagery is sufficient |
| Debates / Symposiums / Announcements tabs | Future feature layers, explicitly deferred in v2.0 |
| Focus Communities | Future hub expansion |
| Algorithmic feed ranking | Conscious anti-feature — chronological feed is a civic legitimacy signal |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HERO-01 | Phase 9 | Complete |
| HERO-02 | Phase 9 | Complete |
| HERO-03 | Phase 9 | Complete |
| LAYOUT-01 | Phase 9 | Complete |
| LAYOUT-02 | Phase 9 | Complete |
| PHOTO-01 | Phase 10 | Complete |
| PHOTO-02 | Phase 10 | Complete |
| SIDE-01 | Phase 11 | Complete |
| SIDE-02 | Phase 11 | Complete |
| SIDE-03 | Phase 11 | Complete |
| SIDE-04 | Phase 11 | Complete |
| SIDE-05 | Phase 11 | Complete |
| CLEAN-01 | Phase 12 | Complete |
| CLEAN-02 | Phase 12 | Complete |

**Coverage:**
- v3.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after v3.0 milestone start*
