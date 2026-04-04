export interface AccountData {
  id: string
  display_name: string
  tier: 'inform' | 'connected' | 'empowered'
  account_standing: 'active' | 'suspended'
  jurisdiction: {
    congressional_district: string
    state_senate_district: string
    state_house_district: string
    county: string
    school_district: string
  } | null
  // TODO(volunteer-role): The accounts team is finalizing the role field name.
  // When confirmed, add the real field here (e.g., roles?: string[], is_volunteer?: boolean).
  // Then update hasVolunteerRole() in sliceAssigner.ts to read it.
}

export async function fetchAccountData(token: string): Promise<AccountData> {
  const url = `${process.env.ACCOUNTS_API_URL}/api/account/me`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Accounts API returned ${response.status}: ${body}`)
  }

  return response.json() as Promise<AccountData>
}
