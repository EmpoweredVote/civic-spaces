import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import type { Block } from '../types/database'

export function useBlockedUsers(userId: string | null) {
  return useQuery({
    queryKey: ['blocked-users', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('civic_spaces')
        .from('blocks')
        .select('*')
        .eq('blocker_id', userId!)
      if (error) throw error
      const blocks = (data ?? []) as Block[]
      const blockedSet = new Set(blocks.map((b) => b.blocked_id))
      return { blocks, blockedSet }
    },
  })
}

export function useBlockUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { blocker_id: string; blocked_id: string }) => {
      const { error } = await supabase.schema('civic_spaces').from('blocks').insert(vars)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['blocked-users', vars.blocker_id] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['boosted-feed'] })
      toast.success('User blocked')
    },
  })
}

export function useUnblockUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { blocker_id: string; blocked_id: string }) => {
      const { error } = await supabase
        .schema('civic_spaces')
        .from('blocks')
        .delete()
        .eq('blocker_id', vars.blocker_id)
        .eq('blocked_id', vars.blocked_id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['blocked-users', vars.blocker_id] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['boosted-feed'] })
      toast.success('User unblocked')
    },
  })
}

export function useIsBlockedBy(userId: string | null) {
  return useQuery({
    queryKey: ['is-blocked-by', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.schema('civic_spaces').rpc('is_blocked_by', { p_user_id: userId! })
      if (error) throw error
      return data as boolean
    },
  })
}
