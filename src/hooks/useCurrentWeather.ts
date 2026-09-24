import { useQuery } from '@tanstack/react-query'
import type { SliceType } from '../types/database'
import { censusGeoinfoUrl } from '../lib/census'

/**
 * Current conditions for a city or county slice, from the National Weather Service.
 *
 * Three public, keyless GETs, all CORS-open (Access-Control-Allow-Origin: *):
 *   1. Census geoinfo  → the place's official internal point, by geoid
 *   2. api.weather.gov/points/{lat},{lon} → that point's hourly forecast URL
 *   3. that URL → hourly periods; the one covering "now" is the current reading
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

function geographyFor(sliceType: SliceType, geoid: string): string | null {
  if (sliceType === 'city' && geoid.length === 7) return `for=place:${geoid.slice(2)}&in=state:${geoid.slice(0, 2)}`
  if (sliceType === 'county' && geoid.length === 5) return `for=county:${geoid.slice(2)}&in=state:${geoid.slice(0, 2)}`
  return null
}

interface HourlyPeriod {
  startTime: string
  endTime: string
  temperature: number
  temperatureUnit: 'F' | 'C'
  shortForecast: string
}

async function fetchCurrentWeather(geography: string): Promise<CurrentWeather | null> {
  const geoRes = await fetch(censusGeoinfoUrl(`get=INTPTLAT,INTPTLON&${geography}`))
  if (!geoRes.ok) throw new Error(`Census geoinfo failed: ${geoRes.status}`)
  const geo = (await geoRes.json()) as string[][]
  const lat = Number(geo?.[1]?.[0])
  const lon = Number(geo?.[1]?.[1])
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
  const geography = geographyFor(sliceType, geoid)
  const { data } = useQuery({
    queryKey: ['current-weather', geography],
    queryFn: () => fetchCurrentWeather(geography!),
    enabled: !!geography,
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
