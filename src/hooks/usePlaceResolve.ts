import { useMutation } from '@tanstack/react-query'
import { EV_API_ORIGIN } from '../lib/evApi'
import { lookupGeoName } from '../lib/geoNames'
import {
  countyFromCoordinateLookup,
  placeFromResolveResponse,
  placeFromSearchRow,
  withCounty,
  type PlaceSearchRow,
  type ResolvedPlace,
} from '../lib/placeResolve'

/**
 * A chosen place — or, once the endpoint exists, a typed address — resolved to
 * the geoids a civic space is keyed on.
 *
 * A mutation rather than a query, deliberately: this is user-initiated and must
 * not refetch. The place-name leg costs one ~100 KB response, and a query that
 * revalidated on focus would spend it again for nothing.
 *
 * 🔴 Failure is honest and final. Every branch below ends in a `ResolvedPlace`
 * or a `PlaceResolveError` — never a nearby county, never a state-level guess,
 * never a fallback place. Treasury Tracker resolving an unknown slug to
 * Bloomington, IN's budget is the precedent: a real answer for the wrong place
 * is worse than no answer. The recovery the UI offers is the other path, not a
 * guess.
 */

const COORDINATE_LOOKUP_URL = `${EV_API_ORIGIN}/api/essentials/coordinate-lookup`

/**
 * 🔴 Its own variable, and deliberately NOT `VITE_SLICE_ASSIGNMENT_URL`.
 *
 * The two point at the same ev-accounts base today, which is exactly why
 * sharing one switch is a trap: every deployment that has configured slice
 * assignment would silently switch the address path on and start 404ing against
 * an endpoint that does not exist yet. Two features, two switches.
 *
 * Unset by default, so `PLACE_RESOLVE_ENABLED` is false and 17-04 renders no
 * address input at all. No dead control, and no copy promising a path that
 * cannot run. The cutover, once ev-accounts ships `POST
 * /api/civic-spaces/resolve`, is this one variable — the frontend is already
 * written.
 */
const rawResolveBase: unknown = import.meta.env.VITE_PLACE_RESOLVE_URL
const PLACE_RESOLVE_BASE = typeof rawResolveBase === 'string' ? rawResolveBase : ''

export const PLACE_RESOLVE_ENABLED = PLACE_RESOLVE_BASE !== ''
export const PLACE_RESOLVE_URL = `${PLACE_RESOLVE_BASE}/resolve`

/**
 * Why a resolution failed, in terms a UI can render without ever naming what
 * was typed.
 *
 * `address-not-found` covers the geocoder's whole failure family, which is one
 * family for a reason: it answers `200 OK` with zero matches for a nonexistent
 * street, a PO box, a ZIP alone, a typo, AND a correctly-typed real address
 * TIGER does not carry. The remedy offered is the same in every case — try the
 * place-name path, which needs no street.
 */
export type PlaceResolveFailure =
  | 'unusable-choice'
  | 'no-centroid'
  | 'no-county'
  | 'address-not-found'
  | 'service-unavailable'
  | 'address-path-disabled'

export class PlaceResolveError extends Error {
  readonly code: PlaceResolveFailure
  constructor(code: PlaceResolveFailure) {
    // 🔴 The message is the code and nothing else. ASVS V7 and D-13's
    // no-logging clause: whatever was typed never reaches an Error, a console
    // or a telemetry payload, because an Error is the one place a string
    // reliably gets logged by somebody later.
    super(code)
    this.code = code
    this.name = 'PlaceResolveError'
  }
}

/**
 * The place-name path, end to end.
 *
 * 🔴 The centroid comes from the COMMITTED GAZETTEER, not from a request.
 * `lookupGeoName` already returns `lat`/`lon` for a geoid and already shares one
 * in-flight promise per state shard, and the 2.7 MB set is already shipped. No
 * new fetch, no key. Only the coordinates are taken from it — the name it also
 * returns is the display path's business, not this one's.
 *
 * 🔴 ONE `coordinate-lookup` call per chosen place, never inside the typeahead.
 * The response is ~100 KB (57 politician records with finance summaries and
 * committee lists) and was measured at 1160 ms, bought for one 5-digit number.
 * Acceptable once per chosen place; indefensible per keystroke.
 */
export async function resolveChosenPlace(row: PlaceSearchRow): Promise<ResolvedPlace> {
  const fromRow = placeFromSearchRow(row)
  if (!fromRow) throw new PlaceResolveError('unusable-choice')
  if (fromRow.complete) return fromRow.place

  const centroid = await lookupGeoName(fromRow.needsCounty.geoid)
  if (!centroid) throw new PlaceResolveError('no-centroid')

  let body: unknown
  try {
    const res = await fetch(COORDINATE_LOOKUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: centroid.lat, lng: centroid.lon }),
    })
    // Status is checked here only to tell "the service is down" from "the
    // service answered" — never to decide whether a place was found. That is
    // the content's job, below, for the reason placeResolve.ts spells out.
    if (!res.ok) throw new PlaceResolveError('service-unavailable')
    body = await res.json()
  } catch (err) {
    if (err instanceof PlaceResolveError) throw err
    console.error('coordinate-lookup failed:', (err as Error).message)
    throw new PlaceResolveError('service-unavailable')
  }

  const county = countyFromCoordinateLookup(body)
  if (!county) throw new PlaceResolveError('no-county')

  const place = withCounty(fromRow.partial, county)
  if (!place) throw new PlaceResolveError('no-county')
  return place
}

/**
 * The address path — written in full, switched off.
 *
 * `POST ${PLACE_RESOLVE_BASE}/resolve` with a JSON **body**, exactly the
 * `${BASE}/assign` shape `sliceAssignment.ts` uses, so the cutover is one
 * variable. The address is in the body and never in a query string: Render's
 * access log records the request line, not the body, which is the whole reason
 * `essentialsCoordinateLookup.ts` is built this way and the reason
 * `GET /api/essentials/address-search` is rejected (see `placeResolve.ts`).
 */
export async function resolveTypedAddress(address: string): Promise<ResolvedPlace> {
  if (!PLACE_RESOLVE_ENABLED) throw new PlaceResolveError('address-path-disabled')

  let res: Response
  try {
    res = await fetch(PLACE_RESOLVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
  } catch (err) {
    // 🔴 `(err as Error).message` and never the body. The address is the one
    // thing that must not reach a log line, here or on the server.
    console.error('place resolve failed:', (err as Error).message)
    throw new PlaceResolveError('service-unavailable')
  }

  if (res.status === 422) throw new PlaceResolveError('address-not-found')
  if (!res.ok) throw new PlaceResolveError('service-unavailable')

  let body: unknown
  try {
    body = await res.json()
  } catch (err) {
    console.error('place resolve returned unparseable body:', (err as Error).message)
    throw new PlaceResolveError('service-unavailable')
  }

  const place = placeFromResolveResponse(body)
  if (!place) throw new PlaceResolveError('address-not-found')
  return place
}

export type PlaceResolveRequest =
  | { kind: 'place'; row: PlaceSearchRow }
  | { kind: 'address'; address: string }

/**
 * One mutation for both paths, so a caller switching between them gets one
 * pending state and one error state rather than two that can disagree.
 */
export function usePlaceResolve() {
  return useMutation<ResolvedPlace, PlaceResolveError, PlaceResolveRequest>({
    mutationFn: (request) =>
      request.kind === 'place'
        ? resolveChosenPlace(request.row)
        : resolveTypedAddress(request.address),
  })
}
