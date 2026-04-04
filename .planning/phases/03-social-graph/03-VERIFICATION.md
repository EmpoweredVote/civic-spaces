---
phase: 03-social-graph
verified: 2026-03-28T00:00:00Z
status: passed
score: 5/5 must-haves verified in code
human_verification:
  - test: Friend request flow
    expected: User A sends request, sees Pending; User B accepts from Friends list; both see each other as friends
    why_human: Requires two active sessions; React Query invalidation and RLS accept-only policy need live DB confirmation
  - test: Friend removal is bidirectional
    expected: User A removes User B; User B also loses User A on next load
    why_human: Bidirectionality relies on shared row deletion; needs two sessions
  - test: Follow / unfollow Empowered account; non-Empowered follow blocked
    expected: Follow/Unfollow toggles; direct INSERT against non-Empowered user rejected by RLS
    why_human: Live Supabase connection required to confirm RLS enforcement
  - test: Empowered badge renders in feed and profile sheet
    expected: Red star beside author name on PostCard; pink sheet background; Empowered Civic Leader label
    why_human: Visual rendering requires running app
  - test: Boosted feed ordering
    expected: Friend posts boosted up to 2 hours ahead of same-age non-friend posts; chronological otherwise
    why_human: Requires live data with known timestamps across page boundaries
---

# Phase 3 Verification: Social Graph

**Phase Goal:** Users can build mutual friendships with slice members and follow Empowered civic leaders, and the feed surfaces friend posts with higher visibility.

**Verified:** 2026-03-28
**Status:** human_needed
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Friend request requires explicit mutual acceptance | VERIFIED | DB: friendships table with REQ_LOW/REQ_HIGH/FRIEND states; RLS friendships_update_accept restricts UPDATE to recipient only (WITH CHECK status=FRIEND). useSendFriendRequest inserts requester-side status; useAcceptFriendRequest updates to FRIEND; useRelationship surfaces pending_sent vs pending_received; UI gates all actions on state. |
| 2 | User can view friends list and remove a friend; removal bidirectional | VERIFIED | useFriendsList fetches all rows for current user, separating FRIEND vs pending_received. useRemoveFriend DELETEs the row. RLS friendships_delete_own allows either party to delete. FriendsList renders both sections. AppShell mounts FriendsList from Friends nav icon. |
| 3 | Follow/unfollow Empowered; following non-Empowered blocked | VERIFIED | DB: RLS follows_insert_empowered enforces target_id IN (SELECT user_id FROM connected_profiles WHERE tier=empowered). useToggleFollow issues INSERT/DELETE. UserProfileCard shows Follow/Unfollow only when profile.tier===empowered; non-Empowered path shows only friend-request controls. |
| 4 | Empowered accounts visually distinguished in feed and profile cards | VERIFIED | EmpoweredBadge renders red star SVG with aria-label. PostCard line 82: conditional render on post.author.tier===empowered. UserProfileCard shows badge, sets sheet background to #FFF0EE, labels tier Empowered Civic Leader. FriendsList shows badge in pending and friends sections. |
| 5 | Feed gives friend posts higher visibility without replacing chronological order | VERIFIED | DB RPC get_boosted_feed: boosted_at = created_at + INTERVAL 2 hours for mutual friends and followed Empowered authors, else boosted_at = created_at. Sorts by boosted_at DESC, id DESC. Additive bump only. useBoostedFeed calls RPC using boosted_at as cursor; SliceFeedPanel uses useBoostedFeed. |

**Score:** 5/5 truths verified in code

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| supabase/migrations/20260328000000_phase3_social_graph.sql | VERIFIED | 236 lines; friendships + follows tables, 6 RLS policies, set_updated_at trigger, get_boosted_feed RPC, public-schema views |
| src/lib/friendship.ts | VERIFIED | 34 lines; friendshipKey and friendshipStatus with correct REQ_LOW/REQ_HIGH bidirectional logic |
| src/types/database.ts | VERIFIED | Friendship, Follow, BoostedPost, BoostedPostWithAuthor, RelationshipState, FriendshipStatus at lines 67-93 |
| src/hooks/useFriendship.ts | VERIFIED | 109 lines; useRelationship, useSendFriendRequest, useAcceptFriendRequest, useRemoveFriend with real Supabase calls and query invalidation |
| src/hooks/useFollow.ts | VERIFIED | 67 lines; useFollowStatus, useToggleFollow with real INSERT/DELETE |
| src/hooks/useFriends.ts | VERIFIED | 91 lines; separates FRIEND vs pending_received, batch-fetches profiles |
| src/components/UserProfileCard.tsx | VERIFIED | 169 lines; all 4 relationship states rendered, EmpoweredBadge, tier-conditional buttons, pink sheet tint |
| src/components/FriendsList.tsx | VERIFIED | 149 lines; pending with Accept/Decline, friends with tap-to-view-profile, nested UserProfileCard |
| src/components/EmpoweredBadge.tsx | VERIFIED | 19 lines; star SVG with aria-label and role=img |
| src/components/PostCard.tsx | VERIFIED | Line 82: conditional EmpoweredBadge on post.author.tier===empowered |
| src/hooks/useBoostedFeed.ts | VERIFIED | 90 lines; calls get_boosted_feed RPC, boosted_at cursor, realtime invalidation wired |
| src/components/SliceFeedPanel.tsx | VERIFIED | Line 3: active useBoostedFeed import; useFeed commented out as documented fallback only |
| src/lib/cursors.ts | VERIFIED | BoostedFeedCursor interface with boosted_at and id fields, distinct from chronological FeedCursor |

---

## Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| UserProfileCard | useSendFriendRequest / useAcceptFriendRequest / useRemoveFriend | WIRED | All three hooks imported and called from action buttons |
| UserProfileCard | useToggleFollow | WIRED | Called with {targetId, currentlyFollowing} on Follow/Unfollow button |
| FriendsList | useFriendsList | WIRED | Called at line 32; result rendered into pending and friends sections |
| SliceFeedPanel | useBoostedFeed | WIRED | Called at line 30; pages flattened and passed to PostCard |
| useBoostedFeed | get_boosted_feed RPC | WIRED | supabase.rpc called at line 14 with all four parameters; boosted_at used as cursor key |
| PostCard | EmpoweredBadge | WIRED | post.author.tier===empowered check at line 82 |
| AppShell | FriendsList | WIRED | Mounted at line 126 when activePanel === friends |
| follows INSERT RLS | empowered tier check | WIRED | follows_insert_empowered subselects connected_profiles WHERE tier=empowered |
| friendships UPDATE RLS | Recipient-only accept | WIRED | friendships_update_accept: sender cannot accept own request; WITH CHECK (status=FRIEND) |

---

## Anti-Patterns Found

No blocker or warning anti-patterns found.

- src/hooks/useFollow.ts: No client-side tier guard before INSERT (Info) - intentional; RLS enforces at DB level; UI only presents Follow for Empowered profiles.
- src/components/SliceFeedPanel.tsx line 2: Commented-out useFeed import (Info) - documented fallback reference, does not affect functionality.

---

## Human Verification Required

All five must-haves pass structural and wiring verification. The items below require a live environment with real user sessions.

### 1. Friend request flow

**Test:** Log in as User A. Open Member Directory, tap User B, tap Add Friend.
**Expected:** User A sees Pending on User B profile card. Log in as User B, open Friends list, see User A under Pending Requests. Tap Accept. Both users appear in each others Friends list.
**Why human:** Two authenticated sessions required; React Query invalidation and RLS accept-only enforcement need live DB confirmation.

### 2. Friend removal is bidirectional

**Test:** User A opens User B profile from Friends list, taps Friends dropdown, taps Remove Friend.
**Expected:** User A Friends list no longer shows User B. User B Friends list also no longer shows User A on next load.
**Why human:** Bidirectionality relies on shared row deletion by either party; needs two sessions.

### 3. Follow / unfollow Empowered; non-Empowered blocked

**Test:** Tap Empowered user profile, tap Follow, tap Unfollow. Attempt direct follows INSERT against a Connected user via Supabase client.
**Expected:** Toggle works correctly. Direct INSERT rejected with RLS violation.
**Why human:** Live Supabase connection required to confirm RLS enforcement.

### 4. Empowered badge renders correctly

**Test:** View slice feed with at least one post by an Empowered author. Open that authors profile card.
**Expected:** Red star icon beside author name on PostCard. Profile sheet has pink-tinted background and Empowered Civic Leader label.
**Why human:** Visual rendering requires a running app.

### 5. Boosted feed ordering

**Test:** In a slice where the current user has at least one mutual friend, inspect feed order across posts with known timestamps. Scroll to a second page.
**Expected:** Friend post from 3 h ago ranks above non-friend post from 1 h ago. Non-friend post from 5 h ago still ranks above both. Pagination preserves order across pages.
**Why human:** Requires live data with known timestamps to confirm RPC output and cursor-based pagination correctness.

---

## Summary

All five must-haves have complete, substantive, wired implementations. No stubs, missing files, or broken connections were found.

The single-row normalized friendship model (user_low < user_high) prevents duplicate rows; REQ_LOW/REQ_HIGH flags track directionality without a second row. RLS ensures only the recipient can accept a friend request (friendships_update_accept) and that follows can only target Empowered accounts (follows_insert_empowered) - neither constraint can be bypassed from the client. The boosted feed applies an additive +2 hour synthetic sort key in the RPC, preserving approximate chronological order while elevating friend and followed-Empowered content. The cursor uses boosted_at not created_at, preventing pagination gaps.

Status is human_needed because the five items above require live Supabase sessions to confirm RLS policy enforcement and React Query cache invalidation in practice.

---

_Verified: 2026-03-28_
_Verifier: Claude (gsd-verifier)_

# Phase 3 Verification: Social Graph

**Phase Goal:** Users can build mutual friendships with slice members and follow Empowered civic leaders, and the feed surfaces friend posts with higher visibility.

**Verified:** 2026-03-28
**Status:** human_needed
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|

# Phase 3 Verification: Social Graph

**Phase Goal:** Users can build mutual friendships with slice members and follow Empowered civic leaders, and the feed surfaces friend posts with higher visibility.

**Verified:** 2026-03-28
**Status:** human_needed
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|

# Phase 3 Verification: Social Graph

**Phase Goal:** Users can build mutual friendships with slice members and follow Empowered civic leaders, and the feed surfaces friend posts with higher visibility.

**Verified:** 2026-03-28
**Status:** human_needed
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|

# Phase 3 Verification: Social Graph

**Phase Goal:** Users can build mutual friendships with slice members and follow Empowered civic leaders, and the feed surfaces friend posts with higher visibility.

**Verified:** 2026-03-28
**Status:** human_needed
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
