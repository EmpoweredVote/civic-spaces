# Pitfalls Research: Civic Spaces

## Technical Pitfalls

### 1. Feed Performance Degradation at Volume

**Warning signs:**
- Feed query time exceeds 200ms at ~1k posts; p95 latency climbs as content accrues
- N+1 queries appearing in Supabase logs when fetching post metadata, vote counts, or reply trees
- Client re-renders entire feed on any single new post

**Prevention strategy:**
- Use cursor-based (keyset) pagination, never offset — offset scans grow with table size
- Materialize vote counts and reply counts as denormalized columns updated by triggers; never COUNT(*) in feed queries
- Index every column touched by RLS policies (user_id, jurisdiction GEOID, created_at) — missing indexes are the single largest performance killer in RLS-heavy apps
- Adopt chronological feed as the default. Algorithmic ranking is expensive and introduces bias; research confirms users prefer chronological options and treat them as a legitimacy signal
- Cache the top-N posts per jurisdiction slice in Redis/Supabase Edge with a short TTL (30–60 seconds), invalidating on new posts

**Phase to address:** MVP (before first real users hit the feed)

---

### 2. Notification Spam and Fatigue

**Warning signs:**
- Push notification opt-out rate exceeds 30% within 30 days of signup
- Users cite "too many notifications" in churn feedback
- Open rate on notifications drops below 5%

**Prevention strategy:**
- Default to digest (daily or twice-daily) rather than per-event notifications
- Apply per-user rate limits server-side (e.g., max 3 notifications per 6-hour window regardless of activity volume)
- Batch same-thread replies into a single notification: "5 people replied to your post"
- Allow per-topic notification preferences from day one — retrofitting this is expensive
- Never send a notification for a user's own activity (common oversight causing immediate mute)

**Phase to address:** Alpha (before inviting more than seed users)

---

### 3. Realtime Subscription Overload

**Warning signs:**
- Supabase Realtime connection count approaching plan limits
- Browser tab consumes >5% CPU idle due to open websocket listeners
- Realtime events firing for rows outside the user's jurisdiction slice

**Prevention strategy:**
- Scope Realtime subscriptions narrowly: filter by jurisdiction GEOID at the channel level, not client-side
- Unsubscribe from channels when user navigates away from a view
- Use polling (30–60 second intervals) for low-urgency data (vote counts, user stats) instead of persistent Realtime channels
- Set a connection limit per user session; reject duplicate tab connections gracefully

**Phase to address:** MVP

---

### 4. Search Without Full-Text Infrastructure

**Warning signs:**
- ILIKE queries appearing in slow query logs
- Search results feel stale or irrelevant to users

**Prevention strategy:**
- Enable `pg_trgm` and `tsvector` full-text search in Postgres from the start — retrofitting is a migration risk
- Create a `search_vector` column updated by trigger on post insert/update
- Index it with GIN; scope searches to jurisdiction GEOID as a WHERE clause before text matching

**Phase to address:** MVP (schema-level decision; hard to retrofit cleanly)

---

## Social Dynamics Pitfalls

### 5. Loud Minority Dominance

**Warning signs:**
- Top 10% of users by post count produce >60% of content
- A handful of accounts appear in most discussions; others lurk only
- Thread quality complaints increase despite low reported-post rates

**Prevention strategy:**
- Apply per-user daily post/reply rate limits (e.g., 10 top-level posts, 50 replies per 24 hours per jurisdiction slice) — this directly targets the volume asymmetry
- Surface "new voices" weighting in feeds: show content from users with fewer than 10 lifetime posts alongside high-engagement posts
- Do not show follower counts, post counts, or any "status" metrics publicly — these create celebrity dynamics and discourage new posters
- The platform's human-scale cap (~6k per slice) is itself the strongest structural defense; enforce it rigorously

**Phase to address:** Alpha (design the rate limits before they're needed, not after)

---

### 6. Partisan Capture via Moderation Bias

**Warning signs:**
- Reported-post removal rates differ significantly by political topic or framing
- Power users campaign to report specific viewpoints en masse
- Moderators are themselves recognized as partisan actors by the community

**Prevention strategy:**
- The platform's core "memory over moderation" principle is the correct defense: do not delete, label and contextualize instead
- Where moderation is necessary (illegal content, doxxing, spam), use a rotating panel of community members from different jurisdiction quadrants, not a permanent mod team
- Log all moderation actions publicly (action taken, category, no content shown) to create accountability
- Research confirms that politically biased moderation directly produces echo chambers — any asymmetric removal policy will replicate this effect even if unintentional
- Never allow users to downvote into invisibility; hiding content based on crowd votes recreates the censorship dynamic

**Phase to address:** Alpha (establish moderation charter before community launch)

---

### 7. Toxicity Escalation Spiral

**Warning signs:**
- Reply chains grow longer than 8 levels deep consistently
- Per-thread report rate exceeds 5%
- User language analysis shows increasing hostility over weeks

**Prevention strategy:**
- Implement reply depth limits (3–4 levels max); long chains become unreadable arguments, not discussions
- Show a "cool-down" warning when a thread accumulates rapid replies (e.g., >10 replies in 5 minutes from the same two users)
- "Memory over moderation": make a post's report history and tolerance rating visible to moderators but not the public, preserving the record without amplifying bad behavior
- Avoid upvote/downvote systems that reward outrage; research shows engagement-based ranking amplifies out-group hostility even when that is not the intent

**Phase to address:** Alpha

---

### 8. Echo Chamber Formation

**Warning signs:**
- Network graph analysis shows clustering — the same users always reply to each other
- New topic threads attract only the same recurring voices
- Users from opposing viewpoints stop posting without being banned

**Prevention strategy:**
- Chronological feeds (rather than engagement-ranked) are the strongest structural intervention — six major studies tested other interventions and found only chronological feeds produced consistent improvement
- Do not allow sub-forum creation by users; user-created sub-communities self-sort into ideological clusters (Reddit's documented pattern)
- The geographic + jurisdiction scoping is a natural cross-cutter: local issues (zoning, transit) force ideologically diverse people to engage on shared stakes
- Avoid explicit "agree/disagree" reaction buttons — they create binary tribal signals. Prefer reactions that signal engagement type (e.g., "insightful", "needs evidence") if reactions are used at all

**Phase to address:** Design (feed architecture and reaction model must be decided before build)

---

## Cold Start / Bootstrap Problem

### 9. The Empty Room Problem

**Warning signs:**
- New jurisdiction slice has fewer than 50 posts in the first two weeks
- New users sign up, see no content, and never return (check 1-day and 7-day retention)
- A single jurisdiction slice launches before reaching critical mass

**Prevention strategy — civic-specific approaches:**

**Seed with structured content, not synthetic posts:**
- Partner with existing local civic institutions (neighborhood associations, city council offices, local newspapers) to import or link to publicly available meeting agendas, planning notices, and public comment periods as starter threads — these are jurisdiction-relevant and factually grounded
- Pre-populate each jurisdiction level (Federal, State, Local, Neighborhood) with 3–5 pinned "founding threads" on perennial local issues (budget, zoning, transit, schools) so new users have scaffolding to respond to

**Invite-first, not open registration:**
- Launch each geographic slice only when a committed seed cohort (~50–100 users) has been recruited offline (civic groups, libraries, local orgs) — do not open public registration to a slice until this seed exists
- The "atomic network" principle: one active slice is more valuable than ten empty ones. Resist the temptation to launch all jurisdictions simultaneously

**Single-user utility:**
- A user should be able to read and bookmark upcoming public meetings, local ordinances, and policy documents even before anyone else in their slice has posted — this gives value before network effects exist
- Email digests of local government activity (auto-sourced from public data feeds where available) give users a reason to return even on quiet weeks

**Milestone announcements:**
- When a slice hits 100, 500, 1000 users, send a community-wide notification — this creates a sense of growing momentum and makes early members feel like founders

**Phase to address:** Pre-launch (bootstrapping strategy must precede any public launch)

---

## Pseudonymity Pitfalls

### 10. Sockpuppet and Multi-Account Abuse

**Warning signs:**
- Multiple accounts posting similar rhetoric or always appearing together in threads
- Sudden influx of new accounts in a slice all taking the same position on a contentious thread
- Account creation spikes correlated with specific political events

**Prevention strategy:**
- The "one human, one Connected account" constraint is the platform's core defense — enforce it at the auth layer, not the app layer. Connected account verification must happen before any posting privileges are granted
- Device fingerprinting and IP pattern analysis at registration can flag probable duplicates for human review (do not auto-ban — false positives harm legitimate users)
- Rate-limit new account posting: accounts under 7 days old can read and react but cannot start top-level threads; this kills throwaway account value
- Stanford research on sockpuppets found they receive significantly more downvotes and reports — surface these signals to moderators via a "new account flagging" dashboard even if you do not expose tolerance ratings publicly
- Never expose pseudonyms to cross-slice search; a user's pseudonym in their neighborhood slice should not be findable by someone searching from a federal slice

**Phase to address:** MVP (auth integration must include duplicate-account signals)

---

### 11. Pseudonym-to-Identity Deanonymization

**Warning signs:**
- Users posting hyper-specific local details (street addresses, names of neighbors) that make identification trivial
- Users whose posting patterns across threads allow triangulation of real identity
- Screenshots of posts being shared outside the platform with "outing" intent

**Prevention strategy:**
- Warn users at post-time when their content contains address-like patterns or full names (client-side regex heuristic; server-side secondary check)
- Do not display precise location beyond GEOID jurisdiction — never show a neighborhood name that maps to fewer than ~500 residents
- Jurisdiction GEOIDs should be displayed in human-readable form only as broad labels ("City Council District 7"), never as raw census tract codes that can be cross-referenced
- Do not provide public post history browsable by pseudonym — this is the primary deanonymization vector. Allow viewing a user's posts only in the context of a specific thread, not as a profile page timeline

**Phase to address:** MVP (data model and UI decisions that are hard to reverse)

---

### 12. Pseudonymity Enabling Consequence-Free Harassment

**Warning signs:**
- Reports of coordinated personal attacks on specific real-world identities (e.g., a local candidate or official)
- Users reporting they feel unsafe returning after a specific thread
- The same targets appear repeatedly across unrelated threads

**Prevention strategy:**
- Tolerance rating (never shown publicly per platform values) should trigger automatic posting restrictions when it crosses thresholds — the user does not see the score, but experiences friction (e.g., posts go to a 1-hour review queue rather than immediate publishing)
- Maintain a "targeting pattern" detector: if >3 posts in 7 days from one account mention the same real-world name in a negative context, flag for human review
- Public officials posting in their official capacity should have a verified badge option — this actually reduces harassment of them as pseudonymous actors, because impersonation is clearly marked

**Phase to address:** Alpha

---

## Scale Transition Pitfalls

### 13. The 6k Cap Enforcement Problem

**Warning signs:**
- Slice approaching 5,800 users with no slice-split process designed
- Users already in a full slice attempting to re-register under a different email
- Admins manually managing waitlists with no tooling

**Prevention strategy:**
- Hard-code the 6k cap in the database as a check constraint on the slice membership table, not just application logic — app-layer limits have race conditions under concurrent registrations
- Design the slice-split workflow before you need it: when a slice hits ~5,000, trigger a review process to divide it geographically (e.g., split a city slice into north/south neighborhood slices)
- Communicate the cap to users at signup: "This community is intentionally limited to ~6,000 members per geographic area." Users who understand the reason accept waitlists more readily
- Provide a waitlist with position transparency and estimated wait time; a hidden waitlist causes users to assume the product is broken

**Phase to address:** MVP (constraint in schema; split workflow before Beta)

---

### 14. Second Slice Creation Breaks Shared Assumptions

**Warning signs:**
- Content or users from Slice A appearing in Slice B's feed due to a shared table without adequate RLS scoping
- Admin tooling built for "one slice" that crashes or produces wrong counts when a second exists
- Users confused about which slice they belong to and why

**Prevention strategy:**
- Design the data model for N slices from day one, even if only one slice launches. Every table referencing user content must have a `slice_id` or `jurisdiction_geoid` foreign key — retrofitting this after launch is the most expensive possible migration
- RLS policies must include slice scoping as a predicate from the start; adding it later requires auditing every policy
- Test with two slices in staging before launching the second in production
- Users should have a clear, persistent UI indicator of which slice they are currently viewing — confusion about context is the first user complaint in multi-slice rollouts

**Phase to address:** Design / MVP schema (never retrofit)

---

### 15. Community Identity Dilution at Growth

**Warning signs:**
- Early members report that "the community doesn't feel the same"
- Reply rates drop as the user base grows (the paradox of more users, less connection)
- Newcomers do not learn community norms; oldtimers become resentful

**Prevention strategy:**
- Pin a "Community Compact" (norms, purpose, values) at the top of every slice — this is the cultural onboarding document. Review and re-ratify it annually via community vote
- Milestone notifications (100, 500, 1k members) create shared history and make early members feel like founders rather than squatters
- Research confirms communities become less linguistically distinctive as they grow — proactively surface jurisdiction-specific topics (local elections, budget cycles) to maintain the "this is about our place" identity

**Phase to address:** Alpha → Beta transition

---

## Auth Integration Pitfalls

### 16. JWT Token Expiry Race Conditions

**Warning signs:**
- Users randomly logged out mid-session; errors appear in logs around token refresh calls
- Multi-tab users experience auth failures where single-tab users do not
- Refresh token rotation logs show duplicate refresh attempts within milliseconds

**Prevention strategy:**
- Implement a client-side refresh mutex: only one in-flight refresh at a time. Queue all other requests that need auth and replay them after refresh succeeds
- Subtract a 30-second buffer from the JWT `exp` claim when deciding whether to proactively refresh — this prevents the "expired by the time the request arrives at the server" race
- Store refresh tokens in httpOnly cookies, not localStorage — this prevents XSS-based token theft and eliminates a class of multi-tab conflict
- On refresh failure, redirect to a re-auth flow immediately rather than retrying — retry loops on a revoked token burn API quota and confuse users

**Phase to address:** MVP (auth layer)

---

### 17. Jurisdiction Claims Becoming Stale

**Warning signs:**
- A user who moved from one city to another still sees their old jurisdiction's slice content
- GEOID embedded in JWT does not reflect a jurisdiction change the user made in their profile
- RLS policies that use JWT claims for jurisdiction reject valid requests after a user's jurisdiction updates

**Prevention strategy:**
- Never embed jurisdiction GEOID directly in the JWT as a long-lived claim. Store jurisdiction in the database and look it up via RLS `auth.uid()` at query time — this ensures changes take effect immediately without requiring token rotation
- If jurisdiction must be in the JWT for performance (edge functions), implement a "force refresh" trigger on jurisdiction change that invalidates the current session token
- Provide a clear UI flow for users to update their jurisdiction: verify the new GEOID (via address lookup against census GEOID data), apply immediately, and log the change with timestamp for audit

**Phase to address:** MVP (auth + data model)

---

### 18. External Auth Provider Outage Causing Total Login Failure

**Warning signs:**
- Auth provider's status page shows degraded service; your login page returns 503
- Spike in "login failed" support tickets with no change on your end
- Users who are already logged in are forced to re-auth mid-session when tokens cannot be refreshed

**Prevention strategy:**
- Set long-lived session tokens (7–30 days) so already-authenticated users are not affected by short provider outages
- Build a graceful degraded-auth UI: "Login is temporarily unavailable. If you are already logged in, you can continue reading." — do not show a blank error page
- Monitor the auth provider's API health as part of your own uptime monitoring, not just your own endpoints
- Cache the last-known valid user state locally (e.g., in the session store) so the app does not fully break during a brief provider outage

**Phase to address:** Alpha (before public launch)

---

### 19. Scope Creep in Auth Token Permissions

**Warning signs:**
- The Connected auth token grants broader scopes than the app actually uses
- A compromised token could read or write data in external systems beyond what Civic Spaces needs
- Token scopes expand over time as features are added without audit

**Prevention strategy:**
- Request the minimum required scopes from the Connected auth API at integration time; document every scope and its justification
- Audit scopes whenever a new feature is added that touches auth
- Never store the raw auth provider token in your own database — store only the normalized user identifier and the claims your RLS policies actually use

**Phase to address:** MVP

---

## Supabase RLS Pitfalls

### 20. RLS Disabled by Default on New Tables

**Warning signs:**
- New table created during a feature sprint; developer tests in SQL Editor (which bypasses RLS) and declares it working
- Supabase dashboard's Security Advisor shows tables without RLS enabled
- In January 2025, 170+ production apps were found to have fully exposed databases because RLS was never enabled

**Prevention strategy:**
- Add a CI check (e.g., a test that queries Supabase's `pg_tables` and fails if any public-schema table has `rowsecurity = false`) — this catches the mistake before it reaches production
- Create a template migration file that always includes `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` as the last line of any new table migration
- Never test RLS policies from the Supabase SQL Editor — it runs as a superuser and bypasses all policies. Always test from the client SDK using a test user's JWT

**Phase to address:** MVP (process, not feature)

---

### 21. Relying on `user_metadata` for Authorization

**Warning signs:**
- RLS policies reference `auth.jwt() -> 'user_metadata'` for role or jurisdiction checks
- Users can update their own metadata via the Supabase client SDK and gain unintended access

**Prevention strategy:**
- Use `raw_app_meta_data` (not `user_metadata`) for any claims that affect authorization — `raw_app_meta_data` can only be written by the service role, not by the user
- Better still: store authorization data (role, jurisdiction GEOID, slice membership) in your own `profiles` table and look it up in RLS policies via `auth.uid()` — this gives you full control and auditability
- Audit every RLS policy for references to `user_metadata`; replace with database-side lookups

**Phase to address:** MVP

---

### 22. Missing SELECT Policy Causes Cryptic INSERT Failures

**Warning signs:**
- INSERT operations return "new row violates row-level security policy" even though an INSERT policy exists
- The error appears only when the INSERT result is returned to the client (i.e., with `RETURNING`)

**Prevention strategy:**
- PostgreSQL SELECTs newly inserted rows to return them to the client. Without a matching SELECT policy, this internal SELECT fails — the error message misleadingly points to the INSERT policy
- Always create both INSERT and SELECT policies together; test with `INSERT ... RETURNING *` from a client SDK context
- Document this behavior in the team's internal Supabase runbook so future developers do not spend hours debugging it

**Phase to address:** MVP

---

### 23. Unindexed RLS Policy Columns Causing Full Table Scans

**Warning signs:**
- Feed queries are slow despite simple WHERE clauses
- `EXPLAIN ANALYZE` shows sequential scans on large tables
- Performance degrades in a linear relationship with table row count

**Prevention strategy:**
- Every column referenced in an RLS policy predicate must have an index. For Civic Spaces this means at minimum: `user_id`, `jurisdiction_geoid`, `slice_id`, `created_at`
- Composite indexes (e.g., `(jurisdiction_geoid, created_at DESC)`) dramatically outperform single-column indexes for feed queries that filter by jurisdiction and sort by time
- Run `EXPLAIN ANALYZE` on every feed query before MVP launch; a query plan showing `Seq Scan` on a table with RLS is a red flag

**Phase to address:** MVP

---

### 24. Service Role Key Exposed in Client Code

**Warning signs:**
- Service role key found in client-side JavaScript bundle (searchable via browser DevTools)
- Environment variable `SUPABASE_SERVICE_ROLE_KEY` referenced in a frontend file
- A security scan or dependency audit flags the key

**Prevention strategy:**
- The service role key bypasses all RLS. Treat it as a root database password — it belongs only in server-side code (Edge Functions, backend API routes) and never in any file that ships to the browser
- Use `SUPABASE_ANON_KEY` for all client-side Supabase calls; RLS policies are the permission layer
- Add a pre-commit hook that rejects commits containing the service role key string

**Phase to address:** MVP

---

### 25. Firebase-Style Third-Party JWT Shared Key Risk

**Warning signs:**
- Using a third-party auth provider whose JWT signing keys are shared across all their customers (e.g., Firebase, Clerk in certain configurations)
- No `aud` (audience) claim check in RLS policies that use JWT claims
- A malicious actor from another app on the same auth provider could forge access

**Prevention strategy:**
- When using third-party auth with Supabase, always validate the `aud` claim in RLS policies to ensure tokens are scoped to your project specifically
- Review the Supabase docs on third-party auth providers — Firebase in particular uses shared signing keys across all Firebase projects, meaning tokens from other Firebase projects are cryptographically valid against your Supabase instance unless you add audience restrictions
- Prefer Supabase's own auth or an auth provider that issues project-scoped signing keys

**Phase to address:** MVP (auth architecture decision)

---

### 26. RLS Policies Not Covering Storage Objects

**Warning signs:**
- Users can access uploaded images or attachments from other jurisdiction slices via direct URL
- Supabase Storage bucket is set to "public" without RLS policies on the `storage.objects` table

**Prevention strategy:**
- Supabase Storage enforces RLS on the `storage.objects` table separately from your application tables — enabling RLS on your app tables does not automatically protect storage
- Define storage policies that restrict object access by the `owner` field and jurisdiction; test by attempting to access another user's uploaded file with a different user's JWT
- For sensitive attachments, generate signed URLs server-side with short TTLs rather than relying solely on Storage RLS

**Phase to address:** MVP (whenever file/image upload is introduced)

---

*Researched: 2026-03-27*
