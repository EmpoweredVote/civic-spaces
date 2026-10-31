import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/** `civic_spaces.get_public_slice` — the lowest-indexed shard of a public place. */
export interface PublicSliceRow {
  slice_id: string
  slice_type: string
  geoid: string
  sibling_index: number
}

/**
 * Does this public place have a `slices` row at all?
 *
 * 🔴 This hook exists for ONE SENTENCE, and the sentence is the point. An empty
 * public feed has two causes and they mean opposite things to a visitor:
 *
 *   - a space exists and nobody has posted in it     → "no conversations here yet"
 *   - no space exists, because nobody lives here yet → "this one hasn't opened"
 *
 * `get_public_feed` cannot tell them apart: it joins through `get_public_slice` and
 * returns zero rows either way. Phase 17 could not tell them apart either and said
 * so in AppShell's own comment — an observer could not read `slices` at all, so it
 * wrote one paragraph true of both. Phase 18 can ask, so it must: rendering "nobody
 * has posted here" over a place that does not exist is the empty-feed lie this
 * codebase names in writeAccess.ts, pointed the other way.
 *
 * 🔴 It returns existence and `sibling_index`, never a member count. D-34 withholds
 * counts from readers with no account, and the RPC does not return one to withhold.
 *
 * @param enabled gate it the way the feed is gated — all six panels mount at once.
 */
export function usePublicSlice(sliceType: string | null, geoid: string | null, enabled = true) {
  return useQuery<PublicSliceRow | null, Error>({
    queryKey: ['public-slice', sliceType ?? '', geoid ?? ''],
    queryFn: async () => {
      // No backend locally (CLAUDE.md), and the fixture feed is non-empty, so the
      // honest local answer is "the space exists".
      if (!import.meta.env.VITE_SUPABASE_URL) {
        return sliceType === 'volunteer'
          ? null
          : { slice_id: 'mock-public-slice', slice_type: sliceType!, geoid: geoid!, sibling_index: 1 }
      }

      const { data, error } = await supabase.schema('civic_spaces').rpc('get_public_slice', {
        p_slice_type: sliceType,
        p_geoid: geoid,
      })

      if (error) throw error
      // 🔴 Zero rows is a RESULT, not a failure: most places have no row, because
      // rows are created on demand by /assign and 15 exist in the whole product.
      return ((data ?? []) as PublicSliceRow[])[0] ?? null
    },
    enabled: enabled && !!sliceType && geoid !== null,
  })
}
