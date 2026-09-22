# Civic Spaces — Empowered Accounts Integration Onboarding

**Audience:** Claude instance working on the Civic Spaces project (Connect Pillar).
**Last updated:** 2026-04-01 (JWT migration to ES256 complete; v1.8 in progress)

---

## What You're Building

**Civic Spaces** is the Connect Pillar of the Empowered Vote civic platform. It's the place where pseudonymous civic participants organize by geography, discuss issues, and build community across five spatial layers:

| Space | Brand | District Type | Size |
|-------|-------|---------------|------|
| Neighborhood | **Civic Space** | `school_district` (closest proxy) | ~6k people |
| Local | **Local Slice** | `county` | ~6k people |
| State | **State Slice** | `state_senate` + `state_house` | ~6k people |
| Federal | **Federal Slice** | `congressional` | ~6k people |
| International | **Unified** | — | Future |

Total across all spaces: ~30,000 (not 30k per space).

**Focus Communities** — subreddit-style communities organized around a compass topic. They live as spokes off the Civic Spaces hub. Not called "Issues in Focus" or "Civic Spaces" — brand is Focus Communities.

Also accessible from the hub: Treasury Tracker, Read & Rank, Essentials (shown as accordion inside the relevant Civic Space, not as a standalone card), Compass calibration, Validation Quests.

Future hub features: Fallacy Finders, Empowered Badges, Symposiums, Awareness Exchange.

---

## The Account System You're Integrating With

Civic Spaces is a feature repo. It does **not** own accounts, auth, or user identity. All of that belongs to `empowered-accounts` (the repo this document lives in), running at:

```
Production API: https://accounts.empowered.vote/api
Auth Hub:       https://accounts.empowered.vote
```

### The Three-Tier Architecture

**Tier = child record presence. Never a status flag.**

```
auth.users                         ← Supabase Auth (UUID, email, password)
    └── public.users               ← slug, account_standing, invite chain
        ├── connect.connected_profiles   ← EXISTS = Connected tier
        └── empower.empowered_profiles   ← EXISTS = Empowered tier
```

| Tier | Who They Are | Connect Access |
|------|-------------|----------------|
| **Inform** | Unauthenticated or basic account | Browse public content only |
| **Connected** | Pseudonymous civic participant, invite-verified | Full Civic Spaces access |
| **Empowered** | Civic leader, legal name public | Same Connect access + elevated public standing |

**Civic Spaces is a Connected-tier feature.** A user must be Connected to participate. Inform users can browse but not post, join, or interact. You gate by checking whether `connected_profiles` exists — never by checking a status field.

### What a Connected Profile Contains (Relevant to Civic Spaces)

```typescript
// Returned by GET /api/account/me
{
  id: string,               // UUID — use this as the user identifier
  display_name: string,     // PSEUDONYM — the only name shown in Connect contexts
  tier: 'inform' | 'connected' | 'empowered',
  account_standing: 'active' | 'suspended',
  jurisdiction: {
    congressional: string,  // e.g. "1809"
    state_senate: string,
    state_house: string,
    county: string,
    school_district: string,
    // All five map directly to Civic Space membership
  },
  xp: {
    total: number,
    level: number,
    xp_in_level: number,
    xp_to_next_level: number,
  },
  gem_balance: {
    yellow: number,
    blue: number,
    red: number,
  },
  vq_hold_active: boolean,
  red_gem_quests_unlocked: boolean,
}
```

**Critical privacy rules — do not violate these:**
- `display_name` is the pseudonym. **Never** show `legal_name` in any Connect context, ever.
- `tolerance_rating` is internal-only. Never read or display it.
- Raw coordinates (`encrypted_lat`, `encrypted_lng`) are never in any API response — you get `jurisdiction` JSON only.

---

## Auth: How to Authenticate Users

### The Auth Hub Pattern

Civic Spaces should **not** build its own login page. Point users to the shared Auth Hub with a redirect parameter:

```
https://accounts.empowered.vote/login?redirect=https%3A%2F%2Fyour-civic-spaces-url%2F
```

After login, the user is redirected back with a token in the URL hash:

```
https://your-civic-spaces-url/#access_token=eyJ...
```

Extract and store it:

```typescript
const hash = new URLSearchParams(window.location.hash.slice(1));
const token = hash.get('access_token');
if (token) {
  localStorage.setItem('ev_token', token);
  window.history.replaceState({}, '', window.location.pathname);
}
```

### Using the Token

All authenticated requests send the token as a Bearer header:

```typescript
const response = await fetch('https://accounts.empowered.vote/api/account/me', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('ev_token')}` }
});
```

### Check User State on Load

```typescript
async function detectUserState() {
  const token = localStorage.getItem('ev_token');

  if (!token) {
    return { state: 'inform' };
  }

  const res = await fetch('https://accounts.empowered.vote/api/account/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (res.status === 401) {
    localStorage.removeItem('ev_token');
    return { state: 'inform' };
  }

  const user = await res.json();

  if (user.tier === 'inform') {
    return { state: 'inform', user };
  }

  if (!user.jurisdiction) {
    return { state: 'connected_no_jurisdiction', user };
    // Prompt them to set location in their profile
  }

  return { state: 'connected_with_jurisdiction', user };
}
```

The three branches matter for Civic Spaces:
- **`inform`** — read-only experience, prompt to create account
- **`connected_no_jurisdiction`** — Connected but hasn't set location yet; prompt them to visit `accounts.empowered.vote/profile` to add their address
- **`connected_with_jurisdiction`** — full access; you have all five jurisdiction GEOIDs to determine space membership

---

## JWT Verification — ES256 / JWKS (Important: Read Before Implementing Auth)

On 2026-03-27, the accounts Supabase project migrated from legacy HS256 (symmetric shared secret) to **ES256 asymmetric signing**. This is the architecture you must target. There is no shared `SUPABASE_JWT_SECRET` to configure — verification is done via the JWKS endpoint exclusively.

### JWKS Endpoint

```
https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1/.well-known/jwks.json
```

Returns a single EC P-256 key (`alg: ES256`).

### Configuring Supabase Third-Party Auth (Path A)

If Civic Spaces uses its own Supabase project and wants to verify accounts JWTs as a trusted third-party issuer, configure Third-Party Auth in your Supabase dashboard with these values:

| Setting | Value |
|---------|-------|
| **JWKS URL** | `https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1/.well-known/jwks.json` |
| **Issuer** | `https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1` |
| **Audience** | `authenticated` |

These are the same values used internally by the accounts API middleware (`auth.ts`). If you configure Third-Party Auth with these three values, tokens issued by the accounts Auth Hub will verify cleanly in your Supabase project.

### Verifying Tokens Yourself (Non-Supabase Path)

If you're verifying tokens server-side outside of Supabase (e.g., in an Express/Node service), use a JWKS-capable JWT library:

```typescript
import { jwtVerify, createRemoteJWKSet } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1/.well-known/jwks.json')
);

const { payload } = await jwtVerify(token, JWKS, {
  issuer: 'https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1',
  audience: 'authenticated',
});

const userId = payload.sub; // accounts UUID
```

**Do not use a shared secret.** `SUPABASE_JWT_SECRET` no longer exists in this project. Any integration that was configured with a symmetric secret before 2026-03-27 will fail — update it to use JWKS.

### Token Revocation

The accounts API enforces server-side token revocation on logout (using Redis). A user who logs out at `accounts.empowered.vote` will have their token marked revoked, even if it hasn't expired yet. If you verify tokens directly (without proxying through the accounts API), be aware that cryptographic validity alone is not sufficient — you may want to call `GET /api/account/me` to confirm the session is still active rather than purely verifying the JWT signature.

---

## Jurisdiction: How Users Join Spaces

The accounts system handles all the geocoding and boundary matching internally. You never ask users for their address — the profile page at `accounts.empowered.vote/profile` handles that. You receive only the resolved jurisdiction struct.

### Jurisdiction Field → Space Mapping

```typescript
const jurisdiction = user.jurisdiction;
// {
//   congressional: "1809",    → Federal Slice
//   state_senate:  "18047",   → State Slice (one of two)
//   state_house:   "18060",   → State Slice (second of two)
//   county:        "05",      → Local Slice (FIPS suffix — Monroe County = "05")
//   school_district: "09060", → Neighborhood Civic Space
// }
```

**GEOID formats (Indiana / TIGER/Line 2024):**
- `congressional`: 4-char state+district code (e.g. `"1809"` = Indiana CD-9)
- `state_senate` / `state_house`: 5-char (e.g. `"18047"`)
- `county`: 5-char full FIPS (e.g. `"18105"`) or 2-char suffix — verify against live data
- `school_district`: 5-char (e.g. `"09060"`)

A user belongs to **all five spaces simultaneously** (or four if Unified isn't built yet). Their `school_district` determines their Neighborhood Civic Space. Their `county` determines their Local Slice. Etc.

**Do not store jurisdiction in Civic Spaces' database.** Fetch it fresh from `GET /api/account/me`. It lives on the accounts system and could change if a user updates their address.

---

## Service-to-Service: Awarding XP and Gems

If Civic Spaces actions should reward XP or gems, call the accounts API with a service key. This key is provided out-of-band by the accounts team and should be stored in your environment as `EV_SERVICE_KEY`.

### Award XP

```typescript
await fetch('https://accounts.empowered.vote/api/xp/award', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': process.env.EV_SERVICE_KEY,
  },
  body: JSON.stringify({
    user_id: userId,           // accounts UUID
    source: 'civic_spaces_post',  // confirm valid source key with accounts team
    amount: 50,
    transaction_key: `cs-post-${postId}`,  // idempotency — use a stable unique key
  })
});
```

**The `transaction_key` is mandatory and must be stable.** If the same event is submitted twice, the second call is silently ignored. Never generate a random key — use a deterministic ID tied to the specific event (post ID, action ID, etc.).

### Award Gems

```typescript
await fetch('https://accounts.empowered.vote/api/gems/award', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': process.env.EV_SERVICE_KEY,
  },
  body: JSON.stringify({
    user_id: userId,
    gem_type: 'yellow',   // 'yellow' | 'blue' | 'red'
    amount: 1,
    source: 'civic_spaces_...',
  })
});
```

Each service key is authorized for specific gem types. Confirm with the accounts team which types your key permits before using.

---

## Public Profile Data

To display another user's profile card in a space (name, level, badges):

```
GET /api/account/profile/:userId
```

Returns only safe public fields — `display_name`, `tier`, `level`, `xp.total`. Never `tolerance_rating`, never `legal_name`, never coordinates.

For your own user's full profile: `GET /api/account/me` (requires auth token).

---

## Civic Spaces Database Ownership

Civic Spaces **will have its own schema** in the consolidated Supabase database. During v1.6 platform consolidation, schemas for all feature repos are being migrated into the ev-accounts Supabase project (`kxsdzaojfaibhuzmclfq`). Your schema will likely be `civic_spaces.*`.

Until the consolidation is complete, Civic Spaces may run its own Supabase project. In either case:

- **User identity is always the accounts UUID.** Use `user_id` (the accounts UUID) as the foreign key for every Civic Spaces record tied to a user. Never create a separate user table.
- **Never replicate user profile data.** Don't copy `display_name`, XP, or gems into your schema — always fetch fresh from accounts.
- **RLS on every table.** When you write migrations, every table must have RLS enabled and policies defined before shipping.

---

## Key Patterns to Follow

1. **Display names only.** In all Civic Spaces UI, show `display_name`. Never `legal_name`. Never email. Never real name.

2. **Jurisdiction from accounts, always.** Do not geocode, do not ask for addresses. The accounts system owns that. You receive only the resolved GEOID struct.

3. **Inform users get read-only.** If `tier === 'inform'`, allow browsing but gate all write actions (posting, reacting, joining) with a prompt to create a Connected Account → Auth Hub redirect.

4. **No jurisdiction = prompt to set location.** If `connected_no_jurisdiction`, show a banner: "Add your location in your profile to join your Civic Spaces." Link to `accounts.empowered.vote/profile`.

5. **Idempotent XP/gem awards.** Always pass a stable `transaction_key`. Never award on every page load or every render — tie the award to a specific discrete action that happened once.

6. **`account_standing: 'suspended'` = read-only.** Suspended users should not be able to post or interact. Check this field.

---

## Accounts API Quick Reference

**Base URL:** `https://accounts.empowered.vote/api`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/account/me` | Bearer token | Full user state (tier, jurisdiction, XP, gems, VR) |
| `GET` | `/api/account/profile/:userId` | None | Public profile (display_name, tier, level) |
| `GET` | `/api/auth/me` | Bearer token | Minimal identity (id, email, tier) |
| `POST` | `/api/xp/award` | X-Service-Key | Award XP (idempotent) |
| `POST` | `/api/gems/award` | X-Service-Key | Award gems (idempotent) |
| `GET` | `/api/compass/topics` | None | All live compass topics |
| `GET` | `/api/compass/politicians` | None | All politicians with district data |

Auth Hub redirect:
```
https://accounts.empowered.vote/login?redirect={encodeURIComponent(returnUrl)}
```

---

## Coordination With the Accounts Team

Before starting implementation, confirm with the accounts team:

1. **Service key issuance** — request an `EV_SERVICE_KEY` scoped to Civic Spaces.
2. **XP source keys** — register the specific source key strings you'll use (e.g. `civic_spaces_post`, `civic_spaces_reaction`) so the ledger has meaningful attribution.
3. **Gem type authorization** — confirm which gem types your service key is authorized to award.
4. **Schema name** — if sharing the ev-accounts Supabase project, confirm the schema name for your tables.
5. **Consolidation timeline** — v1.6 is migrating all schemas into one Supabase project. If you're starting before consolidation completes, build against a separate project but use the accounts UUID as your user FK from day one so migration is a schema import, not a data transformation.

---

## Reading the Accounts Codebase (If Needed)

```
backend/
├── migrations/         Ground truth of the schema (001–040+)
└── src/
    ├── routes/         auth.ts, account.ts, compass.ts, connect.ts, gems.ts, xp.ts
    ├── services/       Business logic
    ├── middleware/     requireAuth, requireConnected, requireServiceKey
    └── lib/            Supabase clients, Redis, JWT utils

docs/
├── ACCOUNTS-ONBOARDING.md      Full system architecture reference
├── COMPASSV2-INTEGRATION.md    Canonical CompassV2 integration guide (745 lines)
└── ESSENTIALS-INTEGRATION.md   Essentials integration guide (654 lines)
```

The integration pattern in `ESSENTIALS-INTEGRATION.md` (three-branch `detectUserState()`, Inform-baseline design) is the closest existing guide to what Civic Spaces needs. Read Section 3 (Jurisdiction Principle), Section 4 (Access States), and Section 5 (Detection Pattern) — they apply directly.

---

*Empowered Accounts — Empowered Vote | Bloomington, Indiana*
*Civic Spaces is the Connect Pillar. Questions → coordinate with the accounts team before building.*
