import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { isMockSliceId, getMockSiblings } from '../lib/devMockData'
import { isPlaceSentinelId } from '../lib/viewedPlace'
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
 * Dev sessions (`?dev=1`) run entirely on local fixture data with no real
 * sibling rows in Supabase — for those, this returns just the caller's own
 * slice as a single-item, safe fallback rather than querying (or inventing)
 * fake sibling data. The switch is the mock SLICE ID, never an environment
 * check.
 *
 * 🔴 An anonymous visitor looking at a place does NOT run on fixture data, and
 * this comment used to say they did. They hold no slices and no user id, so
 * nothing here is reached on their behalf at all — and serving them fixtures
 * would be inventing another place's conversations for them.
 */
export function useSiblingSlices(
  sliceType: SliceType,
  geoid: string,
  ownSliceId: string,
  ownSiblingIndex: number,
  /**
   * Null for a visited place, which has no row and therefore no count. Only
   * ever read by the fixture fallback below, which a sentinel id never reaches.
   */
  ownMemberCount: number | null,
): UseSiblingSlicesResult {
  const mock = isMockSliceId(ownSliceId)
  /**
   * 🔴 A SECOND bail, and it must never be merged with the one above.
   *
   * The mock branch returns FIXTURE siblings. Routing a real place into it would
   * show a stranger invented shards of their own city — worse than showing none,
   * because it is a real-looking answer about the wrong place. This branch
   * returns EMPTY: Phase 17 asks the database nothing about a visited place, and
   * an empty list is the honest shape of "we did not ask".
   *
   * At the hook rather than only at the call sites, so no future caller can
   * reintroduce the query. The render guards in AppShell are the other half —
   * not querying and not OFFERING are different requirements.
   */
  const visitedPlace = isPlaceSentinelId(ownSliceId)

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
    enabled: !mock && !visitedPlace && !!geoid,
  })

  if (visitedPlace) {
    return { siblings: [], isLoading: false, isError: false }
  }

  if (mock) {
    return {
      siblings: getMockSiblings(ownSliceId, ownSiblingIndex, ownMemberCount ?? 0),
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
