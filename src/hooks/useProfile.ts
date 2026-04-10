import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ConnectedProfile } from '../types/database'

export function useProfile(userId: string | null) {
  const query = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('civic_spaces')
        .from('connected_profiles')
        .select('user_id, display_name, avatar_url, tier, is_suspended, account_standing')
        .eq('user_id', userId!)
        .single()

      if (error) throw error
      return data as ConnectedProfile
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
  }
}
