---
status: passed
phase: 02-core-forum
verified: 2026-03-27
---

# Phase 2 Verification

**Phase Goal:** A Connected user can open the hub, navigate to their Federal Slice, read the feed, create a post, and reply to others - the complete read/write loop works end-to-end.

## Must-Haves Check

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Hub with five slice tabs (Neighborhood, Local, State, Federal, Unified); Federal active, others dimmed/non-tappable; scroll preserved | pass | SliceTabBar.tsx: TABS array defines all five in correct order. Non-active tabs have disabled attr, opacity-40, cursor-not-allowed, pointer-events-none. AppShell.tsx hardcodes activeTab=federal. Feed-to-thread scroll preserved by keeping feed mounted with CSS hidden class when thread is open. |
| 2 | Feed in reverse-chronological order via cursor-based infinite scroll; no duplicates or gaps | pass | useFeed.ts: composite cursor (created_at DESC, id DESC) with useInfiniteQuery. Gap-free, duplicate-free cursor condition. SliceFeedPanel.tsx: IntersectionObserver on sentinel triggers fetchNextPage. Pages flattened via flatMap. |
| 3 | Connected user can create a text post; appears in feed immediately | pass | useCreatePost.ts: full optimistic update via onMutate - prepends temp post to first page, rolls back on error. PostComposer.tsx: create form with Zod validation, calls mutateAsync, closes on success. FAB gated on tier and suspended status. |
| 4 | Open a post, see nested replies in chronological order, reply to post or another reply | pass | useThread.ts: fetches post and paginated replies ascending. ThreadView.tsx: builds root/child tree from parent_reply_id. ReplyComposer.tsx supports optional parentReplyId. Optimistic update wired in useCreateReply.ts. |
| 5 | Edit (within window) or delete own post; Inform-tier sees upgrade prompt; suspended user blocked | pass | useEditPost.ts: isWithinEditWindow checks 1-hour window. PostCard.tsx: Edit shown only within window for own posts. SliceFeedPanel.tsx: FAB returns early for suspended users. ThreadView.tsx: canWrite gates all reply actions on tier and is_suspended. Inform-tier clicks route to InformUpgradePrompt. |
| 6 | No-jurisdiction user sees banner prompting address addition at accounts.empowered.vote/profile | pass | NoJurisdictionBanner.tsx rendered by AppShell.tsx when !hasJurisdiction. Links to https://accounts.empowered.vote/profile. Dismissable. No tab bar or feed shown alongside it. |

**Score:** 6/6 criteria have correct code structure. No stubs, placeholders, or broken wiring found.

## Build Verification

**TypeScript (npx tsc --noEmit):** Clean - zero errors, zero warnings.

**Vite build (npx vite build):** Success in 4.81s. 934 modules transformed. One advisory about bundle size (708 kB / 212 kB gzip) - performance note only, not a build error.

## Notable Code Observations

**Scroll preservation (Criterion 1):** Only the Federal tab is active in Phase 2, so tab-switching does not occur. Feed scroll preservation is implemented for the feed-to-thread-back path via CSS hidden (not unmount), preserving browser scroll position on return.

**Suspended user UX (Criterion 5):** Blocking is correct but silent - no explicit account-suspended message is shown. FAB is disabled and returns early; canWrite=false in ThreadView hides reply buttons. UX quality consideration, not a functional gap.

**Inform-tier reply gating:** handleReply checks !canWrite before checking tier, so a suspended Inform-tier user is blocked before reaching the upgrade prompt branch - correct priority ordering.

## Human Verification Checklist

Code is complete and correctly wired. The following require live browser confirmation with a Supabase-connected environment:

### 1. Hub Layout and Tab Rendering
**Test:** Log in as Connected user with jurisdiction set. Open the hub.
**Expected:** Five tabs in order - Neighborhood, Local, State, Federal, Unified. Federal highlighted (blue underline, bold). Others dimmed. Non-Federal tabs do nothing when tapped.

### 2. Federal Tab Feed Loading
**Test:** Observe the feed area under the Federal tab.
**Expected:** Post cards load in reverse-chronological order. Member count shown. Skeleton loader visible during initial fetch.

### 3. Infinite Scroll - No Duplicates or Gaps
**Test:** In a slice with 25+ posts, scroll to the bottom.
**Expected:** Additional posts load automatically. No duplicates. No gap. Spinner during load.

### 4. Create Post - Optimistic UI
**Test:** Tap FAB (blue + button, bottom-right). Fill in title and body. Tap Post.
**Expected:** New post appears at top immediately. Composer closes. Post persists after refresh.

### 5. Create Post - Validation
**Test:** Open composer with empty title, tap Post.
**Expected:** Inline validation error. Post not submitted.

### 6. Thread View - Open and Navigate Back
**Test:** Tap any post card.
**Expected:** Thread view with post at top (author, timestamp, title, body, reply count). Back button returns to feed at same scroll position.

### 7. Thread View - Nested Replies
**Test:** Open thread with replies that have child replies.
**Expected:** Root replies at full width chronologically. Child replies indented with left border.

### 8. Reply to Post
**Test:** In thread view, tap Reply to post.
**Expected:** Inline composer appears. Submission adds reply immediately (optimistic). Composer closes.

### 9. Reply to Reply
**Test:** In thread view, tap Reply on a root-level reply.
**Expected:** Inline composer with Replying to [name] label. Submit creates indented child reply.

### 10. Edit Post - Within Window
**Test:** Tap ... menu on own post from last hour.
**Expected:** Edit and Delete options shown. Edit opens pre-filled composer. Save updates post.

### 11. Edit Post - Outside Window
**Test:** Tap ... menu on own post older than 1 hour.
**Expected:** Edit option absent. Only Delete visible.

### 12. Delete Post
**Test:** Tap ... then Delete on own post. Confirm dialog.
**Expected:** Post removed from feed immediately.

### 13. Inform-Tier Gate - FAB
**Test:** Log in as Inform-tier user. Tap FAB.
**Expected:** Upgrade prompt modal with Create Connected Account CTA. No composer opens.

### 14. Inform-Tier Gate - Thread Reply
**Test:** As Inform-tier, open thread and tap Reply.
**Expected:** Same upgrade prompt modal. No reply composer.

### 15. Suspended User Gate
**Test:** Log in as suspended user.
**Expected:** FAB dimmed and non-functional. Reply buttons absent in thread. Can still read.

### 16. No-Jurisdiction Banner
**Test:** Log in as user with no address/jurisdiction set.
**Expected:** Amber banner with address prompt linking to accounts.empowered.vote/profile. No tab bar or feed shown. Tapping x dismisses the banner.

## Gap Summary

No code gaps found. All six success criteria are backed by substantive, non-stub implementations with correct wiring from UI components through React Query hooks to Supabase queries. TypeScript build is clean.

## Verdict

**Status: human_needed**

The code for the complete read/write loop is correctly implemented and wired. TypeScript compiles clean. Production build succeeds. Status is human_needed because interactive behaviors - optimistic update visual appearance, infinite scroll triggering, sheet animations, tier-gating modal flows - cannot be verified by static analysis and require live browser testing.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
