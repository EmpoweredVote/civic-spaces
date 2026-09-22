# Phase 2: Core Forum - Research

**Researched:** 2026-03-27
**Domain:** React UI, TanStack Query, Supabase Realtime, React Hook Form + Zod, bottom sheet/modal patterns
**Confidence:** HIGH (core stack verified), MEDIUM (Realtime + custom schema configuration)

---

## Summary

Phase 2 introduces the entire React frontend from scratch — the current project has no React installed, only `@supabase/supabase-js` and Vite. The work splits across four plans: AppShell + tab routing (02-01), feed + Realtime (02-02), post composer (02-03), and comment threads (02-04).

The standard approach for this domain is React 19 + Tailwind v4 + TanStack Query v5 + React Hook Form v7 + Zod v4. TanStack Query handles all server state (feed pagination, mutations, optimistic updates, cache invalidation); React Hook Form + Zod handles the composer and reply forms. Supabase Realtime via `postgres_changes` channel drives cache invalidation for new posts — not live streaming.

**One critical schema gap found:** The live `connected_profiles` migration is missing `avatar_url` and `tier` columns that the UI requires (PostCard author avatar, Inform-tier gating). A migration must be added in Phase 2 before the UI is built. Also, `posts` is missing an `edit_history` column (required for FEED-08 internal edit history retention). These gaps must be resolved in 02-01 as a prerequisite migration task.

**Primary recommendation:** Install React 19 + Tailwind v4 + TanStack Query v5 + React Hook Form v7 + Zod v4 in 02-01. Use TanStack Query `useInfiniteQuery` for cursor-paginated feed, `useMutation` with cache-invalidation for writes, and `useOptimistic` only for the specific optimistic post appearance. Supabase Realtime triggers `queryClient.invalidateQueries` — it does not stream post data directly into the feed state.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.0.0 | UI framework | Required; no React installed yet |
| react-dom | ^19.0.0 | DOM renderer | Required with React |
| @types/react | ^19.0.0 | TypeScript types | Required for TSX |
| @types/react-dom | ^19.0.0 | TypeScript types | Required for TSX |
| tailwindcss | ^4.0.0 | Utility CSS | Already in tech stack; v4 is current |
| @tailwindcss/vite | ^4.0.0 | Vite plugin for Tailwind v4 | First-party Vite integration, better perf than PostCSS |
| @tanstack/react-query | ^5.0.0 | Server state management | Cursor pagination, optimistic updates, cache invalidation |
| react-hook-form | ^7.0.0 | Form state management | Standard for React forms; minimal re-renders |
| zod | ^4.0.0 | Schema validation | Current major version; @hookform/resolvers supports v4 |
| @hookform/resolvers | ^5.0.0 | Connects Zod to RHF | Official bridge; v5+ supports Zod v4 |
| date-fns | ^4.0.0 | Relative timestamps | `formatDistanceToNow` for "2 hours ago" display |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-loading-skeleton | ^3.0.0 | Skeleton loading states | Feed cards and thread view while loading |
| react-modal-sheet | ^3.0.0 | Bottom sheet for post composer | Mobile-friendly FAB → sheet UX; requires `motion` |
| motion | ^11.0.0 | Animation (peer dep) | Required by react-modal-sheet |
| @tanstack/react-query-devtools | ^5.0.0 | Debug queries in dev | Dev-only; not shipped to prod |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query | React 19 `useOptimistic` + SWR | TanStack Query has useInfiniteQuery, multi-level cache invalidation, and devtools — essential for cursor pagination + realtime invalidation |
| react-modal-sheet | Custom bottom sheet | react-modal-sheet has built-in keyboard avoidance via Virtual Keyboard API and Virtual Viewport API fallback; custom hand-rolling is error-prone on mobile |
| date-fns | dayjs | date-fns is modular (tree-shakeable), TypeScript-first, no global state |
| react-loading-skeleton | CSS shimmer divs | react-loading-skeleton auto-sizes to content dimensions; CSS divs require manual sizing per component |

### Installation

```bash
# React + TypeScript types
npm install react@^19 react-dom@^19
npm install -D @types/react@^19 @types/react-dom@^19

# Tailwind v4 with Vite plugin
npm install tailwindcss @tailwindcss/vite

# Server state + forms + validation
npm install @tanstack/react-query react-hook-form zod @hookform/resolvers

# Utilities
npm install date-fns react-loading-skeleton react-modal-sheet motion

# Dev tools
npm install -D @tanstack/react-query-devtools
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── supabase.ts          # Already exists — Supabase client
│   └── queryClient.ts       # TanStack QueryClient singleton
├── hooks/
│   ├── useAuth.ts           # cs_token + decoded user claims
│   ├── useFederalSlice.ts   # Fetches user's federal slice_id from slice_members
│   └── useProfile.ts        # Connected profile (tier, is_suspended, display_name)
├── components/
│   ├── AppShell.tsx         # Root layout: SliceTabBar + outlet
│   ├── SliceTabBar.tsx      # Five tabs, Federal active, others dimmed
│   ├── FeedPanel/
│   │   ├── SliceFeedPanel.tsx   # useInfiniteQuery feed container
│   │   ├── PostCard.tsx         # Truncated preview card
│   │   └── FeedSkeleton.tsx     # Loading skeleton (react-loading-skeleton)
│   ├── Composer/
│   │   ├── PostComposerFAB.tsx  # Fixed FAB button
│   │   └── PostComposerSheet.tsx # react-modal-sheet with form
│   └── Thread/
│       ├── ThreadView.tsx       # Full post + replies
│       ├── ReplyItem.tsx        # Single reply with indent
│       └── InlineReplyComposer.tsx
├── pages/
│   ├── HubPage.tsx          # Tab routing host
│   └── ThreadPage.tsx       # Thread view (or modal)
└── main.tsx                 # QueryClientProvider, React root
```

### Pattern 1: TanStack Query Setup

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes — feeds stay fresh until Realtime invalidates
      retry: 2,
    },
  },
})

// src/main.tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

### Pattern 2: Cursor-Paginated Feed (useInfiniteQuery)

The feed cursor is `created_at` + `id` (composite) to avoid gaps when two posts share the same timestamp.

```typescript
// Source: Supabase cursor pagination discussion + TanStack Query v5 docs
interface FeedPage {
  posts: Post[]
  nextCursor: { created_at: string; id: string } | null
}

function useSliceFeed(sliceId: string) {
  return useInfiniteQuery<FeedPage>({
    queryKey: ['feed', sliceId],
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .schema('civic_spaces')
        .from('posts')
        .select('id, title, body, created_at, updated_at, user_id, slice_id')
        .eq('slice_id', sliceId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })  // tiebreaker
        .limit(20)

      if (pageParam) {
        const cursor = pageParam as { created_at: string; id: string }
        // Posts strictly older than the cursor
        query = query.or(
          `created_at.lt.${cursor.created_at},` +
          `and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        )
      }

      const { data, error } = await query
      if (error) throw error

      const nextCursor =
        data && data.length === 20
          ? { created_at: data[data.length - 1].created_at, id: data[data.length - 1].id }
          : null

      return { posts: data ?? [], nextCursor }
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
```

### Pattern 3: Supabase Realtime Cache Invalidation

Use Realtime to detect new posts, then call `invalidateQueries` — do NOT try to merge raw realtime payloads into the TanStack Query cache manually.

```typescript
// Source: Supabase Realtime docs (postgres_changes)
useEffect(() => {
  const channel = supabase
    .channel(`feed:${sliceId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'civic_spaces',
        table: 'posts',
        filter: `slice_id=eq.${sliceId}`,
      },
      () => {
        // Invalidate so user sees a "new posts" prompt or auto-refresh
        queryClient.invalidateQueries({ queryKey: ['feed', sliceId] })
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [sliceId])
```

**Critical:** The `civic_spaces` schema (not `public`) requires:
1. `GRANT SELECT ON civic_spaces.posts TO authenticated` (already in migrations)
2. The table must be added to `supabase_realtime` publication: `ALTER PUBLICATION supabase_realtime ADD TABLE civic_spaces.posts;`
3. This publication step is NOT in current migrations — it must be added in Phase 2.

### Pattern 4: Optimistic Post Submission

```typescript
// Source: TanStack Query v5 optimistic updates docs
function useCreatePost(sliceId: string) {
  return useMutation({
    mutationFn: async (body: { title?: string; body: string }) => {
      const { data, error } = await supabase
        .schema('civic_spaces')
        .from('posts')
        .insert({ ...body, slice_id: sliceId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (newPost) => {
      await queryClient.cancelQueries({ queryKey: ['feed', sliceId] })
      const snapshot = queryClient.getQueryData(['feed', sliceId])
      queryClient.setQueryData(['feed', sliceId], (old: any) => ({
        ...old,
        pages: [
          {
            posts: [{ id: 'optimistic-' + Date.now(), ...newPost, created_at: new Date().toISOString() }, ...(old?.pages?.[0]?.posts ?? [])],
            nextCursor: old?.pages?.[0]?.nextCursor ?? null,
          },
          ...(old?.pages?.slice(1) ?? []),
        ],
      }))
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['feed', sliceId], context.snapshot)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', sliceId] })
    },
  })
}
```

### Pattern 5: React Hook Form + Zod v4 Composer

```typescript
// Source: @hookform/resolvers v5 docs; Zod v4 release notes
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const postSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1, 'Post cannot be empty').max(10000),
})

type PostFormValues = z.infer<typeof postSchema>

function PostComposerForm({ onSubmit }: { onSubmit: (v: PostFormValues) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <textarea {...register('body')} />
      {errors.body && <span>{errors.body.message}</span>}
      <button type="submit" disabled={isSubmitting}>Post</button>
    </form>
  )
}
```

**Note on Zod v4 breaking changes:** `z.object().strict()` is replaced by `z.strictObject()`. Error customization uses `error:` parameter instead of `message:`. The `@hookform/resolvers` v5+ handles Zod v3 and v4 schemas automatically via runtime detection.

### Pattern 6: Tailwind v4 Configuration (Vite)

No `tailwind.config.js`. Configuration lives in CSS.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  /* Custom tokens — civicspaces palette */
  --color-civic-blue: oklch(0.55 0.18 240);
  --color-civic-muted: oklch(0.85 0.02 240);
}
```

### Pattern 7: Tab Scroll State Preservation (HUB-02)

Each tab's scroll container needs its own ref. Store scroll positions in a `Map<string, number>` ref, save on scroll, restore on tab switch.

```typescript
const scrollPositions = useRef<Map<string, number>>(new Map())
const containerRef = useRef<HTMLDivElement>(null)

// On tab leave — save
scrollPositions.current.set(activeTab, containerRef.current?.scrollTop ?? 0)

// On tab enter — restore
useLayoutEffect(() => {
  if (containerRef.current) {
    containerRef.current.scrollTop = scrollPositions.current.get(activeTab) ?? 0
  }
}, [activeTab])
```

Use `useLayoutEffect` (not `useEffect`) to restore before paint — prevents visible scroll jump.

### Pattern 8: FAB Safe Area Positioning

```css
/* Avoids mobile nav bar using env() safe-area-inset */
.fab {
  position: fixed;
  inset-inline-end: 1.5rem;
  inset-block-end: max(1.5rem, env(safe-area-inset-bottom, 0px) + 1rem);
  z-index: 50;
}
```

This uses the CSS `env(safe-area-inset-bottom)` for iPhone home indicator and Android nav bar avoidance. The `inset-block-end` property is logical and respects RTL layouts.

### Anti-Patterns to Avoid

- **Merging Realtime payloads into TanStack Query cache:** Realtime gives you partial payloads; merge logic breaks on edges (deleted posts, RLS-filtered data). Invalidate, don't merge.
- **Using `auth.uid()` in RLS or client code:** Phase 1 established that external JWTs don't populate `auth.uid()`. Always use `civic_spaces.current_user_id()` on the DB side and decode the JWT `sub` claim on the client.
- **Querying `from('posts')` without `.schema('civic_spaces')`:** The client is not configured with a default schema — every query must use `.schema('civic_spaces')` or the client must be initialized with `db: { schema: 'civic_spaces' }`. Recommend setting it at client init.
- **Hard-deleting posts/replies:** Phase 1 established soft-delete only. Always UPDATE `is_deleted = true`; never DELETE rows.
- **Displaying `legal_name` or email:** Only `display_name` from `connected_profiles` is shown. Constraint from project rules.
- **Offset pagination for the feed:** Offset pagination breaks with real-time inserts (items shift, duplicates appear). Use cursor pagination exclusively.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation + submission | Custom form state + validation logic | React Hook Form + Zod | RHF handles focus management, error display, async submission, and prevents double-submit; Zod handles type inference + runtime validation together |
| Mobile bottom sheet | CSS drawer + gesture listeners | react-modal-sheet | Keyboard avoidance (Virtual Keyboard API), smooth gesture physics, snap points — extremely hard to get right across iOS/Android browsers |
| Relative timestamps | `Date.now()` arithmetic | date-fns `formatDistanceToNow` | Handles edge cases: DST, timezones, plural forms, < 1 minute |
| Loading skeletons | CSS shimmer classes | react-loading-skeleton | Auto-sizes to component layout; shimmer animation built-in |
| Cursor pagination | Manual `offset` counter | TanStack `useInfiniteQuery` with cursor | Handles page deduplication, loading states, background refetch, retry on error |
| Optimistic updates + rollback | `useState` + try/catch | TanStack `useMutation` onMutate/onError | Handles concurrent mutations, multiple observers, automatic rollback |

**Key insight:** This phase's complexity lives in state synchronization (optimistic updates + realtime + pagination) and mobile UX (keyboard avoidance + scroll restoration). Both domains have sharp edges that existing libraries solve correctly. Custom solutions are likely to ship subtly broken on mobile Safari.

---

## Common Pitfalls

### Pitfall 1: Missing Realtime Publication for civic_spaces Schema

**What goes wrong:** Supabase Realtime's `postgres_changes` feature only tracks tables added to the `supabase_realtime` publication. Tables in the `civic_spaces` schema are NOT included by default — the publication defaults to the `public` schema.

**Why it happens:** Developers assume Realtime tracks all tables, but it only tracks tables explicitly added to the publication.

**How to avoid:** Add a migration task in 02-02 (or earlier): `ALTER PUBLICATION supabase_realtime ADD TABLE civic_spaces.posts;`

**Warning signs:** Channel subscribes successfully but no events fire. Check `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`

---

### Pitfall 2: Schema Gap — connected_profiles Missing avatar_url, tier, is_suspended

**What goes wrong:** The Phase 1 schema has `connected_profiles(user_id, display_name, account_standing, created_at, updated_at)`. The additional_context for Phase 2 references `avatar_url`, `tier`, and `is_suspended`. These columns do not exist.

**Why it happens:** Phase 1 built the minimum schema; Phase 2 requires UI-specific columns.

**How to avoid:** 02-01 must include a schema migration task:
```sql
ALTER TABLE civic_spaces.connected_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'connected'
    CHECK (tier IN ('connected', 'inform')),
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
-- Keep account_standing for internal use; is_suspended is the UI-visible flag
```
The existing `account_standing` column uses `'active'/'suspended'` — `is_suspended` can be a generated column or kept in sync. Recommend adding `is_suspended` as a computed view or adding it as a separate column maintained by a trigger.

---

### Pitfall 3: Schema Gap — posts Missing edit_history Column

**What goes wrong:** FEED-08 requires edit history retained internally for moderation. The Phase 1 `posts` schema has no `edit_history` column.

**Why it happens:** Phase 1 additional_context referenced it, but the migration DDL did not include it.

**How to avoid:** 02-01 migration must add:
```sql
ALTER TABLE civic_spaces.posts
  ADD COLUMN IF NOT EXISTS edit_history jsonb NOT NULL DEFAULT '[]'::jsonb;
```
On UPDATE, a trigger appends the previous body/title/updated_at to this JSONB array. Phase 2 plan 02-03 must include this trigger.

---

### Pitfall 4: Zod v4 Breaking Changes from v3

**What goes wrong:** Zod v3 code fails silently or throws at runtime with Zod v4.

**Why it happens:** v4 renamed error customization APIs and object strictness methods.

**How to avoid:**
- Use `z.strictObject()` instead of `z.object().strict()`
- Use `error:` parameter instead of `message:` for custom error messages
- `@hookform/resolvers` v5+ handles both v3 and v4 schemas — just import `z` from `'zod'`

---

### Pitfall 5: Tailwind v4 — No tailwind.config.js

**What goes wrong:** Developer creates `tailwind.config.js` expecting it to work. v4 ignores it.

**Why it happens:** v4 moved all configuration to CSS `@theme` directives.

**How to avoid:** Define custom colors/spacing in `@theme` block in the main CSS file. Content detection is automatic — no `content` array needed.

---

### Pitfall 6: RLS Blocks Realtime for Custom Schema

**What goes wrong:** Even with Realtime publication configured, change events may not fire for authenticated users if RLS is not satisfied.

**Why it happens:** Every Realtime change event runs an RLS check: "can this user SELECT this row?" The `posts_select_slice_member` policy requires the user to be a slice member. If the user's `slice_members` row is not yet committed when the Realtime check runs, the event is silently dropped.

**How to avoid:** The policy is correctly written. The concern is timing — ensure slice assignment completes before the user reaches the feed. This is enforced by Phase 1's slice assignment flow.

---

### Pitfall 7: Composite Cursor Required for Feed Pagination

**What goes wrong:** Using only `created_at` as the cursor skips posts when two posts share the same timestamp (common in tests, possible in production).

**Why it happens:** Single-column cursor on a non-unique column produces ambiguous pagination boundaries.

**How to avoid:** Use composite cursor `(created_at, id)` with a compound filter. The Supabase `.or()` filter handles this:
```typescript
query.or(
  `created_at.lt.${cursor.created_at},` +
  `and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
)
```
The existing index `idx_posts_slice_created ON civic_spaces.posts (slice_id, created_at DESC)` supports this. The `id` comparison uses the primary key (already indexed).

---

### Pitfall 8: Edit Window Enforcement Must Be Server-Side Too

**What goes wrong:** The 1-hour edit window is enforced only on the client (disabling the edit button after 1 hour). A user sends a direct PATCH request after the window.

**Why it happens:** Client-only enforcement is not real enforcement.

**How to avoid:** The RLS `posts_update_own` policy currently only checks `user_id = current_user_id() AND is_deleted = false` — it does not check the edit window. A DB function or trigger must enforce the 1-hour window. Add in 02-03:

```sql
CREATE OR REPLACE FUNCTION civic_spaces.enforce_edit_window()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.created_at < now() - INTERVAL '1 hour' THEN
    RAISE EXCEPTION 'Edit window has expired';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_edit_window
  BEFORE UPDATE ON civic_spaces.posts
  FOR EACH ROW
  EXECUTE FUNCTION civic_spaces.enforce_edit_window();
```

---

## Code Examples

### Supabase Client with civic_spaces Default Schema

```typescript
// src/lib/supabase.ts — update in 02-01
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    accessToken: async () => localStorage.getItem('cs_token') ?? '',
    db: { schema: 'civic_spaces' },  // ADD THIS
  }
)
```

With this, all queries can use `.from('posts')` directly without `.schema('civic_spaces')` on each call. Realtime subscriptions still need `.schema('civic_spaces')` in the channel filter explicitly.

### PostCard Text Truncation (Tailwind v4)

```tsx
// line-clamp-3 = 3 lines, built into Tailwind v3+ (no plugin needed in v4)
<p className="line-clamp-3 text-sm text-gray-700">{post.body}</p>
```

For 3 lines of preview: `line-clamp-3`. For 4 lines: `line-clamp-4`. Both work natively in Tailwind v4 without plugins.

### Relative Timestamp

```typescript
import { formatDistanceToNow } from 'date-fns'

function RelativeTime({ date }: { date: string }) {
  return (
    <time dateTime={date} title={new Date(date).toLocaleString()}>
      {formatDistanceToNow(new Date(date), { addSuffix: true })}
    </time>
  )
}
// Outputs: "2 hours ago", "less than a minute ago", "3 days ago"
```

### Tier Gate (Inform-tier write block)

```typescript
function useCurrentUser() {
  // Decode cs_token (JWT) to get sub, then fetch profile
  const userId = useMemo(() => {
    const token = localStorage.getItem('cs_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub as string
  }, [])

  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('connected_profiles')
        .select('display_name, avatar_url, tier, is_suspended')
        .eq('user_id', userId)
        .single()
      return data
    },
    enabled: !!userId,
  })
}

// In composer: block write if tier === 'inform' or is_suspended === true
const { data: profile } = useCurrentUser()
const canWrite = profile?.tier === 'connected' && !profile?.is_suspended
```

### Tombstone Placeholder for Deleted Posts

```tsx
function PostCard({ post }: { post: Post }) {
  if (post.is_deleted) {
    return (
      <div className="px-4 py-3 text-sm text-gray-400 italic border-l-2 border-gray-200">
        [Post deleted]
      </div>
    )
  }
  // ... normal card
}
```

### Reply Indentation (Two-Level Nesting)

```tsx
// Level 1: direct reply to post — no indent
// Level 2: reply to a reply — indent + left accent line
function ReplyItem({ reply, depth }: { reply: Reply; depth: 0 | 1 }) {
  return (
    <div className={depth === 1 ? 'ml-8 pl-3 border-l-2 border-civic-blue/30' : ''}>
      {/* reply content */}
    </div>
  )
}
```

The exact `border-civic-blue/30` value is Claude's discretion — the border should be subtle, low-contrast, clearly structural rather than decorative. A muted blue at 30% opacity works well against both light and dark backgrounds.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js | CSS `@theme` directive | Tailwind v4.0 (2025) | No JS config file; content auto-detected |
| `@tailwind base/components/utilities` directives | `@import "tailwindcss"` | Tailwind v4.0 (2025) | Single import line |
| `react-query` (npm) | `@tanstack/react-query` (npm) | TanStack Query v4 | Package renamed; old `react-query` is outdated |
| `getNextPageParam: (last, all) => ...` signature (TQ v4) | Same signature but `initialPageParam` is now required | TanStack Query v5 | Must provide `initialPageParam: null` for cursor pagination |
| Zod `z.object().strict()` | `z.strictObject()` | Zod v4 | `.strict()` method removed from z.object() |
| Zod `message:` error param | `error:` param | Zod v4 | Unified error API |
| Supabase HS256 JWT | ES256 Third-Party Auth (confirmed Phase 1) | Phase 1 | `auth.jwt() ->> 'sub'` works; `auth.uid()` does NOT |

**Deprecated/outdated:**
- `create-react-app`: Deprecated. This project correctly uses Vite.
- `react-query` (unscoped): Use `@tanstack/react-query` v5 instead.
- Tailwind v3 PostCSS setup: Replaced by `@tailwindcss/vite` plugin in v4.

---

## Open Questions

1. **`connected_profiles` — `is_suspended` vs `account_standing`**
   - What we know: Phase 1 schema has `account_standing` ('active'/'suspended'). Additional context for Phase 2 mentions `is_suspended` boolean and `tier` text.
   - What's unclear: Should `is_suspended` be a generated column (`account_standing = 'suspended'`), a separate column, or should `account_standing` be replaced?
   - Recommendation: Add `is_suspended boolean GENERATED ALWAYS AS (account_standing = 'suspended') STORED` and `tier text NOT NULL DEFAULT 'connected'` in the Phase 2 migration. This preserves the existing column while providing the UI-expected field.

2. **How does the frontend know the user's Federal Slice ID?**
   - What we know: `slice_members` contains `(user_id, slice_id)`. The `slices` table has `slice_type` ('federal', 'state', 'local', 'neighborhood'). RLS on `slice_members` allows users to SELECT only their own rows.
   - What's unclear: Phase 2 frontend must JOIN `slice_members` with `slices` on `slice_type = 'federal'` to find the user's Federal slice. This is a straightforward query but needs a dedicated hook (`useFederalSlice`).
   - Recommendation: `SELECT sm.slice_id FROM civic_spaces.slice_members sm JOIN civic_spaces.slices s ON s.id = sm.slice_id WHERE s.slice_type = 'federal'` — cache in TanStack Query with a long stale time (slice membership changes rarely).

3. **Realtime channel cleanup on tab unmount**
   - What we know: Supabase Realtime channels must be manually removed on cleanup.
   - What's unclear: If the feed panel remounts (tab switching), will duplicate channels accumulate?
   - Recommendation: Always call `supabase.removeChannel(channel)` in the `useEffect` cleanup function. Use a stable channel name keyed to `sliceId` — Supabase deduplicates channels with the same name.

4. **No-jurisdiction banner data source (HUB-05)**
   - What we know: The banner appears when a user has no jurisdiction set. The accounts API stores jurisdiction GEOIDs. The Civic Spaces DB has `slice_members` — zero rows = no jurisdiction.
   - Recommendation: Check `slice_members` count for the current user. Zero rows → show banner linking to `accounts.empowered.vote/profile`. This avoids an external API call and leverages existing data.

---

## Sources

### Primary (HIGH confidence)
- Supabase official docs — `/docs/guides/realtime/postgres-changes` — Realtime channel API, RLS requirements, custom schema
- Supabase official docs — `/docs/guides/api/using-custom-schemas` — `.schema()` per-query API and client `db.schema` option
- Tailwind CSS official blog — `tailwindcss.com/blog/tailwindcss-v4` — v4 install, `@tailwindcss/vite`, `@theme` configuration
- Zod official docs — `zod.dev/v4` — v4 breaking changes, new APIs
- web.dev — FAB component article — CSS `env(safe-area-inset-bottom)` positioning pattern
- Phase 1 migrations (local) — actual schema DDL, RLS policies, confirmed gaps

### Secondary (MEDIUM confidence)
- WebSearch: TanStack Query v5 `@tanstack/react-query` package name + v5.95.0 version confirmed via npm listing
- WebSearch: `@hookform/resolvers` v5+ supports Zod v4 (confirmed by resolvers GitHub releases)
- WebSearch: React 19 install packages confirmed (`react@19`, `react-dom@19`, `@types/react@19`)
- react-modal-sheet GitHub README — keyboard avoidance API, compound component pattern

### Tertiary (LOW confidence)
- Composite cursor pagination with `.or()` Supabase filter — confirmed pattern from community discussion, not official docs
- `useLayoutEffect` for scroll restoration before paint — community pattern, not documented in React or TanStack Query official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm, official docs, and official release notes
- Architecture patterns: HIGH for TanStack Query and Supabase patterns; MEDIUM for scroll restoration pattern
- Schema gaps: HIGH — confirmed by direct reading of Phase 1 migration files
- Pitfalls: HIGH for schema gaps and Realtime publication; MEDIUM for composite cursor and edit window enforcement

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (libraries stable; check TanStack Query patch releases before planning)
