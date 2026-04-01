import { useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ReplyWithAuthor } from '../types/database'

interface CreateReplyInput {
  body: string
  parentReplyId?: string
}

export function useCreateReply(postId: string, userId: string) {
  const queryClient = useQueryClient()
  const repliesKey = ['replies', postId]

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
        .select()
        .single()

      if (error) throw error
      return data
    },

    onMutate: async ({ body, parentReplyId }: CreateReplyInput) => {
      // Cancel in-flight queries so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: repliesKey })

      // Snapshot current data
      const snapshot = queryClient.getQueryData<InfiniteData<ReplyWithAuthor[]>>(repliesKey)

      // Build temp optimistic reply
      const tempReply: ReplyWithAuthor = {
        id: crypto.randomUUID(),
        post_id: postId,
        user_id: userId,
        body,
        parent_reply_id: parentReplyId ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
        author: { display_name: 'You', avatar_url: null },
      }

      // Append to last page of InfiniteData
      if (snapshot) {
        const pages = snapshot.pages
        const lastPage = pages[pages.length - 1] ?? []
        const newLastPage = [...lastPage, tempReply]
        const newPages = [...pages.slice(0, pages.length - 1), newLastPage]

        queryClient.setQueryData<InfiniteData<ReplyWithAuthor[]>>(repliesKey, {
          ...snapshot,
          pages: newPages,
        })
      } else {
        // No existing data — create initial structure
        queryClient.setQueryData<InfiniteData<ReplyWithAuthor[]>>(repliesKey, {
          pages: [[tempReply]],
          pageParams: [undefined],
        })
      }

      return { snapshot }
    },

    onError: (_err, _vars, context) => {
      // Restore snapshot on error
      if (context?.snapshot) {
        queryClient.setQueryData(repliesKey, context.snapshot)
      }
    },

    onSettled: () => {
      // Invalidate replies and feed (reply_count changes)
      queryClient.invalidateQueries({ queryKey: repliesKey })
      queryClient.invalidateQueries({ queryKey: ['boosted-feed'] })
    },
  })
}
