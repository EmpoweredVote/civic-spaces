import { useQuery } from '@tanstack/react-query'
import type { SliceInfo, SliceType } from '../types/database'
import { isSyntheticUserId, MOCK_ELECTIONS } from '../lib/devMockData'

/**
 * Essentials' public elections lookup, served by ev-accounts. No auth, and it takes a
 * Census geoid plus its TIGER feature class — no address, no coordinates, so nothing
 * here geocodes. Production allows civicspaces.empowered.vote; localhost gets no CORS
 * header, which is why the dev id answers from a fixture.
 */
const ELECTIONS_URL = 'https://api.empowered.vote/api/essentials/browse/elections-by-area'

/** TIGER MTFCC for each geoid-bearing slice type: incorporated place, county, state. */
const MTFCC: Partial<Record<SliceType, string>> = {
  city: 'G4110',
  county: 'G4020',
  state: 'G4000',
}

export interface ElectionArea {
  geoid: string
  mtfcc: string
}

/** The response fields this app reads. Races and candidates are ignored here. */
export interface ElectionRecord {
  election_id: string
  election_name: string
  /** 'YYYY-MM-DD', a calendar date with no time zone. */
  election_date: string
  election_type: string
}

export interface NextElection {
  name: string
  /** 'YYYY-MM-DD' */
  date: string
}

/**
 * Which area to ask about for a tab. City, county and state ask about themselves.
 * Federal, Unified and Volunteer have no area of their own (federal's geoid is 'US'),
 * so they ask about the member's state — the ballot where their federal races appear.
 */
export function electionAreaFor(slice: SliceInfo | undefined, stateSlice: SliceInfo | undefined): ElectionArea | null {
  if (slice) {
    const mtfcc = MTFCC[slice.sliceType]
    if (mtfcc && slice.geoid) return { geoid: slice.geoid, mtfcc }
  }
  if (stateSlice?.geoid) return { geoid: stateSlice.geoid, mtfcc: 'G4000' }
  return null
}

/** Today as 'YYYY-MM-DD' in the viewer's own time zone, to compare with election_date. */
export function localIsoDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Whole days from today (local) until an election_date. 0 means today. */
export function daysUntil(date: string, now = new Date()): number {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(y!, m! - 1, d!)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/**
 * The earliest election on or after today. The endpoint also returns recent past
 * elections (primaries for 30 days after, generals until Jan 1), so this filter is
 * required, not defensive.
 */
export function pickNextElection(elections: ElectionRecord[], today = localIsoDate()): NextElection | null {
  const next = elections
    .filter((e) => e.election_date >= today)
    .sort((a, b) => a.election_date.localeCompare(b.election_date))[0]
  return next ? { name: next.election_name, date: next.election_date } : null
}

async function fetchElections(area: ElectionArea, userId: string | null): Promise<ElectionRecord[]> {
  // Same boundary as useRepresentatives: only the reserved dev id ever sees fixtures.
  const synthetic = isSyntheticUserId(userId)
  try {
    const res = await fetch(ELECTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geo_id: area.geoid, mtfcc: area.mtfcc }),
    })
    if (!res.ok) throw new Error(`Failed to fetch elections: ${res.status}`)
    const data = (await res.json()) as { elections?: ElectionRecord[] }
    return data.elections ?? []
  } catch (err) {
    if (synthetic) return MOCK_ELECTIONS
    throw err
  }
}

/**
 * The next election for an area.
 * - `undefined` = still loading, or the lookup failed (the banner shows nothing)
 * - `null`      = answered, and nothing upcoming is on file for this area
 */
export function useNextElection(area: ElectionArea | null, userId: string | null): NextElection | null | undefined {
  const { data, isSuccess } = useQuery({
    queryKey: ['next-election', area?.geoid, area?.mtfcc, userId],
    queryFn: () => fetchElections(area!, userId),
    enabled: !!area,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
  if (!area || !isSuccess) return undefined
  return pickNextElection(data)
}
