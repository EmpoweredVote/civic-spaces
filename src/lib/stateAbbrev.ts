/**
 * Maps 2-digit state FIPS codes to USPS abbreviations.
 *
 * Essentials' coverage catalog keys its `states[]` records by abbrev, while slice
 * geoids carry FIPS — this bridges the two. Keys mirror STATE_FIPS in
 * ./geoidToWiki.ts exactly (50 states + DC); keep the two tables in step.
 */
const STATE_ABBREV: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
}

/**
 * USPS abbreviation for the state a geoid belongs to, from its first 2 digits.
 * Returns null for a short, empty or unrecognised geoid (territories included —
 * the catalog covers 50 states + DC only).
 */
export function stateAbbrevFromGeoid(geoid: string): string | null {
  if (geoid.length < 2) return null
  return STATE_ABBREV[geoid.slice(0, 2)] ?? null
}
