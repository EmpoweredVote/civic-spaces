import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { isMockSliceId, getMockPostById, getMockReplies } from '../lib/devMockData'
import type { PostWithAuthor, ReplyWithAuthor, ConnectedProfile } from '../types/database'

interface ReplyCursor {
  created_at: string
  id: string
}

async function fetchPostWithAuthor(postId: string): Promise<PostWithAuthor> {
  // Fixture posts (from the mock feed) never exist in Supabase — serve the
  // local fixture directly instead of hitting the real posts table.
  if (isMockSliceId(postId)) {
    const mockPost = getMockPostById(postId)
    if (mockPost) return mockPost
  }

  const { data: post, error: postError } = await supabase
    .schema('civic_spaces')
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (postError) throw postError

  const { data: profile, error: profileError } = await supabase
    .schema('civic_spaces')
    // 🔴 PUBLIC READER: see below. 18-02 asserts that anon cannot read
    // connected_profiles AT ALL, so any of these that ran for a reader with no
    // account would 403 and break its panel. The DEFAULT is "does not run" — if
    // one of them turns out to need public data that is a new RPC and a new
    // decision, never a new grant.
    // REPLACED BY AN RPC IN THIS PHASE. ThreadView passes null here when
    // isPublic, so this query does not run; usePublicThread answers instead.
    .from('connected_profiles')
    .select('user_id, display_name, avatar_url')
    .eq('user_id', post.user_id)
    .single()

  if (profileError) {
    // Author profile not found — use fallback
    return {
      ...post,
      author: { display_name: 'Unknown', avatar_url: null },
    } as PostWithAuthor
  }

  return {
    ...post,
    author: { display_name: profile.display_name, avatar_url: profile.avatar_url },
  } as PostWithAuthor
}

const REPLY_PAGE_SIZE = 20

async function fetchRepliesPage(
  postId: string,
  cursor: ReplyCursor | undefined,
): Promise<ReplyWithAuthor[]> {
  if (isMockSliceId(postId)) {
    return cursor ? [] : getMockReplies(postId)
  }

  let query = supabase
    .schema('civic_spaces')
    .from('replies')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(REPLY_PAGE_SIZE)

  if (cursor) {
    query = query.or(
      `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`,
    )
  }

  const { data: replies, error: repliesError } = await query

  if (repliesError) throw repliesError
  if (!replies || replies.length === 0) return []

  // Batch-fetch profiles for all unique user_ids
  const userIds = [...new Set(replies.map((r) => r.user_id))]

  const { data: profiles, error: profilesError } = await supabase
    .schema('civic_spaces')
    // REPLACED BY AN RPC IN THIS PHASE. ThreadView passes null here when
    // isPublic, so this query does not run; usePublicThread answers instead.
    .from('connected_profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', userIds)

  if (profilesError) throw profilesError

  const profileMap = new Map<string, Pick<ConnectedProfile, 'display_name' | 'avatar_url'>>()
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url })
  }

  return replies.map((reply) => ({
    ...reply,
    author: profileMap.get(reply.user_id) ?? { display_name: 'Unknown', avatar_url: null },
  })) as ReplyWithAuthor[]
}

export function useThread(postId: string | null) {
  const postQuery = useQuery({
    queryKey: ['post', postId],
    queryFn: () => fetchPostWithAuthor(postId!),
    enabled: !!postId,
  })

  const repliesQuery = useInfiniteQuery<
    ReplyWithAuthor[],
    Error,
    { pages: ReplyWithAuthor[][] },
    string[],
    ReplyCursor | undefined
  >({
    queryKey: ['replies', postId ?? ''],
    queryFn: ({ pageParam }) => fetchRepliesPage(postId!, pageParam),
    getNextPageParam: (lastPage): ReplyCursor | undefined => {
      if (lastPage.length < REPLY_PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      if (!last) return undefined
      return { created_at: last.created_at, id: last.id }
    },
    initialPageParam: undefined,
    enabled: !!postId,
  })

  const replies = repliesQuery.data?.pages.flatMap((p) => p) ?? []

  return {
    post: postQuery.data ?? null,
    replies,
    fetchMoreReplies: () => repliesQuery.fetchNextPage(),
    hasMoreReplies: repliesQuery.hasNextPage ?? false,
    isLoading: postQuery.isLoading || repliesQuery.isLoading,
    error: postQuery.error ?? repliesQuery.error,
  }
}
