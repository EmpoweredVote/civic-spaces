import { useState, useEffect } from 'react'
import type { SliceInfo } from '../types/database'
import { geoidToWikiTitle, STATE_FIPS } from '../lib/geoidToWiki'
import { lookupGeoName } from '../lib/geoNames'

/** Session-level cache: cacheKey → image URL or null (null means "fetched, no image found") */
const cache = new Map<string, string | null>()

const STORAGE_PREFIX = 'cs_wiki_img_'

async function fetchWikiImage(title: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'))
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!resp.ok) return null
    const data = await resp.json()
    return (data.originalimage?.source ?? data.thumbnail?.source) ?? null
  } catch {
    return null
  }
}

/**
 * Resolves a county's canonical name from the offline table, then looks that
 * name up on Wikipedia.
 *
 * Used for county slices that are not in the hardcoded Indiana lookup table.
 * Returns a Wikipedia image URL, or null if the county or image can't be found.
 *
 * This read the Census API until 2026-09-24, when that endpoint began answering
 * keyless requests with `302 -> missing_key.html`. The failure was invisible:
 * the hook returns null on error and HeroBanner quietly shows the slice's
 * default photo, so every non-Indiana county lost its real image without
 * anything surfacing. See `src/lib/geoNames.ts`.
 */
async function fetchLocalImageViaGeoTable(geoid: string): Promise<string | null> {
  if (geoid.length !== 5) return null
  const entry = await lookupGeoName(geoid)
  if (!entry) return null

  // Wikipedia disambiguates county articles by state — "Buncombe County" alone
  // is a redirect at best. The Census API used to return the qualified form
  // ("Buncombe County, North Carolina") directly; the table stores the bare
  // name, so the state is appended here.
  const stateName = STATE_FIPS[geoid.slice(0, 2)]
  return fetchWikiImage(stateName ? `${entry.name}, ${stateName}` : entry.name)
}

/**
 * Fetches a Wikipedia hero image URL for the given slice.
 *
 * Resolution order:
 *  1. Session cache (instant)
 *  2. geoidToWikiTitle lookup (hardcoded fast path: US Capitol, state capitols, Indiana counties)
 *  3. Offline geo table (for counties not in our hardcoded table)
 *  4. null → HeroBanner falls back to sliceCopy defaultPhoto
 */
/**
 * Returns the hero image URL for the given slice.
 * - `undefined` = still loading (HeroBanner should show gray, not defaultPhoto)
 * - `null`      = loaded, no image found (HeroBanner may use defaultPhoto)
 * - `string`    = resolved image URL
 *
 * URLs are persisted to localStorage so subsequent visits load instantly.
 */
export function useWikiHeroImage(slice: SliceInfo): string | null | undefined {
  const cacheKey = `${slice.sliceType}|${slice.geoid}`

  const [url, setUrl] = useState<string | null | undefined>(() => {
    if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null
    // Check localStorage for a previously resolved URL
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + cacheKey)
      if (stored !== null) {
        const resolved = stored === '' ? null : stored
        cache.set(cacheKey, resolved)
        return resolved
      }
    } catch { /* ignore */ }
    return undefined // not yet fetched
  })

  useEffect(() => {
    if (cache.has(cacheKey)) {
      setUrl(cache.get(cacheKey) ?? null)
      return
    }

    async function resolve() {
      const title = geoidToWikiTitle(slice.sliceType, slice.geoid)

      let result: string | null = null

      if (title) {
        result = await fetchWikiImage(title)
      } else if (slice.sliceType === 'county' && slice.geoid.length === 5) {
        // County not in the hardcoded table — resolve its name offline
        result = await fetchLocalImageViaGeoTable(slice.geoid)
      }

      cache.set(cacheKey, result)
      try {
        // Persist for next session; empty string encodes "no image found"
        localStorage.setItem(STORAGE_PREFIX + cacheKey, result ?? '')
      } catch { /* ignore quota errors */ }
      setUrl(result)
    }

    resolve()
  }, [slice.sliceType, slice.geoid, cacheKey])

  return url
}
