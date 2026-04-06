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
 * Fetches a Wikipedia hero image URL for the given slice.
 *
 * - Returns null immediately for neighborhood/unified/volunteer slices
 *   (those use sliceCopy defaultPhoto instead).
 * - Results are cached in a session-level Map so switching tabs is instant.
 */
export function useWikiHeroImage(slice: SliceInfo): string | null {
  const cacheKey = `${slice.sliceType}|${slice.geoid}`

  const [url, setUrl] = useState<string | null>(() =>
    cache.has(cacheKey) ? (cache.get(cacheKey) ?? null) : null
  )

  useEffect(() => {
    const title = geoidToWikiTitle(slice.sliceType, slice.geoid)
    if (!title) return

    if (cache.has(cacheKey)) {
      setUrl(cache.get(cacheKey) ?? null)
      return
    }

    fetchWikiImage(title).then(result => {
      cache.set(cacheKey, result)
      setUrl(result)
    })
  }, [slice.sliceType, slice.geoid, cacheKey])

  return url
}
