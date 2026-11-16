import { useQuery } from '@tanstack/react-query'
import { isSyntheticUserId } from '../lib/devMockData'
import { EV_API_ORIGIN } from '../lib/evApi'
import { ownPlaceFromAccount } from '../lib/ownPlace'
import type { ResolvedPlace } from '../lib/placeResolve'

const ACCOUNT_ME_URL = `${EV_API_ORIGIN}/api/account/me`

/**
 * The signed-in viewer's own place, for a viewer who holds no civic spaces. See
 * `ownPlaceFromAccount` in lib/ownPlace.ts for who that is and why.
 *
 * 🔴 Call it ONCE, in AppShell, with `enabled` true only while the viewer would otherwise
 * see the address prompt. Every feed panel is mounted at once, so a hook in a panel runs 6×
 * (CLAUDE.md, "Every feed panel is mounted at once").
 *
 * Never runs for the dev id: it has no real session and holds fixture slices anyway.
 */
export function useOwnPlace(
  userId: string | null,
  enabled: boolean,
): { place: ResolvedPlace | null; isLoading: boolean } {
  const token = localStorage.getItem('cs_token') ?? ''
  const run = enabled && !!userId && !!token && !isSyntheticUserId(userId)

  const query = useQuery({
    queryKey: ['own-place', userId],
    queryFn: async (): Promise<ResolvedPlace | null> => {
      const res = await fetch(ACCOUNT_ME_URL, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return null
      return ownPlaceFromAccount(await res.json())
    },
    enabled: run,
    staleTime: 5 * 60 * 1000,
    // An unanswered lookup falls back to the address prompt, which is still a way forward.
    retry: 1,
  })

  return { place: run ? (query.data ?? null) : null, isLoading: run && query.isLoading }
}
