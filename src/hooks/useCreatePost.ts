import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { CreatePostInput } from '../lib/validators'

/**
 * Create a post, and show it only once the database has it.
 *
 * 🔴 Not optimistic. This used to insert a temporary "You" post into the feed before
 * the request returned and roll it back on failure — a post that looked saved, then
 * vanished. Now the feed is refreshed from the server after the insert succeeds, and
 * the composer opens the saved post by its real id. Nothing is shown that was not saved.
 */
export function useCreatePost(sliceId: string, userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ title, body }: CreatePostInput) => {
      const { data, error } = await supabase
        .schema('civic_spaces')
        .from('posts')
        .insert({ slice_id: sliceId, user_id: userId, title, body })
        .select('id')
        .single()

      if (error) throw error
      return data as { id: string }
    },

    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['boosted-feed', sliceId] }),
  })
}
