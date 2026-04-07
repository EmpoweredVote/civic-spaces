import { useQuery } from '@tanstack/react-query'
import type { PoliticianFlatRecord } from '../types/representatives'

const REPS_URL = 'https://accounts.empowered.vote/api/essentials/representatives/me'

async function fetchRepresentatives(token: string): Promise<PoliticianFlatRecord[]> {
  const res = await fetch(REPS_URL, {
    headers: { Authorization: `Bearer ${token}` },
  })
  // 204 No Content — user has no representatives data yet
  if (res.status === 204) return []
  if (!res.ok) throw new Error(`Failed to fetch representatives: ${res.status}`)
  return res.json()
}

export function useRepresentatives(userId: string | null) {
  const token = localStorage.getItem('cs_token') ?? ''

  return useQuery({
    queryKey: ['representatives', userId],
    queryFn: () => fetchRepresentatives(token),
    enabled: !!userId && !!token,
    staleTime: 10 * 60 * 1000,
  })
}
