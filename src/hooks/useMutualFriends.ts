import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface MutualFriend {
  user_id: string
  display_name: string
  tier: string
}

async function fetchMutualFriends(subjectId: string): Promise<MutualFriend[]> {
  const { data, error } = await supabase.schema('civic_spaces').rpc('get_mutual_friends', {
    p_subject_id: subjectId,
  })

  if (error) throw error

  return (data as MutualFriend[]) ?? []
}

export function useMutualFriends(
  subjectId: string | null,
  enabled?: boolean,
): {
  mutualFriends: MutualFriend[]
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['mutual-friends', subjectId],
    queryFn: () => fetchMutualFriends(subjectId!),
    enabled: !!subjectId && enabled !== false,
    staleTime: 5 * 60 * 1000,
  })

  return {
    mutualFriends: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}
