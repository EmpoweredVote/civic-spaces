import { useState, useEffect } from 'react'
import type { SliceInfo } from '../types/database'
import { geoidToWikiTitle } from '../lib/geoidToWiki'
import { bannerFor } from '../lib/banners'
import { censusPlUrl } from '../lib/census'

/** A hero image plus the credit line to display, or null when provenance is unknown. */
export interface HeroImage {
  url: string
  credit: string | null
}

/**
 * Credit for images resolved off the live Wikipedia path.
 *
 * Deliberately vague about licence: the REST summary endpoint hands back whatever
 * the article's lead image is, which may be a Commons file or a locally-uploaded
 * one, so we can name the source but must not assert a licence we have not checked.
 * The shared bucket exists precisely so this path shrinks over time.
 */
const WIKIPEDIA_CREDIT = 'Image via Wikipedia'

/** Session-level cache: cacheKey → image URL or null (null means "fetched, no image found") */
const cache = new Map<string, string | null>()

/**
 * Unchanged from when this hook was Wikipedia-only, so entries cached in visitors'
 * browsers stay valid. Only ever holds Wikipedia-path URLs — shared-bucket banners
 * resolve synchronously and are never cached.
 */
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
      censusPlUrl(`get=NAME&for=county:${countyFips}&in=state:${stateFips}`)
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
 * Returns the hero image for the given slice.
 * - `undefined` = still loading (HeroBanner should show gray, not defaultPhoto)
 * - `null`      = loaded, no image found (HeroBanner may use defaultPhoto)
 * - `HeroImage` = resolved image plus its credit line
 *
 * Resolution order:
 *  1. The org's shared banner library (see lib/banners.ts). SYNCHRONOUS and exact —
 *     keyed off the geoid's FIPS digits or the geoid itself, never a place name. A
 *     hit here never reaches the network on this path and never returns `undefined`,
 *     so state and federal tabs paint their banner on first render.
 *  2. Session cache, then localStorage (Wikipedia-path results from prior visits).
 *  3. geoidToWikiTitle → Wikipedia REST (state capitols, Indiana counties).
 *  4. Census Bureau API → Wikipedia, for counties outside the hardcoded table.
 *  5. null → HeroBanner falls back to the sliceCopy defaultPhoto, where one exists.
 */
export function useHeroBanner(slice: SliceInfo): HeroImage | null | undefined {
  const cacheKey = `${slice.sliceType}|${slice.geoid}`

  // Step 1. Not state — recomputed each render, cheap, and keeps the shared-library
  // path off the loading tri-state entirely.
  const shared = bannerFor(slice.sliceType, slice.geoid)

  const [url, setUrl] = useState<string | null | undefined>(() => {
    if (shared) return shared.url
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
    // A shared-library hit needs no fetch, no cache and no state write.
    if (bannerFor(slice.sliceType, slice.geoid)) return

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
        // County not in hardcoded table — ask Census Bureau for the name
        result = await fetchLocalImageViaCensus(slice.geoid)
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

  if (shared) return shared
  if (url === undefined) return undefined
  if (url === null) return null
  return { url, credit: WIKIPEDIA_CREDIT }
}
