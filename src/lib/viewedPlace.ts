/**
 * The one thing that remembers which place a visitor is looking at.
 *
 * 🔴 It stores GEOIDS AND NOTHING ELSE. D-13: the typed string is never
 * persisted, never logged by us, and never rendered back. `ResolvedPlace` has
 * no name field at all (see `placeResolve.ts`), so there is structurally
 * nothing else here to store — the display name is resolved from the geoid by
 * `geoNames.ts`, offline. `scripts/check-place-resolve.mjs` asserts that the
 * serialised value contains none of a sample input string.
 *
 * 🔴 Session scope, not local. The choice should not outlive the window —
 * `cs_dev_place` sets that precedent and states the same reason — and the
 * stored half is load-bearing rather than a convenience: wouter drops the query
 * string the moment it navigates to `/post/:postId`, so a visited place that
 * lived only in the URL would evaporate the first time somebody followed a
 * thread link.
 *
 * 🔴 Every `sessionStorage` access is wrapped. A private window throws on the
 * first touch, and the privacy-minded visitor this phase is written for is the
 * one most likely to be in one. `useAuth.ts:100` is the repo's existing
 * instance of that bug (deferred item 9 of Phase 16); do not add a second. A
 * blocked write means the place does not survive navigation — degraded, never
 * broken.
 *
 * No React imports, deliberately: `AppShell` and `useSiblingSlices` both import
 * this and a React dependency here would make that a cycle. The only import is
 * `import type`, erased at build, so `node --experimental-strip-types` runs
 * these functions rather than a transcription of them.
 */

import type { ResolvedPlace } from './placeResolve'

const VIEWED_PLACE_KEY = 'cs_viewed_place'

function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Is this parsed JSON a `ResolvedPlace`, field by field?
 *
 * A corrupt or stale entry must cost nothing — `parseDraftKey` is the pattern,
 * returning null on a value it does not recognise rather than throwing inside a
 * render. Every field is re-checked against its FIPS shape, so an entry written
 * by an older build, or hand-edited, or truncated, is dropped rather than
 * handed to a query as if it named somewhere.
 */
function parseViewedPlace(raw: unknown): ResolvedPlace | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>

  const city = value['city']
  if (city !== null && (typeof city !== 'string' || !/^\d{7}$/.test(city))) return null

  const county = value['county']
  if (county !== null && (typeof county !== 'string' || !/^\d{5}$/.test(county))) return null

  const state = value['state']
  if (typeof state !== 'string' || !/^\d{2}$/.test(state)) return null

  if (value['nation'] !== 'US') return null
  if (value['unified'] !== 'UNIFIED') return null

  // Rebuilt field by field rather than returned as-is, so an entry carrying an
  // extra key — a name somebody added in a later build, say — cannot reach a
  // consumer through this door either.
  return { city, county, state, nation: 'US', unified: 'UNIFIED' }
}

/**
 * The visited place for this window, or null if there is none, the storage is
 * blocked, or what is stored is not a place.
 *
 * A value that fails validation is removed on the way out: leaving it would
 * mean re-parsing and re-rejecting it on every read for the life of the window.
 */
export function readViewedPlace(): ResolvedPlace | null {
  const store = storage()
  if (!store) return null

  let raw: string | null = null
  try {
    raw = store.getItem(VIEWED_PLACE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: unknown = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }

  const place = parseViewedPlace(parsed)
  if (!place) {
    try {
      store.removeItem(VIEWED_PLACE_KEY)
    } catch {
      /* blocked — the bad entry simply stays and keeps reading as null */
    }
    return null
  }
  return place
}

/** Remember a visited place for this window, or forget the one it had. */
export function writeViewedPlace(place: ResolvedPlace | null): void {
  const store = storage()
  if (!store) return

  if (place === null) {
    try {
      store.removeItem(VIEWED_PLACE_KEY)
    } catch {
      /* blocked — nothing was ever written, so there is nothing to clear */
    }
    return
  }

  // Serialised field by field, for the same reason parseViewedPlace rebuilds
  // its result: whatever the caller hands over, only these five geoid-shaped
  // values are ever written.
  const payload: ResolvedPlace = {
    city: place.city,
    county: place.county,
    state: place.state,
    nation: 'US',
    unified: 'UNIFIED',
  }
  try {
    store.setItem(VIEWED_PLACE_KEY, JSON.stringify(payload))
  } catch {
    /* private window, or quota — the place just does not survive navigation */
  }
}

/** Exported for the check, so the key it asserts on cannot drift from this one. */
export const VIEWED_PLACE_STORAGE_KEY = VIEWED_PLACE_KEY
