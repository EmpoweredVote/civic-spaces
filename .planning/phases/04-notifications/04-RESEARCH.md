# Phase 4: Notifications - Research

**Researched:** 2026-03-28
**Domain:** PostgreSQL notifications table + triggers, Supabase Realtime postgres_changes, TanStack Query unread count, React popover (desktop) + react-modal-sheet (mobile), notification grouping SQL
**Confidence:** HIGH (core patterns verified via official Supabase docs and codebase), MEDIUM (grouping SQL derived from PostgreSQL fundamentals)

---

## Summary

Phase 4 adds a notification system built as a consumer of a platform-level notification feed. The deliverable is a notifications table contract, DB triggers that populate it, and consumer UI against a stub interface. No new npm packages are required — the full stack is already installed. The key design challenge is the grouping schema: a 24-hour collapsing window for replies to the same post, and an upsert-on-conflict pattern for grouped notifications.

The unread badge feeds from a React Query query with Supabase Realtime invalidation — the same pattern established in Phase 3 (useBoostedFeed owns its own channel; this phase's useNotifications does the same). Desktop shows a plain positioned `div` popover anchored below the bell; mobile shows a `react-modal-sheet` bottom sheet. No additional library is needed for the popover — the project uses Tailwind without shadcn/ui or Radix, so a custom focus-outside-close pattern is the established project pattern.

The critical architectural constraint is the stub-first approach: define `NotificationStub` interface matching the platform feed contract, implement all hooks and UI against it, then swap the stub for the real Supabase query later. This is the only way to avoid coupling Phase 4 to the accounts team timeline.

**Primary recommendation:** Build a `civic_spaces.notifications` table with trigger-based inserts (AFTER INSERT on replies, AFTER UPDATE on friendships), upsert grouping for the 24-hour window, Supabase Realtime invalidation on the per-user channel, and a two-layout bell component (popover on `md:` breakpoint, Sheet on mobile).

---

## Standard Stack

No new npm packages are needed. All are already installed.

### Already Installed

| Library | Version | Phase 4 Use |
|---------|---------|-------------|
| `@supabase/supabase-js` | ^2.100.1 | DB queries, Realtime channel |
| `@tanstack/react-query` | ^5.95.2 | useNotifications, unread count, mark-read mutations |
| `react-modal-sheet` | ^3.5.0 | Mobile bottom sheet for notification list |
| `motion` | ^11.18.2 | Popover open/close animation (already installed, not yet used) |
| `date-fns` | ^4.1.0 | `formatDistanceToNow` for relative timestamps (used in PostCard, ReplyCard) |
| `tailwindcss` | ^4.2.2 | All styling |

### No New npm Packages Needed

The notification bell popover is a positioned `div` with Tailwind — the project has no shadcn/ui or Radix, so don't add them. react-modal-sheet covers the mobile Sheet. motion covers the animation.

---

## Architecture Patterns

### Recommended Project Structure Additions

```
src/
├── components/
│   ├── NotificationBell.tsx      # Bell icon + badge + conditional layout dispatcher
│   ├── NotificationList.tsx      # Shared list renderer (used by both popover and sheet)
│   └── NotificationItem.tsx      # Single row: avatar + copy + timestamp + unread dot
├── hooks/
│   └── useNotifications.ts       # Query + realtime + mark-read mutations
└── types/
    └── database.ts               # Add Notification, NotificationGroup types
```

### Pattern 1: Grouped Notifications Table Schema

**What:** A single `notifications` table stores one row per notification group, with an `event_count` and `actor_ids` array. When a new event arrives (trigger or RPC), an upsert increments the count if a matching group row exists within the 24-hour window.

**Schema:**

```sql
-- In civic_spaces schema
CREATE TABLE civic_spaces.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  text NOT NULL,                          -- auth.jwt() ->> 'sub'
  event_type    text NOT NULL,                          -- 'reply' | 'friend_request' | 'friend_accepted'
  reference_id  text NOT NULL,                          -- post_id for replies, user_id for friend events
  actor_ids     text[] NOT NULL DEFAULT '{}',           -- array of actor user_ids (for grouped display)
  event_count   integer NOT NULL DEFAULT 1,
  is_read       boolean NOT NULL DEFAULT false,
  group_window  date NOT NULL DEFAULT CURRENT_DATE,     -- collapses same-day events
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for grouping: same recipient + event_type + reference_id + same day
CREATE UNIQUE INDEX notifications_group_idx
  ON civic_spaces.notifications (recipient_id, event_type, reference_id, group_window)
  WHERE is_read = false;
```

**Why this schema:**
- `group_window = CURRENT_DATE` is the 24-hour collapsing key — all replies to the same post on the same day collapse into one row
- `actor_ids` array grows via `array_append` on upsert — enables "5 people replied" rendering
- `is_read = false` in the partial index means a read notification starts a new group if the same event recurs
- `reference_id` is `post_id` for replies, sender `user_id` for friend requests (not post content — just the navigation target ID)

**Upsert trigger function:**

```sql
-- Source: PostgreSQL docs + Supabase trigger pattern
CREATE OR REPLACE FUNCTION civic_spaces.notify_on_reply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_post_owner text;
BEGIN
  -- Get post owner
  SELECT user_id INTO v_post_owner
  FROM civic_spaces.posts
  WHERE id = NEW.post_id AND NOT is_deleted;

  -- Don't notify if replying to own post
  IF v_post_owner IS NULL OR v_post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO civic_spaces.notifications
    (recipient_id, event_type, reference_id, actor_ids, event_count, group_window)
  VALUES
    (v_post_owner, 'reply', NEW.post_id, ARRAY[NEW.user_id], 1, CURRENT_DATE)
  ON CONFLICT (recipient_id, event_type, reference_id, group_window)
    WHERE is_read = false
  DO UPDATE SET
    actor_ids   = CASE
                    WHEN NEW.user_id = ANY(notifications.actor_ids)
                    THEN notifications.actor_ids           -- same actor, don't double-count
                    ELSE array_append(notifications.actor_ids, NEW.user_id)
                  END,
    event_count = notifications.event_count + 1,
    updated_at  = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER reply_notification
  AFTER INSERT ON civic_spaces.replies
  FOR EACH ROW EXECUTE FUNCTION civic_spaces.notify_on_reply();
```

**Same-user-replies-twice decision (Claude's discretion):** Count as 1 actor (their user_id already in `actor_ids`) but increment `event_count`. Display as "5 replies to your post" not "5 people". This is honest — it shows total activity, not unique actors.

### Pattern 2: Friend Request / Accepted Notifications

```sql
CREATE OR REPLACE FUNCTION civic_spaces.notify_on_friendship_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Friend request sent: notify the receiver
  IF TG_OP = 'INSERT' THEN
    -- NEW.status = 'REQ_LOW' means user_low sent to user_high
    IF NEW.status = 'REQ_LOW' THEN
      INSERT INTO civic_spaces.notifications
        (recipient_id, event_type, reference_id, actor_ids, event_count, group_window)
      VALUES
        (NEW.user_high, 'friend_request', NEW.user_low, ARRAY[NEW.user_low], 1, CURRENT_DATE)
      ON CONFLICT (recipient_id, event_type, reference_id, group_window)
        WHERE is_read = false
      DO UPDATE SET
        event_count = notifications.event_count + 1,
        updated_at  = now();
    ELSE
      -- REQ_HIGH: user_high sent to user_low
      INSERT INTO civic_spaces.notifications
        (recipient_id, event_type, reference_id, actor_ids, event_count, group_window)
      VALUES
        (NEW.user_low, 'friend_request', NEW.user_high, ARRAY[NEW.user_high], 1, CURRENT_DATE)
      ON CONFLICT (recipient_id, event_type, reference_id, group_window)
        WHERE is_read = false
      DO UPDATE SET
        event_count = notifications.event_count + 1,
        updated_at  = now();
    END IF;

  -- Friendship accepted: notify the original requester
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'FRIEND' AND OLD.status != 'FRIEND' THEN
    -- user_high accepted → notify user_low (or vice versa based on who requested)
    IF OLD.status = 'REQ_LOW' THEN
      -- user_low requested, user_high accepted → notify user_low that user_high accepted
      INSERT INTO civic_spaces.notifications
        (recipient_id, event_type, reference_id, actor_ids, event_count, group_window)
      VALUES
        (NEW.user_low, 'friend_accepted', NEW.user_high, ARRAY[NEW.user_high], 1, CURRENT_DATE)
      ON CONFLICT (recipient_id, event_type, reference_id, group_window)
        WHERE is_read = false
      DO UPDATE SET updated_at = now();
    ELSE
      INSERT INTO civic_spaces.notifications
        (recipient_id, event_type, reference_id, actor_ids, event_count, group_window)
      VALUES
        (NEW.user_high, 'friend_accepted', NEW.user_low, ARRAY[NEW.user_low], 1, CURRENT_DATE)
      ON CONFLICT (recipient_id, event_type, reference_id, group_window)
        WHERE is_read = false
      DO UPDATE SET updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER friendship_notification
  AFTER INSERT OR UPDATE ON civic_spaces.friendships
  FOR EACH ROW EXECUTE FUNCTION civic_spaces.notify_on_friendship_change();
```

### Pattern 3: RLS on Notifications Table

Following the established project pattern (auth.jwt() ->> 'sub', (select ...) subquery wrapping):

```sql
ALTER TABLE civic_spaces.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications_select"
  ON civic_spaces.notifications FOR SELECT
  TO authenticated
  USING (recipient_id = (SELECT auth.jwt() ->> 'sub'));

-- Users can only update their own notifications (mark as read)
CREATE POLICY "notifications_update"
  ON civic_spaces.notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = (SELECT auth.jwt() ->> 'sub'));

-- No direct inserts from client — triggers handle all inserts
-- No DELETE from client
```

### Pattern 4: Supabase Realtime for Notifications

The private schema (`civic_spaces`) requires explicit publication and grant setup. Following the existing pattern from Phase 2/3:

```sql
-- Required for Realtime on private schema table
GRANT SELECT ON civic_spaces.notifications TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE civic_spaces.notifications;
```

**Client subscription — filter by recipient_id:**

```typescript
// Source: Supabase Realtime postgres_changes docs
const channel = supabase
  .channel(`notifications-${userId}`)
  .on(
    'postgres_changes',
    {
      event: '*',           // INSERT (new notif) + UPDATE (read state)
      schema: 'civic_spaces',
      table: 'notifications',
      filter: `recipient_id=eq.${userId}`,
    },
    () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  )
  .subscribe()
```

**Critical:** The filter `recipient_id=eq.${userId}` means each client only receives their own notification changes — Supabase Realtime enforces this at the subscription level, and RLS provides a second layer of enforcement.

### Pattern 5: useNotifications Hook

Following the established project hook pattern (React Query + Supabase + inline Realtime):

```typescript
// Source: useBoostedFeed.ts pattern from Phase 3
export function useNotifications() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  // Realtime invalidation — owns its own channel
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'civic_spaces',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, queryClient])

  const query = useQuery({
    queryKey: ['notifications', userId ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Notification[]
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })

  // Derived unread count — capped at 99
  const unreadCount = Math.min(
    (query.data ?? []).filter(n => !n.is_read).length,
    99
  )

  return { notifications: query.data ?? [], unreadCount, isLoading: query.isLoading }
}
```

### Pattern 6: Mark as Read Mutations

```typescript
// Individual mark-read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })
}

// Mark all read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', userId!)    // RLS enforces this anyway
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })
}
```

### Pattern 7: NotificationBell Component Layout

The project has no Radix/shadcn — use a positioned `div` for the popover. The `md:` breakpoint controls which layout renders.

```typescript
// Popover: positioned div, closed on click-outside via useEffect
// Mobile: react-modal-sheet Sheet (already used in UserProfileCard)

export default function NotificationBell() {
  const { unreadCount } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery('(max-width: 767px)')   // or Tailwind breakpoint check

  // Click-outside close for popover
  useEffect(() => {
    if (!isOpen || isMobile) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, isMobile])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setIsOpen(prev => !prev)} aria-label="Notifications">
        {/* Bell SVG */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-600
                           rounded-full text-[10px] font-bold text-white
                           flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Desktop popover */}
      {!isMobile && isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl
                        border border-gray-200 z-50 overflow-hidden">
          <NotificationList onClose={() => setIsOpen(false)} />
        </div>
      )}

      {/* Mobile bottom sheet */}
      {isMobile && (
        <Sheet isOpen={isOpen} onClose={() => setIsOpen(false)} snapPoints={[0.75]}>
          <Sheet.Container>
            <Sheet.Header />
            <Sheet.Content>
              <NotificationList onClose={() => setIsOpen(false)} />
            </Sheet.Content>
          </Sheet.Container>
          <Sheet.Backdrop onTap={() => setIsOpen(false)} />
        </Sheet>
      )}
    </div>
  )
}
```

**useMediaQuery hook:** Implement a minimal `useMediaQuery` using `window.matchMedia` — no library needed. Or detect using Tailwind's hidden/block trick with CSS at render time.

### Pattern 8: Grouped Notification Copy

```typescript
// Source: product decisions in CONTEXT.md
function getNotificationCopy(n: Notification): string {
  const actorCount = n.actor_ids.length
  const truncatedExcerpt = (title: string) =>
    title.length > 40 ? title.slice(0, 37) + '...' : title

  switch (n.event_type) {
    case 'reply':
      if (actorCount === 1) {
        // Single actor: "Jane replied to your post"
        return `replied to your post`
      }
      // Grouped: "5 people replied to your post 'Should we add a bike...'"
      return `${n.event_count} ${n.event_count === 1 ? 'reply' : 'replies'} on your post`

    case 'friend_request':
      if (actorCount === 1) return `sent you a friend request`
      return `${actorCount} people sent you a friend request`

    case 'friend_accepted':
      return `accepted your friend request`

    default:
      return `new notification`
  }
}
```

**Truncation length:** 40 characters for post excerpts in grouped copy. This fits comfortably in a 320px popover at 14px font.

### Pattern 9: Tap Navigation Behavior

```typescript
// Notification tap handler — closes panel + navigates
function handleNotificationTap(n: Notification, onClose: () => void) {
  // Mark as read first
  markRead(n.id)
  onClose()   // panel closes automatically per product decision

  switch (n.event_type) {
    case 'reply':
      // Navigate to thread, scroll to first unread reply
      // reference_id = post_id
      navigate(`/thread/${n.reference_id}`, { state: { scrollToFirstUnread: true } })
      break
    case 'friend_request':
      // Open UserProfileCard for sender
      // reference_id = sender user_id
      setProfileUserId(n.reference_id)
      break
    case 'friend_accepted':
      // Open UserProfileCard for new friend
      setProfileUserId(n.reference_id)
      break
  }
}
```

**AppShell integration:** `NotificationBell` needs access to `setProfileUserId` and navigation. Option A: lift `setProfileUserId` up into AppShell (already exists there) and pass `onOpenProfile` prop to `NotificationBell`. Option B: make `setProfileUserId` accessible via a lightweight Zustand store. **Prefer Option A** — consistent with how AppShell already owns `UserProfileCard` state.

### Pattern 10: Stub Interface

```typescript
// src/lib/notificationStub.ts
// Stub matches the real platform notification feed contract.
// Swap this file when accounts team delivers.

export interface NotificationContract {
  id: string
  recipient_id: string
  event_type: 'reply' | 'friend_request' | 'friend_accepted'
  reference_id: string    // post_id | user_id
  actor_ids: string[]
  event_count: number
  is_read: boolean
  group_window: string    // ISO date string
  created_at: string
  updated_at: string
}
```

### Anti-Patterns to Avoid

- **Polling for unread count:** Don't use `setInterval` — use Supabase Realtime invalidation, same as the feed. Polling creates unnecessary load and is out of pattern with the rest of the codebase.
- **Separate unread-count query:** Don't add a second query just for the badge number. Derive `unreadCount` from the notifications list query: `data.filter(n => !n.is_read).length`. One query, one channel.
- **Hard-coding recipient_id in SQL client-side:** Let RLS enforce it. The `UPDATE ... WHERE is_read = false` mutation doesn't need an explicit `recipient_id` filter because RLS policy enforces it. But do add it for clarity and defense-in-depth.
- **Nested notification channels:** Don't reuse the existing feed channels — create a separate `notifications-${userId}` channel. The useBoostedFeed channel is `boosted-feed-${sliceId}`.
- **Per-reply unread row tracking:** The 24-hour grouping key (`group_window`) combined with `is_read` on the notification row is sufficient for the UX requirement. Don't add a separate `notification_reads` join table — that's over-engineering for the current scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative timestamps | Custom formatter | `formatDistanceToNow` from date-fns (already installed) | Handles edge cases, locale, DST |
| Bottom sheet (mobile) | Custom slide-up animation | `react-modal-sheet` (already installed) | Already used in UserProfileCard, consistent UX |
| Popover animation | Custom CSS transition | `motion` `AnimatePresence` (already installed) | Handles mount/unmount animation cleanly |
| Click-outside detection | Fraile `useRef` + addEventListener | Established project pattern (it's simple, do it inline) | No library needed for a single element |
| Unread count storage | Redis counter or server-side count | Derive from React Query data | Over-engineering; list is capped at 50 items |

**Key insight:** Every non-DB problem in this phase has a solution already installed. The only novel work is the notifications table schema and the trigger functions.

---

## Common Pitfalls

### Pitfall 1: Partial Index Conflict on group_window

**What goes wrong:** The `ON CONFLICT` clause references a partial index (`WHERE is_read = false`). If the index is not created correctly, upserts fall through to duplicate inserts instead of incrementing counts.

**Why it happens:** Postgres partial index conflict requires exact match of the `WHERE` predicate in the `ON CONFLICT` clause.

**How to avoid:** The `ON CONFLICT (recipient_id, event_type, reference_id, group_window) WHERE is_read = false` syntax must match the index definition verbatim. Test with a known duplicate before deploying.

**Warning signs:** Multiple rows with the same `recipient_id + event_type + reference_id + group_window` where `is_read = false` — that means grouping is broken.

### Pitfall 2: Realtime Not Firing on civic_spaces Schema

**What goes wrong:** Realtime channel set up with `schema: 'civic_spaces'` but changes never arrive.

**Why it happens:** Private schemas require both a `GRANT SELECT` and `ALTER PUBLICATION supabase_realtime ADD TABLE` for Realtime to broadcast changes.

**How to avoid:** Include both SQL statements in the migration:
```sql
GRANT SELECT ON civic_spaces.notifications TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE civic_spaces.notifications;
```

**Warning signs:** Channel subscribes successfully (no error) but the callback never fires when rows are inserted.

### Pitfall 3: auth.jwt() ->> 'sub' vs auth.uid() in Triggers

**What goes wrong:** Trigger functions use `auth.uid()` which always returns `null` in this project (external JWT doesn't populate auth.uid()).

**Why it happens:** This project uses `auth.jwt() ->> 'sub'` throughout — documented in STATE.md. Triggers run as the role that caused the change; `auth.uid()` is not populated by the project's auth model.

**How to avoid:** Triggers don't call `auth.uid()` or `auth.jwt()` — they use `NEW.user_id` from the row being inserted (the actual source of truth). No auth function is needed inside trigger functions.

**Warning signs:** `recipient_id` is always `null` in inserted notification rows.

### Pitfall 4: Notification Bell in AppShell — Prop Threading

**What goes wrong:** `NotificationBell` needs to open `UserProfileCard` for friend event taps, but `setProfileUserId` lives in AppShell. Passing it through multiple component layers creates prop-drilling.

**Why it happens:** AppShell already owns the `UserProfileCard` state via the `onAuthorTap` pattern established in Phase 3.

**How to avoid:** Add `onOpenProfile` prop to `NotificationBell` (same pattern as `onAuthorTap` in SliceFeedPanel). AppShell passes `setProfileUserId` directly to `NotificationBell`. One level of prop passing — no drilling.

### Pitfall 5: Sheet + Popover State Collision

**What goes wrong:** On mobile, `isOpen` triggers both a Sheet and a popover div simultaneously if breakpoint detection is wrong.

**Why it happens:** Forgetting to conditionally render — if both branches render with `isOpen`, the popover div is visible under the Sheet on mobile.

**How to avoid:** Use `{!isMobile && isOpen && <div ...>}` and `{isMobile && <Sheet isOpen={isOpen} ...>}` — the Sheet's `isOpen` prop handles visibility declaratively, and the popover div only renders on non-mobile.

### Pitfall 6: group_window Uses CURRENT_DATE (Server Time)

**What goes wrong:** Using `now()::date` vs `CURRENT_DATE` — both return the same value in PostgreSQL but `CURRENT_DATE` is clearer and slightly more efficient.

**Why it happens:** Confusion about date functions.

**How to avoid:** Use `DEFAULT CURRENT_DATE` in the column definition. In the trigger function, use `CURRENT_DATE` in the INSERT VALUES clause.

---

## Code Examples

### Notification TypeScript Types

```typescript
// Add to src/types/database.ts
// Source: schema design above

export type NotificationEventType =
  | 'reply'
  | 'friend_request'
  | 'friend_accepted'

export interface Notification {
  id: string
  recipient_id: string
  event_type: NotificationEventType
  reference_id: string          // post_id for reply, user_id for friend events
  actor_ids: string[]           // user_ids of actors
  event_count: number           // total events in this group
  is_read: boolean
  group_window: string          // ISO date string (CURRENT_DATE)
  created_at: string
  updated_at: string
}

// For display — enriched with actor profile info
export interface NotificationWithActor extends Notification {
  actor: Pick<ConnectedProfile, 'display_name' | 'avatar_url'>
}
```

### formatDistanceToNow Usage (already in PostCard)

```typescript
// Source: src/components/PostCard.tsx (existing pattern)
import { formatDistanceToNow } from 'date-fns'

const timeAgo = formatDistanceToNow(new Date(notification.updated_at), { addSuffix: true })
// → "2 minutes ago", "5 hours ago", "1 day ago"
```

### Motion AnimatePresence for Popover

```typescript
// Source: motion library (Framer Motion v11 API — installed, not yet used)
import { AnimatePresence, motion } from 'motion/react'

{!isMobile && (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50"
      >
        <NotificationList onClose={() => setIsOpen(false)} />
      </motion.div>
    )}
  </AnimatePresence>
)}
```

**Note:** Import from `'motion/react'` (not `'framer-motion'`) — the `motion` package exports `motion/react` as the React-specific entry point.

### Empty State

```typescript
// When notifications.length === 0
<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
  {/* Bell icon in muted gray */}
  <svg className="w-10 h-10 text-gray-300 mb-3" .../>
  <p className="text-sm text-gray-500">You're all caught up</p>
  <p className="text-xs text-gray-400 mt-1">Replies and friend activity will appear here</p>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Polling unread count | Realtime channel invalidation | No wasted requests; instant delivery |
| One notification per event | Grouped with upsert + actor_ids array | Fewer rows, less noise for user |
| `auth.uid()` in RLS | `auth.jwt() ->> 'sub'` | Required — this project's auth model |
| Global realtime channel | Per-user filtered channel | Security + efficiency — only receives own data |

**Deprecated/outdated:**
- `auth.uid()` in any RLS or trigger: always use `auth.jwt() ->> 'sub'` in this project. This is a hard requirement documented in STATE.md.

---

## Open Questions

1. **Per-reply read tracking for grouped tap navigation**
   - What we know: Tapping a grouped reply notification should navigate to the "first unread reply" in the thread. This requires knowing which replies the current user has already seen.
   - What's unclear: Phase 2 does not implement per-reply read state. Adding it would require a `reply_reads` table or a `last_read_reply_id` per post per user.
   - Recommendation: For Phase 4, navigate to the first reply in the notification's group that was created after `group_window` date. This is a reasonable approximation — exact per-reply tracking can be deferred. Specifically: navigate to the thread, scroll to replies created on `group_window` date for that `post_id`.

2. **Post title/excerpt for grouped notification copy**
   - What we know: Grouped reply copy is "5 people replied to your post 'Should we add a bike...'" — requires the post's title or body excerpt.
   - What's unclear: The notifications table stores `reference_id` (post_id) not the content. Fetching the post content requires a join or a second query.
   - Recommendation: In `useNotifications`, after fetching notifications, batch-fetch post titles for all `reference_id` values where `event_type = 'reply'`. Same pattern as the profile batch-fetch in `useBoostedFeed`. Store in a `postExcerpts` map. Alternatively, store a `reference_excerpt` column in notifications at insert time (denormalization) — simpler and avoids the second query. **Prefer denormalized `reference_excerpt` column** stored in the trigger at insert time, since posts are soft-deleted (not mutated after creation).

3. **Accounts team platform feed integration contract**
   - What we know: The stub-first approach means we define `NotificationContract` interface now and build UI against it.
   - What's unclear: The platform team's actual payload structure is unknown — there may be field name mismatches.
   - Recommendation: Keep the stub isolated in `src/lib/notificationStub.ts` with a clear comment marking the swap point. When the platform feed delivers, the swap is a single file change.

---

## Sources

### Primary (HIGH confidence)
- Supabase Realtime postgres_changes docs (https://supabase.com/docs/guides/realtime/postgres-changes) — private schema grants, filter syntax, RLS interaction
- Supabase Trigger docs (https://supabase.com/docs/guides/database/postgres/triggers) — trigger function pattern, NEW variable
- Codebase: `src/hooks/useBoostedFeed.ts` — established Realtime + React Query + per-hook channel pattern
- Codebase: `src/components/UserProfileCard.tsx` — react-modal-sheet API (snapPoints, Sheet.Container, etc.)
- Codebase: `src/hooks/useFriendship.ts` — established mutation + invalidation pattern
- Codebase: `src/types/database.ts` — existing type patterns to extend
- `package.json` — confirmed installed: react-modal-sheet ^3.5.0, motion ^11.18.2, date-fns ^4.1.0

### Secondary (MEDIUM confidence)
- PostgreSQL partial index + ON CONFLICT pattern — derived from PostgreSQL UPSERT wiki and multiple sources; the `WHERE is_read = false` partial index conflict requirement is standard PostgreSQL behavior
- motion/react `AnimatePresence` import path — verified via package name and v11 API; LOW risk since library is already installed and the v11 API is stable

### Tertiary (LOW confidence)
- `useMediaQuery` hook pattern — standard browser API (`window.matchMedia`), multiple sources agree; no library verification needed but the exact implementation is Claude discretion

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and in use; no new installs
- DB schema and triggers: HIGH — follows established project patterns (auth.jwt() sub, RLS structure, trigger function shape) + verified against Supabase docs
- Realtime pattern: HIGH — verified against Supabase docs, confirmed grant requirement for private schemas
- Notification grouping SQL: MEDIUM — derived from PostgreSQL fundamentals (ON CONFLICT + partial index), not a canonical Supabase example; the partial index approach is correct but should be tested in migration
- UI component patterns: HIGH — directly observed in codebase (react-modal-sheet, Tailwind, project conventions)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable stack — Supabase, React Query, and react-modal-sheet APIs are stable)
