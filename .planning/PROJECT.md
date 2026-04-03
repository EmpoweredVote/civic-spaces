# Civic Spaces

## What This Is

Civic Spaces is the Connect Pillar of the Empowered Vote civic platform. It's a pseudonymous community hub that places each Connected user into four geographically-scoped "slices" of approximately 6,000 people each — Neighborhood, Local, State, and Federal — creating human-scale civic communities where iterative encounters breed cooperation and individual voices actually matter. Users post, discuss, and build relationships within their slices, with a friends system that surfaces familiar voices in their feed.

## Core Value

Every Connected user is part of four geographic communities plus specialized civic spaces — and they can move fluidly between all of them from a single hub.

## Current Milestone: v2.0 All Slices

**Goal:** Expand from Federal-only to all slice types — activating the remaining geo slices, launching the Global and Volunteer slices, and giving users a profile page that anchors their civic identity.

**Target features:**
- Activate Neighborhood, Local, and State slice tabs with full forum capability
- Redesign hub layout: geographic slices (left), special slices — Global and Volunteer — (right)
- Global Slice (Unified tab): distinct 6k-person flat slice with worldwide membership
- Volunteer Slice: role-gated flat slice for users with the Volunteer role; assigned by the slice assignment service; right-side tab only visible to Volunteers
- Profile pages: display name, join date, slice memberships, post/reply counts, mutual connections

## Requirements

### Validated

- ✓ Schema, RLS, external JWT auth, slice assignment service — Phase 1
- ✓ Federal Slice forum: feed, posts, replies, cursor pagination — Phase 2
- ✓ Social graph: mutual friends, Empowered follow, friend-boosted feed — Phase 3
- ✓ Notifications: reply, friend request, accepted friendship — Phase 4
- ✓ Moderation & Safety: flag, block, moderator queue — Phase 5

### Active (Milestone v2.0)

- [ ] Neighborhood, Local, and State slice tabs are active with full forum capability
- [ ] Hub layout separates geographic slices (left) from special slices — Global, Volunteer — (right)
- [ ] Global Slice is a distinct 6k-person slice with worldwide flat membership
- [ ] Volunteer Slice is available to users with the Volunteer role; auto-assigned by the slice assignment service
- [ ] User profile page shows display name, join date, slice memberships, post/reply counts, and mutual connections

### Out of Scope

- Circle-model geographic boundaries (Civil Civics radius approach) — replaced permanently by jurisdiction GEOIDs from the accounts system
- Aggregate "all slices" combined feed — deferred; Unified tab is the Global slice only for now
- Debates, Shared Facts, Symposiums, Announcements tabs inside slices — future feature layers on top of the basic forum
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

## Constraints

- **Tech stack:** React + Tailwind frontend, Express/TypeScript backend, Supabase — matches all other Empowered Vote feature repos
- **Auth:** Must use accounts.empowered.vote Auth Hub pattern — no custom login pages, no custom auth logic
- **Privacy:** `display_name` only in all UI. `tolerance_rating` never read or displayed. Raw coordinates never in any response.
- **Schema:** `civic_spaces.*` in the consolidated Supabase project (`kxsdzaojfaibhuzmclfq`) — or own project if consolidation not yet complete; use accounts UUID as FK from day one
- **XP/Gems:** Award via accounts API with stable `transaction_key` — idempotent, never on render
- **Suspended accounts:** `account_standing: 'suspended'` = read-only, cannot post or interact
- **Repo naming:** `empowered-civic-spaces` per platform convention
- **No cost to Connect:** Equity of Opportunity — participation is never paywalled

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Jurisdiction GEOIDs as slice boundaries (not geographic circles) | Accounts system already resolves GEOIDs; circle model adds complexity without clear benefit for v1 | — Pending |
| Federal Slice first, other slices as empty-but-visible tabs | Proves the model with real users before replicating across all four; pilot population is small | — Pending |
| Mutual friends model (both must accept) | Aligns with platform's pseudonymous community trust model — prevents one-sided social graphs | — Pending |
| Elected accounts followable one-directionally | Civic leaders need reach without requiring reciprocation; mirrors public figure convention | — Pending |
| 6k hard cap per slice → new slice created | Preserves the ~30k principle; prevents "ocean" dynamic as platform grows | — Pending |

---
*Last updated: 2026-04-03 after milestone v2.0 initialization*
