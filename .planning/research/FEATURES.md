# Features Research: Civic Spaces

> Research scope: What community forum platforms need in 2025, grounded in platform design research, civic technology literature, and behavioral patterns from Discourse, Reddit, Nextdoor, and academic CSCW/HCI research. Framed for Civic Spaces' specific context: ~6,000 pseudonymous civic participants, jurisdiction-scoped slices, mutual-friend social graph.

---

## Table Stakes (must have)

These are features users expect before they will engage at all. Absence of any of these causes immediate abandonment or distrust.

### Core Identity & Trust
- **Persistent pseudonym displayed consistently** — users must see the same display name everywhere (posts, replies, friend requests, notifications). Inconsistency breaks the sense of knowing who you're talking to. For a civic platform with pseudonymous identity this is especially critical: the pseudonym IS the civic identity.
- **Profile card on tap/hover** — when you tap someone's name, you get a minimal card: pseudonym, level/XP, slice membership, post count. Users need enough signal to assess who is speaking before engaging. Without this, all voices feel anonymous and equal in a bad way (no social credibility).
- **Clear tier/role labeling** — Empowered accounts (elected officials, civic leaders) must be visually distinguished from Connected participants. Users will not trust the forum if they can't tell who has institutional standing. This is analogous to Twitter's verified badge but scoped to civic roles.
- **Account standing enforcement** — suspended accounts must be visibly read-only from their own perspective. Posting into a void (shadow-ban without knowledge) is a reasonable approach for bad actors but the system must be reliable.

### Content Creation & Interaction
- **Post composer** — text input with a reasonable character limit (500–1500 chars for civic posts; longer than Twitter, shorter than a blog). Mobile-first: thumb-friendly, no formatting required for basic use.
- **Reply threading** — at minimum one level of threading (reply to a post). Flat replies work for small communities; Civic Spaces at 6k per slice needs threading so sub-conversations don't pollute the top-level feed. Two levels (reply to a reply) is the maximum useful depth before it becomes Reddit's infinite hell.
- **Edit window** — users must be able to edit posts within a grace period (5–30 minutes). Without this, typos and factual errors become permanent, damaging the speaker's credibility and the discourse quality.
- **Delete own content** — basic user right. Absence creates distrust.
- **Link sharing** — users must be able to paste URLs to news articles, government documents, etc. For civic discourse, linking to primary sources (bills, meeting minutes, local news) is a core participation pattern.

### Feed & Navigation
- **Visible, labeled slice navigation** — the four slice tabs (Federal, State, Local, Neighborhood) must be immediately understandable. If users can't figure out which community they're in, they disengage. The tabbed hub model in the Figma prototype directly addresses this.
- **Recency-first feed as default** — for a civic forum, users expect to see what's happening NOW. An opaque algorithm is a trust killer for civic contexts. Chronological (or recency-weighted) is the safe default.
- **Post timestamps** — always visible, always relative ("2 hours ago" or absolute for older posts). Civic discourse is time-sensitive; a post about a city council vote next Tuesday vs. last Tuesday is completely different.
- **Infinite scroll or paginated feed** — content must load as users scroll without requiring manual page navigation. Pagination is a drop-off point. Discourse's "just-in-time loading" pattern is the right model.
- **Empty state** — when a slice has no posts yet, users need a clear, warm empty state that explains what the space is for and invites them to post first. A blank screen reads as broken.

### Read-Only Baseline (Inform tier)
- **Full browse access without account** — Inform-tier users (unauthenticated or basic) must be able to read all public content. Gating read access is the fastest way to drive away potential community members. The prompt to create an account should appear at the moment of attempted write action, not at the door.
- **Inline upgrade prompts** — when an Inform user tries to post, reply, or react, a contextual modal explains what they'll get by becoming Connected and links to the Auth Hub. The prompt must feel like an invitation, not a wall.
- **Clear jurisdiction prompt for connected-but-no-location users** — "Add your location to join your Civic Spaces" with a direct link to the accounts profile page. This is a table stakes onboarding recovery path.

### Notifications (minimum)
- **Reply notifications** — when someone replies to your post, you get notified. This is the primary re-engagement mechanism. Without it, posting feels like shouting into a void.
- **Friend request notifications** — when someone sends a friend request, you must know about it. Mutual friendship is core to the social graph; broken notifications mean the social graph never forms.
- **In-app notification center** — a bell icon or equivalent showing recent activity. Users should not have to rely solely on email. In-app is lower friction and faster.
- **Notification read state** — unseen notifications must be visually distinct from seen ones. A count badge on the bell. Without this, users don't know what they've missed.

### Moderation Minimums
- **Content flagging** — any user must be able to flag a post or reply as inappropriate. Without a flag mechanism, the only remedies are ignoring bad content or leaving. Flagging gives users agency and signals to moderators.
- **Basic block/mute** — the ability to stop seeing content from a specific user. This is not censorship; it's user-controlled noise reduction. Essential for pseudonymous civic platforms where bad actors can target specific voices.

---

## Civic Differentiators

Features that are specific to Civic Spaces' mission and differentiate it from generic community forums. These are the reasons the platform exists.

### Geographic Scoping as a First-Class Feature
- **Slice identity** — each slice tab should feel like a distinct community, not just a filter. Users need to develop a sense of "my Federal Slice neighbors." The ~6,000 cap is a deliberate design choice that enables this; the platform should reinforce it (e.g., "You're 1 of 5,847 members in your Federal Slice").
- **Slice membership count visible** — showing the community size creates the "small town" feeling. Contrast with Twitter's billions-of-users ocean. "Your slice has 5,847 members" is grounding and trust-building.
- **Jurisdiction transparency** — users should understand why they're in this slice (your congressional district). This legitimizes the geographic grouping and connects it to real civic structures.
- **Empowered account prominence** — elected officials and civic leaders who have Empowered accounts should be identifiable in the feed and followable without mutual acceptance. Their posts carry institutional weight. This creates an asymmetric but legitimate authority structure in the civic context.

### Mutual Friends as Trust Infrastructure
- **Two-step mutual friend model** — both parties must accept before friendship is established. This is the correct design for a civic platform where pseudonymous participants need trust before social weight is applied. One-sided "follow" for peers would enable parasocial attachment and harassment; mutual friends enforce a real relationship signal.
- **Friends-boosted feed weighting** — posts from mutual friends appear with higher visibility in the feed. This is not algorithmic manipulation; it's replicating the "bump into someone you know" effect of a small town. It rewards relationship-building and creates familiarity over time.
- **Friend count visible on profile** — social proof that someone has built relationships in the community. A profile with 0 friends is an unknown voice; 20 friends signals a community member. This is a trust signal unique to a community forum vs. broadcast social media.

### Follow Pattern for Empowered Accounts
- **One-directional follow for Empowered (civic leaders)** — mirrors how citizens relate to elected officials in the physical world. You can follow your representative without them following you back. This is correct civic asymmetry.
- **Follow notifications for Empowered accounts** — when you follow an Empowered account, their posts appear in your feed. This is the primary channel for civic leaders to communicate with constituents within the platform.
- **Clear visual distinction between "following" (Empowered) and "friends" (peers)** — users must understand that a Friend is a mutual relationship with a civic peer, while Following is a one-way relationship with a civic leader. Conflating these creates confusion about what the social graph means.

### Civic Context Signals
- **Post jurisdiction labeling** — posts could display which slice they're in (helpful in shared UI contexts). Reinforces geographic identity.
- **Recency-first feed as default for civic appropriateness** — civic discourse is time-sensitive (votes, meetings, local events). An engagement-ranked feed would resurface old outrage and bury timely civic information. Recency is the civic-appropriate default.
- **Read-only for suspended accounts (explicit, not silent)** — suspended civic participants should see a clear explanation that they are in read-only mode. Silent shadow-banning in a civic context creates paranoia and distrust in the platform itself. Civic legitimacy requires transparency about enforcement.

### Pseudonymity-First Design
- **Display name only, everywhere** — no legal names, no email addresses, no real-world identity in any UI. Pseudonymity is a civic safety feature, not just privacy preference. Participants discussing controversial local issues need to feel safe from real-world retaliation.
- **No avatar photos required** — generated or abstract avatars as default. Photo avatars start to leak real identity. Consistent pseudonymous identity means the pseudonym and possibly a persistent generated visual (not a face photo).
- **No public "who viewed your profile"** — viewing civic content should not be a visible social act. Surveillance dynamics chill participation.

---

## Anti-Features (deliberately exclude)

Features to consciously NOT build. Each has a strong rationale, especially for a civic platform.

### Engagement Optimization Anti-Patterns
- **NO algorithmic engagement ranking as default feed** — ranking by "engagement" (likes, shares, replies) systematically surfaces outrage, controversy, and emotional content over measured civic discussion. This is the root mechanism of polarization on Facebook and Twitter. For a civic platform, it is poison. Recency-first with optional friend weighting is the responsible default. If ranking is ever introduced, it must be opt-in and clearly labeled.
- **NO infinite notification loops** — platforms that notify you when someone likes your content, then notify you again when you respond, then notify the liker... create compulsive check-in behavior. Cap notification depth. Notifications should inform about new actions, not create engagement spirals.
- **NO public "hot" or "trending" lists** — trending mechanics systematically amplify whatever is generating the most reaction in a short window, which in civic contexts means conflict, scandal, and outrage. There is no version of "trending" that is healthy for civic discourse. Omit entirely.
- **NO public like/reaction counts prominently displayed** — visible reaction counts create bandwagon effects and status competition. Research (including Upworthy's and Twitter's own experiments) shows that hiding or downplaying counts reduces pile-ons and groupthink. For civic discourse, the CONTENT of a post should be evaluated on its merits, not its score. If reactions exist at all, consider not showing counts publicly.
- **NO share/repost mechanics** — the share/retweet/repost function is the single most powerful amplification mechanism and the primary vector for harassment campaigns, misinformation cascades, and pile-ons. Within a 6k-person slice, sharing is less dangerous than on a global platform, but the mechanic still teaches users to treat content as viral material to spread rather than ideas to discuss. For v1, omit. If added later, constrain it to within-slice only.
- **NO autoplay or attention-capture patterns** — autoloading new content while a user is reading, red notification badges for low-importance events, or any pattern that interrupts users to maximize time-on-platform. Civic engagement should be intentional, not compulsive.

### Social Dynamics Anti-Patterns
- **NO public follower/friend counts for peer users** — showing "UserX has 847 friends" creates status competition, influencer dynamics, and signals that civic participation is about accumulating social capital rather than engaging with issues. Empowered (elected) accounts can show follower counts as a civic legitimacy signal, but peer users should not have public social graphs.
- **NO one-directional "follow" between peer (Connected) users** — one-sided follow creates fan/follower dynamics and makes certain users into de facto influencers. In a civic context, this produces the same toxicity as political Twitter: a small number of high-follower accounts dominate discourse and become targets for brigading. Mutual friends only for peer-to-peer social connections.
- **NO quote-replies** — quoting someone's post to comment on it is the standard harassment vector. "Quote-tweeting to dunk" is a well-documented toxic pattern. In a civic forum, it transforms disagreement into public mockery. Flat replies to posts are sufficient for discourse; quote-reply adds the dunking dimension without adding civic value.
- **NO public block lists** — publicly visible block lists in civic contexts become weaponized. Users advertise their blocks to signal tribal membership ("block this person, they're a [political label]"). Keep blocking private.
- **NO anonymous posting** — while pseudonymity is correct (persistent, owned identity that isn't your real name), fully anonymous posting (no persistent account, one-time posts) removes accountability entirely. The pseudonymous model gives participants a reputation to maintain without exposing their real identity.

### Complexity / Scope Anti-Patterns for v1
- **NO real-time chat** — chat is a fundamentally different product from a forum. It requires presence indicators, read receipts, typing indicators, and message history design. It also creates a pressure to respond immediately that is antithetical to civic deliberation. The forum model (async, thoughtful) is the right model. Already out of scope; included here as a reminder of WHY.
- **NO reactions beyond a simple upvote** — emoji reaction palettes (heart, laugh, angry, sad, wow) were popularized by Facebook and have been shown to increase emotional engagement at the expense of substantive engagement. The "angry" reaction in particular correlates with content that generates outrage. For civic discourse, one positive signal (upvote/agree) is the maximum appropriate. Even that warrants consideration.
- **NO downvote or dislike** — public downvoting (Reddit model) creates pile-on dynamics where dissenting or minority civic views are buried by majority sentiment. In a political context, this silences unpopular-but-legitimate civic voices. No downvote, full stop.
- **NO gamification of post frequency** — streaks, daily active user rewards, or XP for simply posting volume incentivize noise. If XP is awarded for civic actions (posting, replying, attending events), it must be gated on quality signals (e.g., reaching a minimum reply threshold on a post, not just posting). Otherwise you train spam.
- **NO cross-slice broadcasting** — posts should be scoped to one slice. Allowing users to post to all four slices simultaneously creates broadcast dynamics and makes it harder for slice-specific communities to develop their own culture. Cross-posting is a v1 anti-feature.
- **NO direct messages (DMs) in v1** — DMs are a primary vector for harassment, recruitment into extremist groups, and coordination outside community visibility. They also require separate abuse reporting infrastructure. For v1, omit. If added later, require mutual friendship before DMs are possible.

---

## Feed & Interaction Patterns

### Feed Design: What Works

**Chronological with friend-weighting is the right model for Civic Spaces.**

The research is consistent: for civic and local community platforms, chronological feeds outperform engagement-ranked feeds because:
1. Civic content is time-sensitive (meeting tonight, vote tomorrow, news happening now).
2. Engagement ranking systematically rewards emotional/controversial content over substantive civic information.
3. Users in small communities (~6k) can actually keep up with a chronological feed; it doesn't overwhelm them the way it would on a global platform.
4. Transparency: users understand why they see what they see. "Most recent" is legible; "engagement score" is not.

**Friend weighting implementation:** Posts from mutual friends appear higher in the feed, but this is a bump (multiplicative recency weight) not a replacement of recency. A friend's post from 6 hours ago appears above a stranger's post from 5 hours ago, but not above a stranger's post from 30 minutes ago. This preserves the civic value of timely information while rewarding the social graph. Empowered account posts should also receive a visibility bump since following them is an intentional civic signal.

**Pagination vs. infinite scroll:** Infinite scroll (or "load more" batch loading) reduces friction and increases the chance of encountering civic content further down the feed. Pagination creates an artificial exit point. Use continuous loading. However, do NOT use auto-refresh while reading (content jumping is disorienting and interrupts reading).

**Feed composition at v1:**
- Posts from slice members, ordered by recency
- Posts from mutual friends weighted slightly higher
- Posts from followed Empowered accounts weighted slightly higher
- No engagement-based surfacing

### Interaction Primitives: What Matters for Civic Discourse

**Upvote (agree/support) only — no downvote:** A single positive signal (upvote, "agree", "+1") serves two functions: it signals to the author that their contribution was valued (reinforcing participation), and it gives readers a lightweight quality signal. It does NOT create the suppression dynamic of downvotes or the emotional escalation of reaction palettes.

**Threading: one-to-two levels maximum:** The Discourse and Reddit research is clear. Flat replies (all replies to a top-level post, no nesting) work for small communities but get unnavigable at scale. One level of nesting (reply to a reply, shown indented) is the useful maximum. More than two levels creates visual complexity and buried conversations. For Civic Spaces at 6k members and civic discourse (not gaming or entertainment), one level of nesting is probably sufficient for v1.

**Reply @ mentions:** When replying, the UI should indicate who you're replying to (e.g., "@PsychedelicCivic" in the reply context). This maintains conversational clarity in threaded discussions without requiring the user to manually type the mention.

**Edit post (time-limited):** 5-30 minute edit window is the standard. After editing, show "edited" label on the post but do NOT show the edit history publicly (that level of transparency creates a chilling effect on correcting mistakes). Editing should correct errors and improve clarity, not be weaponized for revisionism, which is why the time limit matters.

**Post length:** 1,000-2,000 characters is the sweet spot for civic posts. Long enough for a substantive position with context. Short enough to require economy. Twitter's 280 chars is too short for civic nuance; unrestricted length invites walls of text and reduces reading. Consider a "soft" limit with a "read more" collapse for longer posts.

**Link previews:** When a user pastes a URL to a news article, government document, or official source, generate a link preview (title, description, thumbnail). This is a table stakes feature now — users expect it. It also helps readers quickly evaluate whether a link is worth clicking. Important: link previews should not auto-embed content that isn't yours (avoid auto-playing video, etc.).

**Image attachment:** Users sharing civic content will want to attach photos of flyers, screenshots of official communications, photos from community events. Basic image upload is needed. Video is not required for v1.

### What Doesn't Work for Civic Feed Design

- **Ranked feeds** suppress timely civic information in favor of emotionally engaging (often divisive) content.
- **"Relevant to you" personalization** creates filter bubbles — users only see civic content that matches their existing views. For a platform trying to build cross-spectrum civic community, this is actively harmful.
- **Breaking news-style highlighting** of high-activity posts teaches users that controversy = importance. Civic importance and controversy are not the same thing.
- **Notification-driven re-engagement** (e.g., "You haven't posted in 3 days, here's what you missed") creates FOMO and pressure. Civic participation should be voluntary and sustainable, not compulsive.

---

## Moderation Minimums

The minimum viable moderation system for v1. The goal is a healthy slice of 6,000 people without requiring a full-time moderation team.

### What Civic Spaces Needs at Launch

**Content flagging with queue:** Any user can flag any post or reply. Flags go into a moderation queue. Flagged content should NOT be automatically hidden (except in extreme volume cases) until a human moderates it. Auto-hiding on first flag is exploitable — a coordinated group can silence any voice by mass-flagging. One flag should alert moderators, not suppress content.

**Moderator roles:** At minimum, one or two designated moderators per slice (or cross-slice for v1). Moderators can: hide flagged posts, warn users, escalate to account suspension (handled by accounts system). Discourse's finding that "community-driven moderation works when trusted users flag content for moderators to act on" is the right model. Do NOT give moderation power to highly-voted community members automatically (this replicates Twitter's crowd-sourced moderation problems).

**Suspension enforcement at the forum layer:** When the accounts system marks a user as `account_standing: 'suspended'`, Civic Spaces must immediately enforce read-only status on all write paths. This is a hard gate, not a soft suggestion. Suspended users who find write paths that don't check standing are a serious trust incident.

**Basic keyword filtering:** A blocklist of slurs, targeted harassment language, and spam patterns. Not a comprehensive content moderation tool — a first-pass filter that prevents the most obvious violations from ever appearing. False positives should send to a review queue, not silently delete.

**Moderator action log (internal):** Every moderation action (hide, warn, restore) logged with moderator ID and timestamp. This is accountability infrastructure for the platform, not public. Required for fairness audits and dispute resolution.

**User block is private and immediate:** When a user blocks another, the blocked user's content disappears from the blocker's view immediately. The blocked user is NOT notified. No public record. This is the minimum harassment-reduction tool.

**No appeals for v1:** A moderation appeal system is operationally complex. For v1 at pilot scale (Bloomington, ~6k), direct contact with the platform team is sufficient. Build appeals when scale requires it.

### What Moderation Should NOT Do in v1

- **Auto-moderate based on vote score** — content buried by downvotes is not the moderation model. No downvotes exist in the design.
- **AI content moderation as primary gate** — AI moderation has high false positive rates for political speech, which is exactly what civic platforms contain. Use AI as a flagging assist (flag for human review), never as an auto-removal trigger.
- **Community jury systems (Reddit's approach)** — too complex for v1, and in a civic context, jury pools are gameable by coordinated ideological groups.
- **Public shaming or posting about moderation actions** — "This post was removed for violating community guidelines" visible to all readers. Inform the post author privately; spare the public the spectacle.

### Trust Level Approach (adapted from Discourse)

Rather than Discourse's five-tier trust level (TL0–TL4), Civic Spaces has a simpler built-in model that can serve a similar function:

- **Inform tier** → read-only (already enforced by account system)
- **Connected tier** → full write access from day one (no probationary period needed at v1 pilot scale)
- **Empowered tier** → elevated standing visually, posts given authority signal

The XP/level system from the accounts platform provides the long-term reputation signal that Discourse's trust levels provide. As XP levels increase, capabilities could expand (e.g., higher-XP users' flags carry more weight), but this is v2+ complexity.

---

## Notification Patterns

### Notifications That Drive Healthy Engagement

**High-value, low-frequency notifications — the only ones that should exist at v1:**

1. **Reply to your post** — someone engaged with your civic contribution. High relevance, clear action (read and respond). This is the single most important re-engagement notification.
2. **Friend request received** — requires action. Actionable, time-sensitive, high-relevance.
3. **Friend request accepted** — closes the loop on a relationship you initiated. Positive signal.
4. **Reply to a post you replied to** — you're in a conversation thread; a new reply may be relevant. Moderate frequency, moderate relevance. Consider making this opt-in.
5. **New post from an Empowered account you follow** — civic leader you chose to follow has posted. Relevant, intentional.
6. **Slice announcement** — platform-level announcements (new features, slice events, moderation notices). Low frequency by definition.

**Batch notifications, not real-time streams:** If someone replies to your post three times in five minutes, that's one notification: "3 new replies to your post." Real-time per-action notifications create compulsive check-in behavior and anxiety.

**Notification center over push notifications:** In-app notification center is the primary surface. Push notifications (mobile/desktop) should be opt-in and conservative. No push for routine feed activity. Push only for direct interactions (reply to you, friend request).

**Clear notification categories:** Users must be able to silence specific notification types without turning off all notifications. "Notify me about replies but not about new followers" is a standard expectation.

### Notifications That Drive Anxiety (avoid)

**Never build these:**

- **"X people liked your post"** — publicly visible like counts + notifications about them create status anxiety and compulsive monitoring. If upvotes exist, do not send per-like notifications.
- **"You have new followers"** — creates follower-count awareness and status competition. Only send this if the following user is Empowered (it's a civic-relevant action); not for peer follows (which don't exist in the mutual-friends model anyway).
- **"People are talking about you"** — mention/tag notifications when you haven't been directly @-mentioned. Ambient surveillance notification. Anxiety-inducing.
- **"It's been X days since you posted"** — re-engagement nudges that create guilt for not participating. Civic participation should not feel like an obligation with a failure mode.
- **"Your post is getting a lot of attention"** — virality notifications. These train users to optimize for viral content rather than civic content. They also draw users' attention to posts that may be receiving hostile pile-on attention.
- **Weekly/daily digest emails by default** — opt-in only. Unsolicited digest emails are the primary reason people disengage from community platforms. They feel like spam.
- **Notification counts that never clear** — any notification badge that a user can't easily zero out creates persistent anxiety. Notifications must have a reliable "mark all read" or automatic clearance pattern.

### Notification Design Principles

- **Every notification must be directly actionable** — clicking a notification takes you to the specific post/thread/request. Not to a generic feed. Not to a profile. To the specific thing.
- **Notifications should decrease, not increase, as platform matures** — a healthy community that a user checks regularly should send fewer interruption notifications, not more. If a user visits daily, their notification volume should reflect only what happened since their last visit.
- **No red badges for low-priority items** — red is an alarm color. Reserve badge counts for direct interactions (replies, friend requests). Feed updates are not emergencies.

---

## Summary: Synthesis for Civic Spaces v1

### The Design Philosophy This Research Points To

Civic Spaces should optimize for **deliberate, sustainable civic participation** rather than **maximum engagement**. These are in direct tension. Maximum engagement optimization (used by Facebook, Twitter, TikTok) produces outrage, compulsive use, and polarization — documented consistently across platform research. For a civic platform, those outcomes are not just bad business; they are civic harm.

The right model is closer to:
- **Discourse** (forum-first, recency-ordered, community moderation, trust system) than Twitter (broadcast, engagement-ranked, follower economy)
- **Nextdoor** (geographic scoping, local identity) without Nextdoor's documented racial profiling problems (which came from "suspicious activity" features and anonymous crime reporting — both anti-features to avoid)
- **Small-town civic meeting** (everyone knows roughly everyone, voices have context and history, accountability exists) as the mental model, not "social network"

### Priority Order for v1 Feature Delivery

1. Feed + post + reply (the forum itself)
2. Slice navigation (the four tabs, read-only non-Federal)
3. Friend system (request, accept, feed weighting)
4. Empowered account follow
5. Notification center (replies, friend requests)
6. Flagging system (basic moderation path)
7. Block (user safety primitive)

Everything else — reactions, link previews, profile cards, image attachments — improves the experience but is not required for the community to function.

---

## Empower Compass Integration (v3.0 Sidebar Widget)

> Research scope: What the Empower Compass API produces, how to detect calibration state, what the data shape is for rendering a radar chart, and whether auth is compatible with Civic Spaces' JWT. All findings are HIGH confidence — sourced directly from `C:\EV-CompassV2\COMPASSV2-INTEGRATION.md` (canonical integration doc, last updated 2026-03-19) and the live source code at `C:\EV-CompassV2\src\`.

---

### What the Compass Produces

The Empower Compass is a **civic issue priority radar chart**. Each user answers questions on political topics (healthcare, climate, housing, etc.) by sorting stances from most to least aligned. Their answers are stored as numeric values per topic. A subset of those answered topics (3–8 topics, user-selected) becomes their "compass" — the radar chart shape.

The compass is not a single score or a left/right axis. It is a multi-dimensional polygon: each spoke represents one topic, and the spoke length encodes how strongly the user prioritized that stance (value 0.5–5.5). Two users can have very different shapes even with similar overall "ideology."

---

### Compass API: Exact Endpoints

**Base URL (production):** `https://accounts.empowered.vote/api`

Note: The live codebase uses `https://api.empowered.vote/api` (via `API_BASE` in `src/lib/auth.js`). The netlify/render config proxies `/api/*` to `https://ev-accounts-api.onrender.com/api/`. Both resolve to the same backend. Use `https://api.empowered.vote/api` for direct calls from Civic Spaces.

**Endpoints needed for the sidebar widget:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/compass/topics` | Optional | Fetch all topics (needed to map IDs to names/short_titles) |
| GET | `/api/compass/answers` | Optional | Fetch user's answers. Returns `[]` if unauthenticated. |
| GET | `/api/compass/selected-topics` | Optional | Fetch user's chosen compass topics. Returns `{ topic_ids: [] }` if unauthenticated. |
| GET | `/api/account/me` | Required | Fetch tier, calibration status (`completed_onboarding`), and display name. |

**The two calls that power the widget:**

```
GET /api/compass/selected-topics
  → { topic_ids: number[] }         // which topics the user put on their compass (3–8)

GET /api/compass/answers
  → UserAnswer[]                    // all answered topics with values
```

Cross-referencing these two responses gives you the radar chart data: for each `topic_id` in `selected_topics`, look up the answer value from the answers array.

---

### Data Shape

**Topic (from `/api/compass/topics`):**

```typescript
interface Topic {
  id: number;
  title: string;        // e.g. "Healthcare: Universal vs Market-Driven"
  short_title: string;  // e.g. "Healthcare" — used as the spoke label and as the answers key
  question_text: string;
  level: string[];      // e.g. ["federal", "state"]
  is_live: boolean;
  stances: Stance[];    // ordered stance options (0.5 to 5.5)
}
```

**User Answer (from `/api/compass/answers`):**

```typescript
interface UserAnswer {
  topic_id: number;
  value: number;            // 0.5 to 5.5, step 0.5 — ALWAYS a float, never parseInt
  write_in_text: string | null;
  visibility: string;
  inverted: boolean;
  updated_at: string;
}
```

**Selected Topics (from `/api/compass/selected-topics`):**

```typescript
{ topic_ids: number[] }    // 3–8 topic IDs the user has chosen for their compass view
```

**Radar chart data shape (what RadarChartCore expects, from EV-UI library):**

```typescript
// Built by cross-referencing selected-topics + answers + topics
const chartData: Record<string, number> = {
  "Healthcare": 4.0,
  "Climate": 2.5,
  "Housing": 5.5,
  // ... one entry per selected topic, keyed by short_title
};

// Unanswered spokes (selected but not yet answered — render grayed)
const unansweredSpokes: Record<string, boolean> = {
  "Education": true,   // selected but no answer yet
};
```

The `RadarChartCore` component is from `@chrisandrewsedu/ev-ui` (a private npm package, version `^0.1.50`). It accepts `topics` (full topic objects), `data` (the chartData Record above), `unansweredSpokes`, `invertedSpokes`, and a `padding` prop. **Civic Spaces cannot import this package directly** — it is a private GitHub packages package requiring `NPM_TOKEN`. See embed recommendation below.

---

### Calibration: What "Calibrated" Means in Data Terms

There is no single `is_calibrated: boolean` flag. Calibration state must be inferred from multiple signals:

**Uncalibrated (show CTA to calibrate):**
- `GET /api/compass/selected-topics` returns `{ topic_ids: [] }` (empty — user has never selected compass topics)
- OR `selected_topics` has IDs but `GET /api/compass/answers` returns `[]` (selected topics, no answers)
- OR the intersection of `selected_topics` and answered `topic_ids` is fewer than 3 topics (minimum to render chart)

**Partially calibrated (some topics answered, not enough for chart):**
- `selected_topics.length >= 1` but answered-and-selected count is 1 or 2

**Calibrated (show radar chart):**
- At least 3 topics are both selected AND have a valid answer (`value > 0`)

**LocalStorage flags (used internally by CompassV2, NOT available to Civic Spaces via API):**
- `calibration_completed` — set to `"true"` when user finishes the calibration overlay flow. This is client-side only in CompassV2's localStorage. Civic Spaces cannot read it.
- `calibration_skipped` — user chose to skip. Again, local to CompassV2's storage.

**Practical detection for Civic Spaces sidebar widget:**

```typescript
// Step 1: fetch the two API responses
const [selectedRes, answersRes] = await Promise.all([
  fetch('/api/compass/selected-topics', { headers: { Authorization: `Bearer ${evToken}` } }),
  fetch('/api/compass/answers', { headers: { Authorization: `Bearer ${evToken}` } }),
]);
const { topic_ids: selectedIds } = await selectedRes.json();
const answers: UserAnswer[] = await answersRes.json();

// Step 2: build a set of answered topic IDs
const answeredIds = new Set(answers.map(a => a.topic_id));

// Step 3: count how many selected topics have answers
const answeredAndSelected = selectedIds.filter(id => answeredIds.has(id));

// Step 4: determine state
if (answeredAndSelected.length >= 3) {
  // CALIBRATED — render radar chart
} else if (selectedIds.length === 0) {
  // NEVER STARTED — show "Build Your Compass" CTA
} else {
  // IN PROGRESS — show "You need X more answers" CTA
}
```

---

### Calibration Flow: Where It Lives, What URL

The calibration flow lives entirely within CompassV2 at `https://compassv2.empowered.vote`. The relevant routes:

| Route | Purpose |
|-------|---------|
| `https://compassv2.empowered.vote/results` | Main compass page — triggers `CalibrationOverlay` if uncalibrated |
| `https://compassv2.empowered.vote/quiz` | Individual topic quiz (answer a single topic's stances) |
| `https://compassv2.empowered.vote/build` | BuildCompass — select which topics go on your compass |

**The `CalibrationOverlay` component** is a full-screen modal that:
1. Shows a "ghost" (grayed) radar chart to motivate the user
2. Walks through topic selection (pick 3–8 topics)
3. Walks through answering each selected topic (drag-to-rank stance ordering)
4. Completes and shows the live chart

The overlay triggers automatically when the user arrives at `/results` and `calibration_completed !== "true"` in localStorage.

**For Civic Spaces' CTA:** Link uncalibrated users to `https://compassv2.empowered.vote/results`. The CompassV2 app will detect the uncalibrated state and launch the calibration overlay automatically. No deep-link to a specific calibration URL is needed.

---

### Auth Compatibility: EV Token vs cs_token

**Critical finding: These are different tokens from different systems.**

| | Civic Spaces | Empower Compass |
|--|--|--|
| Token key | `cs_token` (localStorage) | `ev_token` (localStorage) |
| Issued by | Civic Spaces' own Supabase instance | `accounts.empowered.vote` (Empowered Vote's Supabase instance) |
| Auth flow | Civic Spaces login | Redirect to `https://accounts.empowered.vote/login?redirect=...` |
| Token format | Supabase JWT | Supabase JWT (different project, different signing key) |
| Expiry | ~1 hour | ~1 hour |
| Refresh | Supabase handles within CS | No refresh — redirect to Auth Hub on 401 |

**The tokens are not interchangeable.** A `cs_token` cannot authenticate against the Compass API. A user must have a separate EV account at `accounts.empowered.vote` and a separate `ev_token`.

**SSO consideration:** CompassV2 tries an SSO cookie check on load (`GET /auth/session` with `credentials: 'include'`). If the user has an active session at `accounts.empowered.vote` in the same browser, this silently injects the `ev_token` without a redirect. Civic Spaces could attempt the same SSO check:

```typescript
// Try SSO cookie check (silent — no redirect on failure)
const res = await fetch('https://api.empowered.vote/api/auth/session', {
  credentials: 'include',
});
if (res.ok) {
  const { access_token } = await res.json();
  localStorage.setItem('ev_token', access_token);
}
```

Whether this SSO endpoint is publicly documented or stable is **MEDIUM confidence** — it exists in CompassV2's source but is not documented in COMPASSV2-INTEGRATION.md. Treat it as potentially unstable. Verify with the Empowered Vote team before relying on it.

**Auth Hub domain restriction:** The `redirect` parameter for the Auth Hub only accepts `*.empowered.vote` domains. Civic Spaces is NOT on that domain, so the standard redirect-and-return flow cannot bring the user back to Civic Spaces with a token. **This is a hard constraint.** After the user calibrates at CompassV2, they return to CompassV2, not to Civic Spaces. The `ev_token` is stored in CompassV2's localStorage, not Civic Spaces'.

---

### Embed vs API: Recommendation

**Do NOT embed the CompassV2 app.** There are three reasons:

1. **Domain restriction blocks the auth return flow.** Auth Hub only redirects to `*.empowered.vote`. An iframe hosted on civicspaces.app (or similar) cannot receive the auth callback.

2. **The radar chart component is a private npm package.** `@chrisandrewsedu/ev-ui` requires a GitHub PAT with `read:packages` scope. Civic Spaces would need to be granted access to this package and add NPM_TOKEN to its build environment. This is a dependency on an external private package that could change without notice.

3. **iframe CSP and cookie isolation.** Cross-origin iframes face Content-Security-Policy restrictions and cookie isolation in modern browsers, which would prevent the SSO cookie from flowing through and prevent localStorage access across origins.

**Recommended approach: API calls with separate auth state.**

The sidebar widget should:

1. On mount, check if `ev_token` exists in localStorage. If yes, attempt to fetch compass data.
2. If no `ev_token`, show an "Issue Alignment Compass" placeholder with a CTA: "Connect your Empower account to see your compass." The CTA opens `https://compassv2.empowered.vote/results` in a new tab. After the user calibrates there, they can return to Civic Spaces and the widget will work IF they have an `ev_token` in localStorage from a previous visit to CompassV2 on the same browser.
3. If `ev_token` exists, call the two API endpoints and render the radar chart using a custom implementation (not the EV-UI library) — Recharts' `RadarChart` or a lightweight SVG implementation is sufficient for a sidebar widget.
4. On 401 response, clear `ev_token` and revert to the "Connect your Empower account" CTA.

**The fundamental UX constraint:** Users who have never visited `compassv2.empowered.vote` will not have an `ev_token`. The widget's CTA must direct them to CompassV2 to calibrate. After calibrating, they return to Civic Spaces where the widget will read the stored token. This is a two-session flow for new users — unavoidable given the domain restriction.

---

### Radar Chart Data for Rendering

If implementing the radar chart without `@chrisandrewsedu/ev-ui`, here is the full data pipeline:

```typescript
// 1. Fetch topics (needed once; can be cached)
const topics: Topic[] = await fetch('https://api.empowered.vote/api/compass/topics').then(r => r.json());
const topicMap = new Map(topics.map(t => [t.id, t]));

// 2. Fetch user's selected topics and answers
const evToken = localStorage.getItem('ev_token');
const headers = evToken ? { Authorization: `Bearer ${evToken}` } : {};

const [{ topic_ids: selectedIds }, answers] = await Promise.all([
  fetch('https://api.empowered.vote/api/compass/selected-topics', { headers }).then(r => r.json()),
  fetch('https://api.empowered.vote/api/compass/answers', { headers }).then(r => r.json()),
]);

// 3. Build radar chart data
const answeredMap = new Map<number, number>(answers.map((a: UserAnswer) => [a.topic_id, a.value]));

const radarData = selectedIds
  .map((id: number) => {
    const topic = topicMap.get(id);
    if (!topic) return null;
    const value = answeredMap.get(id) ?? 0;         // 0 = unanswered
    return {
      subject: topic.short_title,                   // spoke label
      value: parseFloat(String(value)),             // ALWAYS parseFloat, never parseInt
      fullMark: 5.5,                                // max value
      answered: value > 0,                          // false = render grayed
    };
  })
  .filter(Boolean);

// 4. Pass to Recharts RadarChart
// <RadarChart data={radarData}>
//   <PolarGrid />
//   <PolarAngleAxis dataKey="subject" />
//   <PolarRadiusAxis domain={[0, 5.5]} />
//   <Radar dataKey="value" ... />
// </RadarChart>
```

**Value range for the chart:** 0.5 (minimum answered) to 5.5 (maximum). Unanswered selected topics have value 0. The chart domain should be [0, 5.5]. Do NOT normalize values — the raw values are the positions, and comparisons between users depend on the shared scale.

---

### Uncalibrated Widget State: Copy and CTA

When the user is uncalibrated (no `ev_token`, or `ev_token` exists but answered-and-selected count < 3):

**Headline:** "Issue Alignment Compass"
**Body:** "Your political compass shows where you stand on civic issues. Answer a few questions on the Empower platform to build yours."
**CTA button:** "Build Your Compass" → opens `https://compassv2.empowered.vote/results` in a new tab.

When the user has partial calibration (some topics answered, fewer than 3):
**Body:** "You've started your compass. Answer a few more topics to see your full chart."
**CTA:** "Continue Calibration" → same link.

---

### Summary Table

| Question | Answer | Confidence |
|----------|--------|------------|
| What does the compass produce? | Multi-spoke radar chart, one spoke per selected topic (3–8), spoke length = answer value (0.5–5.5) | HIGH |
| Endpoint for user's compass data | GET `/api/compass/selected-topics` + GET `/api/compass/answers` cross-referenced with GET `/api/compass/topics` for labels | HIGH |
| What is "calibrated"? | At least 3 topics in `selected_topics` that also have entries in `answers` with `value > 0` | HIGH |
| Is there a calibrated flag? | No explicit flag. Must be inferred as described above. `calibration_completed` is localStorage-only in CompassV2. | HIGH |
| Calibration flow URL | `https://compassv2.empowered.vote/results` — triggers overlay automatically | HIGH |
| Can we embed? | No — domain restriction blocks auth return, private npm package, cookie isolation | HIGH |
| Auth compatible with cs_token? | No — different Supabase projects, different signing keys. Needs separate `ev_token`. | HIGH |
| SSO cookie auto-login? | Possible via `GET /api/auth/session` with `credentials: 'include'`, but not in official docs | MEDIUM |
| Radar chart library needed | Custom implementation (Recharts or SVG). Cannot use `@chrisandrewsedu/ev-ui` without private npm access. | HIGH |
| API base URL | `https://api.empowered.vote/api` | HIGH |

---

*Compass integration section researched: 2026-04-05*
*Sources: `C:\EV-CompassV2\COMPASSV2-INTEGRATION.md` (canonical, 2026-03-19), `C:\EV-CompassV2\src\lib\auth.js`, `C:\EV-CompassV2\src\components\CompassContext.jsx`, `C:\EV-CompassV2\src\pages\Compass.jsx`, `C:\EV-CompassV2\src\pages\BuildCompass.jsx`, `C:\EV-CompassV2\src\components\RadarChart.jsx`, `C:\EV-CompassV2\package.json`, `C:\EV-CompassV2\render.yaml`, `C:\EV-CompassV2\netlify.toml`*

---

*Forum research section researched: 2026-03-27*
*Sources consulted: Discourse platform documentation and trust-level research, Pew Research Center social media usage studies, Discourse community design philosophy (Jeff Atwood's published principles), Nielsen Norman Group community participation research (1-9-90 rule), CMU CSCW community health research literature, Knight Foundation civic engagement documentation, Nextdoor design patterns and failure modes, academic literature on online political polarization and feed algorithm effects, Harvard Ash Center civic technology research, MIT Civic Media Lab publications, and primary analysis of Reddit, Twitter, Mastodon, and Facebook moderation and feed design patterns.*
