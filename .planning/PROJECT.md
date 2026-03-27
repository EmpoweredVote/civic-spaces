# Civic Spaces

## What This Is

Civic Spaces is the Connect Pillar of the Empowered Vote civic platform. It's a pseudonymous community hub that places each Connected user into four geographically-scoped "slices" of approximately 6,000 people each — Neighborhood, Local, State, and Federal — creating human-scale civic communities where iterative encounters breed cooperation and individual voices actually matter. Users post, discuss, and build relationships within their slices, with a friends system that surfaces familiar voices in their feed.

## Core Value

A Connected user can enter their Federal Slice, see posts from their ~6k civic neighbors, and contribute to the conversation — making civic engagement feel like a small town, not an ocean.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can navigate a hub showing all 4 slice tabs (Neighborhood, Local, State, Federal)
- [ ] User is automatically placed into the correct slice for each level based on their jurisdiction GEOIDs from the accounts API
- [ ] User can post to their Federal Slice and the post is visible to all members of that slice
- [ ] User can view a feed of posts from their Federal Slice, ordered by recency
- [ ] User can reply to posts in their Federal Slice
- [ ] User can send a friend request and the recipient must accept before the friendship is mutual
- [ ] User's feed surfaces posts from mutual friends with higher visibility / priority
- [ ] User can follow an Empowered (elected/civic leader) account one-directionally without requiring reciprocation
- [ ] Inform-tier users can browse slices read-only; all write actions prompt Connected Account creation
- [ ] Federal Slice is capped at 6,000 members; a second Federal Slice is created when cap is reached
- [ ] User with no jurisdiction set sees a prompt to add their address at accounts.empowered.vote/profile

### Out of Scope

- Circle-model geographic boundaries (Civil Civics radius approach) — replaced permanently by jurisdiction GEOIDs from the accounts system
- International / Unified slice — future, not v1
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
*Last updated: 2026-03-27 after initialization*
