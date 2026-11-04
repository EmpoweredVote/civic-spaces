import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PostWithAuthor } from '../types/database'
import type { FeedCursor } from '../lib/cursors'
import type { PublicFeedRow } from '../lib/publicProjection'
import { mapPublicPostRow, publicQueryKey } from '../lib/publicProjection'
import { getMockPublicFeedPage } from '../lib/devMockData'

const PAGE_SIZE = 20

/**
 * One page of a public place's feed, for a reader who may not be a member of it —
 * or signed in at all.
 *
 * 🔴 ONE RPC CALL, AND NO PROFILE JOIN. `get_public_feed` already denormalises the
 * author, which is the point of D-44: `anon` holds EXECUTE on four functions and no
 * table privilege anywhere in `civic_spaces`. Adding the `connected_profiles` join
 * that `useFeed` does would 403 for every signed-out reader — and would also undo
 * the per-author projection, because that table has no idea who is asking.
 *
 * 🔴 Keyed on (slice_type, geoid), not a slice id, because the caller does not have
 * one. A visited place usually has no `slices` row at all — rows are created on
 * demand by /assign, and 15 exist in the whole product — and the RPC resolves the
 * lowest `sibling_index` itself (D-46). A null page is "no conversation here", which
 * this hook reports as an empty array and never as an error.
 */
async function fetchPublicFeedPage(
  sliceType: string,
  geoid: string,
  cursor: FeedCursor | undefined,
): Promise<PostWithAuthor[]> {
  // Local dev has no backend and no login (CLAUDE.md), so the public path would
  // otherwise be the one surface nobody can look at before the migrations apply.
  if (!import.meta.env.VITE_SUPABASE_URL) {
    return cursor ? [] : getMockPublicFeedPage(sliceType)
  }

  const { data, error } = await supabase.schema('civic_spaces').rpc('get_public_feed', {
    p_slice_type: sliceType,
    p_geoid: geoid,
    p_limit: PAGE_SIZE,
    p_cursor_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  })

  if (error) throw error
  return ((data ?? []) as PublicFeedRow[]).map(mapPublicPostRow)
}

/**
 * @param viewerId the reader this page is narrowed FOR — required, no default.
 *   D-49 makes the result per-(slice, viewer), so it is part of the cache key.
 * @param enabled false keeps the query from running at all. The caller owns this:
 *   all six feed panels mount at once, every level of a visited place is public, and
 *   without it a single visit would fire six RPCs for five feeds nobody is looking at.
 */
export function usePublicFeed(
  viewerId: string | null,
  sliceType: string | null,
  geoid: string | null,
  enabled = true,
) {
  return useInfiniteQuery<PostWithAuthor[], Error, { pages: PostWithAuthor[][] }, string[], FeedCursor | undefined>({
    // 🔴 A DIFFERENT KEY NAMESPACE from ['feed', sliceId], AND a viewer term. The two
    // hooks return the same shape over different projections — the member feed is
    // block-filtered and carries author ids, this one is narrowed per reader — so
    // sharing a key across either axis is a disclosure, not a glitch. See
    // publicQueryKey for why the viewer half is not optional.
    queryKey: publicQueryKey('public-feed', viewerId, sliceType ?? '', geoid ?? ''),
    queryFn: ({ pageParam }) => fetchPublicFeedPage(sliceType!, geoid!, pageParam),
    getNextPageParam: (lastPage): FeedCursor | undefined => {
      if (lastPage.length < PAGE_SIZE) return undefined
      const last = lastPage[lastPage.length - 1]
      if (!last) return undefined
      return { created_at: last.created_at, id: last.id }
    },
    initialPageParam: undefined,
    enabled: enabled && !!sliceType && geoid !== null,
  })
}
