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

---

## Representative Data — Accounts API Integration (v3.0)

*Researched: 2026-04-05*
*Source: EV-Accounts codebase (C:\EV-Accounts) — backend source code, route files, team issue notes*
*Confidence: HIGH — all findings sourced from live production code*

---

### 1. Does a `/api/representatives` Endpoint Exist?

Yes. The endpoint is:

```
GET /api/essentials/representatives/me
```

Served by the EV-Accounts Express backend (`C:\EV-Accounts\backend\src\routes\essentials.ts`, line 421).

This is a **Connected-tier-only** endpoint — it requires both `requireAuth` and `requireConnected` middleware. An Inform-tier user (not yet Connected) receives 403. A Connected user with no saved address receives 204 (empty response).

There is no public `/api/representatives` endpoint that accepts a GEOID directly. The public address-based lookup is:

```
GET /api/essentials/address-search?address=<string>
```

This is unauthenticated and does not require a JWT.

---

### 2. Response Shape — Full Field Inventory

Both `representatives/me` and `address-search` return an array of `PoliticianFlatRecord` objects. The complete field set (from `C:\EV-Accounts\backend\src\lib\essentialsService.ts`):

```typescript
interface PoliticianFlatRecord {
  id: string;                        // UUID — use as stable identifier
  external_id: number | null;        // Cicero/BallotReady external ID
  first_name: string;
  middle_initial: string;
  last_name: string;
  preferred_name: string;
  name_suffix: string;
  full_name: string;                 // pre-formatted display name
  party: string;                     // "Democratic", "Republican", "Independent", etc.
  photo_origin_url: string;          // photo URL (prefers photo_custom_url, falls back to photo_origin_url)
  web_form_url: string;              // contact form URL
  urls: string[] | null;             // official website URLs
  email_addresses: string[] | null;
  office_title: string;              // e.g. "U.S. Representative", "Mayor", "City Council Member"
  representing_state: string;        // 2-letter state code
  representing_city: string;
  district_type: string;             // see District Type Enum below
  district_label: string;            // human-readable district name, e.g. "Indiana's 9th Congressional District"
  district_id: string;               // UUID of the district record
  geo_id: string;                    // TIGER/Line GEOID — use this to match slice jurisdiction
  mtfcc: string;                     // Census MTFCC code (geography type)
  chamber_name: string;              // e.g. "House of Representatives"
  chamber_name_formal: string;
  government_name: string;           // e.g. "United States Congress"
  government_body_name: string;      // display name of the governing body
  government_body_url: string;       // official website
  is_elected: boolean;
  is_appointed: boolean;
  faces_retention_vote: boolean;
  election_frequency: string;
  committees: Array<{ name: string; position: string; urls: string[] }>;
  bio_text: string | null;
  slug: string | null;               // URL slug for politician profile page on EV
  is_incumbent: boolean;
  term_start: string;
  term_end: string;
  term_date_precision: string;
  appointment_date: string;
  office_description: string;
  is_vacant: boolean;
  vacant_since: string | null;
  images: Array<{ id: string; url: string; type: string; photo_license: string }>;
}
```

**Response headers on `representatives/me`:**
- `X-Data-Status`: `"fresh"` | `"no-geofence-data"` — indicates whether the geofence query returned results
- `X-Formatted-Address`: The user's address string used for display (e.g., `"12048 CULVER BLVD, LOS ANGELES, CA 90066"`)

#### District Type Enum

The `district_type` field maps directly to jurisdiction levels:

| `district_type` | Civic Spaces Slice Level | Description |
|---|---|---|
| `SCHOOL` | `neighborhood` | Unified school district |
| `LOCAL` | `local` | City, municipality, special district |
| `LOCAL_EXEC` | `local` | City mayor/executive office |
| `COUNTY` | `local` | County government |
| `JUDICIAL` | `local` | County-level court |
| `STATE_UPPER` | `state` | State senate |
| `STATE_LOWER` | `state` | State house/assembly |
| `STATE_EXEC` | `state` | Governor and state executive offices |
| `NATIONAL_LOWER` | `federal` | U.S. House of Representatives |
| `NATIONAL_UPPER` | `federal` | U.S. Senate |
| `NATIONAL_EXEC` | `federal` | President/Vice President |
| `NATIONAL_JUDICIAL` | `federal` | Federal courts (Supreme Court, etc.) |

The Civic Spaces widget "Representing This Community" can filter by `district_type` to show reps appropriate to each slice level. Each slice's `geoid` field on `civic_spaces.slices` should match the `geo_id` field on the politician record.

#### Profile URL Construction

The `slug` field (when non-null) supports linking to the politician's Empowered Essentials profile page. The integration guide documents the public endpoint:

```
GET /api/candidates/:slug
```

No auth required. This is the Empowered Vote candidate profile page — Civic Spaces can deep-link to it.

---

### 3. Auth Compatibility — Does It Accept cs_token?

Yes, with a critical nuance.

The Civic Spaces `cs_token` (JWT stored in localStorage, issued by `accounts.empowered.vote`) is a **standard Supabase JWT**. The EV-Accounts backend verifies it with:

```typescript
const { payload } = await jwtVerify(token, SECRET_KEY, {
  issuer: `${process.env.SUPABASE_URL}/auth/v1`,
  audience: 'authenticated',
});
```

Both Civic Spaces and EV-Accounts use the **same shared Supabase project**. The same `SUPABASE_URL` and `SUPABASE_JWT_SECRET` are in play. The `cs_token` is therefore valid for the EV-Accounts backend's auth middleware with no modification.

**However:** The `representatives/me` endpoint requires `requireConnected` — the user must be Connected tier (have a `connect.connected_profiles` row with `verification_status = 'verified'`). Inform-tier Civic Spaces users will receive 403.

**Civic Spaces implication:** The "Representing This Community" sidebar widget cannot use `representatives/me` for Inform-tier users. It must fall back to the public `address-search` endpoint with a known address, or display an upsell to Connect.

---

### 4. Known Gaps and Pending Issues

Three documented issues affect rep data accuracy. All sourced from internal team documents dated 2026-03-29 to 2026-03-30.

#### Gap A — City Officials Missing on First Login (Known Bug, Partially Fixed)

**Status as of 2026-04-05:** Partially fixed. District-level geo_ids (congressional, state senate, state house, county, school) are now populated at `set-location` time (via `resolve_user_jurisdiction` RPC). However, city/LOCAL district geo_ids are NOT stored in `connected_profiles` because there are no columns for them. The path used to get LOCAL/LOCAL_EXEC officials (`getLocalOfficialsByUserId`) calls a separate PostGIS RPC (`connect.resolve_user_local_officials`) which decrypts the user's encrypted coordinates at query time.

**Consequence for Civic Spaces:** On first login, `representatives/me` correctly returns congressional/state reps but relies on a live coordinate-decryption call for city council members and mayors. This call happens server-side and is transparent — there is no frontend workaround needed. The documented bug (city officials missing) was `BUG-03` and was partially addressed by quick-011 (2026-03-30). Confirm with the accounts team whether this is fully resolved.

#### Gap B — Representative Data by GEOID (Missing Endpoint)

There is **no endpoint that accepts a GEOID directly** and returns the reps for that district. The representative lookup chain is:

1. **Authenticated user with saved address:** `GET /api/essentials/representatives/me` — uses stored encrypted coordinates
2. **Any address string:** `GET /api/essentials/address-search?address=<string>` — geocodes via Census, then PostGIS
3. **No GEOID-to-reps endpoint exists**

**Consequence for Civic Spaces:** The "Representing This Community" widget cannot call "give me reps for GEOID 1807" (Indiana's 9th Congressional District). It must either:
- Call `address-search` with a representative address in that jurisdiction (e.g., the centroid), or
- Ask the accounts team for a new endpoint `GET /api/essentials/reps-by-geoid?geo_id=<geoid>&district_type=<type>`

This is a **missing endpoint** and a real gap. The widget intent is to show reps for a slice's jurisdiction — Civic Spaces knows the GEOID for each slice, not an address within it.

#### Gap C — Cicero Data Corruption (CA, Partially Fixed)

**Status as of 2026-04-05:** BUG-01 was fixed by quick-010 (2026-03-30). The campaign finance import that corrupted 50+ California politicians' district data was repaired. However, the full list of affected politicians and whether all district rows were restored from backup has not been independently verified in this research. California results from the API should be tested before launch.

#### Gap D — Pre-computed District Fields Freshness

`connected_profiles` district geo_ids (congressional, state senate, etc.) are populated at `set-location` time but are not automatically refreshed after redistricting. The accounts team request document (ACCOUNTS-TEAM-REQUEST-representatives-me.md) asks for a weekly staleness-check background job that has not yet been confirmed as built. Districts last updated at redistricting (2022 cycle, in effect through ~2032 for most jurisdictions) — this is low urgency for now but will matter at the next redistricting cycle.

---

### 5. Jurisdiction Mapping — GEOID to Reps

**How the accounts system maps GEOID to reps internally:**

The `essentials.geofence_boundaries` table stores PostGIS polygon geometries indexed by `geo_id` (TIGER/Line GEOID) and `mtfcc` (geography type). A point-in-polygon query (`ST_Covers`) finds all district polygons containing the user's coordinates, then joins to `essentials.districts → essentials.offices → essentials.politicians`.

The `connect.connected_profiles` table stores pre-computed GEOIDs:

```
congressional_geo_id         e.g. "1807" (Indiana's 9th)
state_senate_geo_id          e.g. "18047" (Indiana Senate District 47)
state_house_geo_id           e.g. "18080" (Indiana House District 80)
county_geo_id                e.g. "18097" (Monroe County, FIPS)
school_district_geo_id       e.g. unified school district GEOID
```

These are TIGER/Line GEOIDs — the same format used in the `civic_spaces.slices.geoid` column. This means the Civic Spaces slice's `geoid` can be directly compared to the politician's `geo_id` field in the rep response to verify that a returned rep belongs to that slice's jurisdiction.

**Mapping gaps:** The `connected_profiles` table has no column for `city_geo_id`, `local_district_geo_id`, or `local_exec_geo_id`. City council and mayoral reps are resolved only via live coordinate lookup — there is no pre-computed GEOID for the LOCAL/LOCAL_EXEC district types.

---

### 6. Integration Approach for "Representing This Community" Widget

#### Recommended Architecture

Do NOT call `representatives/me` directly from the Civic Spaces frontend for the widget. Three reasons:

1. The endpoint requires Connected tier — Inform-tier users would get 403
2. It returns ALL of a user's reps across all jurisdictions — the widget needs only reps for a specific slice's jurisdiction
3. Calling it cross-origin from the Civic Spaces frontend to the accounts API creates a CORS dependency and leaks the call pattern

**Recommended approach: Backend proxy with GEOID filter**

Build a Civic Spaces API route that:

```
GET /api/civic-spaces/slices/:sliceId/representatives
Authorization: Bearer <cs_token>   (optional — degrades gracefully for Inform tier)
```

This route:
1. Looks up the slice's `geoid` and `level` from `civic_spaces.slices`
2. If the user is Connected: calls `GET /api/essentials/representatives/me` on the accounts API, passing the user's `cs_token` as `Authorization: Bearer` — filters the response to only reps whose `geo_id` matches the slice's geoid OR whose `district_type` matches the slice level
3. If the user is Inform (no valid Connected JWT): calls `GET /api/essentials/address-search?address=<centroid-address>` with a representative address for that GEOID, filtering results the same way

The proxy approach keeps the accounts API call server-side, avoids CORS issues, and allows Civic Spaces to cache results (rep data is stable, changes rarely).

**Alternative if proxy is too heavy:** Ask the accounts team to expose:

```
GET /api/essentials/reps-by-geoid?geo_id=<geoid>&district_type=<type>
```

No auth required (public data). This would be the cleanest integration — Civic Spaces passes the slice's GEOID directly and gets back the reps for that jurisdiction. This is the endpoint that logically should exist but does not yet.

#### Data Available for Widget Cards

Given the `PoliticianFlatRecord` shape, each rep card can display:

| Widget Card Field | Source Field | Availability |
|---|---|---|
| Name | `full_name` | Always present |
| Title | `office_title` | Always present |
| Party | `party` | Always present (may be empty string) |
| Photo | `photo_origin_url` | Present if politician has a photo; empty string if not |
| Jurisdiction level | `district_type` | Always present — use to label the card |
| District label | `district_label` | Always present — e.g. "Indiana's 9th Congressional District" |
| Profile link | `slug` — construct URL as `https://empowered.vote/candidates/<slug>` | Present for most Empowered candidates; null for some local officials |
| Government body | `government_name` or `government_body_name` | Always present |
| Contact form | `web_form_url` | Present for federal/state; often empty for local |
| Bio snippet | `bio_text` | Nullable — present for some, not all |

**Missing fields (not in API response):**
- Social media handles (Twitter/X, Facebook) — not in the response shape
- Direct office phone/email — available in `PoliticianDetail` (the `/:id` endpoint) but not in the flat list response; would require a second call per rep
- Term status ("Up for election in 2026") — `term_end` is present but requires date logic to compute "next election" label

#### Auth Token Forwarding

When Civic Spaces backend calls `representatives/me` on behalf of a Connected user, forward the `cs_token` verbatim as `Authorization: Bearer <cs_token>`. The accounts backend will verify it against the shared Supabase JWT secret. No token exchange or translation needed — it is the same token.

---

### 7. Summary of Gaps for v3.0 Roadmap

| Gap | Severity | Workaround Available? | Action Required |
|---|---|---|---|
| No GEOID-to-reps endpoint | HIGH | Use `address-search` with centroid address, or build proxy + filter | Request new endpoint from accounts team OR build Civic Spaces proxy route |
| City officials missing from pre-computed path (BUG-03) | MEDIUM | `representatives/me` does a live coordinate lookup — transparent if fixed | Confirm with accounts team that quick-011 resolved this fully |
| Inform-tier users cannot call `representatives/me` | MEDIUM | Fall back to `address-search` for non-Connected users | Build proxy route that degrades gracefully |
| CA data corruption (BUG-01) | MEDIUM | Fixed per quick-010; unverified | Test CA addresses before launch |
| No direct phone/email in flat record | LOW | Second call to `GET /api/essentials/politicians/:id` | Fetch on demand when user opens a rep card detail view |
| No social media handles | LOW | None | Accept limitation; links to EV profile page cover this |
| District staleness (no redistricting refresh job) | LOW (until 2032) | None needed now | Note for post-launch maintenance |

---

### 8. Source Files Consulted

All findings are sourced directly from production code and internal team documents — confidence is HIGH.

| File | What It Tells Us |
|---|---|
| `C:\EV-Accounts\backend\src\routes\essentials.ts` | Exact endpoint definition, auth guards, 3-path fallback logic for `representatives/me` |
| `C:\EV-Accounts\backend\src\lib\essentialsService.ts` | Full `PoliticianFlatRecord` type, complete SQL for both address-based and GEOID-based lookups, `getLocalOfficialsByUserId` for city officials |
| `C:\EV-Accounts\backend\src\routes\connect.ts` | `POST /api/connect/set-location` — shows which geo_ids are stored (congressional, state senate, state house, county, school) and which are absent (city/LOCAL) |
| `C:\EV-Accounts\empowered-accounts-integration-guide.md` | Auth token verification pattern, JWT secret sharing model, confirms same Supabase project |
| `C:\EV-Accounts\ACCOUNTS-TEAM-REQUEST-representatives-me.md` | Documents the city-officials gap, the 3 asks sent to the accounts team (fix coordinates, populate geo_ids, weekly staleness check), privacy model |
| `C:\EV-Accounts\ACCOUNTS-TEAM-NOTE-representatives-me-2026-03-30.md` | Bug report confirming pre-computed geo_ids were null and coordinates were being ignored |
| `C:\EV-Accounts\BUGS-2026-03-30.md` | BUG-03 confirms city officials issue is partially pending as of 2026-03-30 |
| `C:\EV-Backend\internal\essentials\routes.go` | Go backend routes — confirms no `/representatives/me` equivalent exists there; rep data is entirely in the Express accounts backend |
| `C:\EV-Backend\internal\essentials\handlers.go` | `OfficialOut` struct — confirms response field parity between Go and Express |
