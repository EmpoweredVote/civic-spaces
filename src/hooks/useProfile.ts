import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ConnectedProfile } from '../types/database'
import { MOCK_PROFILE } from '../lib/devMockData'

export function useProfile(userId: string | null) {
  const query = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .schema('civic_spaces')
          .from('connected_profiles')
          .select('user_id, display_name, avatar_url, tier, is_suspended, account_standing')
          .eq('user_id', userId!)
          .single()

        if (error) throw error
        return data as ConnectedProfile
      } catch (err) {
        // Local dev's fake token isn't a real Supabase-signed session, so
        // this fails auth outright — fall back to a fixture profile.
        if (import.meta.env.DEV) return MOCK_PROFILE
        throw err
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
  }
}
