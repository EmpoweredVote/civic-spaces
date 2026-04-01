import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { BoostedPostWithAuthor } from '../types/database'
import type { BoostedFeedCursor } from '../lib/cursors'

const PAGE_SIZE = 20

async function fetchBoostedFeedPage(
  sliceId: string,
  cursor?: BoostedFeedCursor,
): Promise<BoostedPostWithAuthor[]> {
  // Call the RPC — returns posts with boosted_at synthetic sort key
  const { data: posts, error } = await supabase.schema('civic_spaces').rpc('get_boosted_feed_filtered', {
    p_slice_id: sliceId,
    p_limit: PAGE_SIZE,
    p_cursor_at: cursor?.boosted_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  })
  if (error) throw error
  if (!posts || posts.length === 0) return []

  // Batch fetch profiles for all unique authors
  const userIds = [...new Set(posts.map((p: any) => p.author_id as string))]
  const { data: profiles } = await supabase
    .from('connected_profiles')
    .select('user_id, display_name, avatar_url, tier')
    .in('user_id', userIds)

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [p.user_id, p]),
  )

  return posts.map((p: any) => ({
    ...p,
    user_id: p.author_id,
    title: p.title ?? null,
    edit_history: p.edit_history ?? [],
    author: profileMap.get(p.author_id) ?? {
      display_name: 'Unknown',
      avatar_url: null,
      tier: 'connected',
    },
  })) as BoostedPostWithAuthor[]
}

export function useBoostedFeed(sliceId: string | null) {
  const queryClient = useQueryClient()

  // Realtime invalidation — invalidate on any post change in this slice
  useEffect(() => {
    if (!sliceId) return
    const channel = supabase
      .channel(`boosted-feed-${sliceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'civic_spaces',
          table: 'posts',
          filter: `slice_id=eq.${sliceId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['boosted-feed', sliceId] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [sliceId, queryClient])

  return useInfiniteQuery<
    BoostedPostWithAuthor[],
    Error,
    { pages: BoostedPostWithAuthor[][] },
    string[],
    BoostedFeedCursor | undefined
  >({
    queryKey: ['boosted-feed', sliceId ?? ''],
    queryFn: ({ pageParam }) =>
      fetchBoostedFeedPage(sliceId!, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage): BoostedFeedCursor | undefined => {
      if (lastPage.length < PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      // CRITICAL: cursor must use boosted_at (synthetic sort key), not created_at
      return { boosted_at: last.boosted_at, id: last.id }
    },
    enabled: !!sliceId,
  })
}
