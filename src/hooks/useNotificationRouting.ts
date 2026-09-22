import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { SliceType, SliceInfo, TabKey } from '../types/database'

/**
 * useNotificationRouting — resolves a post_id to the correct TabKey.
 *
 * Accepts the allSlices map (from useAllSlices) and returns a one-off async
 * function that looks up the post's slice_id, then reverse-maps it against the
 * slices map to find the matching TabKey.  Falls back to 'federal' if the post
 * cannot be found or the user is not a member of that slice.
 */
export function useNotificationRouting(
  slices: Partial<Record<SliceType, SliceInfo>>,
) {
  const resolveTabForPost = useCallback(
    async (postId: string): Promise<TabKey> => {
      try {
        const { data, error } = await supabase
          .schema('civic_spaces')
          .from('posts')
          .select('slice_id')
          .eq('id', postId)
          .single()

        if (error || !data?.slice_id) {
          return 'federal'
        }

        const sliceId = data.slice_id

        // Reverse-lookup: find which SliceType entry owns this slice_id
        for (const [tabKey, sliceInfo] of Object.entries(slices) as [
          SliceType,
          SliceInfo,
        ][]) {
          if (sliceInfo.id === sliceId) {
            // SliceType values match TabKey values for geo slices
            return tabKey as TabKey
          }
        }

        // Post is in a slice the user isn't a member of — fall back to federal
        return 'federal'
      } catch {
        return 'federal'
      }
    },
    [slices],
  )

  return { resolveTabForPost }
}
