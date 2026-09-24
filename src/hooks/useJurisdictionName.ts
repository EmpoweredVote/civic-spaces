import { useState, useEffect } from 'react'
import type { SliceInfo } from '../types/database'
import { geoidToDisplayName } from '../lib/geoidToWiki'
import { lookupGeoName } from '../lib/geoNames'

/** Session-level cache: geoid → resolved display name */
const cache = new Map<string, string>()

/**
 * Returns the human-readable jurisdiction name for a slice's hero banner title.
 *
 * Resolution:
 *  - federal    → "United States of America" (sync)
 *  - state      → state name e.g. "California" (sync)
 *  - unified    → "Unified" (sync)
 *  - volunteer  → "Volunteer" (sync)
 *  - county     → "{County} County" e.g. "Los Angeles County" (offline table)
 *  - city       → place name e.g. "Del Mar" (offline table)
 *
 * Falls back to `fallback` (the tab label) while the table loads, or if the
 * geoid is not in it.
 *
 * This used to call api.census.gov per slice. That endpoint now answers keyless
 * requests with `302 -> missing_key.html`, so the lookup failed for every
 * member and the fallback — a bare "City" or "County" — was all anyone saw.
 * Names are static reference data, so they ship with the app instead: see
 * `src/lib/geoNames.ts` and `scripts/generate-geo-names.mjs`.
 */
export function useJurisdictionName(slice: SliceInfo, fallback: string): string {
  const immediate = geoidToDisplayName(slice.sliceType, slice.geoid)

  const [name, setName] = useState<string>(() => {
    if (immediate) return immediate
    return cache.get(slice.geoid) ?? fallback
  })

  useEffect(() => {
    if (immediate) {
      setName(immediate)
      return
    }

    const cacheKey = slice.geoid
    const hit = cache.get(cacheKey)
    if (hit !== undefined) {
      setName(hit)
      return
    }

    // A slice switch while a lookup is in flight must not let the stale answer
    // land on the new slice's banner.
    let cancelled = false

    lookupGeoName(slice.geoid).then((result) => {
      const resolved = result?.name ?? fallback
      // Only cache a real hit. Caching the fallback would pin "City" for the
      // rest of the session if the shard request lost a race with a flaky
      // network, which is the failure this whole change exists to remove.
      if (result) cache.set(cacheKey, resolved)
      if (!cancelled) setName(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [slice.sliceType, slice.geoid, immediate, fallback])

  return name
}
