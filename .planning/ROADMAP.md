# Roadmap: Civic Spaces

## Overview

Civic Spaces builds from the ground up in five phases: first establishing the secure, correctly-scoped data foundation (auth integration, schema, slice assignment), then delivering the Federal Slice forum as the proof-of-concept product, then layering the social graph, notifications, and moderation tooling that make the forum trustworthy enough for public launch. Every phase delivers something verifiable; nothing ships until the layer beneath it is solid.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Schema, external JWT auth, and slice assignment working end-to-end
- [x] **Phase 2: Core Forum** - Hub shell and Federal Slice feed — post, read, reply, paginate
- [x] **Phase 3: Social Graph** - Mutual friends and one-directional Empowered follow
- [ ] **Phase 4: Notifications** - Re-engagement layer so posting doesn't feel like shouting into a void
- [ ] **Phase 5: Moderation & Safety** - Flag, block, and moderator queue before public launch

## Phase Details

### Phase 1: Foundation
**Goal**: The Supabase schema, external JWT auth integration, and slice assignment service are all working correctly — every downstream phase builds on this without touching auth or RLS again.
**Depends on**: Nothing (first phase)
**Requirements**: ASMT-01, ASMT-02, ASMT-03
**Success Criteria** (what must be TRUE):
  1. A Connected user who logs in via accounts.empowered.vote receives a valid JWT that Supabase accepts, and their identity resolves correctly through `current_user_id()` in every RLS policy
  2. On login, the slice assignment service calls the accounts API, reads the user's jurisdiction GEOIDs, and upserts the user into all four slice member tables — verifiable by querying `slice_members` directly
  3. When a slice reaches 6,000 members, the DB CHECK constraint prevents the 6,001st insert and a new sibling slice is created automatically — verifiable by seeding test data
  4. All `civic_spaces.*` tables have RLS enabled; a test JWT from a non-member cannot read another slice's posts
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Resolve auth path, verify JWT claims, create current_user_id() helper and Supabase client
- [ ] 01-02-PLAN.md — Full schema DDL with RLS policies, triggers, cap enforcement, and seed data
- [ ] 01-03-PLAN.md — Slice assignment Express service (token verify, accounts API, upsert slice_members, overflow handling)

### Phase 2: Core Forum
**Goal**: A Connected user can open the hub, navigate to their Federal Slice, read the feed, create a post, and reply to others — the complete read/write loop works end-to-end.
**Depends on**: Phase 1
**Requirements**: HUB-01, HUB-02, HUB-03, HUB-04, HUB-05, FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06, FEED-07, FEED-08, FEED-09, FEED-10
**Success Criteria** (what must be TRUE):
  1. A Connected user sees a hub with five slice tabs (Neighborhood, Local, State, Federal, Unified — ordered smallest to biggest); the Federal tab loads their slice feed and the other four tabs are visible but grayed out (dimmed, not tappable) — switching to Federal preserves scroll position
  2. The feed displays topic cards in reverse-chronological order using cursor-based infinite scroll — scrolling to the bottom loads the next page without duplicates or gaps
  3. A Connected user can create a new text post; it appears in the feed immediately after submission
  4. A Connected user can open a post and see the full thread with nested replies in chronological order, then add a reply to the post or to another reply
  5. A Connected user can edit their own post (within the edit window) or delete it; an Inform-tier user who attempts any write action sees a prompt to create a Connected account; a suspended user's write actions are blocked
  6. A user with no jurisdiction set sees a banner prompting them to add their address at accounts.empowered.vote/profile
**Plans**: TBD

Plans:
- [ ] 02-01: AppShell, HubPage tab routing, SliceTabBar, and no-jurisdiction banner
- [ ] 02-02: SliceFeedPanel with cursor-paginated feed, PostCard, and Realtime cache invalidation
- [ ] 02-03: PostComposer (create + edit + delete) with React Hook Form + Zod and suspended-account gate
- [ ] 02-04: CommentThread with nested replies (two levels), thread view, and Inform-tier upgrade prompt

### Phase 3: Social Graph
**Goal**: Users can build mutual friendships with slice members and follow Empowered civic leaders, and the feed surfaces friend posts with higher visibility.
**Depends on**: Phase 2
**Requirements**: SOC-01, SOC-02, SOC-03, SOC-04, SOC-05, SOC-06, SOC-07
**Success Criteria** (what must be TRUE):
  1. A Connected user can send a friend request to another slice member; the recipient receives the request and must explicitly accept before the friendship is active — neither user sees the other as a friend until both have accepted
  2. A Connected user can view their friends list and remove a friend; removal is immediate and bidirectional
  3. A Connected user can follow an Empowered account without requiring reciprocation; they can also unfollow; following a non-Empowered account is blocked
  4. Empowered accounts are visually distinguished from Connected peers in the feed and on profile cards
  5. The feed gives posts from mutual friends higher visibility than posts from non-friends (additive recency bump, not algorithmic replacement of chronological order)
**Plans**: TBD

Plans:
- [ ] 03-01: friendships and follows schema, RLS, triggers (Empowered-only follow enforcement), and bidirectional indexes
- [ ] 03-02: FriendRequestButton, friends list view, UserProfileCard with friend/follow state
- [ ] 03-03: Friend-boosted feed query (my_friends CTE + additive bump) and FollowButton for Empowered accounts

### Phase 4: Notifications
**Goal**: Users are notified of replies, friend requests, and accepted friendships so that returning to the app feels rewarding rather than opaque.
**Depends on**: Phase 3
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04
**Success Criteria** (what must be TRUE):
  1. A user who receives a reply to their post or reply sees an unread badge on the notification bell and can open a notification list showing the event — the badge clears when the list is viewed
  2. A user who sends a friend request is notified when it is accepted; a user who receives a friend request sees it in their notification list
  3. Low-priority events are grouped ("5 replies to your post") rather than delivered as individual pings — no per-reaction notifications
**Plans**: TBD

Plans:
- [ ] 04-01: Notifications table, DB triggers for reply/friend-request/accepted events, batch grouping logic
- [ ] 04-02: NotificationBell with unread badge, NotificationList, Supabase Realtime delivery, Redis+DB hybrid unread counts

### Phase 5: Moderation & Safety
**Goal**: Users can flag harmful content, block other users, and moderators can act on flagged posts — the forum is safe enough to open beyond invite-only testers.
**Depends on**: Phase 4
**Requirements**: MOD-01, MOD-02, MOD-03
**Success Criteria** (what must be TRUE):
  1. A Connected user can flag any post or reply for review; the flag is recorded and surfaced to moderators without auto-hiding the content
  2. A Connected user can block another user; the block is private, takes effect immediately, and prevents the blocked user from seeing the blocker's posts or sending friend requests
  3. A moderator can view the flagged content queue, review flagged posts in context, and remove content that violates policy — all moderation actions are recorded in an internal action log
**Plans**: TBD

Plans:
- [ ] 05-01: Flag schema, moderation queue API, moderator role RLS policies, and action log table
- [ ] 05-02: FlagButton component, block flow (client-side filter + DB record), moderator queue UI

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-27 |
| 2. Core Forum | 4/4 | Complete | 2026-03-28 |
| 3. Social Graph | 3/3 | Complete | 2026-03-28 |
| 4. Notifications | 0/2 | Not started | - |
| 5. Moderation & Safety | 0/2 | Not started | - |
