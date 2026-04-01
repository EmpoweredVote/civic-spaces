import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import type { ModQueueItem, ModAction } from '../types/database'

const ACTION_MESSAGES: Record<ModAction, string> = {
  remove: 'Content removed',
  dismiss: 'Flags dismissed',
  warn: 'Warning sent',
  suspend: 'User suspended',
}

export function useModQueue(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ['mod-queue', filters],
    staleTime: 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.schema('civic_spaces').rpc('get_mod_queue', {
        p_status: filters?.status ?? 'pending',
        p_category: filters?.category ?? null,
      })
      if (error) throw error
      return (data ?? []) as ModQueueItem[]
    },
  })
}

export function useIsModerator(userId: string | null) {
  return useQuery({
    queryKey: ['is-moderator', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('moderators')
        .select('user_id')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data !== null
    },
  })
}

export function useModAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      p_action: ModAction
      p_content_id?: string
      p_content_type?: 'post' | 'reply'
      p_user_id?: string
      p_notes?: string
    }) => {
      const { error } = await supabase.schema('civic_spaces').rpc('mod_action', {
        p_action: vars.p_action,
        p_content_id: vars.p_content_id ?? null,
        p_content_type: vars.p_content_type ?? 'post',
        p_user_id: vars.p_user_id ?? null,
        p_notes: vars.p_notes ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['mod-queue'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['boosted-feed'] })
      toast.success(ACTION_MESSAGES[vars.p_action])
    },
    onError: () => {
      toast.error('Action failed')
    },
  })
}
