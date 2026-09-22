// NOTE: The `party` field intentionally omitted from this type — anti-partisan policy.
export interface PoliticianFlatRecord {
  id: string
  full_name: string
  office_title: string
  photo_origin_url: string
  district_type: string
  government_type: string
  is_vacant: boolean
  is_elected: boolean | null
  images: Array<{
    id: string
    url: string
    type: string
    photo_license: string
    focal_point: string | null
  }>
}

export const BRANCH_ORDER: Record<string, number> = {
  // Federal: executive → legislative → judicial
  NATIONAL_EXEC: 0,
  NATIONAL_UPPER: 1,
  NATIONAL_LOWER: 2,
  NATIONAL_JUDICIAL: 3,
  // State: executive → legislative → judicial
  STATE_EXEC: 10,
  STATE_UPPER: 11,
  STATE_LOWER: 12,
  JUDICIAL: 13,
  // Local
  LOCAL_EXEC: 20,
  COUNTY: 21,
  LOCAL: 22,
  SCHOOL: 23,
}

export function getRepPhoto(rep: PoliticianFlatRecord): string | null {
  return rep.images[0]?.url ?? (rep.photo_origin_url || null)
}

// district_types relevant to each slice tab. Omitting a tab key means "show all".
const TAB_DISTRICT_TYPES: Record<string, string[]> = {
  federal:      ['NATIONAL_EXEC', 'NATIONAL_UPPER', 'NATIONAL_LOWER'],
  state:        ['STATE_EXEC', 'STATE_UPPER', 'STATE_LOWER', 'JUDICIAL'],
  local:        ['COUNTY'],
  neighborhood: ['LOCAL', 'LOCAL_EXEC', 'SCHOOL'],
  unified:      [],
  volunteer:    [],
}

export function filterRepsByTab(reps: PoliticianFlatRecord[], tab: string): PoliticianFlatRecord[] {
  const allowed = TAB_DISTRICT_TYPES[tab]
  if (!allowed) return reps
  return reps.filter((r) => allowed.includes(r.district_type))
}
