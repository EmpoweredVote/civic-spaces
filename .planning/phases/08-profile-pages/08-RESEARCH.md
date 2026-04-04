# Phase 8: Profile Pages - Research

**Researched:** 2026-04-03
**Domain:** SPA routing, Supabase count queries, profile page composition with existing social graph hooks
**Confidence:** HIGH

## Summary

Phase 8 introduces the first URL-based navigation in this app. The app is a **Vite + React SPA with no router installed** — the CONTEXT.md decision for "full page at `/profile/:userId`" requires adding a router. Wouter v3 is the right choice: 2.1 KB gzipped, minimal API, and an ideal fit for a SPA that only needs one parameterized route added to an otherwise state-managed app.

The profile page itself is largely a composition job. Almost all hooks needed already exist: `useProfileById`, `useRelationship`, `useFollowStatus`, `useFriendsList`, `useAllSlices`, and the friend action mutations from `useFriendship`. The new work is: (1) installing Wouter and wiring a single Route, (2) a `useProfileStats` hook that counts posts and replies per user, (3) a `useProfileSlices` hook that fetches slice memberships for an arbitrary user ID, (4) a `useMutualFriends` hook for the other-view friends section, and (5) the ProfilePage component itself with all its sections.

The shared-slice indicator (Claude's Discretion) should use a soft blue dot or checkmark icon — subtle enough to be context, not CTA. Tier badges should use Tailwind color chips: `inform` → gray, `connected` → blue, `empowered` → red (matching EmpoweredBadge's existing red star).

**Primary recommendation:** Install Wouter v3, add a single `<Route path="/profile/:userId">` inside App.tsx alongside the existing AppShell, wire all display name tap points to navigate via `useLocation` navigate or `<Link>`. Build the profile page as one full-screen component using existing hooks plus three new hooks.

## Standard Stack

### Core (already installed — no new installs except router)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wouter | 3.9.0 | Client-side routing for `/profile/:userId` | 2.1 KB gzipped, no Provider boilerplate, ideal for "one new route in an existing SPA" |
| @tanstack/react-query | 5.95.2 | Data fetching, caching, count queries | Already in project; handles all profile data |
| @supabase/supabase-js | 2.100.1 | DB queries for posts count, replies count, slice memberships | Already in project |
| react-loading-skeleton | 3.5.0 | Loading skeleton for profile sections | Already used in FeedSkeleton — reuse same pattern |
| tailwindcss | 4.2.2 | All styling | Already in project |
| date-fns | 4.1.0 | Format join date | Already in project |

### No new libraries needed beyond Wouter

**Installation:**
```bash
npm install wouter
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| wouter | react-router-dom v7 | React Router is 18.7 KB vs 2.1 KB; overkill for one route; loader/action conventions not needed here |
| wouter | State-based "fake" profile page (no URL) | Violates CONTEXT.md decision; no Back navigation; no deep link |
| Supabase count queries | Storing counts in DB | DB count is always accurate; stored counts require triggers (added complexity); post counts are already trigger-maintained for reply_count on posts but not per-user |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── ProfilePage.tsx          # New: full-screen profile page component
│   ├── ProfileHeader.tsx        # New: name + tier badge + join date + friend/follow action
│   ├── ProfileStatsStrip.tsx    # New: 3-column Posts | Replies | Friends
│   ├── ProfileSlices.tsx        # New: slice membership list with shared-slice indicator
│   ├── ProfileFriends.tsx       # New: friends section (own vs other view)
│   ├── ProfileSkeleton.tsx      # New: loading skeleton for profile page
│   ├── EmpoweredBadge.tsx       # Existing — reuse
│   └── UserProfileCard.tsx      # Existing — keep as-is (sheet overlay pattern still used from FriendsList)
├── hooks/
│   ├── useProfileById.ts        # Existing — extend to include created_at and join date
│   ├── useProfileStats.ts       # New: post count + reply count for a user
│   ├── useProfileSlices.ts      # New: slice memberships for any user ID
│   ├── useMutualFriends.ts      # New: mutual friends between viewer and subject
│   ├── useFriends.ts            # Existing — used for own-view friends list
│   ├── useFriendship.ts         # Existing — relationship state + mutations
│   └── useFollow.ts             # Existing — follow status + toggle
└── App.tsx                      # Modified: add Router + Route for /profile/:userId
```

### Pattern 1: Wouter Router Integration into Existing SPA

**What:** Wrap the existing `<AppShell>` and a new `<Route path="/profile/:userId">` inside a Wouter `<Router>`. When no profile route is active, `<AppShell>` renders normally. When `/profile/:userId` is matched, the profile page renders instead.

**When to use:** Exactly this case — one new URL-based view in an existing state-driven SPA.

**Example:**
```typescript
// Source: https://github.com/molefrog/wouter (v3 README)
import { Router, Route, Switch } from 'wouter'
import AppShell from './components/AppShell'
import ProfilePage from './components/ProfilePage'

export default function App() {
  return (
    <>
      <Router>
        <Switch>
          <Route path="/profile/:userId" component={ProfilePage} />
          <Route>
            {/* default: AppShell handles all other state */}
            <AppShell />
          </Route>
        </Switch>
      </Router>
      <Toaster richColors position="top-center" />
    </>
  )
}
```

### Pattern 2: Navigation from display names throughout the app

**What:** Replace `onAuthorTap?.(userId)` callback pattern (which opened the sheet) with Wouter navigation to `/profile/${userId}`. Every place that calls `setProfileUserId` needs to call `navigate('/profile/' + userId)` instead.

**Locations that need updating:**
- `PostCard.tsx` — `onAuthorTap?.(post.user_id)` button
- `ReplyCard.tsx` — `onAuthorTap?.(reply.user_id)` button
- `NotificationItem.tsx` — actor name tap (currently does nothing — add tappable name)
- `FriendsList.tsx` — friend row tap (currently opens UserProfileCard sheet — redirect to profile page)
- `AppShell.tsx` — remove `profileUserId` state and `setProfileUserId`, remove `<UserProfileCard>` global overlay

**Example:**
```typescript
// Source: https://github.com/molefrog/wouter (v3 useLocation hook)
import { useLocation } from 'wouter'

const [, navigate] = useLocation()

<button onClick={() => navigate(`/profile/${post.user_id}`)}>
  {post.author.display_name}
</button>
```

### Pattern 3: Supabase count query for posts and replies

**What:** Use Supabase `.select('*', { count: 'exact', head: true })` with `.eq('user_id', userId)` to get post and reply counts without fetching rows. Returns `{ count: number | null }`.

**When to use:** Stats strip (Posts | Replies counts).

**Example:**
```typescript
// Source: Supabase JS docs https://supabase.com/docs/reference/javascript/select
const { count: postCount } = await supabase
  .from('posts')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('is_deleted', false)

const { count: replyCount } = await supabase
  .from('replies')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('is_deleted', false)
```

**Note:** Both queries run in parallel via `Promise.all` inside the hook's `queryFn`.

### Pattern 4: useProfileSlices — fetching another user's slices

**What:** A generalized version of `useAllSlices` that accepts any `userId` (not just the current user). Use it on the profile page to show the subject's slice memberships. Combine with the viewer's own `useAllSlices` result to detect shared slices.

**Shared slice detection:**
```typescript
// A slice is "shared" if both viewer and subject have the same slice_type
// (they may be in different siblings — shared = same type, not same slice_id)
const sharedTypes = new Set(
  Object.keys(viewerSlices).filter(type => !!subjectSlices[type as SliceType])
)
```

### Pattern 5: useMutualFriends — mutual friends for other-view

**What:** Two-step query. First fetch both the viewer's friend IDs and the subject's friend IDs from the `friendships` table. Then compute intersection. Batch-fetch profiles for the intersection.

**Example:**
```typescript
// Step 1: get subject's friend IDs (both sides of friendship row)
const { data: subjectRows } = await supabase
  .schema('civic_spaces')
  .from('friendships')
  .select('user_low, user_high, status')
  .or(`user_low.eq.${subjectId},user_high.eq.${subjectId}`)
  .eq('status', 'FRIEND')

// Step 2: viewer's friends already available from useFriendsList (queryKey: ['friends'])
// Use queryClient.getQueryData(['friends']) or call useFriendsList in the component
// Step 3: intersect IDs
const mutualIds = subjectFriendIds.filter(id => viewerFriendIds.has(id))
```

**RLS note:** The existing `friendships_select_own` RLS policy only allows seeing rows where the current user is user_low or user_high. This means we cannot directly query the subject's friendships from the client — RLS will block it. **Solution: use a Supabase RPC function** that runs as SECURITY DEFINER to return mutual friends safely, or use two separate trusted queries (viewer's friends are already cached; subject's total friend count can be retrieved via a count query that only counts FRIEND rows).

**Alternative (simpler, RLS-safe):** Mutual friends = viewer's friends who are also friends with the subject. The viewer already has their own friends list. For each friend in the viewer's list, check if that person is also friends with the subject. This requires N friendship lookups, which is impractical.

**Recommended approach: RPC function** `get_mutual_friends(p_subject_id text)` that runs as SECURITY INVOKER but uses `current_user_id()` internally — can JOIN friendships twice: once for viewer's friends, once for subject's friends, and return the intersection. This is the correct pattern; the RLS on `friendships` allows the viewer to see their own rows, but cannot see the subject's rows. A SECURITY DEFINER function bypasses RLS and is appropriate here.

### Pattern 6: Subject's total friend count

**What:** For the stats strip "Friends" count and the muted total in other-view, we need the subject's total friend count. RLS blocks direct query. Use the same RPC approach or a `get_friend_count(p_user_id text)` function.

**Alternative (simpler):** Add a `friend_count` denormalized column to `connected_profiles` maintained by a trigger on `friendships`. However, triggers add complexity and phase 3 didn't do this.

**Recommended approach:** RPC function `get_profile_stats(p_user_id text)` that returns `{ post_count, reply_count, friend_count }` as a single call. This is SECURITY DEFINER, takes any user_id, counts posts (not deleted), replies (not deleted), and friendships (status = 'FRIEND'). One RPC call replaces three separate queries.

### Anti-Patterns to Avoid

- **Using `onAuthorTap` callback + sheet for profile navigation:** The CONTEXT.md decision is a full page, not a sheet. The existing `UserProfileCard` sheet in AppShell should be removed from the main flow. Keep it only for places that genuinely need in-place preview (none identified — FriendsList should also navigate).
- **Fetching subject's friendships directly from client:** RLS prevents it. Don't attempt `supabase.from('friendships').select().eq('user_low', subjectId)` — it will return empty for any user who isn't the current user.
- **Querying posts with `select('*')` for counting:** Always use `{ count: 'exact', head: true }` — never fetch all rows just to count them.
- **Detecting shared slices by `slice_id`:** Users in the same geographic area may be in different sibling slices (sibling_index 1 vs 2). Shared slice means same `slice_type`, not same `slice_id`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL routing to `/profile/:userId` | Custom hash-based URL parsing | wouter v3 Route + useParams | Edge cases in URL encoding, back navigation, history management |
| Post/reply counts | Fetch all rows and `.length` | Supabase `{ count: 'exact', head: true }` | Performance — never fetch data you only need to count |
| Mutual friend computation | Client-side set intersection of all friends | RPC function `get_mutual_friends` | RLS blocks viewing subject's friendship rows; RPC is the correct escape hatch |
| Tier badge | Custom inline SVG per usage | Reuse `EmpoweredBadge` component + add Inform/Connected chip variants | Already exists, already styled with red star for Empowered |
| Loading skeletons | CSS animation from scratch | `react-loading-skeleton` (already installed) | Consistent with FeedSkeleton; already themed |
| Join date formatting | Manual date math | `date-fns` `format(new Date(created_at), 'MMMM yyyy')` | Already in project; handles locale edge cases |

**Key insight:** The two genuinely new database operations (counting per-user stats and computing mutual friends) both hit RLS walls when done naively from the client. Both need RPC functions running with appropriate security context.

## Common Pitfalls

### Pitfall 1: RLS Blocking Subject's Friendship Queries

**What goes wrong:** Developer writes `supabase.from('friendships').select().or('user_low.eq.X,user_high.eq.X')` where X is another user's ID, gets 0 rows (not an error — RLS silently filters).
**Why it happens:** The `friendships_select_own` policy only allows rows where current user is user_low or user_high.
**How to avoid:** Any friendship data about a third party (mutual friends, friend counts) must go through a SECURITY DEFINER RPC function.
**Warning signs:** Query returns empty array with no error when you know the subject has friends.

### Pitfall 2: Shared Slice by Slice ID vs Slice Type

**What goes wrong:** Code checks `viewerSlices[type]?.id === subjectSlices[type]?.id` — users in the same city but different sibling slices don't get highlighted as sharing a space.
**Why it happens:** Sibling overflow creates multiple slices for the same geoid/type. Same type = same civic community.
**How to avoid:** Shared slice = same `slice_type` key exists in both `viewerSlices` and `subjectSlices`. Never compare slice IDs.
**Warning signs:** Two users who are both in "Neighborhood" don't see the shared slice indicator.

### Pitfall 3: Own-View Profile via Tapping Your Own Name

**What goes wrong:** Own-name tap opens the profile page, but the friend/follow section renders (because the component checks `isSelf = currentUserId === userId` at render time, not before fetch).
**Why it happens:** `isSelf` check forgotten on the action section.
**How to avoid:** Any component that receives `userId` must derive `isSelf = currentUserId === userId` and branch at both header (hide friend/follow action) and friends section (show full list, not just mutuals).
**Warning signs:** Your own profile shows a "Add Friend" button for yourself.

### Pitfall 4: Back Navigation Losing Feed Scroll Position

**What goes wrong:** User is in the middle of the feed, taps a name, visits profile, taps Back — feed is scrolled to top.
**Why it happens:** Per-tab scroll positions are stored in `scrollPositions.current` in AppShell. When AppShell unmounts (because profile page Route replaced it), the scroll ref state is lost.
**How to avoid:** The current architecture uses `CSS hidden` (not unmount) to preserve tab state. If Wouter's Switch unmounts AppShell when profile route is active, scroll state is lost. **Solution: keep AppShell always mounted, hide it with CSS when profile is active** — same technique as per-tab CSS hidden.

```typescript
// Pattern: keep AppShell mounted, use CSS to hide/show based on route
<Route path="/profile/:userId">
  {(params) => <ProfilePage userId={params.userId} />}
</Route>
// AppShell always mounted:
<div style={{ display: profileRouteActive ? 'none' : 'flex', flexDirection: 'column', height: '100%' }}>
  <AppShell />
</div>
```

**Use `useRoute('/profile/:userId')` to detect match, then CSS hide AppShell accordingly.**

### Pitfall 5: useProfileById Missing join_date (created_at)

**What goes wrong:** The profile header needs to show join date. The existing `useProfileById` hook only selects `user_id, display_name, avatar_url, tier` — it omits `created_at`.
**How to avoid:** Extend the select in `useProfileById` to include `created_at`. The column exists on `connected_profiles` from the original Phase 1 schema.
**Warning signs:** TypeScript error when accessing `profile.created_at`.

### Pitfall 6: Volunteer Slice in Profile List

**What goes wrong:** Subject's slice memberships fetched via `useProfileSlices` might include the `volunteer` slice type. CONTEXT.md says to show Volunteer only if the user has the role. But for another user's profile, we don't check their role — we just read their slice memberships from the database. This is correct: if they have a volunteer slice_member row, they have the role.
**How to avoid:** No special case needed. Show all slice types present in the DB membership, in the ordered display order. The DB slice membership IS the source of truth.

## Code Examples

### useProfileStats hook

```typescript
// Source: Supabase docs https://supabase.com/docs/reference/javascript/select
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface ProfileStats {
  postCount: number
  replyCount: number
  friendCount: number
}

export function useProfileStats(userId: string | null) {
  return useQuery({
    queryKey: ['profile-stats', userId],
    queryFn: async (): Promise<ProfileStats> => {
      // Use RPC to get all three counts in one round-trip
      // (RPC needed for friendCount due to RLS)
      const { data, error } = await supabase
        .rpc('get_profile_stats', { p_user_id: userId! })
      if (error) throw error
      return {
        postCount: data.post_count ?? 0,
        replyCount: data.reply_count ?? 0,
        friendCount: data.friend_count ?? 0,
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
```

### get_profile_stats RPC (Supabase migration)

```sql
-- SECURITY DEFINER: can count any user's friendships (bypasses RLS)
CREATE OR REPLACE FUNCTION civic_spaces.get_profile_stats(p_user_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'post_count',   (SELECT COUNT(*) FROM civic_spaces.posts  WHERE user_id = p_user_id AND is_deleted = false),
    'reply_count',  (SELECT COUNT(*) FROM civic_spaces.replies WHERE user_id = p_user_id AND is_deleted = false),
    'friend_count', (SELECT COUNT(*) FROM civic_spaces.friendships
                     WHERE (user_low = p_user_id OR user_high = p_user_id) AND status = 'FRIEND')
  );
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.get_profile_stats(text) TO authenticated;
```

### get_mutual_friends RPC (Supabase migration)

```sql
-- Returns mutual friends between the current user and p_subject_id
-- SECURITY INVOKER: uses current_user_id() for viewer side (respects RLS for viewer)
-- But needs to see subject's friends → SECURITY DEFINER to bypass subject's RLS
CREATE OR REPLACE FUNCTION civic_spaces.get_mutual_friends(p_subject_id text)
RETURNS TABLE (user_id text, display_name text, tier text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH viewer_friends AS (
    SELECT CASE WHEN user_low = civic_spaces.current_user_id() THEN user_high ELSE user_low END AS friend_id
    FROM civic_spaces.friendships
    WHERE (user_low = civic_spaces.current_user_id() OR user_high = civic_spaces.current_user_id())
      AND status = 'FRIEND'
  ),
  subject_friends AS (
    SELECT CASE WHEN user_low = p_subject_id THEN user_high ELSE user_low END AS friend_id
    FROM civic_spaces.friendships
    WHERE (user_low = p_subject_id OR user_high = p_subject_id)
      AND status = 'FRIEND'
  ),
  mutual_ids AS (
    SELECT vf.friend_id FROM viewer_friends vf
    INNER JOIN subject_friends sf ON sf.friend_id = vf.friend_id
  )
  SELECT cp.user_id, cp.display_name, cp.tier
  FROM civic_spaces.connected_profiles cp
  INNER JOIN mutual_ids m ON m.friend_id = cp.user_id;
$$;

GRANT EXECUTE ON FUNCTION civic_spaces.get_mutual_friends(text) TO authenticated;
```

### Wouter navigation from display name tap points

```typescript
// Source: https://github.com/molefrog/wouter
import { useLocation } from 'wouter'

// In PostCard, ReplyCard, etc.:
const [, navigate] = useLocation()

<button
  type="button"
  onClick={(e) => {
    e.stopPropagation()
    navigate(`/profile/${post.user_id}`)
  }}
  aria-label={`View ${post.author.display_name}'s profile`}
>
  {post.author.display_name}
</button>
```

### CSS-hidden AppShell pattern (preserve scroll state across profile navigation)

```typescript
// Source: project pattern from Plan 06-01 (CSS hidden for tab preservation)
import { useRoute } from 'wouter'

export default function App() {
  const [isProfileRoute] = useRoute('/profile/:userId')

  return (
    <>
      <Router>
        <Route path="/profile/:userId">
          {(params) => <ProfilePage userId={params.userId} />}
        </Route>
        {/* Always mounted — CSS hidden when profile is active */}
        <div style={{ display: isProfileRoute ? 'none' : undefined }} className="flex flex-col h-screen">
          <AppShell />
        </div>
      </Router>
      <Toaster richColors position="top-center" />
    </>
  )
}
```

### Tier badge implementation (Claude's Discretion)

```typescript
// Reuse EmpoweredBadge for empowered; add simple chip for others
function TierBadge({ tier }: { tier: ConnectedProfile['tier'] }) {
  if (tier === 'empowered') return <EmpoweredBadge />
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      tier === 'connected'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-500'  // inform
    }`}>
      {tier === 'connected' ? 'Connected' : 'Inform'}
    </span>
  )
}
```

### Shared slice indicator (Claude's Discretion)

```typescript
// Subtle blue dot + "you're here too" text — context, not CTA
function SharedSliceChip() {
  return (
    <span className="flex items-center gap-1 text-xs text-blue-500">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      you're here too
    </span>
  )
}
```

### Stats strip

```typescript
// 3-column layout matching GitHub/Twitter profile stat pattern
function StatsStrip({ postCount, replyCount, friendCount }: ProfileStats) {
  return (
    <div className="grid grid-cols-3 divide-x divide-gray-100 border-y border-gray-100 py-3">
      <StatCell label="Posts" value={postCount} />
      <StatCell label="Replies" value={replyCount} />
      <StatCell label="Friends" value={friendCount} muted />
    </div>
  )
}

function StatCell({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <span className={`text-lg font-bold ${muted ? 'text-gray-400' : 'text-gray-900'}`}>
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Router v5 (BrowserRouter, Switch, Route) | Wouter v3 / React Router v7 (loader-based) | 2023-2024 | For single-route additions to SPAs, wouter is now the pragmatic choice; React Router v7 is for full framework adoption |
| Fetching all rows to count | `{ count: 'exact', head: true }` | Supabase JS v2+ | No row data transferred; much faster |
| Sheet/modal profile previews | Full-page `/profile/:userId` URL | Industry standard since ~2020 | Linkable, bookmarkable, Back navigation works |

**Deprecated/outdated:**
- `UserProfileCard` sheet as the primary profile view: still valid for quick inline previews (if needed), but Phase 8 replaces it as the primary tap destination. The sheet can be removed from AppShell's global overlay; it may remain in FriendsList or be replaced there too.

## Open Questions

1. **SECURITY DEFINER functions and search path**
   - What we know: Supabase recommends setting `search_path = ''` on SECURITY DEFINER functions to prevent search path injection. Pattern established in get_boosted_feed (SECURITY INVOKER — no issue there).
   - What's unclear: Whether the existing civic_spaces RPC functions use qualified names consistently; SECURITY DEFINER get_mutual_friends and get_profile_stats must qualify all table references as `civic_spaces.tablename`.
   - Recommendation: Always prefix table names with `civic_spaces.` in both new RPC functions. Add `SET search_path = ''` in function options as a best practice.

2. **Vite dev server history fallback for `/profile/:userId`**
   - What we know: Vite's dev server doesn't serve `index.html` for unknown paths by default. In dev, navigating directly to `/profile/abc` returns 404.
   - What's unclear: Production hosting setup (whether static host handles SPA fallback).
   - Recommendation: Add `historyApiFallback: true` to `vite.config.ts` under `server:` for local dev. Production deploy needs SPA fallback configuration.

3. **NotificationItem actor name as tappable link**
   - What we know: `NotificationItem` currently renders the actor's name as plain text inside a button that handles the notification action (navigate to post/thread).
   - What's unclear: Should tapping the actor name go to profile, or should tapping the whole notification row still go to the thread?
   - Recommendation: The CONTEXT.md says "every display name is tappable." Wrap the actor name in a separate `<button onClick={navigate('/profile/' + actor_id)}>` with `e.stopPropagation()` to prevent both actions firing.

## Sources

### Primary (HIGH confidence)
- Codebase inspection (all files listed above) — definitive source of truth for what exists
- `supabase/migrations/*.sql` — definitive DB schema
- `src/types/database.ts` — definitive TypeScript types
- `package.json` — definitive library inventory

### Secondary (MEDIUM confidence)
- [Wouter v3 GitHub README](https://github.com/molefrog/wouter) — verified API: Router, Route, Switch, useLocation, useRoute, useParams, Link
- [Supabase JS select docs](https://supabase.com/docs/reference/javascript/select) — verified `{ count: 'exact', head: true }` count pattern exists

### Tertiary (LOW confidence)
- WebSearch result: wouter 2.1 KB vs react-router 18.7 KB size comparison — reasonable but not measured directly

## Metadata

**Confidence breakdown:**
- Standard stack (no new libs except wouter): HIGH — package.json is ground truth
- Architecture (wouter integration + CSS hidden AppShell): HIGH — pattern already proven in project for CSS hidden tab panels; wouter API verified against official README
- RPC functions for mutual friends / stats: HIGH for approach correctness; MEDIUM for exact SQL syntax (should be validated against live DB)
- Pitfalls (RLS, shared slice type vs id, scroll preservation): HIGH — derived directly from codebase analysis

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (wouter and supabase-js APIs are stable; 30-day window reasonable)
