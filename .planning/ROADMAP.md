# Roadmap: Civic Spaces

## Milestones

- ✅ **v1.0 Foundation & Full Forum** - Phases 1-5 (shipped 2026-03-28)
- 🚧 **v2.0 All Slices** - Phases 6-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation & Full Forum (Phases 1–5) — SHIPPED 2026-03-28</summary>

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
- [x] 01-01-PLAN.md — Resolve auth path, verify JWT claims, create current_user_id() helper and Supabase client
- [x] 01-02-PLAN.md — Full schema DDL with RLS policies, triggers, cap enforcement, and seed data
- [x] 01-03-PLAN.md — Slice assignment Express service (token verify, accounts API, upsert slice_members, overflow handling)

### Phase 2: Core Forum
**Goal**: A Connected user can open the hub, navigate to their Federal Slice, read the feed, create a post, and reply to others — the complete read/write loop works end-to-end.
**Depends on**: Phase 1
**Requirements**: HUB-01, HUB-02, HUB-03, HUB-04, HUB-05, FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06, FEED-07, FEED-08, FEED-09, FEED-10
**Success Criteria** (what must be TRUE):
  1. A Connected user sees a hub with slice tabs; the Federal tab loads their slice feed and the other tabs are visible but grayed out — switching to Federal preserves scroll position
  2. The feed displays topic cards in reverse-chronological order using cursor-based infinite scroll — scrolling to the bottom loads the next page without duplicates or gaps
  3. A Connected user can create a new text post; it appears in the feed immediately after submission
  4. A Connected user can open a post and see the full thread with nested replies in chronological order, then add a reply to the post or to another reply
  5. A Connected user can edit their own post or delete it; an Inform-tier user who attempts any write action sees a prompt to create a Connected account; a suspended user's write actions are blocked
  6. A user with no jurisdiction set sees a banner prompting them to add their address at accounts.empowered.vote/profile
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — AppShell, HubPage tab routing, SliceTabBar, and no-jurisdiction banner
- [x] 02-02-PLAN.md — SliceFeedPanel with cursor-paginated feed, PostCard, and Realtime cache invalidation
- [x] 02-03-PLAN.md — PostComposer (create + edit + delete) with React Hook Form + Zod and suspended-account gate
- [x] 02-04-PLAN.md — CommentThread with nested replies (two levels), thread view, and Inform-tier upgrade prompt

### Phase 3: Social Graph
**Goal**: Users can build mutual friendships with slice members and follow Empowered civic leaders, and the feed surfaces friend posts with higher visibility.
**Depends on**: Phase 2
**Requirements**: SOC-01, SOC-02, SOC-03, SOC-04, SOC-05, SOC-06, SOC-07
**Success Criteria** (what must be TRUE):
  1. A Connected user can send a friend request to another slice member; the recipient must explicitly accept before the friendship is active — neither user sees the other as a friend until both have accepted
  2. A Connected user can view their friends list and remove a friend; removal is immediate and bidirectional
  3. A Connected user can follow an Empowered account without requiring reciprocation; they can also unfollow
  4. Empowered accounts are visually distinguished from Connected peers in the feed and on profile cards
  5. The feed gives posts from mutual friends higher visibility than posts from non-friends
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — friendships and follows schema, RLS, triggers, and bidirectional indexes
- [x] 03-02-PLAN.md — FriendRequestButton, friends list view, UserProfileCard with friend/follow state
- [x] 03-03-PLAN.md — Friend-boosted feed query and FollowButton for Empowered accounts

### Phase 4: Notifications
**Goal**: Users are notified of replies, friend requests, and accepted friendships so that returning to the app feels rewarding rather than opaque.
**Depends on**: Phase 3
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04
**Success Criteria** (what must be TRUE):
  1. A user who receives a reply to their post or reply sees an unread badge on the notification bell and can open a notification list showing the event — the badge clears when the list is viewed
  2. A user who sends a friend request is notified when it is accepted; a user who receives a friend request sees it in their notification list
  3. Low-priority events are grouped ("5 replies to your post") rather than delivered as individual pings
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Notifications table, triggers, RLS, grouping index, public view, Realtime publication, TypeScript types
- [x] 04-02-PLAN.md — NotificationBell with unread badge, NotificationList, NotificationItem, useNotifications hook, mark-read mutations, AppShell integration

### Phase 5: Moderation & Safety
**Goal**: Users can flag harmful content, block other users, and moderators can act on flagged posts — the forum is safe enough to open beyond invite-only testers.
**Depends on**: Phase 4
**Requirements**: MOD-01, MOD-02, MOD-03
**Success Criteria** (what must be TRUE):
  1. A Connected user can flag any post or reply for review; the flag is recorded and surfaced to moderators without auto-hiding the content
  2. A Connected user can block another user; the block is private, takes effect immediately, and prevents the blocked user from seeing the blocker's posts or sending friend requests
  3. A moderator can view the flagged content queue, review flagged posts in context, and remove content that violates policy — all moderation actions are recorded in an internal action log
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Schema (flags, blocks, moderators, action_log), RLS, feed filtering RPCs, mod queue + action RPCs, public views
- [x] 05-02-PLAN.md — FlagButton/FlagModal, block flow with feed RPC migration, ModeratorQueue UI, warn notification rendering

</details>

---

### 🚧 v2.0 All Slices (In Progress)

**Milestone Goal:** Expand from Federal-only to all slice types — activating the remaining geo slices, launching the Unified and Volunteer slices, and giving users a profile page that anchors their civic identity.

#### Phase 6: Hub Expansion
**Goal**: The hub has its permanent two-column layout, geo slices (N/L/S) are fully active forums, scroll state is independently preserved per tab, and notifications route users to the correct slice tab.
**Depends on**: Phase 5
**Requirements**: HUB-06, HUB-08, SLCE-02, SLCE-03
**Success Criteria** (what must be TRUE):
  1. The hub displays geographic slices (N/L/S/F) on the left column and special slices (Unified, Volunteer) on the right — the Unified tab sits beside Federal in the left group; Volunteer appears on the right
  2. Switching between any two slice tabs and switching back returns the user to exactly where they were scrolled in each tab independently
  3. The friend-boosted feed weighting that exists for Federal applies equally when viewing Neighborhood, Local, and State slice feeds — friend posts surface with higher visibility in all three
  4. Tapping a reply or thread notification navigates the user to the correct slice tab (not always Federal) and opens the referenced thread

**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md — Hub layout redesign + useAllSlices hook + activate all 4 geo slice feeds + Unified/Volunteer disabled shells
- [ ] 06-02-PLAN.md — Per-tab scroll state — independent scroll position preservation across all hub tabs
- [ ] 06-03-PLAN.md — Notification routing — resolve post slice_id to owning tab, navigate to correct tab on notification tap

#### Phase 7: New Slice Types
**Goal**: The Unified and Volunteer slices exist in the schema, the assignment service populates them automatically, and their hub tabs are fully active forums — Volunteer tab is visible only to users with the Volunteer role.
**Depends on**: Phase 6
**Requirements**: HUB-07, SLCE-01, UNIF-01, UNIF-02, UNIF-03, UNIF-04, VOL-01, VOL-02, VOL-03, VOL-04, VOL-05
**Success Criteria** (what must be TRUE):
  1. On login, the slice assignment service upserts the user into a Unified slice (geoid sentinel 'UNIFIED') — verifiable by querying slice_members; the Unified tab in the hub loads the user's Unified slice feed
  2. A user with the Volunteer role sees a Volunteer tab on the right side of the hub and can post, reply, and read the Volunteer feed; a user without the Volunteer role sees no Volunteer tab
  3. All five geo/special slice tabs — Neighborhood, Local, State, Federal, and Unified — are fully active: users can create posts, reply, and scroll the feed in each
  4. The Unified slice is capped at 6,000 members; when the cap is reached, the slice assignment service creates a sibling Unified slice and assigns overflow users to it — same cap behavior applies to the Volunteer slice
  5. The schema has distinct slice_type values 'unified' and 'volunteer' in civic_spaces.slices; the existing get_boosted_feed_filtered RPC serves both slice types without modification

**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Schema migration (CHECK constraint extension for unified/volunteer) + TypeScript type updates (SliceType, SliceInfo)
- [x] 07-02-PLAN.md — Slice assignment service extension (Unified check-before-insert, Volunteer role check via POST /api/roles/check, revocation DELETE, route wiring)
- [x] 07-03-PLAN.md — Frontend activation (useAllSlices extension, AppShell/SliceTabBar overhaul, Volunteer tab conditional rendering, feed headers)

#### Phase 8: Profile Pages
**Goal**: Any user's display name is tappable throughout the app and opens a profile page that shows their civic identity — slice memberships, activity counts, and social connections appropriate to the viewer's relationship with them.
**Depends on**: Phase 7
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07
**Success Criteria** (what must be TRUE):
  1. Tapping any display name anywhere in the app — feed, thread, notifications — navigates to that user's profile page
  2. A profile page shows the subject's display name, join date, and tier badge (Inform / Connected / Empowered)
  3. A profile page shows the user's active slice memberships and their post count and reply count
  4. When viewing another user's profile, only mutual friends are shown (not total friend count); when viewing your own profile, your full friends list is visible
  5. Friend request and follow (for Empowered accounts) actions are accessible directly from a user's profile page

**Plans**: TBD

Plans:
- [ ] 08-01: get_user_profile RPC (or composite query) — display_name, join_date, tier, slice_memberships, post_count, reply_count, mutual_friends; own-vs-other view branching
- [ ] 08-02: ProfilePage component — layout, tier badge, slice membership list, activity counts, own/other conditional sections, friend list rendering
- [ ] 08-03: Display name tap navigation — link all display name instances app-wide to /profile/:userId; friend request and follow actions on profile

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-27 |
| 2. Core Forum | v1.0 | 4/4 | Complete | 2026-03-28 |
| 3. Social Graph | v1.0 | 3/3 | Complete | 2026-03-28 |
| 4. Notifications | v1.0 | 2/2 | Complete | 2026-03-28 |
| 5. Moderation & Safety | v1.0 | 2/2 | Complete | 2026-03-28 |
| 6. Hub Expansion | v2.0 | 5/5 | Complete | 2026-04-03 |
| 7. New Slice Types | v2.0 | 3/3 | Complete | 2026-04-04 |
| 8. Profile Pages | v2.0 | 0/3 | Not started | - |
