# Phase 3: Social Graph - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users build mutual friendships with any Connected user on the platform (not limited to their slice) and can follow Empowered civic leaders without reciprocation. The feed rewards these connections with higher visibility for friends' and followed Empowered accounts' posts. Creating posts, notifications, and moderation are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Friend discovery
- Three discovery surfaces: feed post author tap, member directory, and in-app search
- Both directory and search include an "expand beyond your slice" option — cross-slice friendships are fully supported (e.g., adding a family member in a different slice)
- Sending a request changes the button to "Pending" (disabled state)
- Incoming friend requests surface in the friends list tab (pending section at top); Phase 4 adds the notification bell

### Profile card
- Triggered by tapping an author's avatar or name in the feed → bottom sheet slides up
- Card shows: avatar, display name, tier badge (Connected/Empowered), their slice name, action button
- Action button states for Connected→Connected: Add Friend → Pending → Friends (Remove friend via long-press or overflow menu)
- Action button for Connected→Empowered: Follow → Following (no friend option — follows only)
- Friend lists are private: no friends-of-friends visibility anywhere

### Empowered distinction
- Visual treatment: badge/icon next to name **and** tinted card background (red/coral — the Empowered Pillar brand color)
- Icon: civic/star icon in brand color (not a generic checkmark)
- Appears in all contexts: PostCard in feed, ThreadView/reply composer, UserProfileCard (bottom sheet), member directory and search results
- No additional affordance beyond the visual — the Follow button on their profile card is the action surface

### Feed boost
- Invisible boost — no label, no section break, no user-facing indication; friend and followed-Empowered posts simply surface earlier
- No toggle — always friends-boosted, no pure-chronological mode
- Modest bump magnitude: a very recent stranger's post still surfaces above an older friend post (boost is additive, not absolute)
- Both mutual friends and followed Empowered accounts receive the feed boost

### Claude's Discretion
- Exact time-equivalent of the recency bump (e.g., +1h, +2h) — tune for natural feel
- Animation/transition for the bottom sheet profile card
- Empty state for the friends list (no friends yet)
- Loading/skeleton states for directory and search

</decisions>

<specifics>
## Specific Ideas

- Cross-slice friendship: the directory and search "expand beyond your slice" toggle lets users find anyone on the platform — designed specifically for real-world relationships (e.g., siblings in different slices)
- Empowered red/coral tint should feel branded, not alarming — think subtle background wash, not a loud highlight

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-social-graph*
*Context gathered: 2026-03-28*
