# Civic Spaces

## What This Is

Civic Spaces is the Connect Pillar of the Empowered Vote civic platform. It's a pseudonymous community hub that places each Connected user into four geographically-scoped "slices" of approximately 6,000 people each — Neighborhood, Local, State, and Federal — plus a worldwide Unified Slice and a role-gated Volunteer Slice. Users post, discuss, and build relationships within their slices, with a friends system that surfaces familiar voices in their feed and a profile page that anchors their civic identity.

## Core Value

Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.

## Requirements

### Validated

- ✓ Schema, RLS, external JWT auth, slice assignment service — v1.0
- ✓ Federal Slice forum: feed, posts, replies, cursor pagination — v1.0
- ✓ Social graph: mutual friends, Empowered follow, friend-boosted feed — v1.0
- ✓ Notifications: reply, friend request, accepted friendship — v1.0
- ✓ Moderation & Safety: flag, block, moderator queue — v1.0
- ✓ Hub layout: N/L/S/F/Unified left, Volunteer right; per-tab scroll preservation — v2.0
- ✓ Neighborhood, Local, State, Unified tabs fully active with forum capability — v2.0
- ✓ Friend-boosted feed applies equally to all geo and special slices — v2.0
- ✓ Notification routing to correct slice tab (desktop and mobile) — v2.0
- ✓ Unified Slice: 6k-capped worldwide flat slice, auto-assigned on login — v2.0
- ✓ Volunteer Slice: role-gated, auto-assign/revoke on login, tab absent for non-Volunteers — v2.0
- ✓ Profile pages: display name tap navigation, stats, slice memberships, mutual friends, social actions — v2.0
- ✓ Hero banner with geo photo (Wikipedia REST API), name, tagline, pill badges, description per slice tab — v3.0
- ✓ Two-column desktop layout (65/35) / single-column mobile — v3.0
- ✓ Issue Alignment Compass sidebar widget (Recharts radar chart, calibration prompt fallback) — v3.0
- ✓ Representing This Community sidebar widget (rep cards, tab-aware filtering, no party affiliation) — v3.0
- ✓ Tools for This Community sidebar widget (confirmed-live EV ecosystem links) — v3.0
- ✓ Jurisdiction-specific hero photos via Wikipedia REST API; photo_url DB override path active — v3.0
- ✓ v2.0 dead prop cleanup (MutualFriendsList.friendCount, NotificationListProps.onNavigateToThread) — v3.0
- ✓ Tailwind v4 dark mode infrastructure + civic-teal theme token across all new components — v3.0
- ✓ Hook-hoisting at AppShell + React.lazy Recharts code-split (938KB → 328KB async chunk) — v3.0

### Active

(Defined by next milestone — run `/gsd:new-milestone` to set v4.0 requirements)

### Out of Scope

- Circle-model geographic boundaries — replaced permanently by jurisdiction GEOIDs from accounts system
- Aggregate "all slices" combined feed — deferred; Unified tab is the Unified slice only
- Debates, Shared Facts, Symposiums, Announcements tabs inside slices — future feature layers
- Focus Communities — accessible from the hub in a future phase
- Half-slice swapping (2-year rotation mechanic) — future, revisit in ~2 years
- Treasury Tracker, Essentials, Compass integration inside slices — future phases
- Custom onboarding/registration flow — accounts.empowered.vote owns all auth and onboarding
- Real-time messaging or chat — not part of the forum model

## Context

- **Platform:** Empowered Vote — three-pillar civic platform (Inform, Connect, Empower). Civic Spaces is the Connect Pillar.
- **Accounts dependency:** Auth, tier verification, jurisdiction, XP, and gems all live at `accounts.empowered.vote`. Civic Spaces is a consumer, not an owner. Never store or replicate user profile data — always fetch fresh from `GET /api/account/me`.
- **Three tiers:** Inform (browse only) → Connected (full participation, pseudonymous) → Empowered (civic leaders, one-directional followable). Presence of `connected_profiles` record = Connected. Never check a status flag.
- **Display names:** Always show `display_name` (pseudonym) in all Connect contexts. Never show `legal_name` or email.
- **Jurisdiction struct:** `{ congressional, state_senate, state_house, county, school_district }` — maps directly to Federal, State (×2), Local, and Neighborhood slices.
- **Pilot context:** Bloomington, Indiana (Monroe County). Manually curated data. IU students and local civic participants are early adopters.
- **The ~30k principle:** Each slice ~6k people. Four slices ≈ 24k total. Same cohort for 2 years then half-swap (future). Human scale creates iterative encounters and accountability.
- **Figma foundation:** Krishna's prototype (file: J9mfnUSnc2k6fUQDhw9L7h) provides the visual starting point — particularly the tabbed hub interface and the slice navigation model. The onboarding screens in the Figma are superseded by the accounts system.
- **Tech stack:** React + Tailwind (Framer-compatible), Express/Node backend on Render, Supabase (`civic_spaces.*` schema), TypeScript everywhere, Redis with in-memory fallback.
- **Shipped state (v3.0):** 6,847 LOC TypeScript. Identity-rich geo-grounded hero banners on every slice tab (Wikipedia REST API). Two-column desktop layout (65/35), teal pill tab bar, Tailwind v4 dark mode. Three live sidebar widgets (Compass, Representatives, Tools). Hook-hoisting at AppShell prevents 6x API calls. Recharts code-split to 328KB async chunk. Zero-warning TypeScript build. All v3.0 tech debt closed.

## Constraints

- **Tech stack:** React + Tailwind frontend, Express/TypeScript backend, Supabase — matches all other Empowered Vote feature repos
- **Auth:** Must use accounts.empowered.vote Auth Hub pattern — no custom login pages, no custom auth logic
- **Privacy:** `display_name` only in all UI. `tolerance_rating` never read or displayed. Raw coordinates never in any response. Total friend/follower counts not shown on other-user profiles.
- **Schema:** `civic_spaces.*` in the consolidated Supabase project (`kxsdzaojfaibhuzmclfq`) — or own project if consolidation not yet complete; use accounts UUID as FK from day one
- **XP/Gems:** Award via accounts API with stable `transaction_key` — idempotent, never on render
- **Suspended accounts:** `account_standing: 'suspended'` = read-only, cannot post or interact
- **Repo naming:** `empowered-civic-spaces` per platform convention
- **No cost to Connect:** Equity of Opportunity — participation is never paywalled

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Jurisdiction GEOIDs as slice boundaries (not geographic circles) | Accounts system already resolves GEOIDs; circle model adds complexity without clear benefit | ✓ Good — GEOIDs work cleanly across all 4 geo slice types |
| Federal Slice first, other slices as empty-but-visible tabs | Proves the model with real users before replicating across all four; pilot population is small | ✓ Good — v2.0 activated all slices without rearchitecting |
| Mutual friends model (both must accept) | Aligns with platform's pseudonymous community trust model — prevents one-sided social graphs | ✓ Good — working as designed |
| Elected accounts followable one-directionally | Civic leaders need reach without requiring reciprocation; mirrors public figure convention | ✓ Good — implemented, visible on profile pages |
| 6k hard cap per slice → new slice created | Preserves the ~30k principle; prevents "ocean" dynamic as platform grows | ✓ Good — extended to Unified and Volunteer slice types in v2.0 |
| CSS hidden (not conditional rendering) for all geo SliceFeedPanels | Preserves React Query cache, realtime subscriptions, and DOM scroll across tab switches | ✓ Good — critical for scroll preservation and per-tab state isolation |
| check-before-insert for Unified Slice assignment | Stable 2-year cohort: user stays in same sibling Unified slice, not re-assigned each login | ✓ Good — correct cohort semantics |
| Volunteer revocation on every login when role absent | Prompt removal without webhook dependency; 90s server-side cache is acceptable lag | ✓ Good — simple and reliable |
| ProfilePage as fixed inset-0 overlay | Stacks above CSS-hidden AppShell without layout coupling; no routing library required initially | ✓ Good — wouter installed cleanly; overlay approach works |
| Mutual-friends-only disclosure on other-user profile | Privacy: total friend count is not shown to other viewers; only mutual count is relevant | ✓ Good — enforced at RPC level (get_mutual_friends) and UI level |
| onAuthorTap callback pattern removed; leaf components own navigation | Prop drilling through SliceFeedPanel was brittle; useLocation in leaf components is simpler | ✓ Good — cleaner component boundaries |
| Wikipedia REST API for hero images (not Supabase Storage uploads) | Zero-upload, zero-auth, returns geo-appropriate photos for any US state/county automatically | ✓ Good — simpler, no service-role key, better photos |
| Hook-hoisting at AppShell (not inside SliceFeedPanel) | All 6 feed panels mount simultaneously via CSS-hidden pattern; hooks inside panels fire 6x | ✓ Good — essential for sidebar data hooks |
| Anti-partisan policy at type layer (party field omitted from PoliticianFlatRecord) | Policy must be enforced structurally, not just by convention | ✓ Good — accidental rendering is impossible |
| Sidebar width 18% (not 35%) | Feed content should dominate; sidebar is supplemental | ✓ Good — confirmed by user during visual verification |
| Volunteer tab sidebar hidden entirely (returns null) | Volunteer tab will get a task assignment modal; civic widgets not relevant | — Pending v4.0 task modal |
| React.lazy named-export shim for Recharts code-split | React.lazy expects default export; named-export shim is required or runtime throws | ✓ Good — Recharts deferred to 328KB async chunk |

---
*Last updated: 2026-04-10 after v3.0 milestone*
