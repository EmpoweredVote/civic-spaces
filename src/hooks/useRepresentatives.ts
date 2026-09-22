import { useQuery } from '@tanstack/react-query'
import type { PoliticianFlatRecord } from '../types/representatives'
import { isSyntheticUserId, MOCK_REPRESENTATIVES } from '../lib/devMockData'
import { fetchLocalReps } from '../lib/localRepsLookup'
import type { ResolvedGeography } from '../lib/censusGeocoder'

const REPS_URL = 'https://api.empowered.vote/api/essentials/representatives/me'

async function fetchRepresentatives(
  token: string,
  userId: string | null,
  geo: ResolvedGeography | null,
): Promise<PoliticianFlatRecord[]> {
  try {
    const res = await fetch(REPS_URL, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // 204 No Content — user has no representatives data yet
    if (res.status === 204) return isSyntheticUserId(userId) ? await resolveFallback(geo) : []
    if (!res.ok) throw new Error(`Failed to fetch representatives: ${res.status}`)
    return res.json()
  } catch (err) {
    // A synthetic (never-real) user id's request 401s — fall back to real,
    // address-matched data when we have a resolved address, else the
    // President/VP-only fixture. The id itself is the safety boundary, so
    // this is safe in production too, and never fabricates data for a real
    // user or shows a fabricated name for a real user's real request.
    if (isSyntheticUserId(userId)) return resolveFallback(geo)
    throw err
  }
}

async function resolveFallback(geo: ResolvedGeography | null): Promise<PoliticianFlatRecord[]> {
  if (!geo) return MOCK_REPRESENTATIVES
  const realMatches = await fetchLocalReps(geo)
  // President/VP are always genuinely true regardless of address, so they're
  // included alongside whatever real district-matched officials were found.
  return [...MOCK_REPRESENTATIVES, ...realMatches]
}

export function useRepresentatives(userId: string | null, geo: ResolvedGeography | null = null) {
  const token = localStorage.getItem('cs_token') ?? ''

  return useQuery({
    queryKey: ['representatives', userId, geo],
    queryFn: () => fetchRepresentatives(token, userId, geo),
    // No token requirement — a synthetic browsing id still resolves via the
    // fixture fallback in fetchRepresentatives' catch block above.
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  })
}
