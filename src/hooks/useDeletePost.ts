import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PostWithAuthor } from '../types/database'

export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ postId }: { postId: string; sliceId: string }) => {
      const { error } = await supabase
        .schema('civic_spaces')
        .from('posts')
        .update({ is_deleted: true })
        .eq('id', postId)

      if (error) throw error
    },

    onMutate: async ({ postId, sliceId }: { postId: string; sliceId: string }) => {
      await queryClient.cancelQueries({ queryKey: ['boosted-feed', sliceId] })

      const snapshot = queryClient.getQueryData<InfiniteData<PostWithAuthor[]>>(['boosted-feed', sliceId])

      if (snapshot) {
        queryClient.setQueryData<InfiniteData<PostWithAuthor[]>>(['boosted-feed', sliceId], {
          ...snapshot,
          pages: snapshot.pages.map((page) =>
            page.filter((post) => post.id !== postId)
          ),
        })
      }

      return { snapshot, sliceId }
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['boosted-feed', context.sliceId], context.snapshot)
      }
    },

    onSettled: (_data, _err, { sliceId }) => {
      queryClient.invalidateQueries({ queryKey: ['boosted-feed', sliceId] })
    },
  })
}
