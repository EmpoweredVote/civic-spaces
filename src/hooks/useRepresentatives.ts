import { useQuery } from '@tanstack/react-query'
import type { PoliticianFlatRecord } from '../types/representatives'
import { isSyntheticUserId, MOCK_REPRESENTATIVES, MOCK_SLICES } from '../lib/devMockData'
import { EV_API_ORIGIN } from '../lib/evApi'

const REPS_URL = `${EV_API_ORIGIN}/api/essentials/representatives/me`
const BY_AREA_URL = `${EV_API_ORIGIN}/api/essentials/browse/by-area`

/**
 * The most LOCAL area a set of slices covers, as the by-area endpoint's
 * (geo_id, mtfcc) pair: city, else county, else nothing.
 *
 * 🔴 The same ladder `racesAreaFor` walks, and deliberately not an import of it:
 * that function is about which races are a member's own, and this is about which
 * officials represent an area. Two callers, one rule — so when a visited place
 * needs the same pair, lift THIS function rather than writing a third copy.
 *
 * There is no state fallback, for the reason racesAreaFor spells out: a
 * state-area query answers about the whole state, which is a real answer for the
 * wrong place.
 */
const BY_AREA_MTFCC = { city: 'G4110', county: 'G4020' } as const

export function byAreaFor(
  slices: Partial<Record<string, { geoid: string } | undefined>>,
): { geo_id: string; mtfcc: string } | null {
  for (const type of ['city', 'county'] as const) {
    const geoid = slices[type]?.geoid
    if (geoid) return { geo_id: geoid, mtfcc: BY_AREA_MTFCC[type] }
  }
  return null
}

/**
 * The dev id's representatives: the REAL officials for the fixture's most local
 * slice, from Essentials' public by-area lookup (no auth). A designer then works
 * against real names, photos and offices instead of invented ones. Fixtures are
 * the offline fallback only.
 *
 * 🔴 City is not guaranteed. `?dev=1&place=arden` is an unincorporated address
 * and has no city slice at all, so this asks about the county instead — which is
 * what a real member at such an address would get.
 */
async function fetchDevRepresentatives(): Promise<PoliticianFlatRecord[]> {
  const area = byAreaFor(MOCK_SLICES)
  if (!area) return MOCK_REPRESENTATIVES
  try {
    const res = await fetch(BY_AREA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(area),
    })
    if (!res.ok) throw new Error(`Failed to fetch representatives: ${res.status}`)
    return res.json()
  } catch {
    return MOCK_REPRESENTATIVES
  }
}

async function fetchRepresentatives(
  token: string,
  userId: string | null,
): Promise<PoliticianFlatRecord[]> {
  // A reserved dev id has no real session, so this request 401s rather than
  // returning anything. Serve fixtures instead — the id is the boundary, and a
  // real Supabase user id can never collide with it, so this cannot fabricate
  // officials for a real member.
  const synthetic = isSyntheticUserId(userId)
  if (synthetic) return fetchDevRepresentatives()
  try {
    const res = await fetch(REPS_URL, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // 204 No Content — user has no representatives data yet
    if (res.status === 204) return synthetic ? MOCK_REPRESENTATIVES : []
    if (!res.ok) throw new Error(`Failed to fetch representatives: ${res.status}`)
    return res.json()
  } catch (err) {
    if (synthetic) return MOCK_REPRESENTATIVES
    throw err
  }
}

export function useRepresentatives(userId: string | null) {
  const token = localStorage.getItem('cs_token') ?? ''

  return useQuery({
    queryKey: ['representatives', userId],
    queryFn: () => fetchRepresentatives(token, userId),
    enabled: !!userId && !!token,
    staleTime: 10 * 60 * 1000,
  })
}
