import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { isMockSliceId, getMockPostById, MOCK_SLICES } from '../lib/devMockData'
import type { SliceType, SliceInfo, TabKey } from '../types/database'
import type { SiblingSlice } from './useSiblingSlices'
import { fetchPublicPost } from './usePublicThread'
import { publicLocationFrom } from '../lib/publicProjection'

/**
 * Where a post lives, relative to the member looking for it.
 *
 * - `own`       the post is in a slice they belong to
 * - `sibling`   it is in another shard of a jurisdiction they belong to, so RLS
 *               lets them read it but not write (see the sibling-slice policies)
 * - `public`    it is in a PUBLIC place the viewer holds nothing in — Phase 18.
 *               Carries where to go, because the viewer has no tab for it.
 * - `unavailable` not found, deleted, or in a jurisdiction that is not theirs
 *               and not public. Deliberately one outcome for all of them:
 *               distinguishing them would tell the caller whether a post they
 *               cannot read exists.
 *
 * 🔴 `public` narrows `unavailable`, it does not widen it. Everything that was
 * unavailable before and is not publicly readable is still unavailable, and the
 * conflation inside that outcome is untouched — a deleted post, a volunteer post
 * and an id that never existed all still arrive at the same answer, because
 * `get_public_post` returns no row for each of them and this cannot tell which.
 */
export type PostLocation =
  | { kind: 'own'; tab: TabKey }
  | { kind: 'sibling'; tab: TabKey; sibling: SiblingSlice }
  | { kind: 'public'; sliceType: string; geoid: string; postId: string }
  | { kind: 'unavailable' }

// The public branch's decision lives in src/lib/publicProjection.ts, which has no
// runtime imports — this module imports `supabase`, so a pure check cannot load it.

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
  /**
   * The member-scoped lookup, exactly as it was before Phase 18.
   *
   * 🔴 Separated so the public fall-through happens in ONE place. It used to give
   * up at four different `return { kind: 'unavailable' }` statements; adding the
   * fallback to three of them and missing the fourth is the kind of omission that
   * shows as "that link works for me" and nothing else.
   */
  const locateForMember = useCallback(
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

  const locatePost = useCallback(
    async (postId: string): Promise<PostLocation> => {
      const mine = await locateForMember(postId)
      if (mine.kind !== 'unavailable') return mine

      // 🔴 Only AFTER the member lookup has given up. A member reading their own
      // slice must keep the member path: it is block-filtered and carries every
      // author's id, and the public path is neither. Reaching for the public RPC
      // first would silently un-block people they blocked.
      try {
        const row = await fetchPublicPost(postId)
        return publicLocationFrom(row, postId)
      } catch {
        return { kind: 'unavailable' }
      }
    },
    [locateForMember],
  )

  return { locatePost }
}
