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

  // 🔴 The answer is stored WITH the geoid it answers. A bare string would survive a
  // location change: for the render between the new slice arriving and the effect
  // below running — and for the whole of an async lookup — it still held the OLD
  // place's name, so the nav read "Asheville / Los Angeles County" mid-switch.
  const [resolved, setResolved] = useState<{ geoid: string; name: string } | null>(null)

  useEffect(() => {
    if (immediate || cache.has(slice.geoid)) return

    // A slice switch while a lookup is in flight must not let the stale answer
    // land on the new slice's banner.
    let cancelled = false
    const geoid = slice.geoid

    lookupGeoName(geoid).then((result) => {
      // Only cache a real hit. Caching the fallback would pin "City" for the
      // rest of the session if the shard request lost a race with a flaky
      // network, which is the failure this whole change exists to remove.
      if (result) cache.set(geoid, result.name)
      if (!cancelled) setResolved({ geoid, name: result?.name ?? fallback })
    })

    return () => {
      cancelled = true
    }
  }, [slice.geoid, immediate, fallback])

  if (immediate) return immediate
  const hit = cache.get(slice.geoid)
  if (hit !== undefined) return hit
  return resolved?.geoid === slice.geoid ? resolved.name : fallback
}

/**
 * The label a civic-space tab carries in navigation (the nav rail and, below lg,
 * the tab bar): the place itself, never the level. "North Carolina", not "State";
 * "United States", not "Federal" — the short form, because a nav row is narrower
 * than the banner's "United States of America". Unified keeps its own name.
 *
 * Every name comes from the slice's geoid, so it follows the location on screen
 * and nobody is shown a state that is not theirs. Where a geoid has no name
 * (an unknown state FIPS, a place missing from the offline table) it falls back
 * to the generic level label rather than guessing.
 */
export function useSliceNavLabel(slice: SliceInfo, levelLabel: string): string {
  const name = useJurisdictionName(slice, levelLabel)
  return slice.sliceType === 'federal' ? 'United States' : name
}
