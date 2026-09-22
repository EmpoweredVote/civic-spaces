import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PostWithAuthor } from '../types/database'

export function isWithinEditWindow(createdAt: string): boolean {
  return new Date(createdAt) > new Date(Date.now() - 60 * 60 * 1000)
}

export function useEditPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ postId, body }: { postId: string; body: string }) => {
      const { data, error } = await supabase
        .schema('civic_spaces')
        .from('posts')
        .update({ body })
        .eq('id', postId)
        .select()
        .single()

      if (error) {
        if (error.message?.includes('edit_window_expired')) {
          throw new Error('Edit window has expired. Posts can only be edited within 1 hour of creation.')
        }
        throw error
      }
      return data as PostWithAuthor
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['boosted-feed'] })
    },
  })
}
