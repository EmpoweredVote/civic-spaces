# Phase 3: Social Graph - Research

**Researched:** 2026-03-28
**Domain:** PostgreSQL social graph schema, RLS for bidirectional relationships, TanStack Query friend-state management, feed ranking with additive time boost, react-modal-sheet bottom sheet profile card, pg_trgm member search
**Confidence:** HIGH (core stack and DB patterns verified), MEDIUM (feed boost SQL pattern — no canonical Supabase reference, derived from PostgreSQL fundamentals)

---

## Summary

Phase 3 adds three new capabilities on top of the Phase 2 forum: a bidirectional friend request system, a follow system for Empowered accounts, and an additive feed ranking boost for friends and followed Empowered accounts. The profile card bottom sheet reuses `react-modal-sheet` already installed in Phase 2. The member directory and search require a new query surface with `ilike` / `pg_trgm`. No new npm packages are strictly required; `react-modal-sheet` (already installed, currently v5.2.1) covers the bottom sheet. `pg_trgm` (a built-in Postgres extension) improves search performance.

The hardest design decision is the friendship table schema. The single-row normalized pattern with a `CHECK (user_low < user_high)` constraint and a `status` column encoding who sent the request is the established PostgreSQL approach. It avoids row duplication and makes RLS tractable. RLS on a bidirectional table is non-trivial: every policy must cover both the `user_low` and `user_high` sides, and the `(select civic_spaces.current_user_id())` wrapping pattern must be used to avoid per-row function calls (verified 94.97% performance improvement in Supabase benchmarks).

The feed boost is implemented entirely in SQL at query time: a `CASE WHEN` expression adds a fixed interval (e.g., `INTERVAL '2 hours'`) to `created_at` for posts by friends and followed Empowered accounts, making those posts sort as if they were posted more recently. This is additive recency — a stranger's very new post still beats an old friend post, satisfying the "modest bump" requirement.

**Primary recommendation:** Use the normalized single-row `friendships` table with `user_low`/`user_high` + `status` pattern. Implement the feed boost as a SQL `CASE WHEN created_at + INTERVAL` in the feed query function. Reuse `react-modal-sheet` for the profile card bottom sheet. Add `pg_trgm` extension + GIN index for member search.

---

## Standard Stack

No new npm packages are required. All needed libraries were installed in Phase 2.

### Already Installed (Phase 2)

| Library | Version | Phase 3 Use |
|---------|---------|-------------|
| `react-modal-sheet` | ^5.2.1 | Profile card bottom sheet |
| `@tanstack/react-query` | ^5.0.0 | Friend request state, follow state, directory query |
| `react-loading-skeleton` | ^3.0.0 | Skeleton for directory, search, friends list |
| `@supabase/supabase-js` | installed | All DB operations |
| `motion` | ^11.0.0 | Peer dep of react-modal-sheet (already installed) |

### New Database Extension (migration)

| Extension | Purpose | How to Enable |
|-----------|---------|---------------|
| `pg_trgm` | GIN trigram index for `ilike` searches on `display_name` | `CREATE EXTENSION IF NOT EXISTS pg_trgm;` in migration |

### No New npm Packages Needed

The Phase 3 feature set (profile card, friends list, directory, search, follow) is fully served by the Phase 2 stack. Do not install additional packages.

---

## Architecture Patterns

### Recommended Project Structure Additions

```
src/
├── components/
│   ├── UserProfileCard.tsx       # Bottom sheet profile card (new)
│   ├── EmpoweredBadge.tsx        # Civic/star icon badge component (new)
│   ├── FriendsList.tsx           # Friends list tab with pending section (new)
│   └── MemberDirectory.tsx       # Directory + search panel (new)
├── hooks/
│   ├── useFriendship.ts          # Friend request state, send/accept/remove (new)
│   ├── useFollow.ts              # Follow/unfollow Empowered accounts (new)
│   ├── useFriends.ts             # Fetch friends list + pending requests (new)
│   ├── useMemberDirectory.ts     # Paginated member directory query (new)
│   └── useMemberSearch.ts        # Search members by display_name (new)
└── types/
    └── database.ts               # Add Friendship, Follow types (extend)
```

### Pattern 1: Friendship Table Schema (Single-Row Normalized)

The canonical PostgreSQL pattern for bidirectional friendships stores one row per pair, enforcing `user_low < user_high` via CHECK constraint. The `status` column encodes who sent the request, allowing pending-direction queries without a second table.

**Source:** Established PostgreSQL community pattern; consistent across multiple authoritative sources (coderbased.com article, PostgreSQL mailing list discussion, dzone.com).

```sql
-- Migration: civic_spaces schema additions for Phase 3

-- 1. pg_trgm extension for fast ilike search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN trigram index on display_name for member search
CREATE INDEX idx_connected_profiles_display_name_trgm
  ON civic_spaces.connected_profiles
  USING GIN (display_name gin_trgm_ops);

-- 3. Friendships table (single-row normalized pattern)
CREATE TABLE civic_spaces.friendships (
    -- Enforced ordering: user_low is lexicographically smaller user_id
    user_low    text        NOT NULL,
    user_high   text        NOT NULL,
    -- REQ_LOW = user_low sent the request; REQ_HIGH = user_high sent the request; FRIEND = mutual
    status      text        NOT NULL CHECK (status IN ('REQ_LOW', 'REQ_HIGH', 'FRIEND')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (user_low, user_high),
    CONSTRAINT friendships_ordering CHECK (user_low < user_high)
);

CREATE INDEX idx_friendships_user_low_status  ON civic_spaces.friendships (user_low,  status);
CREATE INDEX idx_friendships_user_high_status ON civic_spaces.friendships (user_high, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON civic_spaces.friendships TO authenticated;

-- 4. Follows table (directional: follower → empowered target)
CREATE TABLE civic_spaces.follows (
    follower_id text        NOT NULL,
    target_id   text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (follower_id, target_id)
);

CREATE INDEX idx_follows_follower ON civic_spaces.follows (follower_id);
CREATE INDEX idx_follows_target   ON civic_spaces.follows (target_id);

GRANT SELECT, INSERT, DELETE ON civic_spaces.follows TO authenticated;
```

**Why user_low/user_high instead of requester_id/recipient_id:** A single consistent ordering lets you look up "does a friendship exist between A and B?" with one PK lookup (`WHERE user_low = MIN(a,b) AND user_high = MAX(a,b)`), avoiding the two-row lookup required by directional schemas. The `status` encodes direction without a second table.

### Pattern 2: Computing user_low / user_high in the Client

Before any friendship insert or lookup, the client must compute the canonical pair ordering:

```typescript
// src/lib/friendship.ts
export function friendshipKey(
  userId: string,
  otherId: string
): { user_low: string; user_high: string } {
  return userId < otherId
    ? { user_low: userId, user_high: otherId }
    : { user_low: otherId, user_high: userId }
}

export function friendshipStatus(
  row: { user_low: string; user_high: string; status: string },
  currentUserId: string
): 'none' | 'pending_sent' | 'pending_received' | 'friends' {
  if (row.status === 'FRIEND') return 'friends'
  const iLow = currentUserId === row.user_low
  if (row.status === 'REQ_LOW') return iLow ? 'pending_sent' : 'pending_received'
  if (row.status === 'REQ_HIGH') return iLow ? 'pending_received' : 'pending_sent'
  return 'none'
}
```

### Pattern 3: RLS for Bidirectional Friendship Table

RLS on the friendship table must cover both sides of every pair. All policies use the `(select civic_spaces.current_user_id())` wrapping pattern to cache the function result per-statement (verified 94.97% improvement per Supabase benchmarks).

```sql
ALTER TABLE civic_spaces.friendships ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see their own friendship rows (either side)
CREATE POLICY "friendships_select_own"
    ON civic_spaces.friendships
    FOR SELECT
    TO authenticated
    USING (
        user_low  = (select civic_spaces.current_user_id())
        OR user_high = (select civic_spaces.current_user_id())
    );

-- INSERT: user can only insert rows they are part of, and must be the requester
-- status must be REQ_LOW if they are user_low, REQ_HIGH if they are user_high
CREATE POLICY "friendships_insert_own"
    ON civic_spaces.friendships
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            user_low = (select civic_spaces.current_user_id())
            AND status = 'REQ_LOW'
        )
        OR
        (
            user_high = (select civic_spaces.current_user_id())
            AND status = 'REQ_HIGH'
        )
    );

-- UPDATE: only the recipient of a pending request can accept (change to FRIEND)
-- or either party can initiate removal (set status) — actually removal is DELETE below
CREATE POLICY "friendships_update_accept"
    ON civic_spaces.friendships
    FOR UPDATE
    TO authenticated
    USING (
        -- Only the recipient can accept
        (
            status = 'REQ_LOW'
            AND user_high = (select civic_spaces.current_user_id())
        )
        OR
        (
            status = 'REQ_HIGH'
            AND user_low = (select civic_spaces.current_user_id())
        )
    )
    WITH CHECK (
        status = 'FRIEND'
    );

-- DELETE: either party can remove a friendship or cancel a request
CREATE POLICY "friendships_delete_own"
    ON civic_spaces.friendships
    FOR DELETE
    TO authenticated
    USING (
        user_low  = (select civic_spaces.current_user_id())
        OR user_high = (select civic_spaces.current_user_id())
    );
```

### Pattern 4: RLS for Follows Table

```sql
ALTER TABLE civic_spaces.follows ENABLE ROW LEVEL SECURITY;

-- SELECT: follower can see their own follows; target can see who follows them
CREATE POLICY "follows_select_own"
    ON civic_spaces.follows
    FOR SELECT
    TO authenticated
    USING (
        follower_id = (select civic_spaces.current_user_id())
        OR target_id  = (select civic_spaces.current_user_id())
    );

-- INSERT: can only follow as yourself, and target must be Empowered tier
-- Note: tier check must be enforced via a trigger or the INSERT policy referencing connected_profiles
CREATE POLICY "follows_insert_own"
    ON civic_spaces.follows
    FOR INSERT
    TO authenticated
    WITH CHECK (
        follower_id = (select civic_spaces.current_user_id())
        AND target_id IN (
            SELECT user_id FROM civic_spaces.connected_profiles WHERE tier = 'empowered'
        )
    );

-- DELETE: can only unfollow your own follows
CREATE POLICY "follows_delete_own"
    ON civic_spaces.follows
    FOR DELETE
    TO authenticated
    USING (follower_id = (select civic_spaces.current_user_id()));
```

**IMPORTANT:** The current schema has `tier CHECK (tier IN ('connected', 'inform'))`. Phase 3 requires an `'empowered'` tier value. The Phase 2 migration must be checked — if the CHECK constraint does not include `'empowered'`, a migration must ALTER the constraint before Phase 3 inserts Empowered data. This is a **critical schema gap to verify**.

### Pattern 5: Feed Boost via Additive Interval in SQL

The feed boost is implemented by adjusting the sort key, not by changing actual data. A `CASE WHEN` expression adds an interval to `created_at` for posts by boosted authors, making them sort as if more recent.

This pattern is derived from PostgreSQL fundamentals (timestamps are sortable, INTERVAL arithmetic is native) and the "modest bump magnitude" constraint (a very recent stranger post still beats an old friend post).

```sql
-- Concept: boosted_at = created_at + INTERVAL '2 hours' for friends/followed
-- The feed fetches posts and sorts by boosted_at DESC

-- In the feed query (implemented as a Supabase RPC function for the boosted feed):
CREATE OR REPLACE FUNCTION civic_spaces.get_boosted_feed(
    p_slice_id  uuid,
    p_limit     integer DEFAULT 20,
    p_cursor_at timestamptz DEFAULT NULL,
    p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id          uuid,
    slice_id    uuid,
    user_id     text,
    title       text,
    body        text,
    reply_count integer,
    edit_history jsonb,
    created_at  timestamptz,
    updated_at  timestamptz,
    is_deleted  boolean,
    boosted_at  timestamptz  -- synthetic sort key, not stored
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    WITH my_id AS (
        SELECT civic_spaces.current_user_id() AS uid
    ),
    boosted_authors AS (
        -- Friends (mutual)
        SELECT
            CASE WHEN f.user_low = m.uid THEN f.user_high ELSE f.user_low END AS author_id
        FROM civic_spaces.friendships f, my_id m
        WHERE (f.user_low = m.uid OR f.user_high = m.uid)
          AND f.status = 'FRIEND'

        UNION

        -- Followed Empowered accounts
        SELECT fl.target_id AS author_id
        FROM civic_spaces.follows fl, my_id m
        WHERE fl.follower_id = m.uid
    )
    SELECT
        p.id,
        p.slice_id,
        p.user_id,
        p.title,
        p.body,
        p.reply_count,
        p.edit_history,
        p.created_at,
        p.updated_at,
        p.is_deleted,
        -- Additive 2-hour boost for friend/followed posts
        p.created_at + CASE WHEN ba.author_id IS NOT NULL THEN INTERVAL '2 hours' ELSE INTERVAL '0' END AS boosted_at
    FROM civic_spaces.posts p
    LEFT JOIN boosted_authors ba ON ba.author_id = p.user_id
    WHERE p.slice_id = p_slice_id
      AND p.is_deleted = false
      AND (
          p_cursor_at IS NULL
          OR (p.created_at + CASE WHEN ba.author_id IS NOT NULL THEN INTERVAL '2 hours' ELSE INTERVAL '0' END) < p_cursor_at
          OR (
              (p.created_at + CASE WHEN ba.author_id IS NOT NULL THEN INTERVAL '2 hours' ELSE INTERVAL '0' END) = p_cursor_at
              AND p.id < p_cursor_id
          )
      )
    ORDER BY boosted_at DESC, p.id DESC
    LIMIT p_limit;
$$;
```

**Cursor caveat:** The composite cursor must be based on `boosted_at` (not raw `created_at`) to avoid pagination gaps. This means the cursor stored and sent from the client is the `boosted_at` value from the last post in the page — not `created_at`. The frontend hook must be updated to use `boosted_at` as the cursor key.

**Boost magnitude — Claude's discretion:** `INTERVAL '2 hours'` is the recommended starting value. At 2 hours, a friend post from 10 hours ago sorts as if from 8 hours ago — still below a stranger's 1-hour-old post. Adjustable post-launch via migration.

**Alternative — client-side sort:** Do NOT sort on the client after fetching. Pagination breaks: page 2 would return the wrong items because the server doesn't know the client's sort. The boost MUST be in the DB query.

### Pattern 6: react-modal-sheet for Profile Card Bottom Sheet

`react-modal-sheet` is already installed (v5.2.1). The UserProfileCard bottom sheet follows the same compound component pattern used in PostComposer.

```tsx
// src/components/UserProfileCard.tsx
import Sheet from 'react-modal-sheet'

interface UserProfileCardProps {
  isOpen: boolean
  onClose: () => void
  userId: string   // the profile to show
}

export default function UserProfileCard({ isOpen, onClose, userId }: UserProfileCardProps) {
  // Fetch profile + current friendship/follow status
  const { data: profile } = useProfileById(userId)
  const { data: relationship } = useRelationship(userId)
  const { userId: currentUserId } = useAuth()

  return (
    <Sheet isOpen={isOpen} onClose={onClose} snapPoints={[0.45]} initialSnap={0}>
      <Sheet.Container>
        <Sheet.Header />
        <Sheet.Content>
          {/* Avatar, display name, tier badge, slice name, action button */}
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  )
}
```

**Empowered visual treatment on the card:** When `profile.tier === 'empowered'`, apply a red/coral tinted background to `Sheet.Container`. Use an inline style or Tailwind arbitrary value:
```tsx
<Sheet.Container style={{ backgroundColor: profile?.tier === 'empowered' ? '#FFF0EE' : undefined }}>
```

**Animation — Claude's discretion:** The default `react-modal-sheet` slide-up animation is suitable. No custom tweenConfig needed unless the feel is too fast/slow after testing.

### Pattern 7: ilike Search with pg_trgm

Member directory and search use `ilike` with `%term%` pattern. With the GIN trigram index installed, Postgres's query planner automatically uses the index for `ilike '%x%'` queries.

```typescript
// src/hooks/useMemberSearch.ts
export function useMemberSearch(term: string, crossSlice: boolean, sliceId: string) {
  return useQuery({
    queryKey: ['member-search', term, crossSlice, sliceId],
    queryFn: async () => {
      let query = supabase
        .from('connected_profiles')
        .select('user_id, display_name, avatar_url, tier')
        .ilike('display_name', `%${term}%`)
        .order('display_name')
        .limit(50)

      if (!crossSlice) {
        // Limit to current slice members
        const { data: members } = await supabase
          .from('slice_members')
          .select('user_id')
          .eq('slice_id', sliceId)
        const ids = members?.map(m => m.user_id) ?? []
        query = query.in('user_id', ids)
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
    enabled: term.length >= 2,  // Don't search on <2 chars
    staleTime: 1000 * 30,       // 30s — search results are short-lived
  })
}
```

**Note on cross-slice search:** Filtering by slice membership requires a sub-query or a two-step query (fetch member IDs, then filter profiles). Use the two-query pattern (established in Phase 2 for feed author profiles) rather than a JOIN — PostgREST cannot FK-join across schemas.

**RLS on connected_profiles already allows SELECT for all authenticated users** (policy: `connected_profiles_select_authenticated`). No new RLS needed for directory/search read access.

### Pattern 8: TanStack Query Friend State Management

Friend request actions (send, accept, remove) use `useMutation` with cache invalidation on settle. The friend state query key is `['relationship', userId, otherId]`.

```typescript
// src/hooks/useFriendship.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { friendshipKey, friendshipStatus } from '../lib/friendship'

export function useRelationship(otherUserId: string) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['relationship', userId, otherUserId],
    queryFn: async () => {
      if (!userId) return null
      const key = friendshipKey(userId, otherUserId)
      const { data } = await supabase
        .from('friendships')
        .select('user_low, user_high, status')
        .eq('user_low', key.user_low)
        .eq('user_high', key.user_high)
        .maybeSingle()
      if (!data) return 'none'
      return friendshipStatus(data, userId)
    },
    enabled: !!userId && !!otherUserId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('Not authenticated')
      const key = friendshipKey(userId, otherUserId)
      const status = userId < otherUserId ? 'REQ_LOW' : 'REQ_HIGH'
      const { error } = await supabase
        .from('friendships')
        .insert({ ...key, status })
      if (error) throw error
    },
    onSuccess: (_data, otherUserId) => {
      queryClient.invalidateQueries({ queryKey: ['relationship', userId, otherUserId] })
    },
  })
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('Not authenticated')
      const key = friendshipKey(userId, otherUserId)
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'FRIEND' })
        .eq('user_low', key.user_low)
        .eq('user_high', key.user_high)
      if (error) throw error
    },
    onSuccess: (_data, otherUserId) => {
      queryClient.invalidateQueries({ queryKey: ['relationship', userId, otherUserId] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}

export function useRemoveFriend() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('Not authenticated')
      const key = friendshipKey(userId, otherUserId)
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_low', key.user_low)
        .eq('user_high', key.user_high)
      if (error) throw error
    },
    onSuccess: (_data, otherUserId) => {
      queryClient.invalidateQueries({ queryKey: ['relationship', userId, otherUserId] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}
```

**No optimistic updates for friend requests:** Unlike post submission where the optimistic state is immediately correct, friend request state has multiple parties. Show a loading spinner on the action button; the mutation is fast enough that optimistic complexity isn't warranted.

### Pattern 9: Follow State

```typescript
// src/hooks/useFollow.ts
export function useFollowStatus(targetId: string) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['follow', userId, targetId],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', userId!)
        .eq('target_id', targetId)
        .maybeSingle()
      return !!data
    },
    enabled: !!userId && !!targetId,
  })
}

export function useToggleFollow() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  return useMutation({
    mutationFn: async ({ targetId, isFollowing }: { targetId: string; isFollowing: boolean }) => {
      if (!userId) throw new Error('Not authenticated')
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', userId)
          .eq('target_id', targetId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: userId, target_id: targetId })
        if (error) throw error
      }
    },
    onSuccess: (_data, { targetId }) => {
      queryClient.invalidateQueries({ queryKey: ['follow', userId, targetId] })
    },
  })
}
```

### Pattern 10: Empowered Badge Component

Used in PostCard, ThreadView, UserProfileCard, MemberDirectory, and search results. Single reusable component.

```tsx
// src/components/EmpoweredBadge.tsx
// Civic/star icon in brand red/coral. Not a generic checkmark.
export default function EmpoweredBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className ?? ''}`}
      aria-label="Empowered civic leader"
      title="Empowered civic leader"
    >
      {/* Star/civic SVG icon in brand color */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-4 h-4 text-red-500"
        aria-hidden="true"
      >
        {/* Use a civic-appropriate icon: outlined star or torch */}
        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    </span>
  )
}
```

**Usage:** Next to `display_name` in any author row:
```tsx
{profile.tier === 'empowered' && <EmpoweredBadge className="ml-1" />}
```

### Anti-Patterns to Avoid

- **Two-row friendship pattern:** Storing both `(A→B)` and `(B→A)` rows. Doubles storage, complicates RLS, and creates consistency hazards. Use single-row with user_low/user_high.
- **Sorting on the client after feed fetch:** Breaks cursor pagination. The boost MUST be computed in the DB query.
- **Raw `civic_spaces.current_user_id()` in RLS without `(select ...)` wrapping:** Called once per row, not per statement. Wrap: `(select civic_spaces.current_user_id())`.
- **Allowing follows to non-Empowered accounts in the client:** The RLS INSERT policy enforces this at the DB level, but the UI should also disable the Follow button for Connected-tier authors to prevent an error flash.
- **Using auth.uid() anywhere:** Phase 1 established that external JWTs don't populate `auth.uid()`. Always use `civic_spaces.current_user_id()` DB-side and decode `sub` from JWT client-side.
- **Full text search (tsvector) for display_name search:** `display_name` is a pseudonym, not prose. `ilike` with `pg_trgm` GIN index is the right tool — fast, handles partial substrings, no stemming or stop-word issues.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet profile card | CSS drawer + custom animations | `react-modal-sheet` (already installed) | Keyboard avoidance, gesture physics, snap points — error-prone to implement |
| ilike-based member search index | Sequential scan on `display_name` | `pg_trgm` GIN index | Without trigram index, `ilike '%x%'` forces full table scan; up to 6k rows means acceptable but degrades with growth |
| Bidirectional friendship lookup | Two-row pattern or application-level pair normalization | Single-row with `user_low < user_high` CHECK | One PK lookup per pair; no deduplication bugs; RLS stays tractable |
| Feed boost sorting | Client-side re-sort after fetch | SQL `CASE WHEN ... + INTERVAL` in RPC | Client-side sort breaks cursor pagination across pages |
| Friend request status derivation | Multiple boolean columns (`is_sent`, `is_accepted`, `is_received`) | Single `status` text column with documented values | Prevents inconsistent state (e.g., is_sent=true AND is_accepted=true) |

**Key insight:** The friendship table design has the most long-term consequences. Getting the schema wrong (two-row pattern, multiple status booleans) creates RLS nightmares and query complexity that compounds through every subsequent phase. The single-row normalized pattern is strictly better for this use case.

---

## Common Pitfalls

### Pitfall 1: Empowered Tier Not in CHECK Constraint

**What goes wrong:** Attempting to INSERT a user with `tier = 'empowered'` fails with a constraint violation because the Phase 2 migration set `CHECK (tier IN ('connected', 'inform'))`.

**Why it happens:** Phase 2 only needed two tiers. Phase 3 introduces `'empowered'` as a first-class tier value.

**How to avoid:** Phase 3 migration must ALTER the constraint:
```sql
ALTER TABLE civic_spaces.connected_profiles
  DROP CONSTRAINT IF EXISTS connected_profiles_tier_check;

ALTER TABLE civic_spaces.connected_profiles
  ADD CONSTRAINT connected_profiles_tier_check
  CHECK (tier IN ('connected', 'inform', 'empowered'));
```

**Warning signs:** Error `ERROR: new row violates check constraint "connected_profiles_tier_check"` on profile insert/update.

---

### Pitfall 2: Cursor Mismatch Between Raw Feed and Boosted Feed

**What goes wrong:** The existing `useFeed` hook uses `created_at` + `id` as the cursor. The boosted feed orders by `boosted_at` (= `created_at + INTERVAL`). Using `created_at` as the cursor on the boosted feed causes incorrect pagination — items appear out of order or are skipped.

**Why it happens:** The cursor for a sorted query must be the sort key, not a different column.

**How to avoid:** The boosted feed RPC returns `boosted_at` in its result set. The cursor stored and sent for page 2 must be `{ boosted_at: row.boosted_at, id: row.id }`, not `{ created_at: row.created_at, id: row.id }`. Create a separate `useBoostedFeed` hook — do NOT modify the existing `useFeed` hook.

**Warning signs:** Duplicate posts on page 2, or posts skipped in the middle of the feed.

---

### Pitfall 3: RLS on Friendship Table Is Not Symmetric by Default

**What goes wrong:** Writing a SELECT policy as `USING (user_low = current_user_id())` means users can only see friendships where they are `user_low` — half the rows they're entitled to.

**Why it happens:** The single-row pattern requires explicit OR logic for bidirectional access.

**How to avoid:** Every RLS policy on `friendships` must cover both sides:
```sql
USING (
    user_low  = (select civic_spaces.current_user_id())
    OR user_high = (select civic_spaces.current_user_id())
)
```

**Warning signs:** A user sends a friend request (they are user_high) and cannot see it in their "pending sent" list.

---

### Pitfall 4: Follow INSERT Without Tier Check

**What goes wrong:** A Connected user follows another Connected user. The RLS INSERT policy blocks it (target must be in `connected_profiles WHERE tier = 'empowered'`), but the error reaches the user as an unhandled error flash.

**Why it happens:** The UI shows Follow button for all non-self users; only the DB rejects the action.

**How to avoid:** In `UserProfileCard`, conditionally render the Follow button only when `profile.tier === 'empowered'`. Never show a Follow button for `tier === 'connected'` (show Add Friend instead). The RLS is a safety net, not the primary guard.

---

### Pitfall 5: Long-Press on Mobile Is Unreliable Without Explicit Implementation

**What goes wrong:** "Remove friend via long-press" on the Friends button in the profile card doesn't work reliably on mobile because HTML has no native `onLongPress` event.

**Why it happens:** Mobile browsers fire `touchstart` → `touchend` for taps. Long-press requires a timer on `touchstart`, cancelled if `touchend` fires before ~500ms.

**How to avoid:** Use the overflow menu (···) approach instead of or in addition to long-press. The overflow menu is the reliable path. Long-press can be layered as an enhancement with a `useLongPress` hook:
```typescript
function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  return {
    onTouchStart: () => { timerRef.current = setTimeout(callback, ms) },
    onTouchEnd: () => clearTimeout(timerRef.current),
    onMouseDown: () => { timerRef.current = setTimeout(callback, ms) },
    onMouseUp: () => clearTimeout(timerRef.current),
  }
}
```

---

### Pitfall 6: Member Directory Slice Filter vs Cross-Slice Toggle

**What goes wrong:** The "expand beyond your slice" toggle fetches all `connected_profiles` platform-wide without a slice filter. On a large platform this is unbounded. Even at alpha scale (small), the query should have a LIMIT.

**Why it happens:** Cross-slice search has no natural partition — it's the entire `connected_profiles` table.

**How to avoid:** Always apply `.limit(50)` to member search queries. The two-query approach for same-slice search (fetch `slice_members.user_id` first, then filter profiles by `IN`) is necessary because there is no FK from `connected_profiles` to `slice_members` — PostgREST cannot join across schemas without an FK. The cross-slice version skips the slice filter but keeps the LIMIT and requires `term.length >= 2` before firing.

---

### Pitfall 7: Realtime on friendships Table Not Configured

**What goes wrong:** A user accepts a friend request but the sender's profile card still shows "Pending" because TanStack Query hasn't refetched.

**Why it happens:** Friend request acceptance is an UPDATE to a row the sender can SELECT — but without Realtime or explicit invalidation, the sender's cache is stale.

**How to avoid:** Phase 3 does NOT introduce Realtime for friendships (Phase 4 handles notification bells). Instead, use a reasonable `staleTime` for relationship queries (5 minutes) and rely on:
1. Manual invalidation when the current user takes an action
2. The user re-opening the profile card (triggers a fresh query if stale)

This is acceptable for alpha. Document this as a known limitation. Do NOT add Realtime to friendships table in Phase 3.

---

## Code Examples

### Friendship Lookup (SQL)

```sql
-- Does a friendship exist between user A and user B?
-- user_low = LEAST(A, B), user_high = GREATEST(A, B) (text comparison)
SELECT status
FROM civic_spaces.friendships
WHERE user_low  = LEAST('user-a-id', 'user-b-id')
  AND user_high = GREATEST('user-a-id', 'user-b-id');
```

### Fetch Incoming Pending Requests (Client)

```typescript
// Incoming = requests where current user is the RECIPIENT
async function fetchPendingRequests(userId: string) {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_low, user_high, status, created_at')
    .or(`user_low.eq.${userId},user_high.eq.${userId}`)
    .in('status', ['REQ_LOW', 'REQ_HIGH'])
  if (error) throw error

  // Filter to only requests where current user is the recipient
  return (data ?? []).filter(row => {
    if (row.user_low === userId && row.status === 'REQ_HIGH') return true   // I am user_low; user_high sent request
    if (row.user_high === userId && row.status === 'REQ_LOW') return true  // I am user_high; user_low sent request
    return false
  })
}
```

### Calling the Boosted Feed RPC

```typescript
// src/hooks/useBoostedFeed.ts
interface BoostedCursor { boosted_at: string; id: string }

export function useBoostedFeed(sliceId: string | null) {
  return useInfiniteQuery<PostWithAuthor[], Error, { pages: PostWithAuthor[][] }, string[], BoostedCursor | undefined>({
    queryKey: ['boosted-feed', sliceId ?? ''],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, unknown> = { p_slice_id: sliceId, p_limit: 20 }
      if (pageParam) {
        params.p_cursor_at = pageParam.boosted_at
        params.p_cursor_id = pageParam.id
      }

      const { data: posts, error: postsError } = await supabase
        .rpc('get_boosted_feed', params)
      if (postsError) throw postsError
      if (!posts || posts.length === 0) return []

      // Two-query pattern for author profiles (same as Phase 2)
      const userIds = [...new Set(posts.map((p: any) => p.user_id))]
      const { data: profiles } = await supabase
        .from('connected_profiles')
        .select('user_id, display_name, avatar_url, tier')
        .in('user_id', userIds)

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? [])
      return posts.map((post: any) => ({
        ...post,
        author: profileMap.get(post.user_id) ?? { display_name: 'Unknown', avatar_url: null, tier: 'connected' },
      })) as PostWithAuthor[]
    },
    getNextPageParam: (lastPage): BoostedCursor | undefined => {
      if (lastPage.length < 20) return undefined
      const last = lastPage[lastPage.length - 1] as any
      return { boosted_at: last.boosted_at, id: last.id }
    },
    initialPageParam: undefined,
    enabled: !!sliceId,
  })
}
```

### Profile Card Trigger in PostCard

```tsx
// Tap avatar or display name → open profile card bottom sheet
// Add to PostCard.tsx alongside existing click handler for thread navigation

const [profileCardUserId, setProfileCardUserId] = useState<string | null>(null)

// In the avatar/name row — stop propagation so it doesn't also open the thread:
<button
  onClick={(e) => { e.stopPropagation(); setProfileCardUserId(post.user_id) }}
  className="flex items-center gap-3 text-left"
>
  {/* avatar */}
  {/* display name + Empowered badge */}
</button>

<UserProfileCard
  isOpen={!!profileCardUserId}
  onClose={() => setProfileCardUserId(null)}
  userId={profileCardUserId ?? ''}
/>
```

### Member Directory (Slice-Scoped, Same-Slice Default)

```typescript
// src/hooks/useMemberDirectory.ts
export function useMemberDirectory(sliceId: string, crossSlice: boolean) {
  return useQuery({
    queryKey: ['member-directory', sliceId, crossSlice],
    queryFn: async () => {
      if (!crossSlice) {
        // Two-query pattern: get slice member IDs, then fetch profiles
        const { data: members } = await supabase
          .from('slice_members')
          .select('user_id')
          .eq('slice_id', sliceId)
        const ids = members?.map(m => m.user_id) ?? []
        if (ids.length === 0) return []

        const { data, error } = await supabase
          .from('connected_profiles')
          .select('user_id, display_name, avatar_url, tier')
          .in('user_id', ids)
          .order('display_name')
          .limit(200)  // Slices capped at 6k but directory shows first 200 alphabetically
        if (error) throw error
        return data ?? []
      } else {
        const { data, error } = await supabase
          .from('connected_profiles')
          .select('user_id, display_name, avatar_url, tier')
          .order('display_name')
          .limit(200)
        if (error) throw error
        return data ?? []
      }
    },
    staleTime: 1000 * 60 * 5,
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact on Phase 3 |
|--------------|------------------|-------------------|
| Two-row bidirectional friendship pattern | Single-row with user_low/user_high + status | Use single-row — better RLS, better queries |
| `auth.uid()` in RLS | `(select civic_spaces.current_user_id())` | Already established in Phase 1/2; continue using |
| `textSearch` (tsvector) for name search | `ilike` + `pg_trgm` GIN index for partial name matching | ilike is correct for pseudonym search; tsvector is for prose |
| Full-page navigation for profile | Bottom sheet compound component (`react-modal-sheet`) | Already installed; use it |
| Algorithmic feed replacement | Additive recency boost (invisible, no toggle) | Implement as SQL INTERVAL arithmetic in RPC |

**Deprecated/outdated for this phase:**
- `auth.uid()`: Never use in this codebase (Phase 1 constraint)
- Offset pagination: Already replaced by cursor in Phase 2; boosted feed uses boosted cursor

---

## Open Questions

1. **Empowered tier: is it seeded in Phase 3 or a later phase?**
   - What we know: Phase 3 requires the UI to display Empowered badges and Follow buttons. The `tier` column must accept `'empowered'` values.
   - What's unclear: Who assigns users the Empowered tier? Is there an admin API or is it set manually in the DB for testing?
   - Recommendation: Phase 3 should include a migration that adds `'empowered'` to the tier CHECK constraint and seeds at least one test Empowered account. The assignment mechanism is out of scope for Phase 3.

2. **Empowered account visibility: can a user follow an Empowered account in a different slice?**
   - What we know: The CONTEXT.md says "follow Empowered civic leaders without reciprocation" and doesn't restrict to same-slice. The follows RLS policy does not filter by slice.
   - What's unclear: Should Empowered accounts be discoverable via the cross-slice search toggle? Are they visible in the directory?
   - Recommendation: Empowered accounts are visible in all contexts (directory, search, feed, profile card). The Follow button appears on their profile card regardless of which slice they're in. This is consistent with the "civic leader" framing.

3. **Feed boost magnitude: +2 hours vs +4 hours?**
   - What we know: The requirement says "modest bump — a very recent stranger's post still surfaces above an older friend post." +2 hours means a friend's 3-hour-old post ties a stranger's 1-hour-old post.
   - What's unclear: What feels right in practice. This can only be validated by testing with real data.
   - Recommendation: Start with `INTERVAL '2 hours'`. Expose it as a named constant in the migration (via a Postgres setting or a config table row) so it can be changed without a code deploy.

4. **Friends list tab: where does it live in the AppShell?**
   - What we know: AppShell has a tab bar (`SliceTabBar`) with Federal active. The CONTEXT.md mentions "friends list tab."
   - What's unclear: Is the friends list a new tab in `SliceTabBar`, a nav item in the header, or a separate page?
   - Recommendation: Add a "Friends" tab to `SliceTabBar`. It doesn't show a feed — it shows the friends list with a pending-section at top. This avoids new routing complexity.

---

## Sources

### Primary (HIGH confidence)
- Supabase official docs — `/docs/guides/database/postgres/row-level-security` — RLS performance patterns, `(select auth.uid())` wrapping, security definer functions, 94.97% benchmark improvement
- PostgreSQL official docs — `pgtrgm.html` — GIN trigram index for ilike, index auto-selection by query planner
- Phase 2 research + confirmed schema — established patterns for two-query cross-FK, composite cursor, civic_spaces.current_user_id(), soft-delete

### Secondary (MEDIUM confidence)
- coderbased.com — "User Friends System & Database Design" — single-row normalized friendship pattern with user_low/user_high + status column; consistent with PostgreSQL mailing list discussion
- npmjs.com / GitHub — react-modal-sheet v5.2.1 — compound component API, Sheet.Container/Header/Content/Backdrop, snapPoints in ascending order
- medium.com (Nik Gospodinov) — "Instagram-like profile search with Supabase" — pg_trgm + `.rpc()` pattern; GIN index, similarity function usage
- supabase.com/docs/reference/javascript/ilike — ilike filter API, `%term%` wildcard pattern; community discussion on multi-column with `.or()`

### Tertiary (LOW confidence)
- d4b.dev — hot score feed ranking — general additive INTERVAL boost pattern derived from time-decay formulas; not a canonical Supabase reference
- WebSearch — feed boost INTERVAL arithmetic pattern — derived from PostgreSQL fundamentals + community discussions; no single authoritative source for the exact pattern in Supabase context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 2 libraries confirmed installed; pg_trgm is built-in Postgres extension
- Friendship schema: MEDIUM-HIGH — single-row pattern is well-established community consensus, not a Supabase-specific doc
- RLS patterns: HIGH — verified from Supabase official RLS performance docs with benchmark numbers
- Feed boost: MEDIUM — derived from PostgreSQL fundamentals; the INTERVAL arithmetic is sound but the specific pattern in a Supabase RPC context is not documented in an authoritative source
- Search (pg_trgm + ilike): HIGH — PostgreSQL official docs + Supabase community confirm the pattern
- react-modal-sheet API: HIGH — confirmed from GitHub README, v5.2.1 current

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (react-modal-sheet and TanStack Query are stable; pg_trgm is a Postgres built-in)
