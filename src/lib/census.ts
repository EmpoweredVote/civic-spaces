/**
 * URL for the Census Bureau's 2020 Decennial PL 94-171 dataset, which this app uses
 * to turn a county or place geoid into its name.
 *
 * 🔴 THE API REQUIRES A KEY NOW. As of 2026-09-24, a request without `key=` gets a 302
 * to missing_key.html instead of data — so every name lookup failed and the banner and
 * rail fell back to "City" / "County" with no error anywhere. Set
 * VITE_CENSUS_API_KEY (free: https://api.census.gov/data/key_signup.html). Without it
 * the lookups still run, still fail, and the callers keep their fallback labels.
 *
 * VITE_ variables ship in the browser bundle, so this key is public by construction.
 * That is how Census issues them (a per-app key for rate limiting, not a secret), but a
 * server-side proxy in ev-accounts would keep it out of the bundle if that is preferred.
 */
const CENSUS_PL_URL = 'https://api.census.gov/data/2020/dec/pl'
/**
 * Census geography attributes. Carries INTPTLAT/INTPTLON, the Bureau's official
 * internal point for each place and county — which 2020/dec/pl does not (it answers
 * "unknown variable"). Used for weather, keyed by the slice's geoid: a lookup of
 * public data about a place, not geocoding anyone's address.
 */
const CENSUS_GEOINFO_URL = 'https://api.census.gov/data/2023/geoinfo'

function withKey(base: string, query: string): string {
  const key = import.meta.env.VITE_CENSUS_API_KEY
  return `${base}?${query}${key ? `&key=${encodeURIComponent(key)}` : ''}`
}

export function censusPlUrl(query: string): string {
  return withKey(CENSUS_PL_URL, query)
}

export function censusGeoinfoUrl(query: string): string {
  return withKey(CENSUS_GEOINFO_URL, query)
}
