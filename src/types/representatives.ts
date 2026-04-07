// NOTE: The `party` field intentionally omitted from this type — anti-partisan policy.
export interface PoliticianFlatRecord {
  id: string
  full_name: string
  office_title: string
  photo_origin_url: string
  district_type: string
  government_type: string
  is_vacant: boolean
  images: Array<{
    id: string
    url: string
    type: string
    photo_license: string
    focal_point: string | null
  }>
}

export const BRANCH_ORDER: Record<string, number> = {
  NATIONAL_EXEC: 0,
  STATE_EXEC: 1,
  LOCAL_EXEC: 2,
  NATIONAL_UPPER: 10,
  NATIONAL_LOWER: 11,
  STATE_UPPER: 12,
  STATE_LOWER: 13,
  COUNTY: 14,
  LOCAL: 15,
  SCHOOL: 16,
  NATIONAL_JUDICIAL: 20,
  JUDICIAL: 21,
}

export function getRepPhoto(rep: PoliticianFlatRecord): string | null {
  return rep.images[0]?.url ?? (rep.photo_origin_url || null)
}

// district_types relevant to each slice tab
const TAB_DISTRICT_TYPES: Record<string, string[]> = {
  federal:      ['NATIONAL_EXEC', 'NATIONAL_UPPER', 'NATIONAL_LOWER', 'NATIONAL_JUDICIAL'],
  state:        ['STATE_EXEC', 'STATE_UPPER', 'STATE_LOWER', 'JUDICIAL'],
  local:        ['COUNTY', 'LOCAL_EXEC'],
  neighborhood: ['LOCAL', 'SCHOOL'],
  unified:      Object.keys(BRANCH_ORDER),
  volunteer:    Object.keys(BRANCH_ORDER),
}

export function filterRepsByTab(reps: PoliticianFlatRecord[], tab: string): PoliticianFlatRecord[] {
  const allowed = TAB_DISTRICT_TYPES[tab]
  if (!allowed) return reps
  return reps.filter((r) => allowed.includes(r.district_type))
}
