import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { SliceType, SliceInfo } from '../types/database'

const GEO_SLICE_TYPES: SliceType[] = ['neighborhood', 'local', 'state', 'federal']

interface UseAllSlicesResult {
  slices: Partial<Record<SliceType, SliceInfo>>
  hasJurisdiction: boolean
  isLoading: boolean
}

async function fetchAllSlicesData(userId: string): Promise<{
  slices: Partial<Record<SliceType, SliceInfo>>
  hasJurisdiction: boolean
}> {
  // Step 1: Get all slice_ids this user belongs to
  const { data: memberships, error: memberError } = await supabase
    .from('slice_members')
    .select('slice_id')
    .eq('user_id', userId)

  if (memberError) throw memberError

  const hasJurisdiction = memberships != null && memberships.length > 0

  if (!hasJurisdiction) {
    return { slices: {}, hasJurisdiction: false }
  }

  const sliceIds = memberships.map((m) => m.slice_id)

  // Step 2: Find all geo slices among the user's slices (no slice_type filter)
  const { data: sliceRows, error: sliceError } = await supabase
    .from('slices')
    .select('id, slice_type, geoid, current_member_count')
    .in('id', sliceIds)

  if (sliceError) throw sliceError

  const slices: Partial<Record<SliceType, SliceInfo>> = {}

  for (const row of sliceRows ?? []) {
    const sliceType = row.slice_type as SliceType
    if (GEO_SLICE_TYPES.includes(sliceType)) {
      slices[sliceType] = {
        id: row.id,
        sliceType,
        geoid: row.geoid,
        memberCount: row.current_member_count,
      }
    }
  }

  return { slices, hasJurisdiction: true }
}

export function useAllSlices(userId: string | null): UseAllSlicesResult {
  const { data, isLoading } = useQuery({
    queryKey: ['all-slices', userId],
    queryFn: () => fetchAllSlicesData(userId!),
    enabled: !!userId,
  })

  return {
    slices: data?.slices ?? {},
    hasJurisdiction: data?.hasJurisdiction ?? false,
    isLoading,
  }
}
