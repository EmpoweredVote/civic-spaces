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

export function censusPlUrl(query: string): string {
  const key = import.meta.env.VITE_CENSUS_API_KEY
  return `${CENSUS_PL_URL}?${query}${key ? `&key=${encodeURIComponent(key)}` : ''}`
}
