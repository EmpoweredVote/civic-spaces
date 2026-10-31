import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ConnectedProfile } from '../types/database'

export function useProfile(userId: string | null) {
  const query = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('civic_spaces')
        // 🔴 PUBLIC READER: see below. 18-02 asserts that anon cannot read
        // connected_profiles AT ALL, so any of these that ran for a reader with no
        // account would 403 and break its panel. The DEFAULT is "does not run" — if
        // one of them turns out to need public data that is a new RPC and a new
        // decision, never a new grant.
        // DOES NOT RUN. enabled: !!userId — this is the VIEWER's own profile, and a
        // public reader has no id to look up.
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
