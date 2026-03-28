import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PostWithAuthor } from '../types/database'
import type { CreatePostInput } from '../lib/validators'

export function useCreatePost(sliceId: string, userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ title, body }: CreatePostInput) => {
      const { data, error } = await supabase
        .from('posts')
        .insert({ slice_id: sliceId, user_id: userId, title, body })
        .select()
        .single()

      if (error) throw error
      return data as PostWithAuthor
    },

    onMutate: async ({ title, body }: CreatePostInput) => {
      await queryClient.cancelQueries({ queryKey: ['feed', sliceId] })

      const snapshot = queryClient.getQueryData<InfiniteData<PostWithAuthor[]>>(['feed', sliceId])

      const tempPost: PostWithAuthor = {
        id: crypto.randomUUID(),
        slice_id: sliceId,
        user_id: userId,
        title,
        body,
        reply_count: 0,
        edit_history: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
        author: { display_name: 'You', avatar_url: null },
      }

      if (snapshot) {
        queryClient.setQueryData<InfiniteData<PostWithAuthor[]>>(['feed', sliceId], {
          ...snapshot,
          pages: [
            [tempPost, ...(snapshot.pages[0] ?? [])],
            ...snapshot.pages.slice(1),
          ],
        })
      }

      return { snapshot }
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(['feed', sliceId], context.snapshot)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', sliceId] })
    },
  })
}
