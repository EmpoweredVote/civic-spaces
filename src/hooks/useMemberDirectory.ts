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
