import { useState, useEffect } from 'react'
import type { SliceInfo } from '../types/database'
import { geoidToDisplayName } from '../lib/geoidToWiki'

/** Session-level cache: geoid → resolved display name */
const cache = new Map<string, string>()

/**
 * Cleans a Census Bureau place name into a short display name.
 *
 * Examples:
 *   "Los Angeles County, California"  → "Los Angeles County"
 *   "Del Mar city, California"        → "Del Mar"
 *   "Perry Township, Monroe County"   → "Perry Township"
 */
function extractDisplayName(censusName: string): string {
  // Take everything before the last ", {State}" segment
  const firstPart = censusName.split(', ')[0]
  // Strip Census entity suffixes from place names (cities, towns, etc.)
  return firstPart
    .replace(/ city$/, '')
    .replace(/ town$/, '')
    .replace(/ township$/, '')
    .replace(/ borough$/, '')
    .replace(/ municipality$/, '')
    .replace(/ village$/, '')
    .replace(/ CDP$/, '')
    .trim()
}

/**
 * Fetches a human-readable jurisdiction name from the Census Bureau FIPS API.
 *
 * Handles:
 *  - 5-digit county FIPS (state 2 + county 3): "06037" → "Los Angeles County"
 *  - 7-digit place FIPS (state 2 + place 5):   "0622710" → "Del Mar"
 *
 * Free API, no key required.
 */
async function fetchCensusDisplayName(geoid: string): Promise<string | null> {
  const stateFips = geoid.slice(0, 2)
  try {
    if (geoid.length === 5) {
      // County FIPS
      const countyFips = geoid.slice(2)
      const resp = await fetch(
        `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:${countyFips}&in=state:${stateFips}`
      )
      if (!resp.ok) return null
      const data = await resp.json()
      const name: string | undefined = data?.[1]?.[0]
      if (!name) return null
      // Keep "County" for local slices — "Los Angeles County" is clearer than just "Los Angeles"
      return name.split(', ')[0]
    }

    if (geoid.length === 7) {
      // FIPS place code (state 2 + place 5) — neighborhoods/cities
      const placeFips = geoid.slice(2)
      const resp = await fetch(
        `https://api.census.gov/data/2020/dec/pl?get=NAME&for=place:${placeFips}&in=state:${stateFips}`
      )
      if (!resp.ok) return null
      const data = await resp.json()
      const name: string | undefined = data?.[1]?.[0]
      return name ? extractDisplayName(name) : null
    }
  } catch {
    return null
  }
  return null
}

/**
 * Returns the human-readable jurisdiction name for a slice's hero banner title.
 *
 * Resolution:
 *  - federal    → "United States of America" (sync)
 *  - state      → state name e.g. "California" (sync)
 *  - local      → "{County} County" e.g. "Los Angeles County" (Census API for non-Indiana)
 *  - neighborhood → city/place name e.g. "Del Mar" (Census API)
 *  - unified    → "Unified" (sync)
 *  - volunteer  → "Volunteer" (sync)
 *
 * Falls back to `fallback` (the tab label) while loading or if Census API fails.
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
    if (cache.has(cacheKey)) {
      setName(cache.get(cacheKey)!)
      return
    }

    fetchCensusDisplayName(slice.geoid).then(result => {
      const resolved = result ?? fallback
      cache.set(cacheKey, resolved)
      setName(resolved)
    })
  }, [slice.sliceType, slice.geoid, immediate, fallback])

  return name
}
