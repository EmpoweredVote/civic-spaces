import { defineConfig } from 'vite'
import type { Connect, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The Census Geocoder API has no CORS headers (server-to-server only), so a
// direct browser fetch is blocked. This proxy config lets Vite's own
// dev/preview server relay the request instead. It only covers local
// dev/testing — a real production deployment needs its own small
// server-side relay for src/lib/censusGeocoder.ts to work for real users.
const censusGeocoderProxy = {
  '/api/census-geocoder': {
    target: 'https://geocoding.geo.census.gov',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/census-geocoder/, '/geocoder'),
  },
}

interface RawPolitician {
  id: string
  full_name: string
  office_title: string
  photo_origin_url: string
  district_type: string
  government_type: string
  is_vacant: boolean
  is_elected: boolean | null
  geo_id: string
  mtfcc: string
  images: Array<{ id: string; url: string; type: string; photo_license: string; focal_point: string | null }>
}

const POLITICIANS_URL = 'https://api.empowered.vote/api/essentials/politicians'
const CACHE_TTL_MS = 60 * 60 * 1000 // Essentials' underlying roster changes rarely — 1hr cache is plenty fresh.

let cache: { data: RawPolitician[]; fetchedAt: number } | null = null

async function getPoliticians(): Promise<RawPolitician[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data
  const res = await fetch(POLITICIANS_URL)
  if (!res.ok) throw new Error(`Essentials politicians fetch failed: ${res.status}`)
  const data = (await res.json()) as RawPolitician[]
  cache = { data, fetchedAt: Date.now() }
  return data
}

function toFlatRecord(p: RawPolitician) {
  return {
    id: p.id,
    full_name: p.full_name,
    office_title: p.office_title,
    photo_origin_url: p.photo_origin_url,
    district_type: p.district_type,
    government_type: p.government_type,
    is_vacant: p.is_vacant,
    is_elected: p.is_elected,
    images: p.images ?? [],
  }
}

/**
 * Real address-matched representatives, server-side only. The Essentials
 * politicians endpoint returns its entire ~15MB unfiltered table with no
 * address/geo filtering support — this middleware fetches that once
 * (cached), filters to just the officials matching the resolved Census
 * geoids for this address, and returns a tiny JSON array. Never ships the
 * full table to the browser.
 *
 * Query params (all optional — only supplied levels are matched):
 *   local      — place GEOID (7-digit), matches district_type LOCAL
 *   county     — county GEOID (5-digit), matches district_type COUNTY,
 *                office_title containing "commissioner" (isolates the
 *                countywide chair from district-specific commissioners we
 *                can't resolve without a sub-county geocode, and from
 *                unrelated row offices like sheriff/clerk)
 *   state      — state GEOID (2-digit), matches district_type STATE_EXEC
 *                and NATIONAL_UPPER (US Senators represent the whole state)
 *   stateUpper — state senate district GEOID, matches STATE_UPPER
 *   stateLower — state house district GEOID, matches STATE_LOWER
 *   federal    — congressional district GEOID, matches NATIONAL_LOWER
 */
async function handleLocalReps(req: Connect.IncomingMessage, res: import('http').ServerResponse) {
  try {
    const url = new URL(req.url ?? '', 'http://localhost')
    const local = url.searchParams.get('local')
    const county = url.searchParams.get('county')
    const state = url.searchParams.get('state')
    const stateUpper = url.searchParams.get('stateUpper')
    const stateLower = url.searchParams.get('stateLower')
    const federal = url.searchParams.get('federal')

    const politicians = await getPoliticians()

    const matched = politicians.filter((p) => {
      if (p.is_vacant) return false
      if (local && p.geo_id === local && p.district_type === 'LOCAL') return true
      if (
        county &&
        p.geo_id === county &&
        p.district_type === 'COUNTY' &&
        p.office_title.toLowerCase().includes('commissioner')
      )
        return true
      if (state && p.geo_id === state && p.district_type === 'STATE_EXEC') return true
      if (state && p.geo_id === state && p.district_type === 'NATIONAL_UPPER') return true
      if (stateUpper && p.geo_id === stateUpper && p.district_type === 'STATE_UPPER') return true
      if (stateLower && p.geo_id === stateLower && p.district_type === 'STATE_LOWER') return true
      if (federal && p.geo_id === federal && p.district_type === 'NATIONAL_LOWER') return true
      return false
    })

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(matched.map(toFlatRecord)))
  } catch (err) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
  }
}

function localRepsPlugin(): Plugin {
  return {
    name: 'local-reps-middleware',
    configureServer(server) {
      server.middlewares.use('/api/local-reps', (req, res) => {
        void handleLocalReps(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/local-reps', (req, res) => {
        void handleLocalReps(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localRepsPlugin()],
  server: { proxy: censusGeocoderProxy },
  preview: { proxy: censusGeocoderProxy },
})
