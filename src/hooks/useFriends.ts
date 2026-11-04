import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { ConnectedProfile } from '../types/database'

export interface FriendProfile {
  user_id: string
  display_name: string
  avatar_url: string | null
  tier: ConnectedProfile['tier']
}

interface FriendsListResult {
  friends: FriendProfile[]
  pendingReceived: FriendProfile[]
  isLoading: boolean
  error: Error | null
}

export function useFriendsList(): FriendsListResult {
  const { userId } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      if (!userId) return { friends: [], pendingReceived: [] }

      // Fetch all friendship rows involving current user
      const { data: rows, error: rowsError } = await supabase
        .schema('civic_spaces')
        .from('friendships')
        .select('user_low, user_high, status')
        .or(`user_low.eq.${userId},user_high.eq.${userId}`)

      if (rowsError) throw rowsError
      if (!rows || rows.length === 0) return { friends: [], pendingReceived: [] }

      // Separate friends and pending-received
      const friendIds: string[] = []
      const pendingReceivedIds: string[] = []

      for (const row of rows) {
        const otherId = row.user_low === userId ? row.user_high : row.user_low
        if (row.status === 'FRIEND') {
          friendIds.push(otherId)
        } else if (
          (row.status === 'REQ_LOW' && row.user_high === userId) ||
          (row.status === 'REQ_HIGH' && row.user_low === userId)
        ) {
          pendingReceivedIds.push(otherId)
        }
      }

      const allIds = [...new Set([...friendIds, ...pendingReceivedIds])]
      if (allIds.length === 0) return { friends: [], pendingReceived: [] }

      // Batch-fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .schema('civic_spaces')
        // 🔴 PUBLIC READER: see below. 18-02 asserts that anon cannot read
        // connected_profiles AT ALL, so any of these that ran for a reader with no
        // account would 403 and break its panel. The DEFAULT is "does not run" — if
        // one of them turns out to need public data that is a new RPC and a new
        // decision, never a new grant.
        // DOES NOT RUN. enabled: !!userId, and a public reader has none. Friendship
        // is the D-49 exception and is evaluated in SQL, never fetched by the client.
        .from('connected_profiles')
        .select('user_id, display_name, avatar_url, tier')
        .in('user_id', allIds)

      if (profilesError) throw profilesError

      const profileMap = new Map<string, FriendProfile>()
      for (const p of profiles ?? []) {
        profileMap.set(p.user_id, {
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          tier: p.tier,
        })
      }

      return {
        friends: friendIds.map((id) => profileMap.get(id)).filter(Boolean) as FriendProfile[],
        pendingReceived: pendingReceivedIds
          .map((id) => profileMap.get(id))
          .filter(Boolean) as FriendProfile[],
      }
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  return {
    friends: data?.friends ?? [],
    pendingReceived: data?.pendingReceived ?? [],
    isLoading,
    error: error as Error | null,
  }
}
