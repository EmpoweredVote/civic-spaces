import { useState, useEffect } from 'react'
import type { SliceInfo } from '../types/database'
import { geoidToWikiTitle } from '../lib/geoidToWiki'

/** Session-level cache: cacheKey → image URL or null (null means "fetched, no image found") */
const cache = new Map<string, string | null>()

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
 * Calls the free Census Bureau FIPS API to get a county's canonical name,
 * then looks it up on Wikipedia.
 *
 * Used for local slices whose county isn't in our hardcoded Indiana lookup table.
 * Returns a Wikipedia image URL, or null if the county or image can't be found.
 *
 * Census API docs: https://api.census.gov/data/2020/dec/pl
 * Example: ?get=NAME&for=county:037&in=state:06 → "Los Angeles County, California"
 */
async function fetchLocalImageViaCensus(geoid: string): Promise<string | null> {
  if (geoid.length !== 5) return null
  const stateFips = geoid.slice(0, 2)
  const countyFips = geoid.slice(2)
  try {
    const resp = await fetch(
      `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:${countyFips}&in=state:${stateFips}`
    )
    if (!resp.ok) return null
    const data = await resp.json()
    // Response format: [["NAME","state","county"], ["Los Angeles County, California","06","037"]]
    const countyName: string | undefined = data?.[1]?.[0]
    if (!countyName) return null
    return fetchWikiImage(countyName)
  } catch {
    return null
  }
}

/**
 * Fetches a Wikipedia hero image URL for the given slice.
 *
 * Resolution order:
 *  1. Session cache (instant)
 *  2. geoidToWikiTitle lookup (hardcoded fast path: US Capitol, state capitols, Indiana counties)
 *  3. Census Bureau API (for local slices with counties not in our hardcoded table)
 *  4. null → HeroBanner falls back to sliceCopy defaultPhoto
 */
export function useWikiHeroImage(slice: SliceInfo): string | null {
  const cacheKey = `${slice.sliceType}|${slice.geoid}`

  const [url, setUrl] = useState<string | null>(() =>
    cache.has(cacheKey) ? (cache.get(cacheKey) ?? null) : null
  )

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
      } else if (slice.sliceType === 'local' && slice.geoid.length === 5) {
        // County not in hardcoded table — ask Census Bureau for the name
        result = await fetchLocalImageViaCensus(slice.geoid)
      }

      cache.set(cacheKey, result)
      setUrl(result)
    }

    resolve()
  }, [slice.sliceType, slice.geoid, cacheKey])

  return url
}
