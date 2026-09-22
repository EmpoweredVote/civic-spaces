# Project Research Summary

**Project:** Civic Spaces — Connect Pillar of Empowered Vote
**Domain:** Civic community forum with geographic scoping and social graph
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

Civic Spaces is a forum product with a hard civic mission: enable deliberate, geographic-scoped discourse among ~6,000 pseudonymous peers per slice, without reproducing the polarization mechanics of mainstream social platforms. The research is unusually consistent across all four dimensions — the right patterns are well-documented, the wrong patterns are well-documented, and the main risk is not technical uncertainty but discipline: the temptation to add engagement features that are actively harmful in a civic context. The recommended approach is a chronological feed forum (closer to Discourse than Reddit or Twitter), mutual-friends social graph, and geography as the personalization signal — no engagement ranking, no downvotes, no viral mechanics.

The stack is pre-decided and appropriate. The critical technical constraint is that Supabase Auth is not in use — `accounts.empowered.vote` issues the JWT externally — which means every RLS policy must resolve user identity via `auth.jwt() ->> 'sub'` rather than `auth.uid()`, and slice membership must be checked via DB subquery rather than JWT claims. This pattern is well-understood but requires consistent discipline: every table needs RLS enabled from day one, every policy needs its columns indexed, and the service-role key must never reach the client. The architecture research produced a complete, production-ready schema and build order — follow it.

The biggest non-technical risk is cold start: a civic forum with fewer than ~50 active seed users per slice will feel abandoned and fail to retain its next wave of users. Launch strategy (invite-first, seed content from civic institutions, one slice at a time) is as important as the technical build. The "atomic network" principle applies directly: one active slice beats ten empty ones.

---

## Key Findings

### Recommended Stack

The confirmed stack (React + Tailwind, Express + TypeScript on Render, Supabase PostgreSQL + RLS, Upstash Redis) is appropriate and requires no changes. The key supplementary decisions from research:

**Core technologies:**
- **React Virtuoso `^4.x`**: Virtualized list — purpose-built for variable-height forum posts and infinite scroll; preferred over TanStack Virtual (poor bidirectional scroll) and react-window (no dynamic heights)
- **TanStack Query `^5.x`**: All server state via `useInfiniteQuery` for feeds, optimistic updates for reactions; integrates cleanly with Supabase cursor pagination
- **Supabase Third-Party Auth**: External JWT from `accounts.empowered.vote` integrated via Supabase's native third-party auth feature (requires RS256/OIDC); fallback is an Edge Function token exchange if OIDC isn't available
- **Sonner `^1.x`**: Toast notifications — zero dependencies, shadcn-native, 20.5M weekly downloads; not react-hot-toast or react-toastify
- **React Hook Form `^7.x` + Zod `^3.x`**: Form handling for post composer and social flows
- **Cursor-based pagination everywhere**: Supabase `.range()` (OFFSET) degrades at scale and causes feed drift on live data; keyset pagination on `(created_at, id)` is required
- **Hybrid Realtime**: Supabase Realtime `postgres_changes` to *invalidate* TanStack Query cache (not as data delivery); polling fallback at 15–30s if WebSocket drops; per-thread polling rather than per-row subscriptions for high-activity threads

**Do not use:** Socket.io (redundant with Supabase Realtime), GraphQL/Apollo (REST + TanStack Query is sufficient), react-virtualized (unmaintained), offset pagination, SSE for notifications, TanStack Router (defer for v1), next-auth/Better Auth (wrong paradigm for this SPA).

See `.planning/research/STACK.md` for full patterns including the hot-score formula, optimistic update pattern, and presence channel implementation.

### Expected Features

**Must have (table stakes):**
- Post composer with character limit (1,000–2,000 chars), mobile-first
- Reply threading — one level of nesting (reply to a post); two levels maximum
- Chronological feed as default — recency-first is a civic legitimacy signal, not just a UX choice
- Slice tab navigation (Neighborhood / Local / State / Federal) — clearly labeled, immediately understandable
- Edit window (5–30 minute grace period) with "edited" label, no public edit history
- Delete own content
- Link sharing (URL paste; link preview is table stakes in 2025)
- Upvote only — no downvote, no emoji reactions
- In-app notification center (bell + unread count badge)
- Reply notifications and friend request notifications at minimum
- Content flagging with moderation queue
- Basic block (private, immediate, blocker-only)
- Empty state for new slices — warm, explains purpose, invites first post
- Persistent pseudonym displayed consistently everywhere
- Profile card on tap/hover (pseudonym, level/XP, slice count, post count)
- Clear tier labeling: Empowered accounts visually distinguished from Connected peers
- Read-only access for Inform tier (unauthenticated) with inline upgrade prompt at write actions

**Civic differentiators (should have):**
- Slice member count visible ("You're 1 of 5,847 members") — creates "small town" feeling
- Mutual friends social graph (both-accept model; NOT one-sided follow between peers)
- One-directional follow for Empowered accounts (civic leaders) only
- Friend-boosted feed weighting (additive recency bump, not algorithmic replacement)
- Visual distinction between "following" (Empowered) and "friends" (peers)
- Jurisdiction transparency — users understand why they're in this slice
- Pseudonymity-first design — no legal names, no photo avatars required, no "who viewed your profile"
- Post-time address pattern warnings for deanonymization risk

**Defer to v2+:**
- Image attachments (useful but not required for community to function)
- Link previews (improves UX; build after core forum works)
- Push notifications (mobile/background delivery — build after in-app works)
- Moderation appeals system (direct contact with platform team is sufficient at pilot scale)
- Community jury moderation (too complex for v1)
- XP-gated moderation weight (trust level expansion)
- Direct messages (primary harassment vector; require mutual friendship if ever added)
- "New voices" feed weighting (valuable anti-dominance mechanic; defer until loudness is observed)
- Cohort milestone notifications (100/500/1k members)
- Hot/Top feed sort modes (schema column is worth adding at v1; the UI toggle is v2)

**Conscious anti-features (never build):**
- Algorithmic engagement ranking as default feed
- Downvotes or dislike
- Quote-replies (primary dunking vector)
- Share/repost mechanics
- Cross-slice broadcasting
- Public follower/friend counts for peer users
- One-directional follow between Connected (peer) users
- Public trending / hot lists
- Per-like notifications
- Re-engagement nudge notifications ("It's been 3 days since you posted")
- Anonymous posting (pseudonymity yes, full anonymity no)
- Real-time chat

See `.planning/research/FEATURES.md` for full rationale on each decision.

### Architecture Approach

The architecture research produced a complete, production-ready schema and build order. All tables live in a `civic_spaces` schema. User identity is owned by the external accounts API — Civic Spaces stores only `external_id` and never replicates jurisdiction assignments. Slice membership is dynamic DB state, not a JWT claim, so RLS policies check `slice_members` via subquery. A `civic_spaces.current_user_id()` security-definer function resolves `external_id → internal uuid` once per query, avoiding repeated subqueries across policies.

**Major components:**
1. **Slice Assignment Service (Express)** — on login, calls external accounts API to resolve 4 GEOIDs, upserts `slice_members`, removes stale memberships; runs as service role; the entry point for all jurisdiction logic
2. **Supabase DB (`civic_spaces` schema)** — core tables: `users`, `slices`, `slice_members`, `posts`, `comments`, `reactions`, `friendships`, `follows`, `notifications`; RLS on all tables; `current_member_count` maintained by trigger with CHECK constraint for cap enforcement
3. **Feed Query Layer (Supabase RPC)** — complex feed queries (especially friend-boosted feed) exposed as Postgres RPC functions, not built in PostgREST query builder; cursor-based pagination via `(created_at, id)` keyset
4. **Notification Pipeline** — DB triggers insert into `notifications` on comment/reaction/follow events; Supabase Realtime delivers to client; TanStack Query invalidation handles display; Redis+DB hybrid for unread badge counts
5. **React Component Tree** — `AppShell` (auth guard + Realtime init) → `HubPage` (tab routing) → `SliceFeedPanel` (per-slice, isolated query cache, preserves scroll on tab switch) → `PostCard`, `PostComposer`, `CommentThread`, `NotificationBell`

**Critical schema decisions:**
- `friendships` uses single-row-per-pair with `requester_id/addressee_id` — bidirectional queries use OR; both directions indexed
- `follows` table is separate from `friendships` — keeps RLS and feed queries clean; trigger enforces `is_empowered = true` on followee
- `slices` has `current_member_count` + CHECK constraint for 6k cap — trigger-maintained to avoid COUNT scan on every join
- `notifications.payload` is JSONB — flexible per `kind` without schema changes

See `.planning/research/ARCHITECTURE.md` for full schema DDL, RLS policies, feed queries, and the 16-phase build order.

### Critical Pitfalls

1. **RLS disabled on new tables** — Supabase tables have RLS off by default. Every new table migration must include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` as its last line. Add a CI check that fails if any `civic_spaces` table has `rowsecurity = false`. Never test RLS from the Supabase SQL Editor (it bypasses policies — always test via client SDK with a real JWT).

2. **External JWT auth identity mismatch** — `auth.uid()` is not populated by default with the external JWT from `accounts.empowered.vote`. All RLS policies must use `(auth.jwt() ->> 'sub')` or the `current_user_id()` helper to resolve the user. Never embed jurisdiction GEOIDs in the JWT as long-lived claims — store jurisdiction in the DB and look it up at query time so moves take effect immediately without token rotation.

3. **Unindexed RLS policy columns causing full table scans** — every column referenced in an RLS predicate needs an index. The critical indexes are: `slice_members(user_id)`, `slice_members(slice_id, user_id)` UNIQUE, `posts(slice_id, created_at DESC)`, `friendships(requester_id, status)`, `friendships(addressee_id, status)`, `notifications(recipient_id, read_at, created_at DESC)`. Missing any of these means every feed query does a sequential scan. Run `EXPLAIN ANALYZE` on every feed query before first users hit the system.

4. **Missing SELECT policy causes cryptic INSERT failures** — PostgreSQL SELECTs newly inserted rows to return them with `RETURNING *`. Without a SELECT policy, the INSERT succeeds but the `RETURNING` fails with a misleading RLS error. Always create INSERT and SELECT policies together; test with `INSERT ... RETURNING *` from the client SDK, not the SQL Editor.

5. **Cold start / empty room** — a slice that launches publicly before reaching ~50 committed seed users will fail to retain its first wave. This is a product-critical risk with no technical fix. Prevention: invite-first launch per slice, pre-populate with 3–5 pinned civic threads from real local sources (meeting agendas, planning notices), recruit seed cohort from existing civic institutions offline before opening registration. The "atomic network" principle: do not open multiple slices simultaneously.

**Secondary pitfalls to address at MVP:**
- Service role key exposure in client bundle (add pre-commit hook that rejects it)
- Offset pagination (`supabase.range()`) — use cursor pagination everywhere
- Realtime subscription overload — scope channels narrowly by `slice_id`, unsubscribe on navigate, poll for low-urgency data
- N+1 feed queries — materialize `reaction_count` and `comment_count` as denormalized columns updated by triggers; never COUNT(*) in feed queries
- Sockpuppet abuse — enforce "one human, one Connected account" at the auth layer; rate-limit new accounts (under 7 days: read + react only, no top-level posts)
- Search without full-text infrastructure — add `search_vector` tsvector column with GIN index to `posts` in the initial migration even though search UI is v2; retrofitting full-text search is a painful migration

---

## Implications for Roadmap

Based on the architecture's explicit 16-phase build order, the research points to 5 shipping phases:

### Phase 1: Foundation — Schema, Auth, and Slice Assignment
**Rationale:** Nothing user-facing is buildable until RLS and slice membership are correct. The external JWT auth integration is the highest-risk technical unknown (OIDC discovery availability determines which path to take). Establish this before writing any UI.
**Delivers:** Supabase project with `civic_spaces` schema, all tables with RLS enabled, `current_user_id()` helper, slice assignment service (Express middleware that calls external accounts API and upserts `slice_members` on login), cap enforcement trigger, `search_vector` column on `posts` (cheap now, expensive to retrofit)
**Addresses:** Auth integration, jurisdiction assignment, cap enforcement
**Avoids:** External JWT mismatch (#2), RLS disabled on new tables (#1), unindexed columns (#3), missing SELECT policy (#4), "N slices from day one" — schema must support multiple slices even if only one launches

### Phase 2: Core Forum — Feed, Posts, and Replies
**Rationale:** The forum itself is the product. Everything else (social graph, notifications, moderation) is scaffolding around the core read/write loop. Federal Slice is the only active forum in v1 — validate the feed before building the social layer.
**Delivers:** `SliceFeedPanel` with cursor-paginated feed, `PostCard`, `PostComposer`, `CommentThread` (one level threading), `ReactionButton` with optimistic updates, `SliceTabBar` with Federal active and remaining tabs as coming-soon placeholders, denormalized `reaction_count` + `comment_count` on `posts` maintained by triggers
**Uses:** React Virtuoso (variable-height posts), TanStack Query `useInfiniteQuery`, Supabase cursor pagination on `(slice_id, created_at DESC)`, Sonner for post feedback toasts, React Hook Form + Zod for composer
**Implements:** `SliceFeedPanel`, `PostCard`, `PostComposer`, `CommentThread` components
**Avoids:** Offset pagination, per-row Realtime subscriptions, COUNT(*) in feed queries

### Phase 3: Social Graph — Friends and Follow
**Rationale:** Friend-boosted feed weighting and Empowered follow are core differentiators but depend on the forum existing first. Users need something to interact over before building social relationships. Build after the feed is validated.
**Delivers:** `FriendRequestButton` (send/accept/decline), `FollowButton` (Empowered only, enforced by trigger), `UserProfileCard` (pseudonym, level, friend/follow state), friend-boosted feed query (additive recency bump via `my_friends` CTE), bidirectional friendship lookup
**Implements:** `friendships` and `follows` tables and RLS, empowered-check trigger, `social/` component tree
**Avoids:** One-directional follow between peers, public follower counts, quote-reply, any share/repost mechanic

### Phase 4: Notifications and Realtime
**Rationale:** Notifications are the primary re-engagement mechanism — without them, posting feels like shouting into a void. But they require the social graph to exist (friend requests generate notifications). Build after Phase 3.
**Delivers:** `NotificationBell` with unread count badge, `NotificationList`, DB triggers for reply/reaction/friend-request notifications, Supabase Realtime subscription for live notification delivery, Redis+DB hybrid unread counts for slice tab badges, batch notification grouping ("5 replies to your post"), notification preferences (per-type silencing from day one — retrofitting is expensive)
**Avoids:** Per-like notifications, virality notifications, re-engagement nudges, notification counts that don't clear

### Phase 5: Moderation and Safety
**Rationale:** Moderation infrastructure must exist before public launch but is not required during private seed testing. Establish before opening beyond invite-only cohort.
**Delivers:** Content flagging with moderation queue (one flag = alert moderator, not auto-hide), basic keyword blocklist (first-pass filter → review queue on false positive), user block (private, immediate, client-side filter), moderator action log (internal), suspension enforcement gate on all write paths (check `account_standing` on every post/reply/reaction), `current_member_count` display in slice header, new-account posting rate limit (under 7 days: read + react only, no top-level threads)
**Avoids:** AI auto-moderation as primary gate, auto-hide on first flag (gameable by coordinated mass-flagging), community jury systems, public moderation shaming

### Phase Ordering Rationale

- Phases 1–2 are the irreducible foundation. RLS without correct indexes is dangerous; feed without cursor pagination degrades immediately.
- Phase 3 is gated on Phase 2 because the social graph has no value without something to be social about. The friend-boosted feed query also requires posts to exist.
- Phase 4 is gated on Phase 3 because friend-request notifications are a core notification type. Building notifications without the social graph produces an incomplete system.
- Phase 5 is the last foundation piece before public launch. Moderation tooling that is retrofitted after bad actors arrive is always a reactive scramble.
- Slice overflow logic and cohort expiry (ARCHITECTURE.md phase 15) fit after Phase 5 as operational infrastructure, not v1 MVP.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (Auth):** OIDC discovery availability on `accounts.empowered.vote` is unknown. If it supports RS256 + OIDC discovery endpoint with `kid` header, use Supabase Third-Party Auth natively. If not, an Edge Function token exchange is required. This decision affects every RLS policy and should be resolved in sprint 0.
- **Phase 4 (Realtime under load):** Supabase Realtime connection limits at plan tier need to be verified against projected concurrent users. The hybrid (Realtime invalidation + polling fallback) pattern is the right approach, but the specific polling intervals and subscription scope need tuning once concurrent usage is measurable.

Phases with standard patterns (can skip research-phase):
- **Phase 2 (Core Forum):** React Virtuoso + TanStack Query `useInfiniteQuery` + Supabase cursor pagination is a well-documented, stable pattern. The STACK.md research includes working code for all three.
- **Phase 3 (Social Graph):** Single-row-per-pair friendship table with bidirectional OR query is standard. The ARCHITECTURE.md schema and queries are complete.
- **Phase 5 (Moderation):** No novel infrastructure required for v1 — flagging queue + block are straightforward DB + RLS patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Pre-decided stack; supplementary library choices (Virtuoso, Sonner, TanStack Query v5) are well-documented with production case studies |
| Features | HIGH | Research grounded in platform research literature, Discourse/Reddit/Nextdoor comparative analysis, and Pew/Knight Foundation civic tech studies; anti-features have documented harm evidence |
| Architecture | HIGH | Complete schema with DDL, RLS policies, feed queries, and 16-phase build order produced; patterns validated against Supabase production docs |
| Pitfalls | HIGH | Technical pitfalls verified against Supabase pricing docs and production incident reports; social dynamics pitfalls grounded in academic CSCW research and documented platform failures |

**Overall confidence:** HIGH

### Gaps to Address

- **OIDC availability on `accounts.empowered.vote`:** The entire auth integration path (native Third-Party Auth vs. Edge Function token exchange) depends on this. Resolve in the first engineering conversation before any Supabase RLS policy is written.

- **Hot-score column at v1:** STACK.md documents the Hacker News variant hot-score formula and recommends a `hot_score` denormalized column updated by trigger. FEATURES.md recommends against algorithmic ranking as the default feed but allows it as an optional mode. Decision needed: add the `hot_score` column in Phase 1 migrations (cheap now, expensive to retrofit) even if the sort mode toggle is deferred to v2.

- **Search schema prep:** PITFALLS.md explicitly flags `pg_trgm`/`tsvector` + GIN-indexed `search_vector` column as a schema-level decision that is painful to retrofit. The ARCHITECTURE.md schema does not include this column. Add to Phase 1 migration even though search UI is v2.

- **Post edit audit table:** Research confirms a 5–30 minute edit window with "edited" label, no public history. Neither schema nor ARCHITECTURE.md includes a `post_edits` audit table. Recommendation: add a lightweight `post_edits (post_id, body_before, edited_at, editor_id)` table in Phase 2 for moderation audit — not public, but essential for investigating edit-based abuse.

- **Rate limiting implementation:** Per-user daily post/reply rate limits (10 top-level posts, 50 replies per 24h per slice) are recommended in PITFALLS.md but are not in the ARCHITECTURE.md schema. This requires either DB-side counters (maintainable via triggers on `posts`/`comments`) or Redis-side counters. Decide in Phase 5 planning.

- **Slice content at launch:** The cold-start research recommends 3–5 pinned civic threads per slice level sourced from real local institutions. This requires a content strategy and a relationship with Bloomington civic institutions before technical launch. This is operational, not technical — but it must be resolved before Phase 5 (public launch).

---

## Sources

### Primary (HIGH confidence)
- Supabase official documentation — RLS patterns, Third-Party Auth, Realtime connection limits, storage RLS
- Supabase pricing docs — Realtime concurrent connection limits by plan tier
- React Virtuoso documentation — bidirectional scroll, variable height, `endReached` callback
- TanStack Query v5 documentation — `useInfiniteQuery`, optimistic update pattern
- ARCHITECTURE.md (this project) — full schema DDL, RLS policies, feed queries

### Secondary (MEDIUM confidence)
- Discourse community design philosophy (Jeff Atwood's published principles) — forum threading, trust levels, moderation model
- Nielsen Norman Group community participation research — 1-9-90 rule, engagement patterns
- Pew Research Center social media usage studies — civic engagement patterns
- Knight Foundation civic engagement documentation — civic platform design principles
- CMU CSCW community health research — echo chamber formation, moderation bias
- Harvard Ash Center / MIT Civic Media Lab publications — civic tech platform design

### Tertiary (LOW confidence / inference)
- Stanford sockpuppet research — multi-account detection signals
- Upworthy/Twitter reaction count experiments — effect of visible counts on engagement behavior
- Reddit pattern analysis — sub-forum creation leads to ideological clustering
- Production case studies of Supabase Realtime silent event drops under load (reported in community forums, not official docs)

---

*Research completed: 2026-03-27*
*Ready for roadmap: yes*
