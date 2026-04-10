import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { SliceType, SliceInfo } from '../types/database'

async function fetchProfileSlices(userId: string): Promise<Partial<Record<SliceType, SliceInfo>>> {
  // Step 1: Get all slice_ids this user belongs to
  const { data: memberships, error: memberError } = await supabase
    .schema('civic_spaces')
    .from('slice_members')
    .select('slice_id')
    .eq('user_id', userId)

  if (memberError) throw memberError

  if (!memberships || memberships.length === 0) {
    return {}
  }

  const sliceIds = memberships.map((m) => m.slice_id)

  // Step 2: Find all slices the user belongs to
  const { data: sliceRows, error: sliceError } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('id, slice_type, geoid, current_member_count, sibling_index')
    .in('id', sliceIds)

  if (sliceError) throw sliceError

  const slices: Partial<Record<SliceType, SliceInfo>> = {}

  for (const row of sliceRows ?? []) {
    const sliceType = row.slice_type as SliceType
    slices[sliceType] = {
      id: row.id,
      sliceType,
      geoid: row.geoid,
      memberCount: row.current_member_count,
      siblingIndex: row.sibling_index,
    }
  }

  return slices
}

export function useProfileSlices(userId: string | null): {
  slices: Partial<Record<SliceType, SliceInfo>>
  isLoading: boolean
} {
  const { data, isLoading } = useQuery({
    queryKey: ['profile-slices', userId],
    queryFn: () => fetchProfileSlices(userId!),
    enabled: !!userId,
  })

  return {
    slices: data ?? {},
    isLoading,
  }
}
