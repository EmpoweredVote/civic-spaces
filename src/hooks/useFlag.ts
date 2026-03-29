import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import type { FlagCategory } from '../types/database'

export function useMyFlags(userId: string | null) {
  return useQuery({
    queryKey: ['my-flags', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flags')
        .select('post_id')
        .eq('reporter_id', userId!)
      if (error) throw error
      return new Set((data ?? []).map((f) => f.post_id))
    },
  })
}

export function useFlagPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      post_id: string
      reporter_id: string
      category: FlagCategory
      detail: string | null
    }) => {
      const { error } = await supabase.from('flags').insert(vars)
      if (error) {
        if (error.code === '23505') return // duplicate — treat as success
        throw error
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['my-flags', vars.reporter_id] })
      toast.success('Thanks, we will review this')
    },
    onError: (err: any) => {
      if (err?.code === '23505') {
        toast.success('Thanks, we will review this')
        return
      }
      toast.error('Failed to submit flag')
    },
  })
}
