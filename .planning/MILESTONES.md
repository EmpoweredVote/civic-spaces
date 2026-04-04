# Milestones: Civic Spaces

## v2.0 — All Slices (Shipped: 2026-04-04)

**Delivered:** All geographic and special slice types active with full forum capability — Unified and Volunteer slices launched, profile pages anchoring civic identity.

**Phases completed:** 6–8 (11 plans total)

**Key accomplishments:**

- Multi-tab hub with all 4 geo slices (N/L/S/F) simultaneously mounted via CSS-hidden panel pattern, preserving React Query cache and scroll across tab switches
- Per-tab independent scroll preservation via requestAnimationFrame save/restore on tab change
- Notification routing resolves any post's owning slice via Supabase lookup and switches to the correct tab on tap — desktop and mobile
- Unified Slice — 6k-capped worldwide flat slice; auto-assigned to all Connected users on login via check-before-insert; fully active forum tab
- Volunteer Slice — role-gated flat slice; auto-assigned and revoked on every login based on Volunteer role; tab absent from DOM entirely for non-Volunteer users
- Profile pages — display name tappable from all surfaces (8 total), profile shows stats, slice memberships, mutual-friends-only disclosure, friend request and follow actions

**Stats:**

- 3 phases (6–8), 11 plans
- ~113 commits since v1.0
- ~5,332 lines of TypeScript
- 7 days (2026-03-28 → 2026-04-04)

**Git range:** `feat(06-01)` → `feat(08-03)`

**What's next:** v3.0 — TBD

---

## v1.0 — Foundation & Full Forum (Shipped: 2026-03-28)

**Delivered:** Full working civic forum — auth, slice assignment, Federal Slice forum with social graph, notifications, and moderation.

**Phases completed:** 1–5 (14 plans total)

**Key accomplishments:**

- External JWT auth integration with Supabase — accounts.empowered.vote Auth Hub pattern, `current_user_id()` helper, full RLS on all `civic_spaces.*` tables
- Slice assignment service — reads jurisdiction GEOIDs from accounts API, upserts user into all 4 geo slice member tables, handles 6k cap overflow
- Federal Slice forum — cursor-paginated feed, PostCard, thread view with nested replies, PostComposer (create/edit/delete), Inform-tier gate
- Social graph — mutual friendship (both-accept model), Empowered follow, friend-boosted feed via `get_boosted_feed_filtered` RPC
- Notifications — reply, friend request, accepted friendship; Realtime badge; grouping for low-priority events
- Moderation & Safety — flag/review queue, bidirectional block with feed filtering, moderator action log

**Stats:**

- 5 phases (1–5), 14 plans
- 2 days (2026-03-27 → 2026-03-28)

**Git range:** `feat(01-01)` → `feat(05-02)`

---
