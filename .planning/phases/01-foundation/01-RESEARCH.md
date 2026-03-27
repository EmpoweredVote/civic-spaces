# Phase 1: Foundation - Research

**Researched:** 2026-03-27
**Domain:** Supabase external JWT auth (Third-Party Auth), PostgreSQL RLS + schema design, Express.js slice assignment service
**Confidence:** MEDIUM-HIGH overall (auth path confirmed in memory; PostgreSQL patterns from official docs; some Supabase Third-Party Auth config details require validation against live project)

---

## Summary

Phase 1 establishes the auth integration, full schema DDL, and slice assignment service that all downstream phases depend on. The critical OIDC blocker noted in STATE.md is **resolved**: the memory file (updated 2026-03-27) confirms Path A is live. accounts.empowered.vote (Supabase project `kxsdzaojfaibhuzmclfq`) has migrated GoTrue from HS256 to ES256, and its JWKS endpoint is publicly available. Civic Spaces' Supabase project must be configured to trust JWTs signed by that JWKS endpoint.

The key constraint throughout the entire schema is that `auth.jwt() ->> 'sub'` is the user identity anchor in every RLS policy — not `auth.uid()`. Supabase's `auth.uid()` reads from `request.jwt.claim.sub`, so for a properly-formed external JWT with a `sub` claim it would return the same value, but the project decision locks in `auth.jwt() ->> 'sub'` for explicitness. Every table must also receive `role: 'authenticated'` in the JWT for Supabase to use the authenticated Postgres role.

The 6k member cap requires a trigger-based enforcement pattern, not a plain CHECK constraint. PostgreSQL CHECK constraints cannot reference other tables or count rows. The correct pattern is a BEFORE INSERT trigger on `slice_members` that locks the parent `slices` row with `SELECT ... FOR UPDATE`, reads `current_member_count`, raises an exception if at limit, and increments the counter atomically. Automatic overflow (creating a sibling slice) is handled by the slice assignment service in Express, not by a DB trigger — keeping the sibling-creation logic auditable and testable.

**Primary recommendation:** Configure Third-Party Auth in the Supabase Dashboard using the JWKS URL from accounts' Supabase project. Write all RLS policies using `auth.jwt() ->> 'sub'`. Use a BEFORE INSERT trigger with `SELECT ... FOR UPDATE` for the 6k cap. Handle sibling-slice creation in the Express service, not in a DB trigger.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS client (`@supabase/supabase-js`) | 2.x | Database access, RLS-aware queries, Realtime | Official client; handles JWT injection in Authorization header |
| Express.js | 4.x | Slice assignment service HTTP server | Already decided; minimal; runs on Render |
| `node-postgres` / `pg` | 8.x | Raw SQL in Express service when needed | Allows parameterized queries for the upsert logic |
| `jsonwebtoken` | 9.x | Verify incoming bearer tokens in Express service | Standard Node.js JWT library; needed for token validation in service |
| `jose` | 5.x | JWKS-based JWT verification (alternative to `jsonwebtoken` + manual JWKS fetch) | Handles JWKS key rotation transparently; preferred for JWKS verification |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` (service role) | 2.x | Service-role client in Express to bypass RLS for slice upserts | Slice assignment writes happen as a privileged server action, not as the user |
| `dotenv` | 16.x | Environment variable management in Express | Standard for local dev secret management |
| Supabase CLI | latest | Migration management, local dev stack | Run `supabase db reset` and `supabase db push` for schema management |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jose` for JWKS verify | `jsonwebtoken` + manual JWKS fetch | `jose` handles key rotation + ES256 natively; `jsonwebtoken` requires a JWKS-to-PEM conversion step |
| Supabase service-role client in Express | Direct `pg` connection with superuser | Service-role client respects Supabase API conventions and is easier to configure; direct pg works but bypasses API layer |

**Installation (Express slice assignment service):**
```bash
npm install @supabase/supabase-js jose express dotenv
npm install -D @types/express typescript ts-node
```

---

## Architecture Patterns

### Recommended Project Structure

```
civic-spaces/
├── supabase/
│   ├── config.toml              # Supabase CLI config — third_party auth NOT configurable here for custom OIDC
│   ├── migrations/
│   │   ├── 20260327000001_schema.sql       # Full civic_spaces schema DDL
│   │   ├── 20260327000002_rls.sql          # All RLS policies
│   │   └── 20260327000003_triggers.sql     # member_count trigger, overflow logic
│   └── seed.sql                  # Test data for slice cap verification
│
├── services/
│   └── slice-assignment/         # Express service on Render
│       ├── src/
│       │   ├── index.ts           # Express app entry
│       │   ├── routes/
│       │   │   └── assignment.ts  # POST /assign endpoint
│       │   ├── services/
│       │   │   ├── accountsApi.ts  # GET /api/account/me call
│       │   │   └── sliceAssigner.ts # Upsert logic for all 4 slices
│       │   └── middleware/
│       │       └── verifyToken.ts  # Validate Bearer token via JWKS
│       └── package.json
│
└── src/                          # React frontend (Phase 2+)
    └── lib/
        └── supabase.ts            # Supabase client with external token injection
```

### Pattern 1: Third-Party Auth JWT Injection into Supabase Client

**What:** The frontend receives a Bearer token from accounts.empowered.vote. This token must be passed to Supabase as the Authorization Bearer header for every request so RLS policies can read `auth.jwt()`.

**When to use:** Every Supabase query from the frontend.

```typescript
// Source: Supabase official docs + CIVIC-SPACES-ONBOARDING.md pattern
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create client with dynamic token injection
export function createAuthenticatedClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}

// Usage: get token from localStorage, create client per-request
// OR use the accessToken option for session-less clients:
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => localStorage.getItem('ev_token') ?? '',
})
```

**Critical:** The JWT from accounts.empowered.vote MUST include `"role": "authenticated"`. Confirm this claim exists on the GoTrue ES256 tokens. If not present, Supabase will assign the `anon` role and RLS policies will not evaluate under the authenticated role.

### Pattern 2: RLS Policy Using auth.jwt() ->> 'sub'

**What:** All RLS policies use `auth.jwt() ->> 'sub'` as the user identity. The `sub` claim contains the accounts UUID.

**When to use:** Every SELECT/INSERT/UPDATE/DELETE policy on every `civic_spaces.*` table.

```sql
-- Source: Official Supabase RLS docs + community pattern for external JWT
-- Standard ownership policy
CREATE POLICY "user_owns_row"
ON civic_spaces.posts
FOR ALL
TO authenticated
USING (user_id = (auth.jwt() ->> 'sub'))
WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

-- Helper function (recommended — used in every policy)
CREATE OR REPLACE FUNCTION civic_spaces.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() ->> 'sub';
$$;

-- Usage in policies:
USING (user_id = civic_spaces.current_user_id())
```

**Why a helper function:** Centralizes the claim path. If the sub claim location ever changes, update one function instead of every policy.

### Pattern 3: Slice Member Count Enforcement (Trigger + FOR UPDATE Lock)

**What:** BEFORE INSERT trigger on `slice_members` that locks the parent `slices` row, reads `current_member_count`, raises an exception if at limit (6000), and increments the counter.

**When to use:** Every INSERT into `slice_members`.

```sql
-- Source: PostgreSQL official docs (ddl-constraints, plpgsql-trigger) + concurrency patterns
-- The slices table carries the counter
ALTER TABLE civic_spaces.slices
  ADD COLUMN current_member_count integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT cap_6000 CHECK (current_member_count <= 6000);

-- Trigger function
CREATE OR REPLACE FUNCTION civic_spaces.enforce_slice_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Lock the slice row to serialize concurrent inserts
  SELECT current_member_count
  INTO v_count
  FROM civic_spaces.slices
  WHERE id = NEW.slice_id
  FOR UPDATE;

  IF v_count >= 6000 THEN
    RAISE EXCEPTION 'slice_full: slice % has reached the 6000 member cap', NEW.slice_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Atomically increment
  UPDATE civic_spaces.slices
  SET current_member_count = current_member_count + 1
  WHERE id = NEW.slice_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_slice_cap
BEFORE INSERT ON civic_spaces.slice_members
FOR EACH ROW
EXECUTE FUNCTION civic_spaces.enforce_slice_cap();

-- Mirror trigger for DELETE (decrement)
CREATE OR REPLACE FUNCTION civic_spaces.decrement_slice_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE civic_spaces.slices
  SET current_member_count = current_member_count - 1
  WHERE id = OLD.slice_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_decrement_slice_count
AFTER DELETE ON civic_spaces.slice_members
FOR EACH ROW
EXECUTE FUNCTION civic_spaces.decrement_slice_count();
```

**Concurrency safety:** The `FOR UPDATE` lock on the `slices` row serializes concurrent inserts for the same slice. Two transactions trying to fill the last slot will serialize; only one succeeds. This is the correct pattern for counter-based cap enforcement in PostgreSQL.

**The CHECK constraint `cap_6000`** is a safety net only — it catches bugs in the trigger logic. The trigger does the real enforcement via the lock + exception.

### Pattern 4: Slice Assignment Express Service

**What:** POST endpoint that receives a user's Bearer token, calls `GET /api/account/me` on accounts.empowered.vote, maps jurisdiction GEOIDs to slice IDs, and upserts into all four `slice_members` tables.

**When to use:** Called on every login (idempotent by design).

```typescript
// Source: CIVIC-SPACES-ONBOARDING.md pattern + Supabase upsert docs
async function assignUserToSlices(accountsToken: string): Promise<void> {
  // 1. Fetch jurisdiction from accounts API
  const res = await fetch('https://accounts.empowered.vote/api/account/me', {
    headers: { Authorization: `Bearer ${accountsToken}` },
  })
  if (!res.ok) throw new Error(`accounts API error: ${res.status}`)
  const user = await res.json()

  if (!user.jurisdiction) {
    // No jurisdiction set — skip assignment, not an error
    return
  }

  // 2. Map jurisdiction GEOIDs to slice types
  const assignments = [
    { slice_type: 'federal',      geoid: user.jurisdiction.congressional },
    { slice_type: 'state',        geoid: user.jurisdiction.state_senate },   // primary
    { slice_type: 'local',        geoid: user.jurisdiction.county },
    { slice_type: 'neighborhood', geoid: user.jurisdiction.school_district },
  ]

  // 3. For each assignment, find or create slice, then upsert membership
  for (const { slice_type, geoid } of assignments) {
    const sliceId = await findActiveSliceForGeoid(slice_type, geoid)
    await upsertSliceMember(user.id, sliceId)
  }
}

// Upsert is idempotent: conflict on (user_id, slice_id) does nothing
async function upsertSliceMember(userId: string, sliceId: string): Promise<void> {
  const { error } = await supabaseServiceRole
    .schema('civic_spaces')
    .from('slice_members')
    .upsert(
      { user_id: userId, slice_id: sliceId },
      { onConflict: 'user_id,slice_id', ignoreDuplicates: true }
    )

  if (error) {
    if (error.message.includes('slice_full')) {
      // Slice at cap — find next available sibling or create one
      const siblingSliceId = await findOrCreateSiblingSlice(sliceId)
      await upsertSliceMember(userId, siblingSliceId) // retry with sibling
    } else {
      throw error
    }
  }
}
```

### Pattern 5: Supabase Third-Party Auth Configuration (Dashboard)

**What:** Configure the Civic Spaces Supabase project to trust JWTs issued by the accounts Supabase project.

**Configuration required in Supabase Dashboard (not config.toml):**

```
Dashboard → Authentication → Configuration → Third-Party Auth (or "Integrations")

JWKS URL:  https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1/.well-known/jwks.json
Issuer:    https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1
Audience:  authenticated
```

**Note on local dev:** The named Supabase CLI `config.toml` third_party providers (Firebase, Auth0, Cognito, Clerk, WorkOS) do NOT include a generic OIDC option as of current CLI. For local development, test RLS policies using Supabase's test utilities with manually crafted JWTs signed with a known test key, OR point local Supabase at the live accounts JWKS URL if network access is available.

### Anti-Patterns to Avoid

- **Using `auth.uid()` in RLS policies:** While it likely returns the same value as `auth.jwt() ->> 'sub'` for external JWTs with a `sub` claim, `auth.uid()` is documented for Supabase-native auth. Use `civic_spaces.current_user_id()` (which calls `auth.jwt() ->> 'sub'`) exclusively.
- **Counting rows in a CHECK constraint:** PostgreSQL CHECK constraints cannot reference other tables. The `current_member_count` counter on `slices` + trigger is the correct pattern.
- **Non-idempotent slice assignment:** The slice assignment service will be called on every login. The upsert must use `ignoreDuplicates: true` or equivalent to avoid duplicating memberships.
- **Creating sibling slices in a DB trigger:** Keep sibling-slice creation in the Express service where it can be logged, retried, and tested. DB triggers for this logic are hard to observe and debug.
- **Storing jurisdiction in Civic Spaces DB:** Jurisdiction GEOIDs must never be stored locally — only the `slice_id` mapping (which is derived from the GEOID). The GEOID-to-slice mapping lives in the `slices` table.
- **Using HS256 fallback:** The STATE.md notes that `SUPABASE_JWT_SECRET` must be removed from the accounts API's Render env vars to ensure the HS256 fallback is off. Verify this before writing any RLS policy.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWKS key fetching and caching | Custom JWKS fetch + cache logic in Express | `jose` library (`createRemoteJWKSet`) | Handles key rotation, caching, and ES256 natively |
| JWT verification | Manual base64 decode + signature check | `jose` `jwtVerify` | Handles algorithm enforcement, expiry, audience checks |
| Supabase upsert conflict handling | Manual SELECT then INSERT/UPDATE | `supabase.from().upsert({ onConflict })` | Atomic at DB level; avoids race conditions |
| PostgreSQL counter atomicity | Application-level count + insert | `SELECT ... FOR UPDATE` in trigger | Application-level counts have TOCTOU race conditions |
| Auth Hub redirect | Custom login page | Redirect to `accounts.empowered.vote/login?redirect=...` | The accounts system owns all auth and identity |

**Key insight:** The accounts system owns auth, geocoding, and user identity entirely. Civic Spaces' job is to receive a valid JWT and map jurisdiction to slice membership — nothing more.

---

## Common Pitfalls

### Pitfall 1: Missing `role: "authenticated"` in JWT

**What goes wrong:** Supabase assigns the `anon` Postgres role to requests with JWTs missing the `role` claim. RLS policies scoped to `TO authenticated` never evaluate. All queries return empty results or permission errors silently.

**Why it happens:** GoTrue issues tokens with `role: "authenticated"` by default for its own users, but a custom OIDC/JWT may not include this claim. The transition from HS256 to ES256 at accounts.empowered.vote needs verification that `role` is still present.

**How to avoid:** Before writing any RLS policy, decode a live JWT from accounts.empowered.vote and verify `role: "authenticated"` is present. If missing, the accounts team must add it.

**Warning signs:** Supabase queries return 0 rows even for the authenticated user's own data.

### Pitfall 2: Third-Party Auth Local Dev Mismatch

**What goes wrong:** Local Supabase (via CLI) uses the default `jwt_secret` (HS256) for JWT verification. Third-Party Auth configured in the Dashboard uses asymmetric key verification. Local tests pass but production fails (or vice versa).

**Why it happens:** The Supabase CLI config.toml does not support generic OIDC issuers for third-party auth. Named providers (Firebase, Clerk, etc.) work, but a custom OIDC issuer (accounts.empowered.vote) has no config.toml equivalent.

**How to avoid:** For local dev, either: (a) generate test JWTs signed with the local Supabase HS256 JWT secret and adjust test-only RLS helpers, or (b) use `supabase test db` with pgTAP to test RLS policies using direct SQL functions that simulate JWT claims via `SET LOCAL request.jwt.claims`.

**Warning signs:** RLS tests pass locally but fail in production.

### Pitfall 3: Concurrent Slice Cap Race Condition

**What goes wrong:** Two users simultaneously try to join a slice at member 5,999. Both read `current_member_count = 5999` before either commits. Both pass the cap check. Slice ends up at 6,001.

**Why it happens:** Without the `FOR UPDATE` lock on the `slices` row, the BEFORE INSERT trigger reads stale data from concurrent transactions.

**How to avoid:** The trigger MUST use `SELECT ... FOR UPDATE` to lock the `slices` row before reading `current_member_count`. This serializes concurrent inserts for the same slice.

**Warning signs:** `current_member_count` exceeds 6000; the CHECK constraint `cap_6000` fires unexpectedly.

### Pitfall 4: GEOID Format Assumptions

**What goes wrong:** Slice lookup by GEOID fails because the GEOID string format varies (e.g., `"1809"` vs `"09"` vs `"18009"`).

**Why it happens:** The ONBOARDING.md notes that county GEOIDs may be "5-char full FIPS (e.g. `18105`) or 2-char suffix" — the format is unverified against live data.

**How to avoid:** In the `slices` table, store GEOIDs in a canonical form and normalize incoming GEOIDs before lookup. Test with actual responses from `GET /api/account/me` during service development.

**Warning signs:** `findActiveSliceForGeoid` returns null for users whose jurisdiction is set.

### Pitfall 5: Sibling Slice Creation Without Coordination

**What goes wrong:** Two simultaneous "slice full" errors both trigger sibling creation, creating two sibling slices instead of one.

**Why it happens:** The Express service naively creates a sibling on every cap-rejection without checking if one already exists.

**How to avoid:** `findOrCreateSiblingSlice` must use an INSERT ... ON CONFLICT DO NOTHING or a `SELECT ... FOR UPDATE` on the parent slice before creating the sibling. Use a unique constraint on `(geoid, slice_type, sibling_index)` to prevent duplicates.

**Warning signs:** Multiple sibling slices exist for the same GEOID when only one overflow event occurred.

### Pitfall 6: Decrement Trigger Missing on DELETE

**What goes wrong:** When a member is removed from a slice, `current_member_count` is never decremented. The counter diverges from actual membership. The cap fires prematurely.

**Why it happens:** Developers write the increment trigger but forget the AFTER DELETE decrement trigger.

**How to avoid:** Write both triggers together: `trg_enforce_slice_cap` (BEFORE INSERT) and `trg_decrement_slice_count` (AFTER DELETE). Add a migration test that inserts and then deletes and verifies the counter.

---

## Code Examples

### RLS Policy: Slice Member Can Read Their Slice's Posts

```sql
-- Source: Supabase RLS docs + external JWT sub pattern
CREATE POLICY "slice_members_can_read_posts"
ON civic_spaces.posts
FOR SELECT
TO authenticated
USING (
  slice_id IN (
    SELECT slice_id
    FROM civic_spaces.slice_members
    WHERE user_id = civic_spaces.current_user_id()
  )
);
```

### RLS Policy: User Can Only Post in Their Slice

```sql
CREATE POLICY "user_can_insert_own_posts"
ON civic_spaces.posts
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = civic_spaces.current_user_id()
  AND slice_id IN (
    SELECT slice_id
    FROM civic_spaces.slice_members
    WHERE user_id = civic_spaces.current_user_id()
  )
);
```

### JWT Verification in Express (using jose)

```typescript
// Source: jose docs + CIVIC-SPACES-ONBOARDING.md auth pattern
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(
  new URL('https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1/.well-known/jwks.json')
)

export async function verifyAccountsToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1',
    audience: 'authenticated',
  })
  return payload
}
```

### pgTAP RLS Test Pattern (Local Dev)

```sql
-- Source: Supabase testing docs pattern
BEGIN;
SELECT plan(2);

-- Simulate a user JWT by setting the claim directly
SET LOCAL request.jwt.claims = '{"sub": "user-uuid-here", "role": "authenticated"}';
SET LOCAL role = 'authenticated';

-- Test: user can see their own slice
SELECT ok(
  EXISTS(
    SELECT 1 FROM civic_spaces.slice_members
    WHERE user_id = current_setting('request.jwt.claims')::json ->> 'sub'
  ),
  'user sees their own slice membership'
);

SELECT * FROM finish();
ROLLBACK;
```

### Supabase Client with External Token (Frontend)

```typescript
// Source: CIVIC-SPACES-ONBOARDING.md + Supabase JS docs
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    accessToken: async () => {
      return localStorage.getItem('ev_token') ?? ''
    },
  }
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HS256 JWT_SECRET for external tokens | ES256 asymmetric JWKS (Third-Party Auth) | 2026-03-27 (accounts GoTrue migration) | No more shared secret; key rotation is transparent |
| Token exchange Edge Function (Path B) | Native Third-Party Auth trust (Path A) | 2026-03-27 (confirmed live) | No Edge Function needed; Supabase handles verification natively |
| `auth.uid()` in RLS | `auth.jwt() ->> 'sub'` via helper function | Pre-existing decision | Explicit, portable across auth providers |
| App-level row count checks | DB trigger with `SELECT FOR UPDATE` counter | Pre-existing decision | Race-condition-proof cap enforcement |

**Deprecated/outdated:**
- Edge Function token exchange (Path B): Was the fallback if OIDC wasn't available. Now obsolete — Path A is confirmed.
- `SUPABASE_JWT_SECRET` in accounts API Render env vars: Must be removed to disable HS256 fallback. STATE.md flags this as a required verification step.

---

## Open Questions

1. **`role: "authenticated"` in ES256 tokens**
   - What we know: GoTrue migrated to ES256 on 2026-03-27. Third-Party Auth requires `role: "authenticated"` in the JWT.
   - What's unclear: Whether the GoTrue ES256 tokens at accounts.empowered.vote include `role: "authenticated"` in the payload.
   - Recommendation: Decode a live token from accounts.empowered.vote immediately in Plan 01-01 and verify this claim. If missing, work with accounts team to add it before proceeding.

2. **Dashboard vs. config.toml for Third-Party Auth**
   - What we know: Named providers (Firebase, Clerk, etc.) can be configured in config.toml. Generic OIDC has no config.toml equivalent in current CLI. Dashboard configuration is available.
   - What's unclear: Whether the Civic Spaces Supabase project already has the Third-Party Auth integration configured in the Dashboard, or if it needs to be done as part of Plan 01-01.
   - Recommendation: Plan 01-01 should include a task to verify the Dashboard configuration exists and test it with a live token.

3. **Local dev JWT verification**
   - What we know: Local Supabase stack uses HS256 by default. Third-Party Auth (ES256/JWKS) is not configurable in config.toml for custom issuers.
   - What's unclear: Whether the local CLI stack can be pointed at the live JWKS URL from accounts.empowered.vote for integration tests, or whether RLS tests must use the `SET LOCAL request.jwt.claims` pgTAP approach.
   - Recommendation: Use `SET LOCAL request.jwt.claims` in pgTAP tests for local RLS validation. Document the local/production discrepancy so future developers aren't surprised.

4. **GEOID format for county field**
   - What we know: The ONBOARDING.md notes county GEOID may be "5-char full FIPS (e.g. 18105) or 2-char suffix." This ambiguity is flagged.
   - What's unclear: What the live `GET /api/account/me` response actually returns for `jurisdiction.county`.
   - Recommendation: Make a live API call during Plan 01-01 development to confirm the exact GEOID format before writing the `slices` schema.

5. **State slice: two GEOIDs (state_senate + state_house)**
   - What we know: A user has both `state_senate` and `state_house` GEOIDs, both mapping to the "State Slice."
   - What's unclear: Whether the user is assigned to TWO state slices (one per GEOID) or ONE state slice (the primary). The ONBOARDING.md lists `state_senate` as the primary.
   - Recommendation: Default to state_senate as the State Slice GEOID. Defer state_house as a potential future "second state chamber" slice if needed.

---

## Sources

### Primary (HIGH confidence)
- `C:/Civic Spaces/CIVIC-SPACES-ONBOARDING.md` — Accounts API patterns, jurisdiction mapping, auth hub redirect
- `C:/Users/Chris/.claude/projects/C--Civic-Spaces/memory/project_civic_spaces.md` — Confirmed Path A (ES256, JWKS URL, role claim behavior)
- PostgreSQL official docs (https://www.postgresql.org/docs/current/ddl-constraints.html) — CHECK constraint limitations
- PostgreSQL official docs (https://www.postgresql.org/docs/current/sql-createtrigger.html) — Trigger semantics
- Supabase RLS docs (https://supabase.com/docs/guides/database/postgres/row-level-security) — auth.jwt() usage

### Secondary (MEDIUM confidence)
- Supabase Third-Party Auth overview (https://supabase.com/docs/guides/auth/third-party/overview) — Provider requirements (asymmetric, OIDC discovery, kid header, role claim)
- Supabase GitHub CLI config.go — Named provider list (Firebase, Auth0, Cognito, Clerk, WorkOS only; no generic OIDC in config.toml)
- Clerk/Supabase integration docs (https://clerk.com/docs/guides/development/integrations/databases/supabase) — `auth.jwt() ->> 'sub'` as RLS identity pattern
- Authgear/Supabase integration (https://www.authgear.com/post/supabase-any-auth-provider) — `current_user_id()` helper function pattern
- Supabase upsert docs (https://supabase.com/docs/reference/javascript/upsert) — `onConflict`, `ignoreDuplicates` options

### Tertiary (LOW confidence — verify before implementing)
- WebSearch aggregate on `auth.uid()` with third-party JWTs — Multiple sources say "use `auth.jwt() ->> 'sub'` instead of `auth.uid()`"; however, other sources suggest `auth.uid()` reads `sub` internally. The project decision to use `auth.jwt() ->> 'sub'` is correct and safe regardless.
- WebSearch on concurrent member count enforcement — General concurrency pattern described; specific Supabase/PostgreSQL implementation based on first-principles reasoning from official PostgreSQL docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Libraries are standard and well-established; choices derived from project constraints
- Auth configuration (Path A): HIGH — Memory file confirms live as of 2026-03-27; JWKS URL and issuer documented
- Auth local dev: MEDIUM — No config.toml equivalent for custom OIDC; pgTAP workaround approach is standard
- Schema/RLS patterns: HIGH — Based on official PostgreSQL and Supabase docs
- Trigger-based cap enforcement: HIGH — Based on official PostgreSQL docs; FOR UPDATE lock pattern is well-established
- GEOID format details: LOW — Ambiguity flagged in ONBOARDING.md; verify with live API call
- State slice dual-GEOID resolution: LOW — Inferred from documentation; needs confirmation

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (30 days) — Auth configuration is the fast-moving component; verify Supabase Third-Party Auth Dashboard state before starting Plan 01-01
