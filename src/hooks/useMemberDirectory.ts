import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ConnectedProfile } from '../types/database'

export interface MemberProfile {
  user_id: string
  display_name: string
  avatar_url: string | null
  tier: ConnectedProfile['tier']
}

const PAGE_LIMIT = 50

export function useMemberDirectory(sliceId: string | null) {
  return useInfiniteQuery<
    MemberProfile[],
    Error,
    { pages: MemberProfile[][] },
    string[],
    number
  >({
    queryKey: ['member-directory', sliceId ?? ''],
    queryFn: async ({ pageParam }) => {
      if (!sliceId) return []

      // Step 1: Fetch user_ids for this slice, with pagination
      const { data: memberRows, error: memberError } = await supabase
        .schema('civic_spaces')
        .from('slice_members')
        .select('user_id')
        .eq('slice_id', sliceId)
        .order('user_id', { ascending: true })
        .range(pageParam, pageParam + PAGE_LIMIT - 1)

      if (memberError) throw memberError
      if (!memberRows || memberRows.length === 0) return []

      const userIds = memberRows.map((r) => r.user_id)

      // Step 2: Fetch profiles for those IDs
      const { data: profiles, error: profilesError } = await supabase
        .schema('civic_spaces')
        // 🔴 PUBLIC READER: see below. 18-02 asserts that anon cannot read
        // connected_profiles AT ALL, so any of these that ran for a reader with no
        // account would 403 and break its panel. The DEFAULT is "does not run" — if
        // one of them turns out to need public data that is a new RPC and a new
        // decision, never a new grant.
        // DOES NOT RUN. AppShell gates the whole panel on isAuthenticated AND on the
        // member's own slices. It reads slice_members — who lives where — which D-34
        // withholds from readers with no account outright, counts included.
        .from('connected_profiles')
        .select('user_id, display_name, avatar_url, tier')
        .in('user_id', userIds)
        .order('display_name', { ascending: true })

      if (profilesError) throw profilesError

      return (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        tier: p.tier,
      }))
    },
    getNextPageParam: (lastPage, allPages): number | undefined => {
      if (lastPage.length < PAGE_LIMIT) return undefined
      return allPages.length * PAGE_LIMIT
    },
    initialPageParam: 0,
    enabled: !!sliceId,
    staleTime: 2 * 60 * 1000,
  })
}
