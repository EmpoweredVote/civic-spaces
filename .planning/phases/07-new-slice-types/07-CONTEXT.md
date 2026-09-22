# Phase 7: New Slice Types - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `unified` and `volunteer` slice types to the schema, wire up the slice assignment service to populate them on login, and activate both hub tab shells as fully functional forums. Volunteer tab is visible only to users with the Volunteer role.

The Volunteer role API field is NOT yet confirmed by the accounts team — Volunteer assignment is stubbed as "always false" this phase. Full schema, tab infrastructure, and role-gating are built; the actual role check is wired up in a follow-up once the accounts team confirms the field name.

</domain>

<decisions>
## Implementation Decisions

### Volunteer role detection
- The accounts team is still defining how the Volunteer role is surfaced in the API — do NOT implement the real role check in Phase 7
- Phase 7: The volunteer role check in the assignment service is a stub that always returns false (no Volunteer assignments happen yet)
- Build the full schema, tab, and gating infrastructure so wiring up the real check is a one-line change
- On role revocation: assignment service should remove the user from Volunteer slice membership on next login (Claude decides the mechanism — consistent with how geo assignment works)

### Volunteer tab visibility & access
- Non-Volunteer users: Volunteer tab is completely hidden (not visible, not greyed out)
- Role gain takes effect on next login — the assignment service re-runs at login and grants access
- No in-session real-time role checking required

### Unified slice assignment
- Assignment strategy: "assign once if not already assigned" — check for existing Unified membership before any insert; do NOT blindly re-upsert on every login
- Rationale: users are intended to stay in the same Unified cohort for 2 years; a blind upsert risks moving them to a different slice
- Geoid sentinel: `'UNIFIED'` (as established in roadmap)
- Position in hub: left column, beside Federal (already confirmed by Phase 6 shell placement)
- If user changes their address, re-assignment follows the same path as geo slice re-assignment

### Overflow & sibling slices (all slice types)
- Each slice is an isolated community — no cross-sibling feeds for any slice type
- Geo, Unified, and Volunteer sibling slices are all independent; posts in one sibling do not appear in another
- Overflow behavior: same DB CHECK constraint cap at 6,000; assignment service creates a sibling and routes overflow users there
- Sibling isolation is consistent across all slice types

### Slice numbering display
- All slice types show their number in the **feed header above the feed**, not in the tab label
- Format: "Name #N" — e.g. "Neighborhood #1", "Federal #1", "Unified #3", "Volunteer #1"
- Tab labels remain short (Neighborhood / Local / State / Federal / Unified / Volunteer)
- This pattern applies consistently to every slice type, including geo slices (even though geo siblings are rare)

### Claude's Discretion
- Mechanism for removing Volunteer slice membership on role revocation (delete from slice_members, soft-delete, etc.)
- Whether to show slice # only when N > 1 or always show #1 — Claude should pick the cleanest UX
- RLS policy review for `unified` and `volunteer` slice_types (researcher + planner handle this)

</decisions>

<specifics>
## Specific Ideas

- Unified slice is a "same cohort for 2 years" design — like a small town digital square but worldwide. The slice number matters because it identifies your specific community, not just the type.
- "Every slice (Neighborhood, Local, State, Federal, Unified, Volunteer) remains attached to a person for 2 years unless they move and change their address. What is posted in other slices does not show up in your feed." — direct quote from user, clarifying isolation intent.
- The Volunteer tab should feel like it doesn't exist at all to non-Volunteers — no hint, no lock, no tease.

</specifics>

<deferred>
## Deferred Ideas

- **Unified slice 2-year rotation / "trade half" mechanic** — users stay in the same Unified cohort for 2 years, then half the cohort swaps with another slice. This is a distinct future phase; Phase 7 only handles initial assignment and isolation.
- **Volunteer role API wiring** — accounts team is defining the field; connecting the real role check is a follow-up once confirmed. Document the stub clearly so it's easy to find.

</deferred>

---

*Phase: 07-new-slice-types*
*Context gathered: 2026-04-03*
