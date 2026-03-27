# Phase 2: Core Forum - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Hub shell with five slice tabs (Neighborhood, Local, State, Federal, Unified — ordered smallest to biggest scope). Federal Slice is the only active tab in Phase 2. The other four tabs are visible but grayed out. Within the Federal Slice: cursor-paginated feed, post composer with editing/deletion, and nested reply threads (two levels max). Access-tier gating for Inform users and suspended accounts.

</domain>

<decisions>
## Implementation Decisions

### PostCard design
- Truncated preview (~3-4 lines), consistent card height, open full post on tap
- Metadata per card: author avatar + name, relative timestamp, reply count
- Edited posts show a subtle "edited" indicator near the timestamp
- Deleted posts show a tombstone placeholder ("[Post deleted]") — thread continuity preserved, replies remain

### Post composer UX
- Floating action button (FAB) in bottom-right corner to start a new post
- Opens as a modal / bottom sheet over the feed
- Edit window: 1 hour after publishing
- New posts appear optimistically at top of feed immediately upon submission; rolled back on server failure

### Thread & reply view
- Indent + left accent line for second-level replies (max 2 levels of nesting)
- Replies ordered chronologically, oldest first
- Reply composer expands inline below the specific post/reply being responded to
- Long threads (50+ replies): "Load more" button at bottom, ~20 replies shown initially

### Hub tab structure
- Five tabs in order: Neighborhood → Local → State → Federal → Unified
- Federal Slice is the only active tab in Phase 2
- The other four tabs are dimmed (reduced opacity), not tappable — no tooltip, no placeholder screen, no interaction
- Roadmap updated to reflect 5 tabs (was 4)

### Claude's Discretion
- Exact line count for post truncation (target ~3-4 lines)
- Loading skeleton design for feed and thread view
- Error state handling (post submission failure, network errors)
- Exact accent line color/style for reply indentation
- FAB position adjustment for mobile keyboard/nav bar

</decisions>

<specifics>
## Specific Ideas

- Tab order is explicitly smallest to biggest geographic scope: Neighborhood → Local → State → Federal → Unified
- Grayed-out tabs are purely visual — reduced opacity, no interaction, no explanation needed
- Tombstone pattern for deleted posts keeps thread readable (replies won't appear orphaned)

</specifics>

<deferred>
## Deferred Ideas

- Neighborhood, Local, State, Unified slice functionality — future phases
- Reaction counts on PostCard — Phase 3+ (social graph layer)

</deferred>

---

*Phase: 02-core-forum*
*Context gathered: 2026-03-27*
