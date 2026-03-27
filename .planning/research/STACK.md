# Stack Research: Civic Spaces

## Confirmed Stack (pre-decided)

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React + Tailwind | Components as `.tsx`, Framer-compatible |
| Backend | Express + TypeScript | Deployed on Render |
| Database | Supabase | PostgreSQL + RLS enabled |
| Auth | `accounts.empowered.vote` API | External — Bearer token pattern, no Supabase Auth |
| Cache | Upstash Redis | With in-memory fallback |

**These are not up for re-evaluation.** All other recommendations below work within these constraints.

---

## Feed & Pagination

### Recommendation: Cursor-based pagination over offset-based

**Use cursor pagination everywhere in feeds.** Supabase's `.range()` (OFFSET/LIMIT) degrades badly at scale and causes duplicate/missing items in live feeds when new posts arrive mid-scroll. Cursor pagination using `created_at` or a composite `(created_at, id)` cursor avoids both problems.

**Pattern for a descending-time feed:**

```typescript
// First page
const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('slice_id', sliceId)
  .order('created_at', { ascending: false })
  .limit(20);

// Subsequent pages — pass last item's created_at as cursor
const { data: nextPage } = await supabase
  .from('posts')
  .select('*')
  .eq('slice_id', sliceId)
  .lt('created_at', lastCreatedAt)
  .order('created_at', { ascending: false })
  .limit(20);
```

**Index requirement:** Index must exist on `(slice_id, created_at DESC)` — not just `created_at`. Without the composite index, Supabase will perform a full table scan before filtering.

For ranked feeds (hot score), cursor on a `(hot_score DESC, id)` composite avoids ties causing items to skip pages.

### Real-time: Hybrid approach (subscriptions + polling fallback)

**Do not use Supabase Realtime subscriptions as the sole data delivery mechanism.** Production case studies show subscriptions can silently drop events under load, and WebSocket connections have per-project concurrency limits on free/pro plans. The right pattern for a civic forum:

- **New post notifications:** Supabase Realtime `postgres_changes` subscription on `posts` table filtered by `slice_id`. Use the event to *invalidate* the TanStack Query cache — do not use the payload as the source of truth.
- **Polling fallback:** If WebSocket connection drops, fall back to polling at 15–30s intervals. The in-memory cache (already in stack) absorbs the polling load.
- **Chat/comment threads:** For high-activity threads, use a 10s polling interval rather than per-row subscriptions. Supabase charges per concurrent connection; a forum with 100 active users in 10 threads would exhaust connection limits quickly with naive per-thread subscriptions.

**Confidence:** High — validated against Supabase's own pricing docs and production reports from browser extension teams.

### Pagination library integration

Pair Supabase cursor queries with TanStack Query `useInfiniteQuery`:

```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['feed', sliceId],
  queryFn: ({ pageParam }) => fetchPosts(sliceId, pageParam),
  getNextPageParam: (lastPage) =>
    lastPage.length === 20 ? lastPage[lastPage.length - 1].created_at : undefined,
  initialPageParam: undefined,
});
```

---

## React UI Libraries

### Virtualized List: React Virtuoso `^4.x`

**Recommendation: React Virtuoso** over TanStack Virtual for this project.

| Library | Version | Verdict |
|---------|---------|---------|
| **React Virtuoso** | `4.x` | **Use this** — purpose-built for feeds and chat |
| TanStack Virtual | `3.x` | Better for tables/grids, painful for bidirectional scroll |
| react-virtualized | `9.x` | Deprecated-adjacent; no active development |
| react-window | `1.x` | No dynamic item heights; unsuitable for posts with variable content |

React Virtuoso handles the hard cases that matter for Civic Spaces: variable-height posts, reverse scroll for comment threads (oldest-at-top), prepending older items without scroll-jump, and an `endReached` callback that integrates cleanly with `useInfiniteQuery`. TanStack Virtual's GitHub discussions explicitly flag bidirectional infinite scroll as unsolved without UX side effects.

```tsx
import { Virtuoso } from 'react-virtuoso';

<Virtuoso
  data={flatPosts}
  endReached={fetchNextPage}
  itemContent={(index, post) => <PostCard post={post} />}
  overscan={200}
/>
```

### Data Fetching / State: TanStack Query v5 `^5.x`

Already the de facto standard. Use it for:
- All feed data (`useInfiniteQuery`)
- Unread counts (`useQuery` with `staleTime: 30_000`)
- Optimistic updates on upvotes and replies

**Optimistic upvote pattern (TanStack Query v5):**

```typescript
const mutation = useMutation({
  mutationFn: upvotePost,
  onMutate: async (postId) => {
    await queryClient.cancelQueries({ queryKey: ['feed', sliceId] });
    const snapshot = queryClient.getQueryData(['feed', sliceId]);
    queryClient.setQueryData(['feed', sliceId], (old) => optimisticallyUpvote(old, postId));
    return { snapshot };
  },
  onError: (_err, _postId, ctx) => {
    queryClient.setQueryData(['feed', sliceId], ctx.snapshot);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['feed', sliceId] }),
});
```

### Toast Notifications: Sonner `^1.x`

**Recommendation: Sonner** (20.5M weekly downloads, zero dependencies, 2–3KB compressed, native shadcn/ui integration, TypeScript-first). Do not use react-hot-toast (lower adoption, no shadcn alignment) or react-toastify (bloated, poor DX).

```tsx
import { Toaster, toast } from 'sonner';

// In app root
<Toaster position="bottom-right" richColors />

// Anywhere
toast.success('Reply posted');
toast.promise(submitPost(), { loading: 'Posting...', success: 'Posted!', error: 'Failed' });
```

### Form Handling: React Hook Form `^7.x` + Zod `^3.x`

Standard for 2025 React. RHF with Zod resolvers for post composition, comment forms, and slice join flows. No alternatives needed.

---

## Real-time / Presence

### Online Member Presence: Supabase Realtime Presence

Supabase's Presence feature uses CRDT-based state synchronization over WebSocket channels. Each connected client publishes a small payload; all clients receive `sync`, `join`, and `leave` events.

**Pattern for "who's online in this Slice":**

```typescript
const channel = supabase.channel(`slice:${sliceId}`, {
  config: { presence: { key: userId } },
});

channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    setOnlineCount(Object.keys(state).length);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user_id: userId, joined_at: Date.now() });
    }
  });
```

**Limits to design around:**
- Presence payloads should be minimal (user_id + timestamp only — do not include profile data).
- Do not show an exact "123 online" count if the slice has fewer than ~10 active users — it reveals individual activity patterns. Use bucketed counts ("10+ members active") below a threshold.
- One Presence channel per Slice is the right granularity. Do not create per-thread presence channels.

### Unread Counts: Upstash Redis + DB Counters (hybrid)

Two approaches, pick based on feature scope:

**Approach A — Redis counters (recommended for launch):**
Store `unread:{userId}:{sliceId}` as a Redis integer. Increment on new post (via Express webhook/trigger), reset to 0 on slice visit.

```typescript
// On new post published (Express handler)
await redis.incr(`unread:${memberId}:${sliceId}`);

// On user opens slice
await redis.set(`unread:${userId}:${sliceId}`, 0);

// On client load — batch fetch for sidebar badges
const counts = await redis.mget(sliceKeys.map(id => `unread:${userId}:${id}`));
```

**Approach B — DB `last_read_at` timestamps:**
Store `slice_members.last_read_at` and count posts after that timestamp. More durable across cache flushes; acceptable query cost if indexed on `(slice_id, created_at)`. Use this for the source of truth; use Redis as the fast read layer.

**Recommendation:** Use Approach B (DB) as source of truth, Approach A (Redis) for the fast badge query on page load. Reconcile on significant drift or cache miss.

### Notification Delivery

Do not build a push notification system for launch. For in-app notifications:
- Store `notifications` table in Supabase (type, actor_id, target_id, read_at, created_at).
- Poll for unread count with TanStack Query at `staleTime: 60_000` (1 minute is sufficient for a civic forum — not a chat app).
- Use Supabase Realtime `postgres_changes` on `notifications` WHERE `recipient_id = auth.uid()` to invalidate the count query on new notification (event-driven invalidation, not event-driven data delivery).

---

## Feed Ranking

### The Three Ranking Modes to Support

Civic Spaces needs three sort modes — not one algorithm. Hard-code the mode selector; don't try to merge them into a single personalized feed at launch.

| Mode | Label | Algorithm | When to Use |
|------|-------|-----------|-------------|
| New | "New" | `ORDER BY created_at DESC` | Default for low-activity slices |
| Hot | "Hot" | Hot score (see below) | Default for active slices |
| Top | "Top" | `ORDER BY upvote_count DESC` + time filter | Week/Month/All leaderboards |

### Hot Score Formula (Hacker News variant — recommended)

Store `hot_score` as a computed column updated by a Postgres trigger or periodic cron job (Supabase Edge Function on a schedule). Do not compute it in the query.

```sql
-- hot_score = (upvotes - 1) / (age_hours + 2)^1.5
CREATE OR REPLACE FUNCTION compute_hot_score(upvotes INT, created_at TIMESTAMPTZ)
RETURNS FLOAT AS $$
  SELECT (GREATEST(upvotes - 1, 0)::FLOAT) /
         (POWER(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 + 2, 1.5))
$$ LANGUAGE SQL IMMUTABLE;
```

**Adjustments for a civic context:**

- **Comment weight:** Add `(comment_count * 0.5)` to the numerator. Civic discussion quality is signaled by replies, not just upvotes.
- **Recency floor:** Posts younger than 1 hour should always appear above posts older than 24 hours regardless of score — prevents cold-start suppression.
- **No personalization at launch.** Friends-vs-strangers weighting (à la Facebook EdgeRank) requires a social graph. Civic Spaces has geography-based membership, not a follower graph. Do not build personalized ranking until a follow/connection feature exists.

### Reddit's Approach (context, not a recommendation to copy)

Reddit's hot algorithm uses velocity (upvotes per time unit), with time decay every 12.5 hours equivalent to a 10x vote penalty. As of February 2025, Reddit experiments with replacing "Hot" with "Best" (personalized). For Civic Spaces, personalization is premature — geography IS the personalization signal.

### Discord's Approach (context)

Discord does not rank messages — all channels are purely chronological. This is appropriate for their use case (real-time chat) but wrong for an asynchronous civic forum where older high-quality posts should remain discoverable.

### Discourse's Approach (context)

Discourse uses a "suggested topics" sidebar based on tags, category, and read history. Its main feed is category-scoped chronological. For Civic Spaces, the Slice structure provides natural scoping that is analogous to Discourse categories — useful framing.

---

## Supabase Patterns

### Auth Integration with External JWT

**Critical constraint:** Civic Spaces uses `accounts.empowered.vote` for auth, not Supabase Auth. This means `auth.uid()` will not be populated by default in RLS policies.

**Recommended pattern — Third-Party Auth (Supabase native as of 2024):**

Supabase's Third-Party Auth feature allows Supabase to trust JWTs issued by an external provider. The external JWT must:
- Use asymmetric signing (RS256/ES256) with a public OIDC discovery URL
- Include a `kid` header parameter
- Include `sub` claim as the user identifier

If `accounts.empowered.vote` issues RS256 JWTs with an OIDC discovery endpoint, configure it as a third-party provider and `auth.uid()` will work natively.

**Fallback pattern — Token exchange via Edge Function:**

If the external JWT cannot meet OIDC requirements, use an Edge Function to exchange the external token for a Supabase-signed JWT. The `--no-verify-jwt` flag is required on the exchange endpoint.

```typescript
// Express middleware — exchange on first use, cache result
async function supabaseClient(externalToken: string) {
  const { data } = await supabase.functions.invoke('exchange-token', {
    headers: { Authorization: `Bearer ${externalToken}` },
  });
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.supabase_token}` } },
  });
}
```

**In RLS policies, use `auth.jwt() ->> 'sub'` as the user identifier** regardless of which approach is used.

### RLS Patterns for Slice Membership

**Membership gate — posts table:**

```sql
-- Users can read posts in slices they belong to
CREATE POLICY "slice_members_can_read_posts" ON posts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM slice_members
    WHERE slice_members.slice_id = posts.slice_id
      AND slice_members.user_id = (auth.jwt() ->> 'sub')::uuid
  )
);
```

**Performance:** Index `slice_members(slice_id, user_id)` — this index is required for the EXISTS subquery to be fast. Without it, every post read performs a full `slice_members` scan.

**Wrapping in a security definer function (recommended for complex policies):**

```sql
CREATE OR REPLACE FUNCTION is_slice_member(p_slice_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM slice_members
    WHERE slice_id = p_slice_id
      AND user_id = (auth.jwt() ->> 'sub')::uuid
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Policy becomes cleaner
CREATE POLICY "slice_members_can_read" ON posts
FOR SELECT TO authenticated
USING (is_slice_member(slice_id));
```

The `SECURITY DEFINER STABLE` function is cached per query, so it runs once per statement rather than once per row — significant performance gain on large result sets.

### Efficient Filtered Feed Query

For a feed that spans multiple slices (the "All my Slices" view), avoid N+1 queries:

```sql
-- Single query for all slice feeds a user belongs to
SELECT p.*, sm.slice_id as member_slice
FROM posts p
JOIN slice_members sm ON sm.slice_id = p.slice_id
WHERE sm.user_id = $1
  AND p.created_at < $2  -- cursor
ORDER BY p.hot_score DESC, p.id DESC
LIMIT 20;
```

Expose this as a Supabase RPC function rather than building it in the PostgREST query builder — complex joins with multiple filter conditions are more readable and maintainable as SQL functions.

### Schema Indexing Checklist

| Table | Required Indexes |
|-------|-----------------|
| `posts` | `(slice_id, created_at DESC)`, `(slice_id, hot_score DESC, id DESC)` |
| `slice_members` | `(slice_id, user_id)` UNIQUE, `(user_id)` |
| `notifications` | `(recipient_id, read_at, created_at DESC)` |
| `comments` | `(post_id, created_at ASC)` |

---

## What NOT to Use

### Socket.io
**Do not use.** Supabase Realtime already provides WebSocket infrastructure. Adding Socket.io on top of an Express backend creates a second connection layer, doubles infrastructure cost on Render (stateful server required), and conflicts with Upstash Redis's HTTP-based client model. If raw WebSocket server-push is needed, use Supabase Realtime channels.

### GraphQL / Apollo Client
**Do not use.** Supabase's PostgREST REST API + TanStack Query provides equivalent functionality without the overhead of a GraphQL layer, schema stitching, or resolver maintenance. For Civic Spaces's data patterns (list queries + mutations), REST is simpler. Revisit only if highly complex cross-resource queries become frequent.

### Supabase Auth
**Do not use** (already decided). Adding Supabase Auth alongside `accounts.empowered.vote` would create split identity, requiring user sync across two systems. The external JWT integration is the correct path.

### react-virtualized
**Do not use.** The library is unmaintained (last meaningful release 2019). Use React Virtuoso instead.

### react-window
**Do not use for forum posts.** React Window does not support variable-height items without complex custom configuration. Forum post cards have variable content (images, embeds, long text) making fixed-height virtualization impractical.

### offset-based pagination (`.range()`)
**Do not use for feeds.** Supabase's `.range(from, to)` uses SQL OFFSET which degrades at scale and causes item duplication/skipping in live feeds. Use cursor-based pagination.

### Server-Sent Events (SSE) for notifications
**Do not use at launch.** SSE requires a persistent HTTP connection per client, which conflicts with Render's free-tier instance spinning down. Supabase Realtime channels cover the same use case with better infrastructure.

### next-auth / Better Auth
**Not applicable** — this is a React SPA, not a Next.js app, and auth is external. Do not introduce an auth library that assumes server-side session management.

### TanStack Router
**Defer.** React Router v6/v7 is the safe choice for a Vite + React SPA in 2025. TanStack Router is excellent but adds bundle weight and a steeper learning curve with no clear benefit over React Router for this project's navigation patterns (Slice → Feed → Post → Comments).

---

## Version Summary

| Package | Recommended Version | Confidence |
|---------|-------------------|------------|
| `react` | `^19.x` | High |
| `react-virtuoso` | `^4.x` | High |
| `@tanstack/react-query` | `^5.95.x` | High |
| `sonner` | `^1.x` | High |
| `react-hook-form` | `^7.x` | High |
| `zod` | `^3.x` | High |
| `@supabase/supabase-js` | `^2.x` | High |
| `@upstash/redis` | `^1.x` | High |
| `react-router-dom` | `^6.x` | High |
| `framer-motion` | `^11.x` | Medium (Framer compatibility constraint) |

---

*Researched: 2026-03-27*
