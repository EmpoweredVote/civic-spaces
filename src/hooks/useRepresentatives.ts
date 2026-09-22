import { useQuery } from '@tanstack/react-query'
import type { PoliticianFlatRecord } from '../types/representatives'
import { isSyntheticUserId, MOCK_REPRESENTATIVES } from '../lib/devMockData'

const REPS_URL = 'https://api.empowered.vote/api/essentials/representatives/me'

async function fetchRepresentatives(
  token: string,
  userId: string | null,
): Promise<PoliticianFlatRecord[]> {
  // A reserved dev id has no real session, so this request 401s rather than
  // returning anything. Serve fixtures instead — the id is the boundary, and a
  // real Supabase user id can never collide with it, so this cannot fabricate
  // officials for a real member.
  const synthetic = isSyntheticUserId(userId)
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
