import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { MemberProfile } from './useMemberDirectory'

export function useMemberSearch(
  term: string,
  crossSlice: boolean,
  sliceId: string | null,
) {
  const enabled = term.length >= 2

  return useQuery<MemberProfile[], Error>({
    queryKey: ['member-search', term, crossSlice, sliceId ?? ''],
    queryFn: async () => {
      if (crossSlice || !sliceId) {
        // Search all connected profiles
        const { data, error } = await supabase
          .from('connected_profiles')
          .select('user_id, display_name, avatar_url, tier')
          .ilike('display_name', `%${term}%`)
          .limit(50)

        if (error) throw error
        return (data ?? []).map((p) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          tier: p.tier,
        }))
      } else {
        // Two-query: get slice member IDs, then filter by name
        const { data: memberRows, error: memberError } = await supabase
          .from('slice_members')
          .select('user_id')
          .eq('slice_id', sliceId)

        if (memberError) throw memberError
        if (!memberRows || memberRows.length === 0) return []

        const memberIds = memberRows.map((r) => r.user_id)

        const { data, error } = await supabase
          .from('connected_profiles')
          .select('user_id, display_name, avatar_url, tier')
          .ilike('display_name', `%${term}%`)
          .in('user_id', memberIds)
          .limit(50)

        if (error) throw error
        return (data ?? []).map((p) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          tier: p.tier,
        }))
      }
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
  })
}
