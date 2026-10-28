import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface CreateReplyInput {
  body: string
  parentReplyId?: string
}

/**
 * Post a reply, and show it only once the database has it.
 *
 * 🔴 Not optimistic. A temporary "You" reply used to appear before the request returned
 * and disappear if it failed, taking the typed text with it. Now the reply list is
 * re-fetched after the insert succeeds — `mutateAsync` resolves only once that refetch
 * has landed, so the composer closes on a list that already shows the saved reply.
 */
export function useCreateReply(postId: string, userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ body, parentReplyId }: CreateReplyInput) => {
      const { data, error } = await supabase
        .schema('civic_spaces')
        .from('replies')
        .insert({
          post_id: postId,
          user_id: userId,
          body,
          parent_reply_id: parentReplyId ?? null,
        })
        .select('id')
        .single()

      if (error) throw error
      return data as { id: string }
    },

    onSuccess: async () => {
      // reply_count on the post changes too, so the feed's count is refreshed as well.
      queryClient.invalidateQueries({ queryKey: ['boosted-feed'] })
      await queryClient.invalidateQueries({ queryKey: ['replies', postId] })
    },
  })
}
