import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { isMockSliceId, getMockSiblings } from '../lib/devMockData'
import type { SliceType } from '../types/database'

export interface SiblingSlice {
  id: string
  siblingIndex: number
  memberCount: number
}

interface UseSiblingSlicesResult {
  /** All slices sharing this (sliceType, geoid) — includes the caller's own slice. */
  siblings: SiblingSlice[]
  isLoading: boolean
  isError: boolean
}

/**
 * Lists every "sibling" slice at a location (same slice_type + geoid, split
 * apart by member-cap sharding — see findOrCreateSiblingSlice in the
 * ev-accounts engine; the local services/slice-assignment copy is FROZEN). Used to
 * populate the slice selector so a member of Slice 1 can browse Slice 2, 3,
 * etc. read-only.
 *
 * Requires the `posts_select_sibling_slice` / `replies_select_sibling_slice`
 * RLS policies (see supabase/migrations/20260917000000_sibling_slice_read_access.sql)
 * to actually see those other slices' posts — this hook only lists which
 * slices exist, which `slices_select_authenticated` already allows anyone
 * authenticated to read.
 *
 * Dev/mock sessions (`?dev=1`, or an anonymous address-preview) run entirely
 * on local fixture data with no real sibling rows in Supabase — for those,
 * this returns just the caller's own slice as a single-item, safe fallback
 * rather than querying (or inventing) fake sibling data.
 */
export function useSiblingSlices(
  sliceType: SliceType,
  geoid: string,
  ownSliceId: string,
  ownSiblingIndex: number,
  ownMemberCount: number,
): UseSiblingSlicesResult {
  const mock = isMockSliceId(ownSliceId)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sibling-slices', sliceType, geoid],
    queryFn: async (): Promise<SiblingSlice[]> => {
      const { data, error } = await supabase
        .schema('civic_spaces')
        .from('slices')
        .select('id, sibling_index, current_member_count')
        .eq('slice_type', sliceType)
        .eq('geoid', geoid)
        .order('sibling_index', { ascending: true })

      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id as string,
        siblingIndex: row.sibling_index as number,
        memberCount: row.current_member_count as number,
      }))
    },
    enabled: !mock && !!geoid,
  })

  if (mock) {
    return {
      siblings: getMockSiblings(ownSliceId, ownSiblingIndex, ownMemberCount),
      isLoading: false,
      isError: false,
    }
  }

  return {
    siblings: data ?? [],
    isLoading,
    isError,
  }
}
