import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PostWithAuthor, ConnectedProfile } from '../types/database'
import type { FeedCursor } from '../lib/cursors'

const PAGE_SIZE = 20

async function fetchFeedPage(
  sliceId: string,
  cursor: FeedCursor | undefined,
): Promise<PostWithAuthor[]> {
  // Step 1: Fetch block-filtered posts via RPC with composite cursor pagination
  const { data: posts, error: postsError } = await supabase.schema('civic_spaces').rpc('get_feed_filtered', {
    p_slice_id: sliceId,
    p_limit: PAGE_SIZE,
    p_cursor_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  })

  if (postsError) throw postsError
  if (!posts || posts.length === 0) return []

  // Step 2: Collect unique user_ids
  const userIds = [...new Set(posts.map((p: { user_id: string }) => p.user_id))]

  // Step 3: Fetch profiles for those users
  const { data: profiles, error: profilesError } = await supabase
    .schema('civic_spaces')
    .from('connected_profiles')
    .select('user_id, display_name, avatar_url, tier')
    .in('user_id', userIds)

  if (profilesError) throw profilesError

  // Step 4: Build O(1) lookup map and merge
  const profileMap = new Map<string, Pick<ConnectedProfile, 'display_name' | 'avatar_url' | 'tier'>>()
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url, tier: p.tier })
  }

  return posts.map((post: { user_id: string; [key: string]: unknown }) => ({
    ...post,
    author: profileMap.get(post.user_id) ?? { display_name: 'Unknown', avatar_url: null },
  })) as PostWithAuthor[]
}

export function useFeed(sliceId: string | null) {
  return useInfiniteQuery<PostWithAuthor[], Error, { pages: PostWithAuthor[][] }, string[], FeedCursor | undefined>({
    queryKey: ['feed', sliceId ?? ''],
    queryFn: ({ pageParam }) => fetchFeedPage(sliceId!, pageParam),
    getNextPageParam: (lastPage): FeedCursor | undefined => {
      if (lastPage.length < PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      if (!last) return undefined
      return { created_at: last.created_at, id: last.id }
    },
    initialPageParam: undefined,
    enabled: !!sliceId,
  })
}
