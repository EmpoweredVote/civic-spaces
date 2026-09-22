# Phase 5: Moderation & Safety - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can flag harmful content, block other users, and moderators can act on flagged posts — the forum is safe enough to open beyond invite-only testers. Scope includes: flag submission flow, block mechanics, moderator review queue, and action logging. Scheduled/automated moderation, appeals, and advanced routing are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Flagging behavior
- Toast confirmation on submit ("Thanks, we'll review this") — soft acknowledge, not silent
- Personal visual indicator on the flagged post (filled/colored flag icon, only visible to the flagger)
- Content stays fully visible to all users after flagging — no auto-hide
- 5+ unique flaggers on the same post → automatically escalate to high priority in the moderator queue
- No public flag counts shown on posts

### Block scope
- Full mutual hide — when A blocks B, neither sees the other's posts in the feed
- Blocked user cannot reply to the blocker's posts or send a friend request
- If the blocked user attempts to interact (visit profile, send request), they see a generic "unavailable" — no confirmation that a block exists
- Block is one-sided in initiation but symmetric in feed effect

### Moderator queue UX
- Single-item focus layout — one flagged post fills the screen at a time, full thread shown with flagged post highlighted
- Queue depth indicator (e.g., "3 in queue") visible so mods know backlog size
- Per-item metadata shown: reporter count, flag categories, timestamp
- Moderator actions available on each item:
  - **Remove** — soft delete (`is_deleted = true`), content hidden from feed
  - **Dismiss** — mark flag as resolved, no action taken on content
  - **Warn** — send notification to post author that their content was reviewed
  - **Suspend** — suspend the user directly from the queue
- All actions logged to action log table with moderator ID + timestamp + action taken

### Flag categories
- 4 categories: **Spam**, **Harassment**, **Misinformation**, **Other**
- "Other" includes an optional short free-text field for context
- Category is metadata shown in the moderator queue — no mechanical routing or separate queues in Phase 5
- Categories shown as filterable/sortable in the queue

### Claude's Discretion
- Exact threshold tuning (5 flaggers is the target, ±1 acceptable)
- Visual design of the personal flag indicator
- Exact copy for toast, warn notification, and "unavailable" message
- Compression algorithm for action log storage
- Queue sort order when multiple flags exist at equal priority

</decisions>

<specifics>
## Specific Ideas

- The flag indicator should feel like a "you've flagged this" state — similar to a liked/bookmarked toggle, just in a flagging context
- The moderator queue should feel like a deliberate review tool (Linear/Zendesk), not a dashboard — one thing at a time, full context

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-moderation-safety*
*Context gathered: 2026-03-28*
