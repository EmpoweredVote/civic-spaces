# Architecture Research: Civic Spaces

## Schema Design

All tables live in the `civic_spaces` schema. User identity is owned by the external accounts API — Civic Spaces stores only the external `user_id` (the GEOID-resolved identity) and never replicates jurisdiction assignments.

### Core Tables

```sql
-- Registered users (mirrors external accounts API, minimal local state)
civic_spaces.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   text UNIQUE NOT NULL,   -- ID from external accounts API
  display_name  text NOT NULL,
  avatar_url    text,
  is_empowered  boolean NOT NULL DEFAULT false,  -- followable one-directionally
  created_at    timestamptz NOT NULL DEFAULT now()
)

-- Geographic slice definitions (one row per slice instance)
-- Slices are NOT stored in the user record — membership is in slice_members
civic_spaces.slices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level         text NOT NULL CHECK (level IN ('neighborhood','local','state','federal')),
  geoid         text NOT NULL,          -- jurisdiction GEOID from external API
  cohort_start  date NOT NULL,          -- 2-year cohort anchor date
  cohort_end    date NOT NULL,          -- cohort_start + 2 years
  member_cap    int  NOT NULL DEFAULT 6000,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, geoid, cohort_start)   -- one slice per level+geoid per cohort
)

-- Membership linking users to their 4 current slices
-- Populated/updated by the API layer after consulting external accounts API
civic_spaces.slice_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slice_id   uuid NOT NULL REFERENCES civic_spaces.slices(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES civic_spaces.users(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slice_id, user_id)
)
-- Indexes:
CREATE INDEX ON civic_spaces.slice_members (user_id);
CREATE INDEX ON civic_spaces.slice_members (slice_id);

-- Posts scoped to exactly one slice
civic_spaces.posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slice_id     uuid NOT NULL REFERENCES civic_spaces.slices(id),
  author_id    uuid NOT NULL REFERENCES civic_spaces.users(id),
  body         text NOT NULL,
  media_urls   text[],
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
)
-- Indexes:
CREATE INDEX ON civic_spaces.posts (slice_id, created_at DESC);
CREATE INDEX ON civic_spaces.posts (author_id);

-- Nested replies (single level of threading recommended to start)
civic_spaces.comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES civic_spaces.posts(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES civic_spaces.users(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX ON civic_spaces.comments (post_id, created_at);

-- Reactions (likes / upvotes) on posts
civic_spaces.reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES civic_spaces.posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES civic_spaces.users(id),
  kind       text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, kind)
)
CREATE INDEX ON civic_spaces.reactions (post_id);

-- In-app notification queue
civic_spaces.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES civic_spaces.users(id),
  kind         text NOT NULL,          -- 'reply','reaction','mention','follow'
  payload      jsonb NOT NULL DEFAULT '{}',
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX ON civic_spaces.notifications (recipient_id, read_at, created_at DESC);
```

### Social Graph Tables

```sql
-- Mutual friendship (requires both users to accept)
civic_spaces.friendships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES civic_spaces.users(id),
  addressee_id uuid NOT NULL REFERENCES civic_spaces.users(id),
  status       text NOT NULL CHECK (status IN ('pending','accepted','rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
)
-- Efficient bidirectional lookup:
CREATE INDEX ON civic_spaces.friendships (addressee_id, status);
CREATE INDEX ON civic_spaces.friendships (requester_id, status);

-- One-directional follows (for empowered accounts only as target)
civic_spaces.follows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES civic_spaces.users(id),
  followee_id uuid NOT NULL REFERENCES civic_spaces.users(id),  -- must be empowered
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (follower_id <> followee_id),
  UNIQUE (follower_id, followee_id)
)
CREATE INDEX ON civic_spaces.follows (followee_id);
CREATE INDEX ON civic_spaces.follows (follower_id);
```

---

## RLS Policy Approach

### Strategy: Membership-Based Policy via Subquery

Because slice membership is dynamic (users belong to up to 4 slices, slices can overflow), RLS policies check `slice_members` rather than a JWT claim. JWT claims are suitable for static roles (e.g., `is_empowered`) but slice membership changes too frequently to cache reliably in the token without stale-data risk.

**Key principle:** A user can SELECT a post if and only if they are a member of the slice the post belongs to.

```sql
-- Enable RLS on all tables
ALTER TABLE civic_spaces.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.slice_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_spaces.follows ENABLE ROW LEVEL SECURITY;

-- Posts: readable only by members of the same slice
CREATE POLICY posts_select ON civic_spaces.posts
  FOR SELECT USING (
    slice_id IN (
      SELECT slice_id FROM civic_spaces.slice_members
      WHERE user_id = (
        SELECT id FROM civic_spaces.users
        WHERE external_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- Posts: writable only by the author, and only into their own slices
CREATE POLICY posts_insert ON civic_spaces.posts
  FOR INSERT WITH CHECK (
    author_id = (
      SELECT id FROM civic_spaces.users WHERE external_id = auth.jwt() ->> 'sub'
    )
    AND slice_id IN (
      SELECT slice_id FROM civic_spaces.slice_members
      WHERE user_id = (
        SELECT id FROM civic_spaces.users WHERE external_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- Notifications: recipient-only visibility
CREATE POLICY notifications_select ON civic_spaces.notifications
  FOR SELECT USING (
    recipient_id = (
      SELECT id FROM civic_spaces.users WHERE external_id = auth.jwt() ->> 'sub'
    )
  );

-- Slice members: each user can see their own memberships
CREATE POLICY slice_members_select ON civic_spaces.slice_members
  FOR SELECT USING (
    user_id = (
      SELECT id FROM civic_spaces.users WHERE external_id = auth.jwt() ->> 'sub'
    )
  );
```

### Performance Note

Index `slice_members(user_id)` and `slice_members(slice_id)` are essential — these subqueries run on every row scan. Consider a security-definer helper function to resolve `external_id → internal id` once per session:

```sql
CREATE OR REPLACE FUNCTION civic_spaces.current_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM civic_spaces.users
  WHERE external_id = auth.jwt() ->> 'sub'
  LIMIT 1;
$$;
```

Replace the repeated subquery with `civic_spaces.current_user_id()` in all policies. Postgres caches the result for the duration of the query.

### Service-Role Bypass

The Express/TypeScript API backend should use the Supabase **service role key** only for slice assignment operations (e.g., syncing memberships from the external accounts API). All user-facing queries use the **anon/user JWT** to let RLS enforce access naturally.

---

## Feed Query Patterns

### Base Feed: Recency-Ranked Posts for a Slice

```sql
SELECT
  p.id,
  p.body,
  p.created_at,
  p.author_id,
  u.display_name,
  u.avatar_url,
  COUNT(r.id) AS reaction_count,
  COUNT(c.id) AS comment_count
FROM civic_spaces.posts p
JOIN civic_spaces.users u ON u.id = p.author_id
LEFT JOIN civic_spaces.reactions r ON r.post_id = p.id
LEFT JOIN civic_spaces.comments c ON c.post_id = p.id
WHERE p.slice_id = $slice_id
GROUP BY p.id, u.display_name, u.avatar_url
ORDER BY p.created_at DESC
LIMIT 50
OFFSET $cursor;
```

Use cursor-based pagination (keyset on `created_at, id`) rather than `OFFSET` at scale.

### Friend-Boosted Feed

Compute a composite score: `recency_score + friend_boost`. The friend boost is a fixed additive constant applied when the post author is a mutual friend or followed empowered account.

```sql
WITH my_friends AS (
  -- Mutual friends
  SELECT
    CASE WHEN requester_id = $me THEN addressee_id ELSE requester_id END AS friend_id
  FROM civic_spaces.friendships
  WHERE (requester_id = $me OR addressee_id = $me)
    AND status = 'accepted'
  UNION
  -- Followed empowered accounts
  SELECT followee_id AS friend_id
  FROM civic_spaces.follows
  WHERE follower_id = $me
),
scored AS (
  SELECT
    p.*,
    -- Exponential time decay: half-life ~48 hours
    EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0 AS age_hours,
    EXP(-0.015 * EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0) AS recency_score,
    CASE WHEN p.author_id IN (SELECT friend_id FROM my_friends) THEN 0.3 ELSE 0 END AS friend_boost
  FROM civic_spaces.posts p
  WHERE p.slice_id = $slice_id
)
SELECT
  s.*,
  u.display_name,
  u.avatar_url,
  (s.recency_score + s.friend_boost) AS rank_score
FROM scored s
JOIN civic_spaces.users u ON u.id = s.author_id
ORDER BY rank_score DESC
LIMIT 50;
```

### Index Strategy

| Table | Index | Purpose |
|---|---|---|
| `posts` | `(slice_id, created_at DESC)` | Primary feed scan |
| `posts` | `(author_id)` | Profile pages |
| `slice_members` | `(user_id)` | RLS policy lookups |
| `slice_members` | `(slice_id)` | Member count / overflow check |
| `friendships` | `(requester_id, status)` | Friend graph traversal |
| `friendships` | `(addressee_id, status)` | Bidirectional lookup |
| `follows` | `(follower_id)` | Following list |
| `notifications` | `(recipient_id, read_at, created_at DESC)` | Unread badge + list |

---

## Slice Membership Model

### Assignment Flow

1. User authenticates via Supabase Auth (JWT contains `sub` = external account ID).
2. On login (or via a periodic sync job), the Express API calls the **external accounts API** with the user's address/registration to retrieve the 4 GEOIDs (neighborhood, local, state, federal).
3. For each GEOID + level pair, the API finds or creates the appropriate `slices` row:
   - Find an active slice for that `(level, geoid)` where `member_count < member_cap` AND the current date falls within the cohort window.
   - If none exists (first user or all existing slices are full), create a new `slices` row with a fresh cohort window.
4. Upsert into `slice_members` linking the user to all 4 resolved slice IDs.
5. Remove any stale memberships (e.g., if the user moved — detected by a change in GEOIDs from the external API).

### Cap Enforcement

```sql
-- Atomic overflow check + insert (run as service role in a transaction)
WITH current_count AS (
  SELECT COUNT(*) AS cnt
  FROM civic_spaces.slice_members
  WHERE slice_id = $target_slice_id
  FOR UPDATE  -- lock the count
)
INSERT INTO civic_spaces.slice_members (slice_id, user_id)
SELECT $target_slice_id, $user_id
WHERE (SELECT cnt FROM current_count) < (
  SELECT member_cap FROM civic_spaces.slices WHERE id = $target_slice_id
);
-- If 0 rows inserted → overflow → create new slice and retry
```

A simpler alternative: add a `current_member_count` integer column to `slices` and use a trigger to increment/decrement it, with a CHECK constraint enforcing the cap. This avoids a COUNT scan on every join.

```sql
ALTER TABLE civic_spaces.slices ADD COLUMN current_member_count int NOT NULL DEFAULT 0;
ALTER TABLE civic_spaces.slices ADD CONSTRAINT cap_not_exceeded
  CHECK (current_member_count <= member_cap);

-- Trigger on slice_members to maintain the count
CREATE OR REPLACE FUNCTION civic_spaces.update_slice_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_spaces.slices SET current_member_count = current_member_count + 1
    WHERE id = NEW.slice_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_spaces.slices SET current_member_count = current_member_count - 1
    WHERE id = OLD.slice_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER slice_member_count_trigger
AFTER INSERT OR DELETE ON civic_spaces.slice_members
FOR EACH ROW EXECUTE FUNCTION civic_spaces.update_slice_member_count();
```

### 2-Year Cohort Tracking

- `cohort_start` and `cohort_end` on the `slices` table define the cohort window.
- When `cohort_end` is reached, the slice is soft-expired (a background job sets a `status = 'expired'` column, stops accepting new members) and a new sibling slice is created for the same `(level, geoid)` with the next cohort dates.
- Existing members remain in their cohort slice for continuity of community history; new residents joining that jurisdiction land in the fresh slice.

---

## Social Graph Schema

### Mutual Friendship Model

The `friendships` table uses a **single-row-per-pair** model with a directional `requester_id` / `addressee_id` to track who initiated. A friendship is "active" when `status = 'accepted'`. Queries always use an OR to find either side:

```sql
-- Is user A friends with user B?
SELECT 1 FROM civic_spaces.friendships
WHERE ((requester_id = $a AND addressee_id = $b)
    OR (requester_id = $b AND addressee_id = $a))
  AND status = 'accepted';

-- All friends of user $me (both directions)
SELECT
  CASE WHEN requester_id = $me THEN addressee_id ELSE requester_id END AS friend_id
FROM civic_spaces.friendships
WHERE (requester_id = $me OR addressee_id = $me)
  AND status = 'accepted';
```

### One-Directional Follows

The `follows` table is a simple directed edge. A constraint (or application-layer enforcement) restricts `followee_id` to users where `is_empowered = true`.

```sql
-- Enforce follows only target empowered accounts (via trigger or CHECK)
CREATE OR REPLACE FUNCTION civic_spaces.check_followee_empowered()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (SELECT is_empowered FROM civic_spaces.users WHERE id = NEW.followee_id) THEN
    RAISE EXCEPTION 'Can only follow empowered accounts';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER follows_empowered_check
BEFORE INSERT ON civic_spaces.follows
FOR EACH ROW EXECUTE FUNCTION civic_spaces.check_followee_empowered();
```

### Why Two Separate Tables

Keeping friendships and follows separate avoids complex status-conditional logic in queries and makes RLS straightforward. Feed queries union both graphs to build the "boosted authors" set (see Feed Query Patterns above).

---

## Notification Architecture

### Approach: DB-Driven with Supabase Realtime

Supabase Realtime (backed by PostgreSQL logical replication) makes it natural to push notifications without a separate message broker.

**Pattern:**

1. A PostgreSQL trigger fires on events that generate notifications (new reply, new reaction, new follower, new mention in post body).
2. The trigger inserts a row into `civic_spaces.notifications`.
3. The frontend subscribes to Supabase Realtime on `notifications` filtered by `recipient_id = <current user>`.
4. On new row → update unread badge count and prepend to notification list in UI.

**Trigger Example (reply notification):**

```sql
CREATE OR REPLACE FUNCTION civic_spaces.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  post_author uuid;
BEGIN
  SELECT author_id INTO post_author FROM civic_spaces.posts WHERE id = NEW.post_id;
  IF post_author IS DISTINCT FROM NEW.author_id THEN
    INSERT INTO civic_spaces.notifications (recipient_id, kind, payload)
    VALUES (
      post_author,
      'reply',
      jsonb_build_object(
        'comment_id', NEW.id,
        'post_id', NEW.post_id,
        'actor_id', NEW.author_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER comment_notification_trigger
AFTER INSERT ON civic_spaces.comments
FOR EACH ROW EXECUTE FUNCTION civic_spaces.notify_on_comment();
```

**Realtime Subscription (TypeScript client):**

```typescript
supabase
  .channel('user-notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'civic_spaces',
      table: 'notifications',
      filter: `recipient_id=eq.${currentUserId}`,
    },
    (payload) => {
      // Update unread count, show toast
    }
  )
  .subscribe();
```

**Push Notifications (optional):** For mobile/background delivery, pair an Edge Function with a database webhook on the `notifications` table → Edge Function → Firebase Cloud Messaging or web push. This decouples the DB trigger from external HTTP calls and avoids blocking the transaction.

### Notification Hygiene

- Add a `read_at` column (nullable); `NULL` = unread.
- Batch-mark-as-read endpoint: `UPDATE notifications SET read_at = now() WHERE recipient_id = $me AND read_at IS NULL`.
- Prune old read notifications via a cron job (Supabase pg_cron extension) to keep the table lean.

---

## Component Architecture

### Hub Layout

```
<HubPage>
  ├── <SliceTabBar />              — tabs: Neighborhood | Local | State | Federal
  │     └── UnreadBadge (per tab)
  ├── <SliceFeedPanel slice="neighborhood" />
  ├── <SliceFeedPanel slice="local" />      (lazy-loaded, not rendered until tab active)
  ├── <SliceFeedPanel slice="state" />
  └── <SliceFeedPanel slice="federal" />
```

Each `<SliceFeedPanel>` is fully independent: its own query, its own scroll position, its own pagination cursor. Switching tabs does NOT reset feed state. Use React Query (TanStack Query) with `queryKey: ['feed', sliceId]` so each slice feed has an isolated cache entry.

### Component Breakdown

```
components/
  hub/
    HubPage.tsx              — layout shell, tab routing
    SliceTabBar.tsx          — tab navigation + unread dot indicators
    SliceFeedPanel.tsx       — feed list + infinite scroll for one slice
  feed/
    PostCard.tsx             — single post: author, body, media, reactions, reply count
    PostComposer.tsx         — create post (slice-scoped)
    ReactionButton.tsx       — optimistic like/unlike
    CommentThread.tsx        — expanded comment list (lazy on demand)
  social/
    FriendRequestButton.tsx  — send/accept/decline friend request
    FollowButton.tsx         — follow empowered account (conditional render)
    UserProfileCard.tsx      — avatar, display name, friend/follow state
  notifications/
    NotificationBell.tsx     — unread count badge + dropdown
    NotificationList.tsx     — paginated notification items
    NotificationItem.tsx     — renders per `kind` with appropriate copy
  slice/
    SliceMemberCount.tsx     — member count + cap indicator
    SliceInfoPanel.tsx       — cohort dates, GEOID, level label
  layout/
    AppShell.tsx             — nav, auth guard, global Realtime subscription init
```

### State Management

- **Server state:** TanStack Query for all feed, post, notification, and social graph data. Enables automatic background refetch and optimistic updates.
- **UI state:** React local state or Zustand for tab selection, modal open/close, composer draft.
- **Realtime:** Supabase Realtime client initialized once in `AppShell`, dispatches to TanStack Query cache invalidation or direct state updates.

### Data Flow

```
External Accounts API
        │
        ▼ (on login, Express middleware)
  Slice Assignment Service (Express)
        │  upserts slice_members rows (service role)
        │
        ▼
  Supabase DB (civic_spaces schema)
        │
        ├──[RLS]──► Supabase PostgREST / JS client
        │                    │
        │              TanStack Query
        │                    │
        │             React Components
        │
        └──[Realtime]──► Supabase Realtime WS
                               │
                         NotificationBell
                         + Feed auto-refresh
```

---

## Build Order

Dependencies flow strictly from data layer → access control → API → UI. The following order minimizes blocking:

| Phase | Component | Depends On |
|---|---|---|
| 1 | Supabase project + `civic_spaces` schema migration | — |
| 2 | `users`, `slices`, `slice_members` tables + indexes | Phase 1 |
| 3 | External accounts API integration + slice assignment service (Express) | Phase 2 |
| 4 | RLS policies + `current_user_id()` helper | Phase 2 |
| 5 | `posts`, `comments`, `reactions` tables + RLS policies | Phase 4 |
| 6 | `friendships`, `follows` tables + RLS + trigger (empowered check) | Phase 4 |
| 7 | `notifications` table + DB triggers for reply/reaction events | Phase 5, 6 |
| 8 | Express API routes: feed, post CRUD, social graph, notifications | Phase 5, 6, 7 |
| 9 | `AppShell` + auth guard + Supabase Realtime init | Phase 8 |
| 10 | `SliceTabBar` + `SliceFeedPanel` + `PostCard` (core feed UI) | Phase 9 |
| 11 | `PostComposer` + `ReactionButton` + `CommentThread` | Phase 10 |
| 12 | `NotificationBell` + `NotificationList` (Realtime-backed) | Phase 10 |
| 13 | `FriendRequestButton` + `FollowButton` + `UserProfileCard` | Phase 10 |
| 14 | Friend-boosted feed ranking query | Phase 13 |
| 15 | Slice overflow logic + cohort expiry cron job | Phase 3, 7 |
| 16 | Push notification Edge Function (optional mobile layer) | Phase 7, 12 |

**Critical path:** Phases 1–5 are the irreducible foundation. Nothing user-facing is buildable until RLS and slice membership are solid, because the security model is baked into every query.

---

*Researched: 2026-03-27*
