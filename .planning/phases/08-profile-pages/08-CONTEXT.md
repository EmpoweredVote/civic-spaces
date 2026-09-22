# Phase 8: Profile Pages - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Any display name anywhere in the app (feed, thread, notifications) is tappable and opens a profile page at `/profile/:userId`. The profile shows the user's civic identity: slice memberships, activity counts, and social connections — with own-vs-other view branching. Creating/editing profile data (bio, avatar) is not in scope.

</domain>

<decisions>
## Implementation Decisions

### Profile Layout
- Name + tier badge only — no avatar or photo
- Header contains: display name, tier badge (Inform/Connected/Empowered), join date, and friend/follow action (for other-view)
- Friend/follow action lives in the header beside the name — immediately visible, not buried
- Section order below header: **Stats strip → Slice Memberships → Friends**
- Stats strip is a 3-column layout: `42 Posts | 118 Replies | 7 Friends` — number + label per column

### Slice Membership Display
- All active slices shown: N/L/S/F + Unified + Volunteer (Volunteer only if user has the role)
- Slice type label only per entry (e.g., "Federal", "State", "Neighborhood") — no post counts per slice, no slice IDs
- Display order: Federal → State → Local → Neighborhood → Unified → Volunteer
- Shared slices highlighted — when viewing another user's profile, slices the viewer and subject share in common get a subtle "you're both here" indicator

### Social & Activity Section
- Stats strip shows **Posts | Replies | Friends** as three separate metrics (not combined into "Contributions")
- Friends count in the stats strip: shows the subject's **total** friend count, displayed muted/secondary
- **Other view (viewing someone else's profile):**
  - Friends section shows: mutual friends list (names, tappable) + muted total count below
  - e.g., "Mutual friends (3)" with names listed, then "· 12 friends total" muted
- **Own view (viewing your own profile):**
  - Friends section shows: full friends list (all mutual friends, names tappable)
  - Does NOT show pending requests (those live elsewhere)

### Navigation Pattern
- Full page at `/profile/:userId` — not a modal or sheet
- Standard browser back navigation — tapping Back returns to exactly where the user came from (mid-thread, mid-feed, notification list)
- Every display name in the app is a tappable link, including the user's own name — tapping your own name shows your own profile (own view)
- No separate nav bar profile icon needed — own name tappable app-wide is sufficient

### Claude's Discretion
- Exact visual treatment of the "shared slice" indicator (icon, color, label)
- Tier badge design (color, shape)
- Stats strip spacing and typography
- Empty state if a user has no friends yet
- Loading skeleton layout

</decisions>

<specifics>
## Specific Ideas

- Stats strip should feel like GitHub's contribution stats or Twitter's profile counts — scannable numbers with simple labels
- Shared slice indicator should be subtle, not dominant — it's context, not a call to action

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-profile-pages*
*Context gathered: 2026-04-03*
