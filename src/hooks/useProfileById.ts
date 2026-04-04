import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ConnectedProfile } from '../types/database'

interface ProfileByIdResult {
  profile: Pick<ConnectedProfile, 'user_id' | 'display_name' | 'avatar_url' | 'tier' | 'created_at'> | null
  sliceName: string | null
  isLoading: boolean
  error: Error | null
}

async function fetchProfileById(userId: string): Promise<{
  profile: Pick<ConnectedProfile, 'user_id' | 'display_name' | 'avatar_url' | 'tier' | 'created_at'> | null
  sliceName: string | null
}> {
  const { data: profileData, error: profileError } = await supabase
    .from('connected_profiles')
    .select('user_id, display_name, avatar_url, tier, created_at')
    .eq('user_id', userId)
    .single()

  if (profileError) throw profileError

  // Fetch federal slice name for this user
  const { data: memberData } = await supabase
    .from('slice_members')
    .select('slice_id, slices(slice_type, geoid)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  let sliceName: string | null = null
  if (memberData?.slices) {
    const slicesRaw = memberData.slices as unknown as { slice_type: string; geoid: string }[]
    const sliceInfo = slicesRaw[0]
    if (sliceInfo) {
      sliceName = `${sliceInfo.slice_type} · ${sliceInfo.geoid}`
    }
  }

  return {
    profile: profileData ?? null,
    sliceName,
  }
}

export function useProfileById(userId: string | null): ProfileByIdResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfileById(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    profile: data?.profile ?? null,
    sliceName: data?.sliceName ?? null,
    isLoading,
    error: error as Error | null,
  }
}
