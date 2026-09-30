import type { SliceType } from '../types/database'
import { stateAbbrevFromGeoid } from './stateAbbrev'

/**
 * A National Weather Service forecast link for a city slice, or null.
 *
 * A link, not live weather: no EV service carries weather data, and showing live
 * conditions would mean a new third-party vendor, which ev-cto's CONSTRAINTS.md
 * requires a privacy review for first. NWS's own zipcity search resolves
 * "Asheville, NC" to that city's forecast page (verified 2026-09-24), so the member's
 * browser goes to weather.gov directly and this app sends nothing.
 *
 * City only. zipcity does not resolve county names, and a whole state or the nation
 * has no single forecast. `resolvedName` must be the real place name; the tab label
 * fallback ("City") would send the member to a search for the word "City".
 */
export function forecastUrlFor(sliceType: SliceType, geoid: string, resolvedName: string | null): string | null {
  if (sliceType !== 'city' || !resolvedName) return null
  const state = stateAbbrevFromGeoid(geoid)
  if (!state) return null
  return `https://forecast.weather.gov/zipcity.php?inputstring=${encodeURIComponent(`${resolvedName}, ${state}`)}`
}
