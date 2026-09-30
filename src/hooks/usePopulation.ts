import { useQuery } from '@tanstack/react-query'
import type { SliceType } from '../types/database'
import { lookupGeoName } from '../lib/geoNames'

/**
 * The geoid the offline table carries this slice's population under, or null when
 * the slice has no area. Geoids are FIPS: state 2 digits, county state+3, place
 * state+5; the nation is the literal 'US'.
 */
function populationGeoid(sliceType: SliceType, geoid: string): string | null {
  switch (sliceType) {
    case 'city':
      return geoid.length === 7 ? geoid : null
    case 'county':
      return geoid.length === 5 ? geoid : null
    case 'state':
      return geoid.length === 2 ? geoid : null
    case 'federal':
      return 'US'
    default:
      // unified and volunteer are not places.
      return null
  }
}

/**
 * Total resident population of a slice's area, from the 2020 Census, or undefined
 * while loading / for a slice with no area / for the ~470 small CDPs the table
 * carries no figure for — in every one of those cases the banner simply shows
 * nothing. The count is fixed at the 2020 enumeration, which is why the banner
 * names its source and year.
 *
 * Reads the offline table in `public/geo/` rather than api.census.gov, which now
 * answers keyless requests with `302 -> missing_key.html`. The shard this needs is
 * the one useJurisdictionName and useHeroBanner already load for the member's
 * state, so a population costs no request of its own. No `retry`: a failed shard
 * load is cached as a settled null by lookupGeoName, so retrying re-reads the same
 * answer.
 */
export function usePopulation(sliceType: SliceType, geoid: string): number | undefined {
  const target = populationGeoid(sliceType, geoid)
  const { data } = useQuery({
    queryKey: ['geo-population', target],
    queryFn: async () => (await lookupGeoName(target!))?.pop ?? null,
    enabled: !!target,
    // Decennial counts never change; one lookup per session is plenty.
    staleTime: Infinity,
  })
  return data ?? undefined
}
