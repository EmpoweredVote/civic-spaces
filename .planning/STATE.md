# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** A Connected user can enter their Federal Slice, see posts from their ~6k civic neighbors, and contribute to the conversation — making civic engagement feel like a small town, not an ocean.
**Current focus:** Phase 5 in progress — Moderation & Safety backend complete (05-01). Ready for Phase 5 Plan 2 (Moderation UI).

## Current Position

Phase: 5 of 5 (Moderation & Safety) — IN PROGRESS
Plan: 1 of 2 in phase 05 — COMPLETE
Status: In progress
Last activity: 2026-03-28 — Completed 05-01-PLAN.md (Phase 5 backend: flags, blocks, moderators, action_log, RPCs, block-aware policies, TypeScript types)

Progress: [█████████████████░] 95%

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (3 Phase 1 + 4 Phase 2)
- Average duration: ~3-4 min
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 3/3 | ~3 min avg | ~3 min |
| Phase 2 | 4/4 | ~3-4 min avg | ~3-4 min |

**Recent Trend:**
- Last 5 plans: 02-01, 02-02, 02-03, 02-04
- Trend: Stable ~3-4 min per plan

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Federal Slice first; other three tabs are visible placeholders in Phase 2, fully active in later work.
- [Pre-Phase 1]: 6k cap is a DB CHECK constraint (not app logic) — trigger-maintained `current_member_count` on `slices` table.
- [Pre-Phase 1]: All RLS policies use `auth.jwt() ->> 'sub'` (not `auth.uid()`) — external JWT does not populate `auth.uid()`.
- [Plan 01-01]: Path B (Edge Function) chosen for auth — Supabase Third-Party Auth only supports named providers; GoTrue cannot issue client credentials for external apps. Auth flow: accounts JWT → exchange-token Edge Function → Supabase HS256 JWT (cs_token). Documented in 01-01-SUMMARY.md.
- [Plan 01-02]: GEOID format confirmed — raw TIGER/Line strings stored verbatim as text. congressional_district=4-digit (e.g. "1807"), state_senate_district=5-digit (e.g. "18046"), county=5-digit FIPS (e.g. "18097"), school_district=7-digit NCES (e.g. "1804770"). No normalization anywhere. JSON keys match API field names exactly.
- [Plan 01-02]: slice_members INSERT is service_role only in practice (RLS only exposes SELECT to authenticated); cap trigger fires regardless of role.
- [Plan 01-02]: Soft delete pattern established — posts/replies use is_deleted flag, never hard-deleted.
- [Plan 01-03]: State slice maps to state_senate_district (broader representation unit). All 4 SLICE_ASSIGNMENTS use confirmed jurisdiction JSON keys.
- [Plan 01-03]: Health check at /health placed before verifyToken middleware — unauthenticated probe access for orchestrators/load balancers.
- [Plan 01-03]: Race conditions on slice creation handled via 23505 re-query pattern (not retry loops).
- [Plan 01-03]: slice_full retry goes directly to findOrCreateSiblingSlice (skips re-checking the known-full slice).
- [Plan 02-01]: Used @vitejs/plugin-react@5 (not v6) — v6 requires vite@^8; project uses vite@6.
- [Plan 02-01]: Two-query pattern in useFederalSlice (slice_members then slices.in()) — no FK constraints for embedded select.
- [Plan 02-01]: JWT decode uses native atob() — no external library needed for read-only claims extraction.
- [Plan 02-01]: db: { schema: 'civic_spaces' } was initially set on supabase createClient but removed post-execution — replaced with public-schema views (slices, slice_members, posts, replies, connected_profiles) that forward to civic_spaces tables. PostgREST schema exposure config not required.
- [Plan 02-02]: Composite cursor (created_at + id) for feed pagination — stable under concurrent inserts, no duplicate/skip risk vs. offset.
- [Plan 02-02]: PostCard onClick defers to console.log — replaced in 02-04 with ThreadView navigation.
- [Plan 02-02]: Realtime invalidation pattern: one channel per sliceId, invalidates entire feed query on any post change event.
- [Plan 02-03]: PostComposer uses two separate useForm instances (createForm + editForm) with distinct Zod resolvers — cleaner schema isolation.
- [Plan 02-03]: PostCard refactored from single <button> to <div> wrapper + inner <button> to allow absolutely-positioned menu without nested interactive elements.
- [Plan 02-03]: Inform-tier upgrade prompt was inline overlay in SliceFeedPanel — replaced with InformUpgradePrompt component in 02-04.
- [Plan 02-04]: Reply pagination uses ascending composite cursor (created_at ASC, id ASC) — oldest-first display.
- [Plan 02-04]: Feed hidden (not unmounted) when ThreadView active — preserves IntersectionObserver scroll position.
- [Plan 02-04]: InformUpgradePrompt is a shared reusable component used in both SliceFeedPanel and ThreadView.
- [Plan 02-04]: Depth-1 replies rendered with canWrite=false — max nesting depth enforced at render level.
- [Plan 03-01]: Friendships use single-row normalization (user_low < user_high) — eliminates duplicate-row bugs, simplifies RLS policies to single row operations.
- [Plan 03-01]: BoostedPostWithAuthor includes tier in author Pick — Phase 3 UI needs tier for EmpoweredBadge rendering (unlike Phase 2 PostWithAuthor).
- [Plan 03-01]: get_boosted_feed uses SECURITY INVOKER — RLS applies to caller, consistent with project auth model.
- [Plan 03-01]: (select ...) subquery wrapping on all RLS policies — PostgreSQL caches subquery result within statement, better perf on large tables.
- [Plan 03-02]: PostWithAuthor and ReplyWithAuthor now include tier in author Pick — EmpoweredBadge in feed/thread without per-card queries.
- [Plan 03-02]: onAuthorTap propagated AppShell -> SliceFeedPanel -> PostCard/ThreadView -> ReplyCard — AppShell owns UserProfileCard state.
- [Plan 03-02]: FriendsList and MemberDirectory as fixed full-screen overlays (z-50), not sheets — better for multi-section panels with lists.
- [Plan 03-03]: useBoostedFeed owns its own realtime invalidation on ['boosted-feed', sliceId] queryKey — not delegated to useRealtimeInvalidation.
- [Plan 03-03]: Cursor uses boosted_at (synthetic sort key from RPC), not created_at — critical for correct pagination.
- [Plan 03-03]: RPC returns author_id (not user_id) — hook uses (p: any) cast; BoostedPostWithAuthor structurally satisfies PostWithAuthor.
- [Plan 04-01]: SECURITY DEFINER on notification trigger functions — auth.jwt() returns NULL inside trigger context; all actor identification uses NEW.* row data.
- [Plan 04-01]: actor_ids deduplication via CASE WHEN x = ANY(array) — prevents duplicate actor entries when same user acts multiple times in group window.
- [Plan 04-01]: reference_id is text (not uuid) — covers both post UUIDs (reply events) and user_id strings (friend events) in single column.
- [Plan 04-01]: Trigger-only inserts for notifications — no INSERT RLS policy; client can only SELECT + UPDATE own rows.
- [Plan 04-02]: activePostId lifted from SliceFeedPanel to AppShell — notification taps in header bell need to reach ThreadView inside SliceFeedPanel; prop drilling consistent with existing onAuthorTap pattern.
- [Plan 04-02]: Desktop popover via Tailwind hidden md:block; mobile Sheet always renders but stays closed on desktop — no JS breakpoint detection required.
- [Plan 04-02]: useMarkAllNotificationsRead adds .eq('recipient_id', userId) alongside RLS scoping — defense-in-depth.
- [Plan 05-01]: is_moderator() and is_blocked_by() are SECURITY DEFINER — bypasses RLS for controlled lookups; moderator RPCs have explicit guard checks.
- [Plan 05-01]: get_feed_filtered() and get_boosted_feed_filtered() use NOT EXISTS bidirectional block check (both blocker→viewer and viewer→blocker directions).
- [Plan 05-01]: get_boosted_feed_filtered corrects a latent Phase 3 bug (p.author_id → p.user_id) while returning author_id as alias for API compatibility.
- [Plan 05-01]: notifications_event_type_check constraint extended to include 'warn' for mod warn notifications.

### Pending Todos

None.

### Blockers/Concerns

None — Phase 4 complete. Phase 5 (Moderation & Safety) can proceed.

## Session Continuity

Last session: 2026-03-28
Stopped at: Completed 05-01-PLAN.md — Phase 5 backend complete
Resume file: None
