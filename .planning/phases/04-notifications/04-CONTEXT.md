# Phase 4: Notifications - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Notify users of replies to their posts/replies, incoming friend requests, and accepted friendships. Users see an unread badge on a notification bell, open a list, and can navigate to the relevant content. Low-priority events (multiple replies to same post, multiple friend requests) group rather than ping individually. No push/email notifications — in-app only.

</domain>

<decisions>
## Implementation Decisions

### Architecture
- Build as a **consumer** of the shared platform notification system — accounts team owns the notification infrastructure
- Our deliverable: define the notification contract (events we emit, data we need to display) and build consumer UI against a stub interface
- Swap stub for real platform feed when accounts team delivers
- Do NOT build a siloed Civic Spaces notification system — validation quests already has notifications, avoid duplicate systems

### Notification List UI
- **Desktop:** Dropdown/popover anchored below the bell icon
- **Mobile:** Bottom sheet (slide-up panel)
- **Item content:** Minimal — actor avatar + event type + timestamp only (no post excerpt in the item itself)
  - Examples: "Jane replied to your post · 2m" / "Tom sent a friend request · 5m"
- **Unread styling:** Blue dot + bold actor name — subtle, not aggressive
- **Philosophy:** Low-pressure; the profile page accumulates a longer-term todo-style record

### Badge & Unread Counts
- **Count display:** Exact count capped at 99+
- **Clearing:** Individual read state — badge decrements as notifications are read; user can also "Mark all read"
- **Mark as read trigger:** Tap on individual notification marks it read
- **Mark all read:** Header button inside the notification panel (visible but not prominent — escape hatch)

### Tap / Navigate Behavior
- **Reply notification** → navigate to the thread view, scroll to and highlight the triggering reply
- **Friend request notification** → open the sender's UserProfileCard (with Accept/Decline actions inline)
- **Accepted friendship notification** → open the new friend's UserProfileCard
- **After any navigation** → notification panel closes automatically

### Grouping Rules
- **Grouped events:** Replies to the same post; multiple incoming friend requests; Claude decides other bursty event types
- **Time window:** 24 hours — replies within the same day to the same post collapse into one notification
- **Grouped copy format:** Count + truncated post excerpt
  - "5 people replied to your post 'Should we add a bike...'"
  - "3 people sent you a friend request"
- **Tapping a grouped reply notification:** Navigate to first unread reply in the thread (requires per-reply read tracking)

### Claude's Discretion
- Exact grouping logic for edge cases (e.g., same user replies twice — count as 1 actor or 2 events?)
- Truncation length for post excerpts in grouped copy
- Animation/transition for panel open/close
- Empty state illustration when no notifications exist

</decisions>

<specifics>
## Specific Ideas

- "Low-pressure" is the guiding aesthetic — blue dot + bold is enough signal, not aggressive red badges
- Profile page will have an accumulating todo-style record as the longer-term notification history (separate from the bell popover which shows recent)
- Accounts team platform feed is the integration target; stub it first, real swap later

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-notifications*
*Context gathered: 2026-03-28*
