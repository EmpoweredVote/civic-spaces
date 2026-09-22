import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface FederalSliceResult {
  id: string
  geoid: string
  memberCount: number
}

interface UseFederalSliceResult {
  federalSlice: FederalSliceResult | null
  hasJurisdiction: boolean
  isLoading: boolean
}

async function fetchFederalSliceData(userId: string): Promise<{
  federalSlice: FederalSliceResult | null
  hasJurisdiction: boolean
}> {
  // Step 1: Get all slice_ids this user belongs to
  const { data: memberships, error: memberError } = await supabase
    .schema('civic_spaces')
    .from('slice_members')
    .select('slice_id')
    .eq('user_id', userId)

  if (memberError) throw memberError

  const hasJurisdiction = memberships != null && memberships.length > 0

  if (!hasJurisdiction) {
    return { federalSlice: null, hasJurisdiction: false }
  }

  const sliceIds = memberships.map((m) => m.slice_id)

  // Step 2: Find the federal slice among the user's slices
  const { data: federalSlice, error: sliceError } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('id, slice_type, geoid, current_member_count')
    .in('id', sliceIds)
    .eq('slice_type', 'federal')
    .single()

  if (sliceError) {
    // No federal slice found (PGRST116 = no rows)
    if (sliceError.code === 'PGRST116') {
      return { federalSlice: null, hasJurisdiction: true }
    }
    throw sliceError
  }

  return {
    federalSlice: {
      id: federalSlice.id,
      geoid: federalSlice.geoid,
      memberCount: federalSlice.current_member_count,
    },
    hasJurisdiction: true,
  }
}

export function useFederalSlice(userId: string | null): UseFederalSliceResult {
  const { data, isLoading } = useQuery({
    queryKey: ['federal-slice', userId],
    queryFn: () => fetchFederalSliceData(userId!),
    enabled: !!userId,
  })

  return {
    federalSlice: data?.federalSlice ?? null,
    hasJurisdiction: data?.hasJurisdiction ?? false,
    isLoading,
  }
}
