import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PostWithAuthor, ReplyWithAuthor } from '../types/database'
import type { PublicPostRow, PublicReplyRow } from '../lib/publicProjection'
import { mapPublicPostRow, mapPublicReplyRow, publicQueryKey } from '../lib/publicProjection'
import { getMockPostById, getMockReplies } from '../lib/devMockData'

interface ReplyCursor {
  created_at: string
  id: string
}

const REPLY_PAGE_SIZE = 20

/**
 * One public post, by id, with where it lives.
 *
 * 🔴 Exported because `locatePost` needs exactly this and must not issue its own
 * copy of the call. Two call sites for one RPC is the `current_user_id()` shape
 * this codebase was already bitten by: when the two disagree the failure looks like
 * missing data rather than like a bug in either.
 *
 * 🔴 Returns NULL for a post that is not publicly readable, and does not
 * distinguish not-found from not-public from deleted. That conflation is
 * deliberate and matches `locatePost`'s existing `unavailable`: splitting it would
 * reveal whether a post the reader may not see exists.
 */
export async function fetchPublicPost(postId: string): Promise<PostWithAuthor & { slice_type: string; geoid: string } | null> {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    const mock = getMockPostById(postId)
    return mock ? { ...mock, slice_type: 'city', geoid: '3702140' } : null
  }

  const { data, error } = await supabase.schema('civic_spaces').rpc('get_public_post', {
    p_post_id: postId,
  })

  if (error) throw error
  const row = ((data ?? []) as PublicPostRow[])[0]
  if (!row) return null
  return { ...mapPublicPostRow(row), slice_type: row.slice_type, geoid: row.geoid }
}

async function fetchPublicRepliesPage(
  postId: string,
  cursor: ReplyCursor | undefined,
): Promise<ReplyWithAuthor[]> {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    return cursor ? [] : getMockReplies(postId)
  }

  const { data, error } = await supabase.schema('civic_spaces').rpc('get_public_replies', {
    p_post_id: postId,
    p_limit: REPLY_PAGE_SIZE,
    p_cursor_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  })

  if (error) throw error
  return ((data ?? []) as PublicReplyRow[]).map(mapPublicReplyRow)
}

/**
 * A public thread, in the shape `useThread` returns, so `ThreadView` needs no
 * change to its props.
 *
 * 🔴 TWO RPCs, NO PROFILE JOIN and NO `posts`/`replies` SELECT. `useThread` reads
 * both tables directly and then joins `connected_profiles`; every one of those is a
 * table privilege `anon` does not hold and must never be given (D-44). The author
 * arrives denormalised, already narrowed per reader by D-48/D-49.
 *
 * 🔴 The replies RPC filters `is_deleted = false` on the ROW ITSELF and not on its
 * ancestors, so a child of a deleted reply still arrives — which is why
 * `parent_reply_id` survives the mapping and the nesting still renders.
 */
export function usePublicThread(viewerId: string | null, postId: string | null, enabled = true) {
  const postQuery = useQuery({
    // 🔴 A different key namespace from ['post', id], AND a viewer term: the two
    // queries return the same shape over different projections, and the public one
    // is narrowed per reader (D-49). Sharing a key across either axis serves one
    // reader another reader's projection. See publicQueryKey.
    queryKey: publicQueryKey('public-post', viewerId, postId ?? ''),
    queryFn: () => fetchPublicPost(postId!),
    enabled: enabled && !!postId,
  })

  const repliesQuery = useInfiniteQuery<
    ReplyWithAuthor[],
    Error,
    { pages: ReplyWithAuthor[][] },
    string[],
    ReplyCursor | undefined
  >({
    queryKey: publicQueryKey('public-replies', viewerId, postId ?? ''),
    queryFn: ({ pageParam }) => fetchPublicRepliesPage(postId!, pageParam),
    getNextPageParam: (lastPage): ReplyCursor | undefined => {
      if (lastPage.length < REPLY_PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      if (!last) return undefined
      return { created_at: last.created_at, id: last.id }
    },
    initialPageParam: undefined,
    enabled: enabled && !!postId,
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
