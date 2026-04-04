import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ProfileStats {
  postCount: number
  replyCount: number
  friendCount: number
}

async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const { data, error } = await supabase.rpc('get_profile_stats', {
    p_user_id: userId,
  })

  if (error) throw error

  return {
    postCount: (data as { post_count: number; reply_count: number; friend_count: number }).post_count ?? 0,
    replyCount: (data as { post_count: number; reply_count: number; friend_count: number }).reply_count ?? 0,
    friendCount: (data as { post_count: number; reply_count: number; friend_count: number }).friend_count ?? 0,
  }
}

export function useProfileStats(userId: string | null): {
  stats: ProfileStats | null
  isLoading: boolean
  error: Error | null
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['profile-stats', userId],
    queryFn: () => fetchProfileStats(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    stats: data ?? null,
    isLoading,
    error: error as Error | null,
  }
}
