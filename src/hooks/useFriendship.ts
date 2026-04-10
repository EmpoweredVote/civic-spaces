import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { friendshipKey, friendshipStatus } from '../lib/friendship'
import { useAuth } from './useAuth'
import type { RelationshipState } from '../types/database'

export function useRelationship(otherUserId: string | null): {
  state: RelationshipState
  isLoading: boolean
} {
  const { userId } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['relationship', otherUserId],
    queryFn: async () => {
      if (!userId || !otherUserId) return null
      const key = friendshipKey(userId, otherUserId)
      const { data, error } = await supabase
        .schema('civic_spaces')
        .from('friendships')
        .select('*')
        .eq('user_low', key.user_low)
        .eq('user_high', key.user_high)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!userId && !!otherUserId,
    staleTime: 60 * 1000, // 1 minute
  })

  if (!data) return { state: 'none', isLoading }

  return {
    state: userId ? friendshipStatus(data, userId) : 'none',
    isLoading,
  }
}

export function useSendFriendRequest() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('Not authenticated')
      const key = friendshipKey(userId, otherUserId)
      // Determine status: REQ_LOW if current user is user_low, REQ_HIGH if user_high
      const status = userId === key.user_low ? 'REQ_LOW' : 'REQ_HIGH'

      const { error } = await supabase.schema('civic_spaces').from('friendships').insert({
        user_low: key.user_low,
        user_high: key.user_high,
        status,
      })
      if (error) throw error
    },
    onSuccess: (_data, otherUserId) => {
      queryClient.invalidateQueries({ queryKey: ['relationship', otherUserId] })
    },
  })
}

export function useAcceptFriendRequest() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('Not authenticated')
      const key = friendshipKey(userId, otherUserId)

      const { error } = await supabase
        .schema('civic_spaces')
        .from('friendships')
        .update({ status: 'FRIEND' })
        .eq('user_low', key.user_low)
        .eq('user_high', key.user_high)
      if (error) throw error
    },
    onSuccess: (_data, otherUserId) => {
      queryClient.invalidateQueries({ queryKey: ['relationship', otherUserId] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}

export function useRemoveFriend() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('Not authenticated')
      const key = friendshipKey(userId, otherUserId)

      const { error } = await supabase
        .schema('civic_spaces')
        .from('friendships')
        .delete()
        .eq('user_low', key.user_low)
        .eq('user_high', key.user_high)
      if (error) throw error
    },
    onSuccess: (_data, otherUserId) => {
      queryClient.invalidateQueries({ queryKey: ['relationship', otherUserId] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}
