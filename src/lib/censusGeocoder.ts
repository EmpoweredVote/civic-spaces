/**
 * Resolves a full US street address to real Census Bureau geography —
 * state, county, incorporated place (city/neighborhood), and congressional
 * district — via the free public Census Geocoder API (no key required).
 * Unlike a ZIP-only lookup, a full address genuinely supports all four
 * civic-space levels, since ZIP codes alone don't map cleanly to districts
 * or places.
 */

import { extractDisplayName } from '../hooks/useJurisdictionName'

export interface ResolvedGeography {
  stateGeoid?: string
  stateName?: string
  countyGeoid?: string
  countyName?: string
  placeGeoid?: string
  placeName?: string
  federalGeoid?: string
  stateUpperGeoid?: string
  stateLowerGeoid?: string
}

interface CensusGeographyRow {
  GEOID?: string
  NAME?: string
  STATE?: string
  PLACE?: string
}

interface CensusGeocoderResponse {
  result?: {
    addressMatches?: Array<{
      geographies?: Record<string, CensusGeographyRow[]>
    }>
  }
}

export async function resolveAddress(address: string): Promise<ResolvedGeography | null> {
  const trimmed = address.trim()
  if (!trimmed) return null

  try {
    // Routed through Vite's dev/preview proxy (see vite.config.ts) — the
    // Census Geocoder API has no CORS headers, so a direct browser fetch
    // to geocoding.geo.census.gov is silently blocked.
    const url = `/api/census-geocoder/geographies/onelineaddress?address=${encodeURIComponent(trimmed)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = (await res.json()) as CensusGeocoderResponse
    const geographies = data.result?.addressMatches?.[0]?.geographies
    if (!geographies) return null

    const state = geographies['States']?.[0]
    const county = geographies['Counties']?.[0]
    const place = geographies['Incorporated Places']?.[0] ?? geographies['Census Designated Places']?.[0]
    // Congressional/state-legislative-district layer names are vintage-
    // dependent (e.g. "119th Congressional Districts", "2024 State
    // Legislative Districts - Upper") — match by suffix instead of a
    // hardcoded key so a Census vintage bump doesn't silently break this.
    const districtKey = Object.keys(geographies).find((key) => key.endsWith('Congressional Districts'))
    const district = districtKey ? geographies[districtKey]?.[0] : undefined
    const stateUpperKey = Object.keys(geographies).find((key) => key.endsWith('State Legislative Districts - Upper'))
    const stateUpper = stateUpperKey ? geographies[stateUpperKey]?.[0] : undefined
    const stateLowerKey = Object.keys(geographies).find((key) => key.endsWith('State Legislative Districts - Lower'))
    const stateLower = stateLowerKey ? geographies[stateLowerKey]?.[0] : undefined

    return {
      stateGeoid: state?.GEOID,
      stateName: state?.NAME,
      countyGeoid: county?.GEOID,
      // Census returns "Buncombe County, North Carolina" — keep the
      // "County" suffix (clearer than just "Buncombe") but drop the state.
      countyName: county?.NAME?.split(', ')[0],
      placeGeoid: place?.GEOID,
      // Census returns "Asheville city, North Carolina" — strip both the
      // state and the place-type suffix (city/town/village/etc.).
      placeName: place?.NAME ? extractDisplayName(place.NAME) : undefined,
      federalGeoid: district?.GEOID,
      stateUpperGeoid: stateUpper?.GEOID,
      stateLowerGeoid: stateLower?.GEOID,
    }
  } catch {
    return null
  }
}
