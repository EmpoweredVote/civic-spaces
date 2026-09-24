import { useQuery } from '@tanstack/react-query'
import type { SliceType } from '../types/database'
import { censusPlUrl } from '../lib/census'

/**
 * The Census geography clause for a slice, or null when the slice has no area.
 * Geoids are FIPS: state 2 digits, county state+3, place state+5. Federal's geoid is
 * 'US', which is the `us:1` geography.
 */
function geographyFor(sliceType: SliceType, geoid: string): string | null {
  switch (sliceType) {
    case 'city':
      return geoid.length === 7 ? `for=place:${geoid.slice(2)}&in=state:${geoid.slice(0, 2)}` : null
    case 'county':
      return geoid.length === 5 ? `for=county:${geoid.slice(2)}&in=state:${geoid.slice(0, 2)}` : null
    case 'state':
      return geoid.length === 2 ? `for=state:${geoid}` : null
    case 'federal':
      return 'for=us:1'
    default:
      // unified and volunteer are not places.
      return null
  }
}

async function fetchPopulation(geography: string): Promise<number | null> {
  // P1_001N is the 2020 Decennial total population. Rows come back as strings:
  // [["P1_001N","state","place"],["94589","37","02140"]].
  const res = await fetch(censusPlUrl(`get=P1_001N&${geography}`))
  if (!res.ok) throw new Error(`Census population request failed: ${res.status}`)
  const data = (await res.json()) as string[][]
  const value = Number(data?.[1]?.[0])
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Total resident population of a slice's area, from the 2020 Census, or undefined
 * while loading / on failure / for a slice with no area — in every one of those cases
 * the banner simply shows nothing. The count is fixed at the 2020 enumeration, which
 * is why the banner names its source and year.
 */
export function usePopulation(sliceType: SliceType, geoid: string): number | undefined {
  const geography = geographyFor(sliceType, geoid)
  const { data } = useQuery({
    queryKey: ['census-population', geography],
    queryFn: () => fetchPopulation(geography!),
    enabled: !!geography,
    // Decennial counts never change; one fetch per session is plenty.
    staleTime: Infinity,
    retry: 2,
  })
  return data ?? undefined
}
