import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useFollowStatus(targetId: string | null): {
  isFollowing: boolean
  isLoading: boolean
} {
  const { userId } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['follow', targetId],
    queryFn: async () => {
      if (!userId || !targetId) return null
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', userId)
        .eq('target_id', targetId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!userId && !!targetId,
    staleTime: 60 * 1000,
  })

  return {
    isFollowing: !!data,
    isLoading,
  }
}

export function useToggleFollow() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      targetId,
      currentlyFollowing,
    }: {
      targetId: string
      currentlyFollowing: boolean
    }) => {
      if (!userId) throw new Error('Not authenticated')

      if (currentlyFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', userId)
          .eq('target_id', targetId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: userId, target_id: targetId })
        if (error) throw error
      }
    },
    onSuccess: (_data, { targetId }) => {
      queryClient.invalidateQueries({ queryKey: ['follow', targetId] })
    },
  })
}
