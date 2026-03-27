import { createClient } from '@supabase/supabase-js'
import { AccountData } from './accountsApi'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLICE_ASSIGNMENTS: Array<{
  sliceType: string
  geoid: (j: NonNullable<AccountData['jurisdiction']>) => string
}> = [
  { sliceType: 'federal', geoid: (j) => j.congressional_district },
  { sliceType: 'state', geoid: (j) => j.state_senate_district },
  { sliceType: 'local', geoid: (j) => j.county },
  { sliceType: 'neighborhood', geoid: (j) => j.school_district },
]

async function findOrCreateSiblingSlice(
  sliceType: string,
  geoid: string
): Promise<string> {
  // Find max sibling_index for this (geoid, slice_type)
  const { data: existingSlices, error: queryError } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('sibling_index')
    .eq('slice_type', sliceType)
    .eq('geoid', geoid)
    .order('sibling_index', { ascending: false })
    .limit(1)

  if (queryError) throw new Error(`Failed to query slices: ${queryError.message}`)

  const maxSiblingIndex = existingSlices && existingSlices.length > 0
    ? existingSlices[0].sibling_index
    : 0

  const newSiblingIndex = maxSiblingIndex + 1

  const { data: newSlice, error: insertError } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .insert({ slice_type: sliceType, geoid, sibling_index: newSiblingIndex })
    .select('id')
    .single()

  if (insertError) {
    // On unique conflict (race condition), re-query and return the existing sibling
    if (insertError.code === '23505') {
      const { data: raceWinner, error: reQueryError } = await supabase
        .schema('civic_spaces')
        .from('slices')
        .select('id')
        .eq('slice_type', sliceType)
        .eq('geoid', geoid)
        .eq('sibling_index', newSiblingIndex)
        .single()

      if (reQueryError) throw new Error(`Failed to re-query after conflict: ${reQueryError.message}`)
      if (!raceWinner) throw new Error('Race condition re-query returned no result')
      return raceWinner.id as string
    }
    throw new Error(`Failed to insert sibling slice: ${insertError.message}`)
  }

  if (!newSlice) throw new Error('Slice insert returned no data')
  return newSlice.id as string
}

async function findActiveSliceForGeoid(
  sliceType: string,
  geoid: string
): Promise<string> {
  const { data, error } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('id')
    .eq('slice_type', sliceType)
    .eq('geoid', geoid)
    .lt('current_member_count', 6000)
    .order('sibling_index', { ascending: true })
    .limit(1)

  if (error) throw new Error(`Failed to query slices: ${error.message}`)

  if (data && data.length > 0) {
    return data[0].id as string
  }

  // No available slice — check if any slice exists at all
  const { data: anySlice, error: anyError } = await supabase
    .schema('civic_spaces')
    .from('slices')
    .select('id')
    .eq('slice_type', sliceType)
    .eq('geoid', geoid)
    .limit(1)

  if (anyError) throw new Error(`Failed to query slices: ${anyError.message}`)

  if (!anySlice || anySlice.length === 0) {
    // No slice exists at all — create the initial one
    const { data: initialSlice, error: insertError } = await supabase
      .schema('civic_spaces')
      .from('slices')
      .insert({ slice_type: sliceType, geoid, sibling_index: 1 })
      .select('id')
      .single()

    if (insertError) {
      // Race condition on initial creation
      if (insertError.code === '23505') {
        const { data: raceWinner, error: reQueryError } = await supabase
          .schema('civic_spaces')
          .from('slices')
          .select('id')
          .eq('slice_type', sliceType)
          .eq('geoid', geoid)
          .eq('sibling_index', 1)
          .single()

        if (reQueryError) throw new Error(`Failed to re-query after initial conflict: ${reQueryError.message}`)
        if (!raceWinner) throw new Error('Initial race condition re-query returned no result')
        return raceWinner.id as string
      }
      throw new Error(`Failed to insert initial slice: ${insertError.message}`)
    }

    if (!initialSlice) throw new Error('Initial slice insert returned no data')
    return initialSlice.id as string
  }

  // All slices are full — create a sibling
  return findOrCreateSiblingSlice(sliceType, geoid)
}

async function upsertSliceMember(
  userId: string,
  sliceId: string,
  retries = 3
): Promise<void> {
  const { error } = await supabase
    .schema('civic_spaces')
    .from('slice_members')
    .upsert(
      { user_id: userId, slice_id: sliceId },
      { onConflict: 'user_id,slice_id', ignoreDuplicates: true }
    )

  if (error) {
    if (error.message.includes('slice_full') || error.code === 'P0001') {
      if (retries <= 0) {
        throw new Error('Max retries exceeded for slice_full condition')
      }
      // Find the slice's type and geoid to locate/create a sibling
      const { data: sliceData, error: sliceQueryError } = await supabase
        .schema('civic_spaces')
        .from('slices')
        .select('slice_type, geoid')
        .eq('id', sliceId)
        .single()

      if (sliceQueryError || !sliceData) {
        throw new Error(`Failed to query slice for retry: ${sliceQueryError?.message}`)
      }

      const siblingId = await findOrCreateSiblingSlice(
        sliceData.slice_type as string,
        sliceData.geoid as string
      )
      return upsertSliceMember(userId, siblingId, retries - 1)
    }
    throw new Error(`Failed to upsert slice member: ${error.message}`)
  }
}

async function upsertConnectedProfile(
  userId: string,
  displayName: string,
  accountStanding: string
): Promise<void> {
  const { error } = await supabase
    .schema('civic_spaces')
    .from('connected_profiles')
    .upsert(
      { user_id: userId, display_name: displayName, account_standing: accountStanding },
      { onConflict: 'user_id' }
    )

  if (error) throw new Error(`Failed to upsert connected profile: ${error.message}`)
}

export async function assignUserToSlices(
  userId: string,
  jurisdiction: NonNullable<AccountData['jurisdiction']>
): Promise<{ assigned: string[] }> {
  const assigned: string[] = []

  for (const { sliceType, geoid: geoidFn } of SLICE_ASSIGNMENTS) {
    const geoid = geoidFn(jurisdiction)
    const sliceId = await findActiveSliceForGeoid(sliceType, geoid)
    await upsertSliceMember(userId, sliceId)
    assigned.push(sliceId)
  }

  return { assigned }
}

export { upsertConnectedProfile }
