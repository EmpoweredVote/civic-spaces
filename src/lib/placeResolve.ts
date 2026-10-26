/**
 * Turning a typed place name — or, once ev-accounts ships the endpoint, a typed
 * street address — into the geoids a civic space is keyed on. Every decision,
 * as pure functions over plain data.
 *
 * 🔴 This module has no runtime imports, deliberately. Every import below is
 * `import type`, which is erased, so `node --experimental-strip-types` can load
 * this file and run the SHIPPED functions rather than a transcription of them.
 * `scripts/check-place-resolve.mjs` does exactly that. A copy-test passes while
 * the shipped code is wrong, so do not add a value import here without moving
 * the check to something that can still reach the real thing.
 *
 * Nothing here touches React, React Query, Supabase, storage or the network.
 * The hooks (`usePlaceSearch`, `usePlaceResolve`) own all of that and pass the
 * answers in; `src/lib/viewedPlace.ts` owns the one piece of memory.
 *
 * ── The path this module serves ──────────────────────────────────────────────
 *
 *   place name typed
 *     → GET /api/essentials/location-search?q=…   public, CORS-OK, ~136 ms
 *         → a 7-digit place geoid (or a 5-digit county, or a 2-digit state)
 *     → public/geo/<state FIPS>.json              committed, offline, keyless
 *         → the place's Census internal point (lat, lon)
 *     → POST /api/essentials/coordinate-lookup    public, CORS-OK, body-only
 *         → county.geoid → state = county.geoid.slice(0, 2)
 *     → federal = 'US', unified = 'UNIFIED'       literals, never looked up
 *
 * Every leg is anonymous, already deployed, and already allow-listed for
 * civicspaces.empowered.vote. No address is handled at all on this path — a
 * place centroid is not a residence.
 *
 * ── 🔴 The three rejected endpoints, and why — all probed live 2026-10-26 ────
 *
 * Each of these is attractive and each of them is wrong. They are named here so
 * the next person does not re-discover the wall, or worse, not notice it.
 *
 * 1. `GET /api/essentials/address-search?address=…` — REJECTED. It is the
 *    convenient option: public, CORS-allowed for this origin, and it answers in
 *    one call. It violates D-13 twice. The address travels in the **query
 *    string**, which Render's access log records as part of the request line,
 *    and `matchedAddress` is **echoed back** in the response — verified
 *    2026-10-26, the body came back carrying `"67 HAYWOOD ST, ASHEVILLE, NC,
 *    28801"`. It is also missing the place geoid outside ev-accounts'
 *    `PLACE_LOADED_STATES`, so it could not answer the question anyway.
 *
 * 2. Browser `fetch()` to `geocoding.geo.census.gov` — REJECTED, **no CORS**.
 *    Reproduced in real Chromium from the real origin on 2026-10-26: *"Access
 *    to fetch at '…' has been blocked by CORS policy: No
 *    'Access-Control-Allow-Origin' header is present on the requested
 *    resource."* The response carries `vary: Origin` **without**
 *    `access-control-allow-origin`, and the `OPTIONS` 200 is an Apache
 *    `Allow:` response, which a browser reads as a failed preflight.
 *    🔴 Node's `fetch` does not enforce CORS, so every Node probe of this
 *    passes and the browser still fails. Any future claim that this works must
 *    be made in Chromium, from the real origin, and dated.
 *
 * 3. JSONP (`format=jsonp&callback=`) to the same host — NOT the plan of
 *    record. It does work (442 ms, 1 match, verified 2026-10-26). It also
 *    executes third-party script inside this app's origin; it reproduces only
 *    the FIRST geocoder with none of ev-accounts' NAD and county-locator
 *    fallbacks, so "a correctly-typed real address returns zero matches"
 *    becomes a user-visible failure; and the address is still a query string.
 *    Documented fallback of last resort. If it is ever reached for it needs its
 *    own decision, a comment naming the missing header and the day it was
 *    checked, and privacy copy that does not claim the address stays local.
 *
 * The accepted answer for the address path is the one that already exists next
 * door: a **body-only POST**, which Render's access log does not record, copied
 * from `essentialsCoordinateLookup.ts`. That endpoint —
 * `POST /api/civic-spaces/resolve` — does not exist yet; the ask is
 * `ACCOUNTS-HANDOFF.md` in this phase's planning directory, and the client is
 * written and gated on `VITE_PLACE_RESOLVE_URL`.
 */

// ── Shapes ───────────────────────────────────────────────────────────────────

/**
 * One row from `GET /api/essentials/location-search`.
 *
 * Every field is optional, and that is not defensiveness for its own sake: this
 * is remote data from an origin we do not control, which is the model
 * `toolCoverage.ts` already states for Essentials' catalog. A row shape nobody
 * anticipated must drop out of the list, not take down a render.
 */
export interface PlaceSearchRow {
  geo_id?: string
  mtfcc?: string
  label?: string
  state?: string
  area_type?: string
  has_local_data?: boolean
}

/**
 * The answer: GEOIDS ONLY.
 *
 * 🔴 There is no `name`, no `label`, no `matchedAddress` field, and that is
 * structural rather than a convention. D-13 says the input is never echoed
 * back. The display name is resolved FROM the geoid by `geoNames.ts`'s
 * `lookupGeoName` — committed, offline and drift-guarded, the same path
 * `useJurisdictionName` already uses for a member's own slices. Making the name
 * unrepresentable here means no call site can render the typed string by
 * accident, and `scripts/check-place-resolve.mjs` asserts the key set rather
 * than any behaviour, so adding a sixth key cannot pass.
 *
 * 🔴 `nation` and `unified` are literals and are never looked up. ev-accounts'
 * `SLICE_ASSIGNMENTS` keys federal on `'US'` and `assignUnifiedIfNotAssigned`
 * on `'UNIFIED'`. `volunteer` is role-gated and is never a visitor's.
 */
export interface ResolvedPlace {
  /**
   * null for an unincorporated address or a county-level choice. That is an
   * ANSWER, not a failure — ev-accounts' `jurisdictionPayload.ts` says so
   * outright, and `?dev=1&place=arden` is the fixture for it.
   */
  city: string | null
  county: string | null
  state: string
  nation: 'US'
  unified: 'UNIFIED'
}

/** A place geoid whose county is not known yet. Never surfaced to a consumer. */
export interface PendingPlace {
  city: string
  state: string
}

/**
 * What one chosen search row can answer, and whether a second leg is needed.
 *
 * Discriminated so the hook cannot forget the centroid leg and the check can
 * assert which rows require it — a place row that claimed to be complete would
 * simply ship with `county: null`, and nothing would fail.
 */
export type PlaceFromRow =
  | { complete: true; place: ResolvedPlace }
  | { complete: false; partial: PendingPlace; needsCounty: { geoid: string } }

// ── Input, at the edge ───────────────────────────────────────────────────────

/**
 * Control characters that are never part of a place name.
 *
 * Tab, newline and carriage return are deliberately absent: they are whitespace
 * and are collapsed below rather than rejected, because a paste out of a
 * document arrives full of them and is a legitimate thing for someone to do.
 * Everything else in C0, DEL and C1 means the input is not a typed place name.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/

/** The longest place label in the gazetteer is well under this. */
const MAX_QUERY = 120

/** Below this the typeahead is answering about nothing useful. */
const MIN_QUERY = 3

/**
 * The typed string, made safe and made sane — ASVS V5, at the edge.
 *
 * Returns null when there is nothing worth asking about, which is what the
 * hook's `enabled` reads, so one letter never reaches the API.
 *
 * No HTML is ever constructed from this and PostgREST is not in this path, so
 * there is nothing to escape. The cap and the trim are what stop a paste of an
 * entire document reaching the API, and the control-character rejection is what
 * stops a response-splitting shape being handed to a URL builder.
 */
export function normalisePlaceQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (CONTROL_CHARS.test(raw)) return null
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  // Truncate rather than reject: a long paste is a mistake, not an attack, and
  // the first 120 characters of it are usually the place the person meant.
  const capped = collapsed.length > MAX_QUERY ? collapsed.slice(0, MAX_QUERY).trim() : collapsed
  if (capped.length < MIN_QUERY) return null
  return capped
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export type SearchRowKind = 'place' | 'county' | 'state' | 'unusable'

/**
 * What a search row is, branched on the LENGTH of its geoid.
 *
 * 🔴 Length, never `mtfcc`. Both `G4110` (incorporated place) and `G4120`
 * (census designated place) are places, and ev-accounts may add more; branching
 * on the code would require this file to be kept in agreement with a list that
 * lives in another repo, and the failure when it drifts is silent — a whole
 * class of real places quietly becoming unselectable. FIPS length is the
 * property that does not move: 7 digits is a place, 5 a county, 2 a state.
 *
 * `unusable` rather than a throw, for the reason `toolCoverage.ts` states: this
 * is remote data from an origin we do not control, and an unrecognised row must
 * drop out of the list rather than take down a render.
 */
export function searchRowKind(row: PlaceSearchRow | null | undefined): SearchRowKind {
  const geoid = row?.geo_id
  if (typeof geoid !== 'string') return 'unusable'
  if (!/^\d+$/.test(geoid)) return 'unusable'
  if (geoid.length === 7) return 'place'
  if (geoid.length === 5) return 'county'
  if (geoid.length === 2) return 'state'
  return 'unusable'
}

/**
 * The state FIPS prefixing a county or place geoid — always, by FIPS
 * construction, which is why no lookup and no network is needed for it.
 *
 * `'US'` and `'UNIFIED'` are not places and resolve to null by shape, the same
 * way `lookupGeoName` rejects them.
 */
export function stateFromGeoid(geoid: unknown): string | null {
  if (typeof geoid !== 'string') return null
  if (!/^\d+$/.test(geoid)) return null
  if (geoid.length !== 2 && geoid.length !== 5 && geoid.length !== 7) return null
  return geoid.slice(0, 2)
}

/**
 * What a chosen row can answer on its own.
 *
 * | kind     | city      | county    | state             | second leg?          |
 * |----------|-----------|-----------|-------------------|----------------------|
 * | `place`  | `geo_id`  | unknown   | `geo_id.slice(0,2)` | 🔴 yes — the gazetteer has no place→county link |
 * | `county` | null      | `geo_id`  | `geo_id.slice(0,2)` | no                  |
 * | `state`  | null      | null      | `geo_id`            | no                  |
 *
 * A county-level or state-level choice with `city: null` is a complete and
 * honest answer, exactly as an unincorporated address is.
 */
export function placeFromSearchRow(row: PlaceSearchRow | null | undefined): PlaceFromRow | null {
  const kind = searchRowKind(row)
  if (kind === 'unusable') return null
  // searchRowKind already proved this is a numeric string of a known length;
  // re-reading it rather than casting keeps the narrowing honest.
  const geoid = row?.geo_id
  if (typeof geoid !== 'string') return null
  const state = stateFromGeoid(geoid)
  if (!state) return null

  if (kind === 'place') {
    return { complete: false, partial: { city: geoid, state }, needsCounty: { geoid } }
  }
  if (kind === 'county') {
    return {
      complete: true,
      place: { city: null, county: geoid, state, nation: 'US', unified: 'UNIFIED' },
    }
  }
  return {
    complete: true,
    place: { city: null, county: null, state, nation: 'US', unified: 'UNIFIED' },
  }
}

/**
 * The second leg's answer joined to the first: a place geoid plus the county
 * the coordinate lookup found inside.
 *
 * Returns null when the two disagree about the state. A Census place never
 * spans a state line — place geoids are state-scoped by construction — so a
 * mismatch means one of the two answers is about somewhere else, and the
 * honest result is "we could not work that place out". 🔴 Never a nearby
 * county, never a state-level guess: Treasury Tracker resolving an unknown slug
 * to Bloomington, IN's budget is the precedent, and a real answer for the wrong
 * place is worse than no answer.
 */
export function withCounty(partial: PendingPlace, countyGeoid: unknown): ResolvedPlace | null {
  if (typeof countyGeoid !== 'string' || !/^\d{5}$/.test(countyGeoid)) return null
  if (countyGeoid.slice(0, 2) !== partial.state) return null
  if (!/^\d{7}$/.test(partial.city)) return null
  return {
    city: partial.city,
    county: countyGeoid,
    state: partial.state,
    nation: 'US',
    unified: 'UNIFIED',
  }
}

// ── Responses ────────────────────────────────────────────────────────────────

/**
 * 🔴 Neither parser below branches on HTTP status, and that is the single most
 * load-bearing rule in this file.
 *
 * The Census Geocoder — which sits behind both of these endpoints — answers
 * `200 OK` with `result.addressMatches: []` for EVERY failure: a nonexistent
 * street, a PO box, a ZIP on its own, a typo, and **a correctly-typed real
 * address that TIGER does not carry** (`70 Court Plaza, Asheville NC` returns
 * zero matches and is a real address; verified 2026-10-26). A parser that
 * trusts `res.ok` therefore reports "resolved" with every geoid undefined.
 * Branch on the CONTENT. Both of these return null rather than throwing, and
 * null means "we could not work that out", which the UI says out loud.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * The county geoid out of `POST /api/essentials/coordinate-lookup`.
 *
 * 🔴 Reads `county.geoid` and nothing else. `locality.incorporated` is the
 * attractive-looking field and it is `null` for Asheville, because ev-accounts'
 * place geofences are loaded only for `PLACE_LOADED_STATES` and NC is not among
 * them (verified live 2026-10-26). Counties are nationwide; places are not.
 * Reading `locality.incorporated` here would pass against a state that happens
 * to be loaded and return null for most of the country.
 */
export function countyFromCoordinateLookup(body: unknown): string | null {
  const root = asRecord(body)
  if (!root) return null
  const county = asRecord(root['county'])
  if (!county) return null
  const geoid = county['geoid']
  if (typeof geoid !== 'string' || !/^\d{5}$/.test(geoid)) return null
  return geoid
}

/**
 * The whole answer out of `POST /api/civic-spaces/resolve` — the endpoint
 * `ACCOUNTS-HANDOFF.md` asks for, which does not exist yet.
 *
 * Requires a county: a body with no county resolved nothing, whatever its
 * status code said. `city` must be absent, null, or a 7-digit place geoid —
 * anything else means the body is not the contract and the whole thing is
 * refused, rather than silently degraded to a county-level answer about a place
 * we did not actually identify.
 *
 * 🔴 The result is built key by key, so a body carrying `matchedAddress` (or
 * any other field) parses fine and that field cannot reach a consumer. D-13.
 */
export function placeFromResolveResponse(body: unknown): ResolvedPlace | null {
  const root = asRecord(body)
  if (!root) return null

  const county = root['county']
  if (typeof county !== 'string' || !/^\d{5}$/.test(county)) return null

  const rawCity = root['city']
  let city: string | null = null
  if (typeof rawCity === 'string') {
    if (!/^\d{7}$/.test(rawCity)) return null
    city = rawCity
  } else if (rawCity !== null && rawCity !== undefined) {
    return null
  }

  // State is derived from the county by FIPS construction rather than trusted
  // from the body — one source for a value two fields could disagree about.
  const state = county.slice(0, 2)
  const rawState = root['state']
  if (typeof rawState === 'string' && rawState !== state) return null
  if (city && city.slice(0, 2) !== state) return null

  return { city, county, state, nation: 'US', unified: 'UNIFIED' }
}
