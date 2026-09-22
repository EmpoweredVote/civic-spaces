import type { PoliticianFlatRecord } from '../types/representatives'
import type { ResolvedGeography } from './censusGeocoder'

/**
 * Real, address-matched representatives — routed through the Vite dev/
 * preview middleware in vite.config.ts, which does the actual filtering
 * server-side against Essentials' full politician table. Returns [] (never
 * throws) on any failure, so callers can safely fall back to an honest
 * "not available" state per level rather than crash or show stale data.
 */
export async function fetchLocalReps(geo: ResolvedGeography): Promise<PoliticianFlatRecord[]> {
  const params = new URLSearchParams()
  if (geo.placeGeoid) params.set('local', geo.placeGeoid)
  if (geo.countyGeoid) params.set('county', geo.countyGeoid)
  if (geo.stateGeoid) params.set('state', geo.stateGeoid)
  if (geo.stateUpperGeoid) params.set('stateUpper', geo.stateUpperGeoid)
  if (geo.stateLowerGeoid) params.set('stateLower', geo.stateLowerGeoid)
  if (geo.federalGeoid) params.set('federal', geo.federalGeoid)

  if ([...params.keys()].length === 0) return []

  try {
    const res = await fetch(`/api/local-reps?${params.toString()}`)
    if (!res.ok) return []
    const data = (await res.json()) as PoliticianFlatRecord[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
