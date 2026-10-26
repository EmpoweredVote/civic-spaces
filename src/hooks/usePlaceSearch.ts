import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EV_API_ORIGIN } from '../lib/evApi'
import { normalisePlaceQuery, searchRowKind, type PlaceSearchRow } from '../lib/placeResolve'

/**
 * The place-name typeahead: what somebody types, as a short list of real
 * places they can choose from.
 *
 * `GET /api/essentials/location-search` is public, needs no credential, is
 * already CORS-allow-listed for civicspaces.empowered.vote, and answered in
 * 136 ms / 622 B for five rows when it was measured on 2026-10-26. In dev
 * `EV_API_ORIGIN` is `''`, so the request goes through vite.config.ts's `/api`
 * proxy, which is the only thing that makes it work from localhost.
 *
 * 🔴 No address is involved on this path at all. A place name is not an
 * address, and `q=` carrying "asheville" is not a D-13 concern. The address
 * path lives in `usePlaceResolve.ts` and is a body-only POST.
 *
 * 🔴 This is a shared data hook, so it belongs in the welcome screen and the
 * shell's place control — never inside `SliceFeedPanel`, where all six panels
 * mount at once and any hook fires 6×.
 */

const LOCATION_SEARCH_URL = `${EV_API_ORIGIN}/api/essentials/location-search`

/** Long enough that a typist is not generating a request per keystroke. */
const DEBOUNCE_MS = 250

/** Enough to disambiguate Portland OR from Portland ME without a scroll. */
const RESULT_LIMIT = 8

/** The list is a ranked set of names; it does not go stale in a session. */
const STALE_MS = 5 * 60 * 1000

function useDebounced(value: string, delayMs: number): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

/**
 * 🔴 Rows are filtered through `searchRowKind` here, so no consumer has to.
 * A row whose `geo_id` is not a 2, 5 or 7-digit FIPS code cannot be turned into
 * a civic space, and offering it would produce a control that looks live and
 * resolves to nothing. Remote data from an origin we do not control drops out
 * of the list rather than taking down a render.
 *
 * An empty array is an ANSWER — "no place by that name" — and never an error.
 */
async function fetchPlaceSearch(query: string): Promise<PlaceSearchRow[]> {
  const url = new URL(LOCATION_SEARCH_URL, window.location.origin)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(RESULT_LIMIT))

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`location-search failed: ${res.status}`)

  const body: unknown = await res.json()
  if (!Array.isArray(body)) return []
  return (body as PlaceSearchRow[]).filter((row) => searchRowKind(row) !== 'unusable')
}

export function usePlaceSearch(query: string) {
  const debounced = useDebounced(query, DEBOUNCE_MS)
  const normalised = normalisePlaceQuery(debounced)

  return useQuery<PlaceSearchRow[], Error>({
    queryKey: ['place-search', normalised ?? ''],
    queryFn: () => fetchPlaceSearch(normalised ?? ''),
    // `normalisePlaceQuery` returns null below three characters and for input
    // that is not a place name at all, so neither reaches the API.
    enabled: normalised !== null,
    staleTime: STALE_MS,
    retry: 1,
  })
}
