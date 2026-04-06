# Phase 11: Sidebar Widgets - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate the ~35% right sidebar column (established in Phase 9) with three live widgets: Issue Alignment Compass (Recharts radar chart), Representing This Community (rep cards from Accounts/Essentials API), and Tools for This Community (civic tool icon grid). Sidebar hook architecture must be established at AppShell level to prevent 6× firing across simultaneously-mounted panels. Mobile access via a collapsible section above the feed is also in scope.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Structure
- Widget order (top to bottom): Compass → Representatives → Tools
- Desktop: sidebar column is sticky (`position: sticky, top: 0`); if combined widget height exceeds viewport, sidebar scrolls independently within itself
- Visual container: each widget is a rounded card with a header label — subtle background/border, rounded corners, light/dark mode compliant
- Mobile: collapsible section placed below hero banner, above post feed — collapsed by default, tap to expand; architecture must be extensible (6+ widgets expected in near future)

### Compass Widget
- Axes: pulled from Empowered Vote API topic categories — researcher must confirm response shape and category structure; do not hardcode labels
- Calibration prompt (shown when `ev_token` absent or fewer than 3 answered topics): compact card — compass icon + one-liner benefit statement + "Calibrate Now" button linking to `compassv2.empowered.vote/results`
- Chart color: **purple** (primary); **orange** reserved for a second persona if/when implemented; **no red or blue** — deliberate anti-partisan color policy
- Interactivity: hover tooltips on desktop showing axis label + score value; static display only on mobile

### Representatives Widget
- Show **all** reps for the current slice, sorted by branch: Executive → Legislative → Judicial
- **No party badges, no party affiliation displayed anywhere** — Civic Spaces is explicitly anti-partisan and does not acknowledge or display candidate party affiliation
- Rep photos: use the existing Accounts/Essentials headshot pipeline (researcher must trace this flow); fallback to generic avatar icon when no photo available
- Empty state: **hide the widget entirely** when no reps are found for the current slice — no placeholder, no "coming soon" message; sidebar layout is dynamic per slice
- Tab-switch behavior: show brief loading skeleton while fetching reps for the newly-selected slice; do not show stale reps during transition

### Tools Widget
- **Hide tools that are not yet live** — only functional tools with real links appear in the grid; no "Coming Soon" cards
- Layout: 2-column icon grid — each card shows an icon + short name label; hover tooltip with description on desktop
- Link behavior: all tool links open in a **new browser tab** — never navigate away from Civic Spaces
- Slice filtering: **universal** — same live tools shown on all slices; no slice-specific filtering in Phase 11

### Claude's Discretion
- Loading skeleton design for Representatives widget
- Exact icon choices for each tool card
- Collapsible section expand/collapse animation on mobile
- Error state handling when Accounts/Essentials API is unreachable
- Compass hook memoization strategy at AppShell level

</decisions>

<specifics>
## Specific Ideas

- "We could easily have twice as many widgets by next week" — the collapsible mobile section and sidebar card architecture must be widget-extensible by design, not hardcoded to 3
- Purple chart color is intentional: avoids partisan red/blue associations; orange is pre-designated for a second persona (not yet implemented but color system should accommodate it)
- Rep card party badge was explicitly removed: "We are anti-partisan to the point where we don't even recognize a candidate's party affiliation"
- Rep photos follow the same pipeline already built in Accounts/Essentials — researcher should look at how headshots are downloaded and stored there, then consume via the same CDN/API pattern

</specifics>

<deferred>
## Deferred Ideas

- Slice-aware tool filtering (e.g., Treasury Tracker highlighted for local slices) — future phase
- Second persona support (orange chart color) — color reserved but feature is future scope
- Mobile sidebar as a dedicated bottom navigation tab — discussed, rejected in favor of collapsible section above feed

</deferred>

---

*Phase: 11-sidebar-widgets*
*Context gathered: 2026-04-06*
