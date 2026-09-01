export interface AccountData {
  id: string
  display_name: string
  tier: 'inform' | 'connected' | 'empowered'
  account_standing: 'active' | 'suspended'
  // Every field is nullable in practice, whatever the API's own docs imply. A point
  // can sit outside a layer we hold: a Buncombe County, NC address on 2026-09-01
  // resolved a county, a congressional district and a senate district but NO school
  // district, because no school-district boundary covers it. Typing these as
  // non-null hid that until it reached a NOT NULL column at runtime.
  jurisdiction: {
    congressional_district: string | null
    state_senate_district: string | null
    state_house_district: string | null
    county: string | null
    school_district: string | null
  } | null
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

// Volunteer role is a separate role-grant system, not part of AccountData.
// POST /api/roles/check returns { permitted: boolean } — always present, never omitted.
// Results are cached server-side for up to 90 seconds, so revocation may lag by that window.
// jurisdiction_geoid: null checks for an unrestricted (platform-scope) volunteer grant.
export async function checkVolunteerRole(token: string): Promise<boolean> {
  const url = `${process.env.ACCOUNTS_API_URL}/api/roles/check`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feature_scope: 'volunteer', jurisdiction_geoid: null }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Roles check API returned ${response.status}: ${body}`)
  }

  const { permitted } = await response.json() as { permitted: boolean }
  return permitted
}
