import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { isMockSliceId } from '../lib/devMockData'

export function useRealtimeInvalidation(sliceId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Fixture slices have no rows to watch, and their join fails the slice_id filter check.
    if (!sliceId || isMockSliceId(sliceId)) return

    const channel = supabase
      .channel(`feed-${sliceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'civic_spaces',
          table: 'posts',
          filter: `slice_id=eq.${sliceId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feed', sliceId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sliceId, queryClient])
}
