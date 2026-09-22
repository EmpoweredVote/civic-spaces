# Phase 5: Moderation & Safety - Research

**Researched:** 2026-03-28
**Domain:** PostgreSQL moderation schema + RLS, block-based feed filtering, flag submission, moderator queue UI
**Confidence:** HIGH (all patterns verified against existing codebase and prior phase migrations)

---

## Summary

Phase 5 adds three mutually independent but reinforcing features: flag submission (user-facing), block mechanics (user-facing + feed-level), and a moderator review queue (privileged UI). All three integrate directly into the existing civic_spaces schema, public-schema view pattern, and React Query + Supabase Realtime stack already in place.

The most architecturally significant decision is **moderator role storage**: the exchange-token Edge Function mints a minimal JWT containing only `sub`, `role: 'authenticated'`, `iss`, and `aud`. There are no custom claims and no mechanism to inject them without modifying the Edge Function. The correct approach is a `civic_spaces.moderators` lookup table, with RLS policies calling `(SELECT EXISTS (SELECT 1 FROM civic_spaces.moderators WHERE user_id = (SELECT auth.jwt() ->> 'sub')))`. This is the project's established pattern for any privilege check beyond "authenticated" — the same subquery-wrapping pattern used in every prior phase for slice membership.

The block feature's feed filtering cannot be done purely in RLS without breaking slice-member-based access (the existing `posts_select_slice_member` policy cannot AND with a NOT IN block check without either table scan overhead or policy conflict). The correct approach is client-side block exclusion in the query hooks (`useFeed`, `useBoostedFeed`) — filter posts where `post.user_id NOT IN blocked_ids` after fetching, paralleling how friendship status is resolved via separate query and client merge. Alternatively, a new `get_feed_filtered` RPC function with block exclusion built in is cleaner. The RPC approach is recommended.

**Primary recommendation:** Two-plan split: Plan 05-01 covers all schema (flags, blocks, moderators, action_log tables, RLS, public views, `is_moderator()` helper function, `get_feed_filtered` RPC). Plan 05-02 covers all UI (flag button + modal + toast, block button in UserProfileCard, feed filtering via hook update, moderator queue page with single-item layout).

---

## Standard Stack

No new npm packages are needed except one toast library.

### Core (Already Installed)

| Library | Version | Phase 5 Use |
|---------|---------|-------------|
| `@supabase/supabase-js` | ^2.100.1 | All DB queries, RLS enforcement |
| `@tanstack/react-query` | ^5.95.2 | useFlagPost, useBlockUser, useModQueue mutations/queries |
| `react-hook-form` | ^7.72.0 | Flag submission form (category select + optional text) |
| `zod` | ^4.3.6 | Flag form schema validation |
| `react-modal-sheet` | ^3.5.0 | Flag modal (same Sheet pattern as UserProfileCard) |
| `tailwindcss` | ^4.2.2 | All styling |
| `date-fns` | ^4.1.0 | Timestamps in mod queue |

### New Package Required

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `sonner` | 2.0.7 | Toast notifications | "Thanks, we'll review this" confirmation on flag submit; no other toast mechanism exists in the project |

### Installation

```bash
npm install sonner@2.0.7
```

### Setup (AppShell.tsx)

```typescript
// Source: https://sonner.emilkowal.ski/
import { Toaster } from 'sonner'
// Add inside AppShell return, at root level:
<Toaster position="bottom-center" />
```

### Usage at Call Site

```typescript
import { toast } from 'sonner'
toast("Thanks, we'll review this.")
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sonner | Custom div toast | Sonner is <3KB gzipped, zero deps, zero config — custom is more work for identical result |
| sonner | react-hot-toast | Either would work; sonner is current standard and Emil Kowalski-maintained (same author as Vaul/Sheet) |

---

## Architecture Patterns

### Recommended Project Structure Additions

```
src/
├── components/
│   ├── FlagButton.tsx           # Flag icon toggle + Sheet trigger
│   ├── FlagModal.tsx            # Sheet with category radio + optional text + submit
│   └── ModeratorQueue.tsx       # Full-screen moderator queue (one item at a time)
├── hooks/
│   ├── useFlag.ts               # useFlagPost mutation + useMyFlags query
│   ├── useBlock.ts              # useBlockUser, useUnblockUser, useBlockedUsers
│   └── useModQueue.ts           # useModQueue query, useModAction mutations
└── types/
    └── database.ts              # Add Flag, Block, Moderator, ActionLog types

supabase/
├── migrations/
│   └── 20260328200000_phase5_moderation.sql  # All schema for phase 5
└── functions/
    └── (no new edge functions needed)
```

### Pattern 1: Moderator Role Check via Database Table

**What:** A `civic_spaces.moderators` table stores user_ids of moderators. A helper function `civic_spaces.is_moderator()` wraps the subquery for reuse across multiple RLS policies.

**Why:** The exchange-token Edge Function mints JWTs with no custom claims — only `sub` and `role: 'authenticated'`. There is no mechanism to inject a `moderator` claim without modifying the Edge Function. Database table lookup is the only correct pattern here.

```sql
-- Source: Established project pattern (civic_spaces.current_user_id() precedent)
CREATE TABLE civic_spaces.moderators (
  user_id    text        PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text        NOT NULL
);

CREATE OR REPLACE FUNCTION civic_spaces.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM civic_spaces.moderators
    WHERE user_id = (SELECT auth.jwt() ->> 'sub')
  );
$$;
```

**In RLS policies:**
```sql
-- Moderator SELECT on flags (see all flags, not just their own)
CREATE POLICY flags_select_moderator ON civic_spaces.flags
  FOR SELECT TO authenticated
  USING (
    reporter_id = (SELECT auth.jwt() ->> 'sub')
    OR (SELECT civic_spaces.is_moderator())
  );
```

**Why SECURITY DEFINER on is_moderator():** Consistent with `notify_on_reply()` pattern — functions that do privilege lookups must use SECURITY DEFINER so the inner query runs as the function owner, not the calling user. Without it, the inner SELECT would itself be subject to RLS on the moderators table, potentially blocking the lookup.

### Pattern 2: Flags Table Schema

**What:** One row per flag submission. Multiple flags on the same post by different users share the same `post_id` — no grouping/collapsing. Auto-escalation to high priority uses a DB-level count check (or trigger-maintained counter).

```sql
CREATE TABLE civic_spaces.flags (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid        NOT NULL REFERENCES civic_spaces.posts(id) ON DELETE CASCADE,
  reporter_id  text        NOT NULL,
  category     text        NOT NULL CHECK (category IN ('spam', 'harassment', 'misinformation', 'other')),
  detail       text,                          -- optional free-text (category = 'other')
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- One flag per reporter per post (prevent double-flagging)
  CONSTRAINT flags_unique_reporter_post UNIQUE (reporter_id, post_id)
);

CREATE INDEX idx_flags_post_id ON civic_spaces.flags (post_id);
CREATE INDEX idx_flags_status_created ON civic_spaces.flags (status, created_at DESC);
```

**High-priority escalation:** A trigger-maintained `flag_count` column on the flags table is NOT recommended — it adds complexity. Instead, the moderator queue query computes count per post via `COUNT(*)` GROUP BY, and the 5-flag threshold is applied as a `HAVING` filter for the "high priority" sort tier. This is simpler and requires no additional trigger.

### Pattern 3: Blocks Table Schema

**What:** One row per block relationship. Directional (A blocks B is one row). Feed filtering excludes posts from blocked users in both directions (A cannot see B's posts, B cannot see A's posts).

```sql
CREATE TABLE civic_spaces.blocks (
  blocker_id  text        NOT NULL,
  blocked_id  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocker ON civic_spaces.blocks (blocker_id);
CREATE INDEX idx_blocks_blocked ON civic_spaces.blocks (blocked_id);
```

**Feed filtering — RPC approach (recommended):** Extend the existing `get_boosted_feed` function or create `get_feed_filtered` RPC that includes a `NOT EXISTS` block exclusion. This keeps filtering server-side and avoids client-side post-fetch filtering that leaks data.

```sql
-- Source: Adapted from existing get_boosted_feed pattern
-- Add to WHERE clause of feed query:
AND NOT EXISTS (
  SELECT 1 FROM civic_spaces.blocks b
  WHERE (b.blocker_id = (SELECT civic_spaces.current_user_id()) AND b.blocked_id = p.user_id)
     OR (b.blocker_id = p.user_id AND b.blocked_id = (SELECT civic_spaces.current_user_id()))
)
```

**For the standard feed (useFeed hook):** The existing `posts` view SELECT cannot have block filtering in RLS without creating a `posts_select_block_exclusion` policy. Multiple permissive policies are OR'd, not AND'd — a block exclusion policy cannot negate the existing select. The solution is a new `get_feed_filtered` RPC (for the standard feed) and update to `get_boosted_feed` (for the boosted feed).

### Pattern 4: Moderator Action Log

```sql
CREATE TABLE civic_spaces.action_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id text        NOT NULL,
  action       text        NOT NULL CHECK (action IN ('remove', 'dismiss', 'warn', 'suspend')),
  target_type  text        NOT NULL CHECK (target_type IN ('post', 'user')),
  target_id    text        NOT NULL,  -- post_id (uuid as text) or user_id
  flag_ids     uuid[]      NOT NULL DEFAULT '{}',  -- which flags were resolved
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_log_moderator ON civic_spaces.action_log (moderator_id, created_at DESC);
CREATE INDEX idx_action_log_target ON civic_spaces.action_log (target_id);
```

### Pattern 5: Moderator Queue Query

The mod queue shows flagged posts grouped by post, sorted by flag count DESC (high priority first), with full thread context.

```sql
-- RPC or view: returns one row per unique flagged post
SELECT
  p.id              AS post_id,
  p.body,
  p.user_id         AS author_id,
  p.created_at,
  COUNT(f.id)       AS flag_count,
  ARRAY_AGG(DISTINCT f.category) AS flag_categories,
  MIN(f.created_at) AS first_flagged_at,
  CASE WHEN COUNT(f.id) >= 5 THEN 'high' ELSE 'normal' END AS priority
FROM civic_spaces.flags f
JOIN civic_spaces.posts p ON p.id = f.post_id
WHERE f.status = 'pending'
  AND p.is_deleted = false
GROUP BY p.id, p.body, p.user_id, p.created_at
ORDER BY flag_count DESC, first_flagged_at ASC;
```

### Pattern 6: Flag Button State (Toggle UI)

The flag button follows the like/bookmark toggle paradigm used elsewhere in the project — icon changes state based on `userHasFlagged` derived from `useMyFlags` query.

```typescript
// Source: analogous to isFollowing pattern in useFollow.ts
const { data: myFlags } = useQuery({
  queryKey: ['my-flags', userId],
  queryFn: async () => {
    const { data } = await supabase
      .from('flags')
      .select('post_id')
    return (data ?? []).map(f => f.post_id)
  },
  enabled: !!userId,
  staleTime: 5 * 60 * 1000,
})
const userHasFlagged = myFlags?.includes(postId) ?? false
```

### Pattern 7: Block in UserProfileCard

Block action lives in the existing `overflowOpen` dropdown in UserProfileCard (the "Friends ▾" overflow menu already exists). For non-friend users, block appears in a new "..." overflow button alongside the primary action button.

### Pattern 8: "Unavailable" Generic Response

When a blocked user visits a blocker's profile or attempts to send a friend request, the response is generic — "This profile is unavailable." This is achieved by:
1. The `useProfileById` hook returns null when the target user has blocked the current user (filter applied in the query)
2. UserProfileCard renders "Profile not found." for null — the existing fallback message already handles this

A dedicated `useIsBlocked` check is not needed — the profile query naturally returns null when blocked.

### Anti-Patterns to Avoid

- **JWT claims for moderator role:** The exchange-token function doesn't inject custom claims. Don't add `is_moderator` to JWT — use the database table.
- **RLS for block feed filtering:** Multiple permissive SELECT policies are OR'd, not AND'd. A block exclusion RLS policy cannot negate the existing `posts_select_slice_member` policy. Use RPC functions.
- **Hard-deleting flagged posts:** Established project pattern is `is_deleted = true` (soft delete). The "Remove" mod action sets `is_deleted = true` on the post — never hard-deletes.
- **No INSERT RLS on flags:** Flags should have an INSERT policy (unlike notifications which were trigger-only). Users INSERT their own flags directly — need `WITH CHECK (reporter_id = current_user_id())`.
- **Flag count trigger:** Don't maintain a `flag_count` column on posts with a trigger. Compute it in the mod queue query via COUNT(*) GROUP BY.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom div + useState + setTimeout | `sonner` 2.0.7 | Accessibility, stacking, positioning, auto-dismiss — 3KB gzipped, zero config |
| Moderator role check | JWT claim injection | `civic_spaces.moderators` table + `is_moderator()` SECURITY DEFINER helper | Exchange-token function mints minimal JWT with no custom claims |
| Block feed filtering in RLS | Additional RLS SELECT policy | RPC function with NOT EXISTS block exclusion | Multiple permissive policies OR not AND — exclusion cannot work as RLS |
| Flag deduplication | App-level check before insert | `UNIQUE (reporter_id, post_id)` DB constraint + catch 23505 error | Same race-condition pattern used for slice membership |

**Key insight:** The project's existing patterns (SECURITY DEFINER triggers, subquery-wrapped RLS, public-schema views, RPC for complex queries) are the right model for every new table. Follow them exactly.

---

## Common Pitfalls

### Pitfall 1: Moderator RLS Without is_moderator() Helper

**What goes wrong:** Inlining the moderator subquery in every RLS policy — `(SELECT EXISTS (SELECT 1 FROM civic_spaces.moderators WHERE user_id = (SELECT auth.jwt() ->> 'sub')))` — is verbose and harder to maintain.
**Why it happens:** Developers forget to extract shared logic.
**How to avoid:** Create `civic_spaces.is_moderator()` STABLE SECURITY DEFINER function once and call `(SELECT civic_spaces.is_moderator())` in all policies. Same pattern as `civic_spaces.current_user_id()`.
**Warning signs:** Multiple policies with identical inline subquery.

### Pitfall 2: Flag Double-Submit Without DB Constraint

**What goes wrong:** User taps flag button twice quickly — two flag rows inserted for the same (reporter_id, post_id).
**Why it happens:** React mutation fires twice before optimistic state settles.
**How to avoid:** `UNIQUE (reporter_id, post_id)` constraint on flags table. Catch PostgreSQL error code `23505` (unique_violation) in the mutation and treat it as idempotent success.
**Warning signs:** Test with rapid double-tap; check for duplicate rows.

### Pitfall 3: Block Filtering in Feed Leaks Data

**What goes wrong:** Client-side block filtering (fetch all posts, then filter) means blocked users' posts were fetched and transmitted to the blocker before being discarded.
**Why it happens:** RLS can't exclude with AND when existing policies use OR-combined permissive policies.
**How to avoid:** Use `get_feed_filtered` RPC with server-side NOT EXISTS block exclusion. Data never leaves the DB.
**Warning signs:** Network tab shows blocked user's post content in API response.

### Pitfall 4: Moderator Action Doesn't Close Flags

**What goes wrong:** Moderator takes "Remove" action on a post, but pending flags remain in `status = 'pending'`. The post disappears from the feed but the flags stay open, making the queue stale.
**Why it happens:** Action and flag resolution are separate operations, easy to forget to batch.
**How to avoid:** Each moderator action (remove, dismiss, warn, suspend) must atomically update BOTH the post/user AND set all pending flags for that post to `status = 'resolved'` or `status = 'dismissed'`. Use a single transaction or an RPC function that wraps both UPDATEs.
**Warning signs:** Mod queue shows items that no longer have visible posts.

### Pitfall 5: Suspend Action Doesn't Use Existing Pattern

**What goes wrong:** Building a new suspension mechanism instead of using `connected_profiles.account_standing = 'suspended'`, which already gates writes in the feed via the `is_suspended` generated column.
**Why it happens:** Phase 5 developer doesn't read Phase 2 migration.
**How to avoid:** The "Suspend" mod action sets `connected_profiles.account_standing = 'suspended'` for the target user_id. This is already enforced upstream — suspended users' write actions are already blocked by Phase 2 checks in PostComposer/ReplyComposer. No new mechanism needed.
**Warning signs:** Inventing a new `is_suspended` table or column when one already exists.

### Pitfall 6: SECURITY DEFINER Omitted on is_moderator()

**What goes wrong:** `is_moderator()` without SECURITY DEFINER runs as the calling user. The inner `SELECT FROM civic_spaces.moderators` is itself subject to RLS — if moderators table RLS only allows moderators to select their own row, the function correctly returns true for moderators but fails with permission denied for non-moderators (they can't read the table).
**Why it happens:** Pattern from trigger functions (which need SECURITY DEFINER for different reasons) applies here too but for different reasons.
**How to avoid:** SECURITY DEFINER on `is_moderator()` so it always runs as the function owner (superuser context), which can read the moderators table regardless of RLS.
**Warning signs:** `is_moderator()` works in superuser context but returns false or throws for regular users even when they are moderators.

### Pitfall 7: Realtime on Flags for Mod Queue

**What goes wrong:** Adding Realtime subscription to `civic_spaces.flags` for the mod queue — but the table uses RLS, and authenticated users can only see their own flags (as reporters). Moderators need to see all flags.
**Why it happens:** Realtime postgres_changes respects RLS, so a moderator's Realtime subscription on flags would filter to their own reporter_id rows only, missing others' flags.
**How to avoid:** The mod queue does NOT use Realtime subscription. Instead, use React Query with `staleTime: 0` and manual `refetchInterval` or a "Refresh" button. Alternatively, the `public.flags` view could have a separate Realtime grant but this is complex. Polling is simpler and correct.
**Warning signs:** Mod queue appears empty despite pending flags in DB.

---

## Code Examples

### Flag Submission Mutation

```typescript
// Source: Established pattern from useSendFriendRequest.ts + UNIQUE constraint idempotency
export function useFlagPost() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      postId,
      category,
      detail,
    }: {
      postId: string
      category: 'spam' | 'harassment' | 'misinformation' | 'other'
      detail?: string
    }) => {
      if (!userId) throw new Error('Not authenticated')
      const { error } = await supabase.from('flags').insert({
        post_id: postId,
        reporter_id: userId,
        category,
        detail: detail ?? null,
      })
      // 23505 = unique_violation: already flagged — treat as success
      if (error && error.code !== '23505') throw error
    },
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['my-flags', userId] })
      toast("Thanks, we'll review this.")
    },
  })
}
```

### Block Mutation

```typescript
// Source: Established pattern from useRemoveFriend.ts
export function useBlockUser() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (targetId: string) => {
      if (!userId) throw new Error('Not authenticated')
      const { error } = await supabase.from('blocks').insert({
        blocker_id: userId,
        blocked_id: targetId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', userId] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['boosted-feed'] })
    },
  })
}
```

### Feed Filtered RPC (SQL)

```sql
-- Source: Adapted from civic_spaces.get_boosted_feed pattern
CREATE OR REPLACE FUNCTION civic_spaces.get_feed_filtered(
  p_slice_id  uuid,
  p_limit     integer     DEFAULT 20,
  p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_id uuid        DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  slice_id    uuid,
  user_id     text,
  title       text,
  body        text,
  reply_count integer,
  edit_history jsonb,
  is_deleted  boolean,
  created_at  timestamptz,
  updated_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    p.id, p.slice_id, p.user_id, p.title, p.body,
    p.reply_count, p.edit_history, p.is_deleted,
    p.created_at, p.updated_at
  FROM civic_spaces.posts p
  WHERE p.slice_id = p_slice_id
    AND p.is_deleted = false
    AND p.slice_id IN (
      SELECT slice_id FROM civic_spaces.slice_members
      WHERE user_id = (SELECT civic_spaces.current_user_id())
    )
    AND NOT EXISTS (
      SELECT 1 FROM civic_spaces.blocks b
      WHERE (b.blocker_id = (SELECT civic_spaces.current_user_id()) AND b.blocked_id = p.user_id)
         OR (b.blocker_id = p.user_id AND b.blocked_id = (SELECT civic_spaces.current_user_id()))
    )
    AND (
      p_cursor_at IS NULL
      OR (p.created_at, p.id) < (p_cursor_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.get_feed_filtered(uuid, integer, timestamptz, uuid) TO authenticated;
```

### Moderator Queue Query (as RPC or client-side query)

```typescript
// Source: Pattern from useModQueue.ts (to be created)
// Query via public view on civic_spaces.mod_queue (or direct RPC)
const { data: queueItems } = useQuery({
  queryKey: ['mod-queue'],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_mod_queue')
    if (error) throw error
    return data
  },
  staleTime: 0,  // Always fresh — no Realtime on flags
  refetchInterval: 30_000,  // Poll every 30 seconds
  enabled: isModerator,
})
```

### Moderator Action Mutation (atomic)

```typescript
// Source: Pattern from useDeletePost.ts
export function useModAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      action,
      postId,
      authorId,
      flagIds,
    }: {
      action: 'remove' | 'dismiss' | 'warn' | 'suspend'
      postId: string
      authorId: string
      flagIds: string[]
    }) => {
      // All actions resolve the flags
      const { error: flagError } = await supabase
        .from('flags')
        .update({ status: action === 'dismiss' ? 'dismissed' : 'resolved' })
        .in('id', flagIds)
      if (flagError) throw flagError

      if (action === 'remove') {
        const { error } = await supabase
          .from('posts')
          .update({ is_deleted: true })
          .eq('id', postId)
        if (error) throw error
      }

      if (action === 'suspend') {
        const { error } = await supabase
          .from('connected_profiles')
          .update({ account_standing: 'suspended' })
          .eq('user_id', authorId)
        if (error) throw error
      }

      // Log the action
      await supabase.from('action_log').insert({
        action,
        target_type: action === 'suspend' ? 'user' : 'post',
        target_id: action === 'suspend' ? authorId : postId,
        flag_ids: flagIds,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-queue'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
```

### RLS Policy Pattern for Flags

```sql
-- Source: Established project pattern from phase4_notifications.sql
ALTER TABLE civic_spaces.flags ENABLE ROW LEVEL SECURITY;

-- User can see their own flags
CREATE POLICY flags_select_own ON civic_spaces.flags
  FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.jwt() ->> 'sub'));

-- Moderator can see all flags
CREATE POLICY flags_select_moderator ON civic_spaces.flags
  FOR SELECT TO authenticated
  USING ((SELECT civic_spaces.is_moderator()));

-- User can insert their own flags
CREATE POLICY flags_insert_own ON civic_spaces.flags
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.jwt() ->> 'sub'));

-- Moderator can update flag status (resolve/dismiss)
CREATE POLICY flags_update_moderator ON civic_spaces.flags
  FOR UPDATE TO authenticated
  USING     ((SELECT civic_spaces.is_moderator()))
  WITH CHECK ((SELECT civic_spaces.is_moderator()));
```

### Sonner Setup in AppShell

```typescript
// Source: https://sonner.emilkowal.ski/
import { Toaster } from 'sonner'

// In AppShell return, inside the outermost div:
<Toaster position="bottom-center" richColors />
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| JWT custom claims for roles | DB lookup table + SECURITY DEFINER helper | Required because exchange-token mints minimal JWT |
| RLS exclusion policies for blocks | RPC function with NOT EXISTS | RLS multiple permissive policies OR — cannot AND-negate |
| Manual toast components | sonner 2.0.7 | Zero config, accessible, stacking handled |

**Already established in this project (not outdated):**
- Soft delete via `is_deleted = true` — do not change
- `(SELECT auth.jwt() ->> 'sub')` subquery wrapping in all RLS — do not change
- SECURITY DEFINER on all trigger functions — extend to `is_moderator()`
- Public-schema views for PostgREST access — create for all new tables
- Supabase Realtime via `postgres_changes` — do NOT use for mod queue flags (RLS limitation)

---

## Open Questions

1. **Warn notification delivery**
   - What we know: "Warn" action sends a notification to the post author that their content was reviewed. The notifications table and trigger pattern exists.
   - What's unclear: Should this be a new `event_type = 'content_warned'` in the notifications table, or a direct INSERT from the client mutation? The trigger pattern (SECURITY DEFINER, no client INSERT) was for automatic notifications. A warn notification is deliberate/manual.
   - Recommendation: Add a `civic_spaces.send_warn_notification(target_user_id text, post_id text)` SECURITY DEFINER function callable as an RPC. This keeps the no-client-INSERT-to-notifications rule intact while allowing the moderator action to trigger it.

2. **Moderator queue "Suspend" and friend request blocking**
   - What we know: Block mechanics prevent friend requests from blocked users. Suspended users are a separate concept (account_standing).
   - What's unclear: Should suspension also implicitly block all active friend relationships? Phase 5 scope as defined does not mention this.
   - Recommendation: Suspension only sets `account_standing = 'suspended'`. Existing Phase 2 gating already prevents suspended users from writing. Don't add friend/block logic to suspension in this phase.

3. **`get_boosted_feed` update vs. new `get_feed_filtered` RPC**
   - What we know: Two separate feed hooks exist: `useFeed` (standard) and `useBoostedFeed` (boosted). Both need block filtering.
   - What's unclear: Whether to update `get_boosted_feed` in-place (migration ALTER FUNCTION) or create a separate function.
   - Recommendation: Create `get_feed_filtered` (standard) and `get_boosted_feed_filtered` (boosted) as new functions, then update hooks to call the new versions. Keeps old functions intact as fallback and avoids migration drop-and-recreate complexity.

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `supabase/migrations/` (all 7 migration files read directly)
- Existing codebase — `src/hooks/`, `src/components/`, `src/types/database.ts` (read directly)
- `exchange-token/index.ts` — confirmed JWT payload structure (sub, role: 'authenticated' only, no custom claims)
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — WebFetch, confirmed (select ...) pattern and multiple permissive policy OR behavior

### Secondary (MEDIUM confidence)

- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — WebFetch, confirmed database table + is_moderator() helper pattern
- [Sonner official site](https://sonner.emilkowal.ski/) — WebFetch, confirmed installation and API; version confirmed via `npm info sonner version` = 2.0.7

### Tertiary (LOW confidence)

- None — all findings verified against codebase or official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies except sonner (verified current version 2.0.7 via npm)
- Architecture: HIGH — all patterns derived from reading actual migration files and source code
- Pitfalls: HIGH — derived from constraints visible in existing code (JWT payload, RLS OR behavior, SECURITY DEFINER pattern)
- Moderator role approach: HIGH — JWT payload confirmed to contain only `sub`, `role`, `iss`, `aud`

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable patterns; sonner version may change but 2.0.7 is pinned)
