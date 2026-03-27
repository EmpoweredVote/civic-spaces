# Requirements: Civic Spaces

**Defined:** 2026-03-27
**Core Value:** A Connected user can enter their Federal Slice, see posts from their ~6k civic neighbors, and contribute to the conversation — making civic engagement feel like a small town, not an ocean.

## v1 Requirements

### Hub & Navigation

- [ ] **HUB-01**: Connected user sees a hub with 4 slice tabs (Neighborhood, Local, State, Federal)
- [ ] **HUB-02**: User can switch between slice tabs; each tab preserves its scroll state
- [ ] **HUB-03**: Each slice tab shows the slice name, member count, and active/unread indicator
- [ ] **HUB-04**: Inform-tier users can view the hub and browse slices read-only
- [ ] **HUB-05**: User with no jurisdiction set sees a banner prompting them to add their address at accounts.empowered.vote/profile

### Slice Assignment

- [ ] **ASMT-01**: Connected user is automatically placed into all 4 slices based on jurisdiction GEOIDs from the accounts API
- [ ] **ASMT-02**: All slices (Neighborhood, Local, State, Federal) are hard-capped at 6,000 members; overflow creates a new sibling slice of the same type
- [ ] **ASMT-03**: Slice membership is fetched fresh from the accounts API (never stored locally in profiles — only the assignment mapping is stored)

### Federal Slice Forum

- [ ] **FEED-01**: User can view a feed of topic cards (title + preview) in their Federal Slice
- [ ] **FEED-02**: Feed surfaces posts from mutual friends with higher visibility
- [ ] **FEED-03**: Feed uses cursor-based pagination with infinite scroll
- [ ] **FEED-04**: User can create a new topic (text post) in their Federal Slice
- [ ] **FEED-05**: Tapping a topic opens a thread view with nested replies (Reddit/Discourse style)
- [ ] **FEED-06**: Thread view displays the original post and all nested replies in chronological order
- [ ] **FEED-07**: User can reply to a post or to another reply (nested threading)
- [ ] **FEED-08**: User can edit their own post (edit history retained internally for moderation)
- [ ] **FEED-09**: User can delete their own post
- [ ] **FEED-10**: Suspended accounts are read-only; all write actions are blocked

### Social Graph

- [ ] **SOC-01**: User can send a friend request to another slice member
- [ ] **SOC-02**: Friendship is mutual — both users must accept before it is active
- [ ] **SOC-03**: User can view their friends list
- [ ] **SOC-04**: User can remove a friend
- [ ] **SOC-05**: User can follow an Empowered (civic leader) account one-directionally without requiring reciprocation
- [ ] **SOC-06**: User can unfollow an Empowered account
- [ ] **SOC-07**: Empowered accounts are visually distinguished in the feed and on profile cards

### Notifications

- [ ] **NOTF-01**: User is notified when their friend request is accepted
- [ ] **NOTF-02**: User is notified when someone replies to their post or reply
- [ ] **NOTF-03**: User is notified when they receive a friend request
- [ ] **NOTF-04**: Notifications are batched; no per-event pings for low-priority events

### Moderation & Safety

- [ ] **MOD-01**: User can flag a post or reply for review
- [ ] **MOD-02**: User can block another user (private; blocked user cannot see your posts or send friend requests)
- [ ] **MOD-03**: Moderator role can review flagged content and remove it

## v2 Requirements

### Forum Enhancements

- **FEED-V2-01**: Hot/Top feed sorting modes (in addition to chronological)
- **FEED-V2-02**: Image attachments on posts
- **FEED-V2-03**: Search within a slice

### Slice Tabs (Future Feature Layers)

- **TAB-V2-01**: Debates tab inside each slice
- **TAB-V2-02**: Shared Facts tab inside each slice
- **TAB-V2-03**: Symposiums tab inside each slice
- **TAB-V2-04**: Announcements tab inside each slice

### Hub Integrations

- **HUB-V2-01**: Focus Communities accessible from the hub
- **HUB-V2-02**: Treasury Tracker surfaced within relevant slices
- **HUB-V2-03**: Essentials shown as accordion inside relevant slice

### Social

- **SOC-V2-01**: Half-slice rotation mechanic (2-year cohort swap)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Circle-model geographic boundaries | Replaced permanently by jurisdiction GEOIDs from accounts system |
| International / Unified slice | Future — not part of v1 or near-term roadmap |
| Custom onboarding / registration flow | accounts.empowered.vote owns all auth and onboarding |
| New-account posting time-lock (7-day read-only) | Superseded by invite-code gate — every Connected Account during alpha requires a code from admin or level-2 member |
| Real-time chat / DMs | Not part of the forum model |
| Algorithmic engagement ranking | Research confirms chronological + friend-boost is correct for civic discourse; engagement ranking drives polarization |
| Downvotes | Documented harm to civic discourse quality |
| Public reaction counts / share mechanics | Anti-pattern for civic platforms — drives performance over substance |
| Post history browsable by pseudonym | Primary deanonymization vector |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HUB-01 | — | Pending |
| HUB-02 | — | Pending |
| HUB-03 | — | Pending |
| HUB-04 | — | Pending |
| HUB-05 | — | Pending |
| ASMT-01 | — | Pending |
| ASMT-02 | — | Pending |
| ASMT-03 | — | Pending |
| FEED-01 | — | Pending |
| FEED-02 | — | Pending |
| FEED-03 | — | Pending |
| FEED-04 | — | Pending |
| FEED-05 | — | Pending |
| FEED-06 | — | Pending |
| FEED-07 | — | Pending |
| FEED-08 | — | Pending |
| FEED-09 | — | Pending |
| FEED-10 | — | Pending |
| SOC-01 | — | Pending |
| SOC-02 | — | Pending |
| SOC-03 | — | Pending |
| SOC-04 | — | Pending |
| SOC-05 | — | Pending |
| SOC-06 | — | Pending |
| SOC-07 | — | Pending |
| NOTF-01 | — | Pending |
| NOTF-02 | — | Pending |
| NOTF-03 | — | Pending |
| NOTF-04 | — | Pending |
| MOD-01 | — | Pending |
| MOD-02 | — | Pending |
| MOD-03 | — | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 0 (populated during roadmap creation)
- Unmapped: 31 ⚠️

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after initial definition*
