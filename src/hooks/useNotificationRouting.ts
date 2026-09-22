import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { isMockSliceId, getMockPostById, MOCK_SLICES } from '../lib/devMockData'
import type { SliceType, SliceInfo, TabKey } from '../types/database'
import type { SiblingSlice } from './useSiblingSlices'

/**
 * Where a post lives, relative to the member looking for it.
 *
 * - `own`       the post is in a slice they belong to
 * - `sibling`   it is in another shard of a jurisdiction they belong to, so RLS
 *               lets them read it but not write (see the sibling-slice policies)
 * - `unavailable` not found, deleted, or in a jurisdiction that is not theirs.
 *               Deliberately one outcome for all three: distinguishing them
 *               would tell the caller whether a post they cannot read exists.
 */
export type PostLocation =
  | { kind: 'own'; tab: TabKey }
  | { kind: 'sibling'; tab: TabKey; sibling: SiblingSlice }
  | { kind: 'unavailable' }

/**
 * Resolves a post id to the tab that should open for it.
 *
 * Used by both notification clicks and `/post/:postId` deep links, so a shared
 * link and a notification land in exactly the same place by exactly the same
 * route.
 */
export function useNotificationRouting(
  slices: Partial<Record<SliceType, SliceInfo>>,
) {
  const locatePost = useCallback(
    async (postId: string): Promise<PostLocation> => {
      // Fixture posts never existed in Supabase; resolve them from the same
      // fixtures the feed reads so ?dev=1 can exercise deep links too.
      if (isMockSliceId(postId)) {
        const mockPost = getMockPostById(postId)
        if (!mockPost) return { kind: 'unavailable' }
        for (const [tabKey, info] of Object.entries(slices) as [SliceType, SliceInfo][]) {
          if (info.id === mockPost.slice_id) return { kind: 'own', tab: tabKey as TabKey }
        }
        // A fixture sibling shard: find the tab whose own slice shares its type.
        for (const [tabKey, info] of Object.entries(MOCK_SLICES) as [SliceType, SliceInfo][]) {
          if (slices[tabKey]?.id && mockPost.slice_id.startsWith(info.id)) {
            return {
              kind: 'sibling',
              tab: tabKey as TabKey,
              sibling: { id: mockPost.slice_id, siblingIndex: 2, memberCount: 0 },
            }
          }
        }
        return { kind: 'unavailable' }
      }

      try {
        const { data: post, error: postError } = await supabase
          .schema('civic_spaces')
          .from('posts')
          .select('slice_id')
          .eq('id', postId)
          .single()

        // RLS returns nothing rather than an error for a post outside every
        // slice this member can read, so "no row" is the unreadable case too.
        if (postError || !post?.slice_id) return { kind: 'unavailable' }

        for (const [tabKey, info] of Object.entries(slices) as [SliceType, SliceInfo][]) {
          if (info.id === post.slice_id) return { kind: 'own', tab: tabKey as TabKey }
        }

        // Not one of theirs, but RLS still returned it — so it is a sibling
        // shard of a jurisdiction they do belong to. Find which of their tabs
        // shares its (slice_type, geoid) and open that one, view-only.
        const { data: slice, error: sliceError } = await supabase
          .schema('civic_spaces')
          .from('slices')
          .select('id, slice_type, geoid, sibling_index, current_member_count')
          .eq('id', post.slice_id)
          .single()

        if (sliceError || !slice) return { kind: 'unavailable' }

        for (const [tabKey, info] of Object.entries(slices) as [SliceType, SliceInfo][]) {
          if (info.sliceType === slice.slice_type && info.geoid === slice.geoid) {
            return {
              kind: 'sibling',
              tab: tabKey as TabKey,
              sibling: {
                id: slice.id as string,
                siblingIndex: slice.sibling_index as number,
                memberCount: slice.current_member_count as number,
              },
            }
          }
        }

        return { kind: 'unavailable' }
      } catch {
        return { kind: 'unavailable' }
      }
    },
    [slices],
  )

  return { locatePost }
}
