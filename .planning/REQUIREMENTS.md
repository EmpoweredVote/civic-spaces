# Requirements: Civic Spaces

**Defined:** 2026-03-27
**Updated:** 2026-04-03 (Milestone v2.0 — traceability mapped)
**Core Value:** Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.

## v1.0 Requirements (Complete)

### Hub & Navigation

- [x] **HUB-01**: Connected user sees a hub with 4 slice tabs (Neighborhood, Local, State, Federal)
- [x] **HUB-02**: User can switch between slice tabs; each tab preserves its scroll state
- [x] **HUB-03**: Each slice tab shows the slice name, member count, and active/unread indicator
- [x] **HUB-04**: Inform-tier users can view the hub and browse slices read-only
- [x] **HUB-05**: User with no jurisdiction set sees a banner prompting them to add their address at accounts.empowered.vote/profile

### Slice Assignment

- [x] **ASMT-01**: Connected user is automatically placed into all 4 geo slices based on jurisdiction GEOIDs from the accounts API
- [x] **ASMT-02**: All slices are hard-capped at 6,000 members; overflow creates a new sibling slice of the same type
- [x] **ASMT-03**: Slice membership is fetched fresh from the accounts API (never stored locally in profiles)

### Federal Slice Forum

- [x] **FEED-01**: User can view a feed of topic cards (title + preview) in their Federal Slice
- [x] **FEED-02**: Feed surfaces posts from mutual friends with higher visibility
- [x] **FEED-03**: Feed uses cursor-based pagination with infinite scroll
- [x] **FEED-04**: User can create a new topic (text post) in their Federal Slice
- [x] **FEED-05**: Tapping a topic opens a thread view with nested replies
- [x] **FEED-06**: Thread view displays the original post and all nested replies in chronological order
- [x] **FEED-07**: User can reply to a post or to another reply (nested threading)
- [x] **FEED-08**: User can edit their own post (edit history retained internally)
- [x] **FEED-09**: User can delete their own post
- [x] **FEED-10**: Suspended accounts are read-only; all write actions are blocked

### Social Graph

- [x] **SOC-01**: User can send a friend request to another slice member
- [x] **SOC-02**: Friendship is mutual — both users must accept before it is active
- [x] **SOC-03**: User can view their friends list
- [x] **SOC-04**: User can remove a friend
- [x] **SOC-05**: User can follow an Empowered (civic leader) account one-directionally
- [x] **SOC-06**: User can unfollow an Empowered account
- [x] **SOC-07**: Empowered accounts are visually distinguished in the feed and on profile cards

### Notifications

- [x] **NOTF-01**: User is notified when their friend request is accepted
- [x] **NOTF-02**: User is notified when someone replies to their post or reply
- [x] **NOTF-03**: User is notified when they receive a friend request
- [x] **NOTF-04**: Notifications are batched; no per-event pings for low-priority events

### Moderation & Safety

- [x] **MOD-01**: User can flag a post or reply for review
- [x] **MOD-02**: User can block another user (private; blocked user cannot see your posts or send friend requests)
- [x] **MOD-03**: Moderator role can review flagged content and remove it

---

## v2.0 Requirements (Milestone: All Slices)

### Hub & Navigation

- [x] **HUB-06**: Hub displays N/L/S/F/Unified on the left and Volunteer on the right; Unified tab sits beside Federal
- [ ] **HUB-07**: Neighborhood, Local, State, and Unified tabs are active with full forum capability
- [x] **HUB-08**: Each slice tab independently preserves its scroll position when switching

### Multi-Slice Forum

- [ ] **SLCE-01**: User can post, reply, and view a cursor-paginated feed in Neighborhood, Local, State, and Unified slices
- [x] **SLCE-02**: Friend-boosted feed weighting applies in all active geo slices
- [x] **SLCE-03**: Reply and thread notifications route the user to the correct slice tab

### Unified Slice

- [ ] **UNIF-01**: User is auto-assigned to the Unified Slice on login via the slice assignment service
- [ ] **UNIF-02**: Unified Slice is capped at 6,000 members; overflow creates a sibling Unified Slice
- [ ] **UNIF-03**: User can post, reply, and view the Unified Slice feed via the Unified tab
- [ ] **UNIF-04**: Unified Slice has a distinct `slice_type` ('unified') in the schema

### Volunteer Slice

- [ ] **VOL-01**: Users with the Volunteer role see a Volunteer tab on the right side of the hub
- [ ] **VOL-02**: Slice assignment service assigns Volunteer-role users to the Volunteer Slice automatically
- [ ] **VOL-03**: Users without the Volunteer role do not see the Volunteer tab
- [ ] **VOL-04**: Volunteer Slice is capped at 6,000 members; overflow creates a sibling
- [ ] **VOL-05**: User can post, reply, and view the Volunteer Slice feed

### Profile Pages

- [ ] **PROF-01**: User can navigate to any slice member's profile by tapping their display name anywhere in the app
- [ ] **PROF-02**: Profile shows display name, join date, and tier badge
- [ ] **PROF-03**: Profile shows the user's active slice memberships
- [ ] **PROF-04**: Profile shows post count and reply count
- [ ] **PROF-05**: Viewing another user's profile shows mutual connections (mutual friends only, not total friend count)
- [ ] **PROF-06**: Viewing your own profile shows your full friends list
- [ ] **PROF-07**: Friend request and follow actions are accessible from a user's profile

---

## Future Requirements

### Forum Enhancements

- **FEED-V2-01**: Hot/Top feed sorting modes (in addition to chronological)
- **FEED-V2-02**: Image attachments on posts
- **FEED-V2-03**: Search within a slice

### Slice Enhancements

- **SLCE-V2-01**: Aggregate "all slices" combined feed (view posts from all slices at once)

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

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Circle-model geographic boundaries | Replaced permanently by jurisdiction GEOIDs from accounts system |
| Custom onboarding / registration flow | accounts.empowered.vote owns all auth and onboarding |
| Real-time chat / DMs | Not part of the forum model |
| Algorithmic engagement ranking | Chronological + friend-boost is correct for civic discourse |
| Downvotes | Documented harm to civic discourse quality |
| Public reaction counts / share mechanics | Anti-pattern for civic platforms |
| Post history browsable by pseudonym | Primary deanonymization vector |
| Aggregate "all slices" combined feed | Deferred — Unified tab is the Unified slice only for now |
| Public total friend/follower counts | Only mutual connections shown on other profiles |

---

## Traceability

### v1.0 (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| HUB-01–05 | Phase 2 | Complete |
| ASMT-01–03 | Phase 1 | Complete |
| FEED-01–10 | Phase 2 | Complete |
| SOC-01–07 | Phase 3 | Complete |
| NOTF-01–04 | Phase 4 | Complete |
| MOD-01–03 | Phase 5 | Complete |

### v2.0 (Mapped — Phases 6–8)

| Requirement | Phase | Status |
|-------------|-------|--------|
| HUB-06 | Phase 6 | Complete |
| HUB-07 | Phase 7 | Pending |
| HUB-08 | Phase 6 | Complete |
| SLCE-01 | Phase 7 | Pending |
| SLCE-02 | Phase 6 | Complete |
| SLCE-03 | Phase 6 | Complete |
| UNIF-01 | Phase 7 | Pending |
| UNIF-02 | Phase 7 | Pending |
| UNIF-03 | Phase 7 | Pending |
| UNIF-04 | Phase 7 | Pending |
| VOL-01 | Phase 7 | Pending |
| VOL-02 | Phase 7 | Pending |
| VOL-03 | Phase 7 | Pending |
| VOL-04 | Phase 7 | Pending |
| VOL-05 | Phase 7 | Pending |
| PROF-01 | Phase 8 | Pending |
| PROF-02 | Phase 8 | Pending |
| PROF-03 | Phase 8 | Pending |
| PROF-04 | Phase 8 | Pending |
| PROF-05 | Phase 8 | Pending |
| PROF-06 | Phase 8 | Pending |
| PROF-07 | Phase 8 | Pending |

**v2.0 Coverage:**
- v2.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

**Phase distribution:**
- Phase 6 (Hub Expansion): HUB-06, HUB-08, SLCE-02, SLCE-03 — 4 requirements
- Phase 7 (New Slice Types): HUB-07, SLCE-01, UNIF-01–04, VOL-01–05 — 11 requirements
- Phase 8 (Profile Pages): PROF-01–07 — 7 requirements

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-04-03 — v2.0 traceability mapped (Phases 6–8, 22 requirements, 100% coverage)*
