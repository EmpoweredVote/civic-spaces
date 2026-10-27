# ev-accounts — request from Civic Spaces: one anonymous endpoint, `POST /api/civic-spaces/resolve`

**From:** Civic Spaces (`C:\Civic Spaces`), Phase 17 — The Signed-Out Arrival
**Written:** 2026-10-26
**Audience:** whoever works `C:\EV-Accounts` next
**Companion docs:** `17-CONTEXT.md` (the product decisions), `17-RESEARCH.md` (every call
behind the claims below, with the responses) and `17-03-PLAN.md` (what this repo built), all
in this directory. `16-explore-by-slice/EXPLORE-HANDOFF.md` and
`15-tool-deep-links/TT-HANDOFF.md` are the precedents for the shape.

**Nothing in Civic Spaces is blocked on this.** The client is already written, already
committed, and already gated behind an environment variable that is unset. The place-name entry
path — which needs nothing from you — ships in the same phase. This is the *second* of two
ways into the app for someone with no account, and it is the one the product owner named
first (`17-CONTEXT.md` D-12: *"Both paths, address first"*).

**Cost on your side: roughly forty lines, against helpers that already exist.** Every
component this needs is already written and already deployed; the endpoint is an arrangement
of them with one privacy property and one error contract.

**Cost on ours once it lands: one environment variable.** No frontend release.

---

## First: what already works, and it is most of this

Three of the four things an anonymous visitor needs turned out to be public, CORS-allowed for
`civicspaces.empowered.vote`, and live. That is worth saying before the ask.

- **`GET /api/essentials/location-search?q=`** — public, 136 ms, 622 B for five rows, ranked
  and state-qualified. It already knows Portland OR is not Portland ME. The whole place-name
  entry path is built on it and needs nothing new.
- **`POST /api/essentials/coordinate-lookup`** — public, `optionalAuth`, rate-limited
  30/min/IP, zero DB writes, and **body-only by design with the privacy reasoning written
  into the file**. That comment block is the specification for what we are asking for; we are
  asking for a sibling of this route, not a new idea.
- **`POST /api/essentials/browse/by-area {geo_id, mtfcc}`** — public, and already what this
  repo's dev path uses for officials.

The gap is narrow and specific: **no public route turns an address into the geoids Civic
Spaces keys a civic space on**, and the two that come closest each fail for a different
reason (below).

---

## Why Civic Spaces is asking

Phase 17 makes Civic Spaces observable without an account. A visitor types where they live,
and the City / County / State / Federal / Unified spaces for that place load, read-only.

A civic space is keyed on a **geoid**, one per level of government:

| Slice | geoid | Source |
|---|---|---|
| `city` | 7-digit place FIPS, MTFCC `G4110`/`G4120` | needs a lookup |
| `county` | 5-digit county FIPS, `G4020` | needs a lookup |
| `state` | 2-digit state FIPS, `G4000` | free — the first two characters of the county |
| `federal` | the literal `'US'` | free |
| `unified` | the literal `'UNIFIED'` | free |

Those are read straight out of your own `SLICE_ASSIGNMENTS` in
`backend/src/civic_spaces/services/sliceAssigner.ts`. So the whole question is **two numbers**
— a place geoid and a county geoid — for a point that was never stored.

The governing privacy decision on our side is `17-CONTEXT.md` **D-13**: *the address is used
to resolve jurisdictions and is then gone. No persistence, no echo in the UI, no logging.* It
is the same principle the platform already states as *"a boundary geoid is a category, an
address is not."*

---

## The ask

### The contract

```
POST /api/civic-spaces/resolve
Content-Type: application/json

  { "address": "2 S Pack Sq, Asheville, NC 28801" }

200 OK   (~120 bytes)
  { "city": "3702140", "county": "37021", "state": "37", "nation": "US" }

  city is NULL for an unincorporated address. That is an answer, not a failure —
  your own jurisdictionPayload.ts says so, and our shell already handles four tabs
  instead of five (dev fixture `?dev=1&place=arden`).

422  { "code": "VALIDATION_ERROR" }     empty or non-string address
422  { "code": "ADDRESS_NOT_FOUND" }    no match after the full fallback chain
422  { "code": "PO_BOX_REJECTED" }      a PO box is not a residence
503  { "code": "GEOCODER_UNAVAILABLE" } every upstream geocoder failed
```

**And nothing else in the body.** No `matchedAddress`, no `politicians`, no `jurisdiction`,
no `locality`. Our parser builds its result key by key and would drop extra fields anyway,
but the contract should not carry them: the 100 KB `coordinate-lookup` payload is 57
politician records bought for one 5-digit number, and this question deserves 120 bytes.

### The implementation, which is a copy

`17-RESEARCH.md` Pattern 4 has it nearly written. From
`backend/src/routes/essentialsCoordinateLookup.ts`, kept wholesale:

- `optionalAuth` — anonymous callers are the point; a signed-in caller is not special here.
- **Body-only transport, with its existing comment block intact.** It is the specification.
- `express-rate-limit`, 30/min/IP, mirroring `coordinateLookupLimiter` (ASVS V13).
- Zero DB writes.
- `console.error((err as Error).message)` and nothing else, ever.

Then:

- **`geocodeAddress()`** for the point. 🔴 This is the part that cannot be done on our side
  and is the main reason this is an ask rather than a client feature — see "why the fallback
  chain is the answer" below.
- The existing `G4110/G4120`, `G4020` and `G4000` `ST_Covers` queries in
  `essentialsService.ts` for the geoids, as `resolveOfficialsAtPoint` already uses them.
- 🔴 **A Census `geographies/coordinates` backstop for the place geoid**, because your place
  geofences are loaded only for `PLACE_LOADED_STATES` and counties are nationwide while
  places are not. This is not hypothetical: `coordinate-lookup` for Asheville's centroid
  returns `locality.incorporated: null` (verified live 2026-10-26, through our dev proxy),
  because NC is not in that list. Without the backstop this endpoint answers `city: null` for
  most of the country and quietly looks like "everywhere is unincorporated".

---

## Why not the obvious alternatives

All three were probed live on 2026-10-26 from `Origin: https://civicspaces.empowered.vote`.
They are listed so `address-search` is not proposed back, and they are also written into
`src/lib/placeResolve.ts`'s header and `CLAUDE.md` on our side.

| Alternative | Why it is rejected |
|---|---|
| **`GET /api/essentials/address-search?address=…`** | The convenient one, and it breaks D-13 twice. The address is in the **query string**, which Render's access log records as part of the request line; and `matchedAddress` is **echoed back** — the response carried `"67 HAYWOOD ST, ASHEVILLE, NC, 28801"`. It is also missing the place geoid outside `PLACE_LOADED_STATES`, so it cannot answer the question even setting privacy aside |
| **Browser `fetch()` to `geocoding.geo.census.gov`** | **No CORS.** Reproduced in real Chromium from the real origin: *"blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present."* `vary: Origin` is present **without** `access-control-allow-origin`, and the `OPTIONS` 200 is an Apache `Allow:` response, which a browser reads as a failed preflight. 🔴 Node's `fetch` does not enforce CORS, so any Node probe of this passes and the browser still fails |
| **JSONP to the same host** | It works (442 ms, verified). It also executes third-party script inside our origin, reproduces only the *first* geocoder with none of your fallbacks, and still puts the address in a query string. Documented as a last resort, not implemented, and if it is ever reached for it needs its own decision |
| **`connect.resolve_user_jurisdiction`** | It returns exactly the right shape — and it is keyed on `p_user_id` and reads the member's encrypted coordinates out of the vault. It cannot answer for a point that was never stored, which is the whole of D-13. A point-keyed variant would be a new RPC, not a reuse |
| **`POST /api/civic-spaces/assign`** | `requireAuth`, 403s an Inform tier, and **writes `slice_members`**. Unusable for an observer in three separate ways. Probed unauthenticated: 401 |

---

## 🔴 Why the fallback chain is the answer, and not a detail

This is the strongest argument for the endpoint living with you.

**The Census Geocoder never returns a non-2xx for a bad address.** Every failure is `200 OK`
with `result.addressMatches: []`. Verified live:

| Input | Status | matches |
|---|---|---|
| `123 Nowhere Street, Nowhereville, ZZ 00000` | 200 | 0 |
| `PO Box 1234, Asheville, NC 28802` | 200 | 0 |
| `28801` (ZIP alone) | 200 | 0 |
| `70 Cort Plza, Asheville, NC 28801` (typo) | 200 | 0 |
| **`70 Court Plaza, Asheville, NC 28801` — a real address** | **200** | **0** |

That last row is the point. **A correctly-typed real address can return zero matches**,
because TIGER's address ranges are incomplete. It is precisely why
`backend/src/lib/geocodingService.ts` chains Census → county ArcGIS locators → NC OneMap →
NAD, with a documented reason for the order.

A client-side implementation in our repo would reproduce the **first** geocoder and none of
the fallbacks. The user-visible consequence is not "slightly worse coverage" — it is that
somebody whose address your member path resolves fine would be told *"we couldn't find
that"* by the signed-out path. Two answers for the same address, from the same platform,
depending on whether they had an account yet.

---

## The D-13 contract this endpoint must honour

Stated plainly so it survives review on your side, and so the one caveat is not lost:

1. The address is read **only** from the JSON body. Never a query string, never a header,
   never a path segment. Render's access log records the request line, not the body.
2. The address is **never echoed** in a response — not in a success body, not in an error
   body, not in a `code` or a `message`.
3. The address is **never logged**, never in telemetry, never in an APM span name. Only
   `(err as Error).message` reaches `console.error`.
4. **Zero DB writes.** Nothing about the request is persisted anywhere.

🔴 **The honest caveat: census.gov sees the address regardless.** `onelineaddress` is a GET,
so the address is in a query string on census.gov's side on every path, including the member
path you already run. This is not a flaw in the design; it is a fact the privacy copy has to
respect. Ours says *"geocoded once and never kept"* and must never grow into *"it never
leaves your browser."* If your own copy ever makes the stronger claim, it is wrong for the
same reason.

---

## What this repo already did, and what unblocks

**Already shipped, Phase 17-03:**

- `src/lib/placeResolve.ts` — `placeFromResolveResponse()` parses exactly the contract above,
  and is written to **never branch on HTTP status** for the geocoder family, for the reason
  in the table. A body carrying `matchedAddress` parses and that key cannot reach a consumer;
  there is a committed assertion for it.
- `src/hooks/usePlaceResolve.ts` — `resolveTypedAddress()` POSTs `{ address }` to
  `${VITE_PLACE_RESOLVE_URL}/resolve`, maps 422 to `address-not-found` — the honest empty state with the
  place-name path offered as the escape hatch — and every other non-2xx to
  `service-unavailable`, and logs `(err as Error).message` only. The same client rule
  as yours, on our side.
- `scripts/check-place-resolve.mjs` — 42 assertions over the shipped functions, including a
  structural D-13 check that fails if a sixth key ever appears in a resolved place.

**What unblocks when this lands:** we set `VITE_PLACE_RESOLVE_URL` to
`https://api.empowered.vote/api/civic-spaces` and the address input appears. No frontend
release is required to be ready.

**One request about the rollout:** tell us the day it deploys, and we will re-run
`node scripts/check-place-resolve.mjs --live`, which diffs your response shapes against our
committed fixtures and exits non-zero on drift.

---

## Not part of this ask

- **Any `civic_spaces` grant, policy or migration.** Phase 17 touches none. Opening
  conversations to `anon` is our Phase 18 and is our work, in our schema.
- **A place-name endpoint.** `location-search` already is one.
- **Officials, meetings, elections or compass topics for a visited place.** All already
  anonymous; Phase 17 consumes them as they are.
- **Anything that lets an observer write.** The write paths stay exactly as closed as they
  are, on both sides.
