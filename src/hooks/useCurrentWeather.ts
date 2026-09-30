import { useQuery } from '@tanstack/react-query'
import type { SliceType } from '../types/database'
import { lookupGeoName } from '../lib/geoNames'

/**
 * Current conditions for a city or county slice, from the National Weather Service.
 *
 * The point comes from the offline geo table, which already carries the Bureau's
 * INTPTLAT/INTPTLON for every place and county — so this makes two public, keyless,
 * CORS-open GETs rather than three, and none to api.census.gov:
 *   1. api.weather.gov/points/{lat},{lon} → that point's hourly forecast URL
 *   2. that URL → hourly periods; the one covering "now" is the current reading
 *
 * Nothing about the member is sent: the point is the place's published centre, the
 * same for everyone in the slice. It is still a new third-party call made on page
 * load (weather.gov sees the viewer's IP and which city they looked at), which is why
 * ev-cto's vendor review applies — see the PR.
 *
 * City and county only. A state or the nation has no single temperature.
 */

export interface CurrentWeather {
  /** NWS reports Fahrenheit for US points; Celsius is derived for display. */
  tempF: number
  /** NWS short forecast for the current hour, e.g. "Mostly Cloudy". */
  summary: string
  /** Full forecast page for the same point, for the chip's link. */
  forecastUrl: string
}

const NWS_HEADERS = { Accept: 'application/geo+json' }

/** The geoid the table carries a point for, or null for a slice with no single location. */
function pointGeoid(sliceType: SliceType, geoid: string): string | null {
  if (sliceType === 'city' && geoid.length === 7) return geoid
  if (sliceType === 'county' && geoid.length === 5) return geoid
  return null
}

interface HourlyPeriod {
  startTime: string
  endTime: string
  temperature: number
  temperatureUnit: 'F' | 'C'
  shortForecast: string
}

async function fetchCurrentWeather(geoid: string): Promise<CurrentWeather | null> {
  const entry = await lookupGeoName(geoid)
  const lat = entry?.lat
  const lon = entry?.lon
  if (lat === undefined || lon === undefined) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  // NWS wants at most four decimals; more is rejected with a redirect.
  const point = `${lat.toFixed(4)},${lon.toFixed(4)}`
  const pointRes = await fetch(`https://api.weather.gov/points/${point}`, { headers: NWS_HEADERS })
  if (!pointRes.ok) throw new Error(`NWS points failed: ${pointRes.status}`)
  const hourlyUrl: string | undefined = (await pointRes.json())?.properties?.forecastHourly
  if (!hourlyUrl) return null

  const hourlyRes = await fetch(hourlyUrl, { headers: NWS_HEADERS })
  if (!hourlyRes.ok) throw new Error(`NWS hourly failed: ${hourlyRes.status}`)
  const periods: HourlyPeriod[] = (await hourlyRes.json())?.properties?.periods ?? []
  const now = Date.now()
  const current = periods.find((p) => Date.parse(p.startTime) <= now && now < Date.parse(p.endTime)) ?? periods[0]
  if (!current) return null

  const tempF = current.temperatureUnit === 'C' ? current.temperature * 9 / 5 + 32 : current.temperature
  return {
    tempF,
    summary: current.shortForecast,
    forecastUrl: `https://forecast.weather.gov/MapClick.php?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
  }
}

/** undefined while loading, on failure, or for a slice with no single location. */
export function useCurrentWeather(sliceType: SliceType, geoid: string): CurrentWeather | undefined {
  const target = pointGeoid(sliceType, geoid)
  const { data } = useQuery({
    queryKey: ['current-weather', target],
    queryFn: () => fetchCurrentWeather(target!),
    enabled: !!target,
    // NWS updates hourly periods about once an hour; refresh well inside that.
    staleTime: 20 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  })
  return data ?? undefined
}

export function toCelsius(tempF: number): number {
  return Math.round(((tempF - 32) * 5) / 9)
}
