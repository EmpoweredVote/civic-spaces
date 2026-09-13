# FROZEN — this backend service is folded into the ev-accounts engine

**Do not develop this service further.** It has been folded into the ev-accounts engine as an
in-process module and is **canonical there**, per **ev-cto decision 0018** (vendored-copy
governance, decision 0013 — same pattern as Civic Trivia and Validation Quests).

- **Canonical source:** `ev-accounts/backend/src/civic_spaces/`
- **Endpoint in the engine:** `POST /api/civic-spaces/assign`
- **Auth:** the engine's single dual-issuer verifier (`requireAuth`). The duplicate
  `verifyToken.ts` here is deliberately NOT carried into the engine — it 401'd every WorkOS
  member after the 2026-08-28 cutover.
- **Database:** a dedicated least-privilege Postgres role `civic_spaces_app` (migration
  CA_0112 in ev-accounts) — NOT the broad service key this service used. It can touch only
  `civic_spaces.{slices, slice_members, connected_profiles}` (identity wall,
  PRIVACY-ARCHITECTURE property A).

## The frontend stays active
Only THIS backend service is frozen. The civic-spaces **frontend still calls slice
assignment** — it builds `${VITE_SLICE_ASSIGNMENT_URL}/assign` (see
`src/lib/sliceAssignment.ts`). Cutover is one env var: point `VITE_SLICE_ASSIGNMENT_URL` at the
engine base `https://api.empowered.vote/api/civic-spaces` and rebuild the static site.

## Retirement (founder, dashboard-only — no MCP tool)
1. Set `VITE_SLICE_ASSIGNMENT_URL` on the civic-spaces static site to the engine base; rebuild;
   verify a real member setup end-to-end.
2. On the `civic-spaces-slice-assignment` Render service: turn **OFF** autoDeploy.
3. **Suspend** it once the frontend is confirmed on the engine.
4. **Delete** it only after a soak. (Reversible until deleted.)

Any change to slice-assignment behaviour must be made in `ev-accounts/backend/src/civic_spaces/`,
not here.
