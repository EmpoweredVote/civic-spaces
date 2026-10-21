import { useQuery } from '@tanstack/react-query'
import type { PoliticianFlatRecord } from '../types/representatives'
import { isSyntheticUserId, MOCK_REPRESENTATIVES, MOCK_SLICES } from '../lib/devMockData'
import { EV_API_ORIGIN } from '../lib/evApi'

const REPS_URL = `${EV_API_ORIGIN}/api/essentials/representatives/me`
const BY_AREA_URL = `${EV_API_ORIGIN}/api/essentials/browse/by-area`

/**
 * The dev id's representatives: the REAL officials for the mock city slice, from
 * Essentials' public by-area lookup (no auth). A designer then works against real
 * names, photos and offices instead of invented ones. Fixtures are the offline
 * fallback only.
 */
async function fetchDevRepresentatives(): Promise<PoliticianFlatRecord[]> {
  try {
    const res = await fetch(BY_AREA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geo_id: MOCK_SLICES.city.geoid, mtfcc: 'G4110' }),
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
