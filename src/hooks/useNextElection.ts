import { useQuery } from '@tanstack/react-query'
import { EV_API_ORIGIN } from '../lib/evApi'
import type { SliceInfo, SliceType } from '../types/database'
import { isSyntheticUserId, MOCK_ELECTIONS } from '../lib/devMockData'

/**
 * Essentials' public elections lookup, served by ev-accounts. No auth, and it takes a
 * Census geoid plus its TIGER feature class — no address, no coordinates, so nothing
 * here geocodes. In local dev it goes through the /api proxy, so the dev id sees real
 * elections; the fixture is only the offline fallback.
 */
const ELECTIONS_URL = `${EV_API_ORIGIN}/api/essentials/browse/elections-by-area`

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

/**
 * One candidate on a race.
 *
 * `primary_party` and `result` are on the wire and deliberately absent here:
 * both are null on every row today (a general election, pre-vote), and a field
 * nothing may render is a field someone will render. Add them when they carry
 * something.
 */
export interface CandidateRecord {
  candidate_id: string
  full_name: string
  photo_url: string | null
  is_incumbent: boolean
  /**
   * 🔴 'active' | 'withdrawn'. The LIST route does not filter; we must.
   * Verified live 2026-10-24: 1486 active, 4 withdrawn across the corpus.
   * `getCandidateById` filters server-side, which is why this is easy to miss.
   */
  candidate_status: string
  is_write_in: boolean
  politician_id: string | null
}

export interface RaceRecord {
  race_id: string
  position_name: string
  seats: number
  /**
   * 🔴 Unreliable for statewide offices — see src/lib/races.ts. Never classify
   * on it alone: `Comptroller (Auditor of State)` and `Treasurer of State`
   * arrive as LOCAL while `Secretary of State` arrives as STATE_EXEC.
   */
  district_type: string | null
  candidates: CandidateRecord[]
}

/**
 * The response fields this app reads. A SUBSET of the response, not a contract —
 * which is why widening it is additive and disturbs neither `pickNextElection`
 * nor the hero banner.
 */
export interface ElectionRecord {
  election_id: string
  election_name: string
  /** 'YYYY-MM-DD', a calendar date with no time zone. */
  election_date: string
  election_type: string
  /**
   * 🔴 OPTIONAL, both of them, and deliberately so.
   *
   * MOCK_ELECTIONS (devMockData.ts) is the offline fallback for the dev id and
   * carries neither — it was written when this type was four fields. A required
   * `races` would make the fixture a type error, and the only ways to fix that
   * are to delete the fallback or to write candidate names into it. The second
   * is inventing civic record: a fixture full of plausible candidates for real
   * offices is exactly what the anti-goal forbids, and it would be the first
   * thing anyone reaches for to get a green build.
   *
   * Optional also matches the wire: a future route that omits races must
   * degrade to an empty module, not a crash. Every consumer therefore reads
   * `e.races ?? []`.
   */
  jurisdiction_level?: string
  races?: RaceRecord[]
}

export interface NextElection {
  name: string
  /** 'YYYY-MM-DD' */
  date: string
}

/**
 * Which area to ask about for a tab's ELECTION CALENDAR — when the next election
 * is. City, county and state ask about themselves. Federal, Unified and
 * Volunteer have no area of their own (federal's geoid is 'US'), so they fall
 * back to the member's state, which is right for a date: every area asked on
 * 2026-10-24 answered 2026-11-03.
 *
 * 🔴 NOT the area to ask for RACES. That is `racesAreaFor` in
 * src/lib/exploreComposition.ts, and the difference is this one's state
 * fallback:
 *   - a state area returns EVERY congressional district (Indiana: all 9) where
 *     the member has one (Bloomington's city area: District 9 alone), and
 *   - a state area OMITS statewide races (North Carolina's has no US Senate
 *     race; California's has no Governor) — wrong in both directions at once.
 *
 * The two functions differ by exactly that fallback, so they look mergeable and
 * are not. Merging them silently reintroduces the nine-House-races bug.
 * `racesAreaFor` returns null rather than falling back; a member with neither a
 * city nor a county slice gets no races module, which is the honest answer.
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
 * The raw election list for an area. One query, shared by the banner, the events
 * widget and the races modules — keyed by `(geoid, mtfcc, userId)`, so two
 * callers asking about the same area cost one request.
 *
 * Exported for `useRacesForArea` below, which asks about a DIFFERENT area on the
 * Federal and State tabs and is a cache hit on City.
 */
export function useElectionsQuery(area: ElectionArea | null, userId: string | null) {
  return useQuery({
    queryKey: ['next-election', area?.geoid, area?.mtfcc, userId],
    queryFn: () => fetchElections(area!, userId),
    enabled: !!area,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
}

/**
 * The next election for an area.
 * - `undefined` = still loading, or the lookup failed (the banner shows nothing)
 * - `null`      = answered, and nothing upcoming is on file for this area
 */
export function useNextElection(area: ElectionArea | null, userId: string | null): NextElection | null | undefined {
  const { data, isSuccess } = useElectionsQuery(area, userId)
  if (!area || !isSuccess) return undefined
  return pickNextElection(data)
}

export interface UpcomingElection extends NextElection {
  /** 'general', 'primary', ... as Essentials records it. */
  type: string
}

/**
 * Every election on or after today for an area, soonest first.
 * `elections` is undefined until answered — and stays undefined on failure, which
 * `isLoading` (false once settled either way) tells apart from still-waiting.
 */
export function useUpcomingElections(
  area: ElectionArea | null,
  userId: string | null,
): { elections: UpcomingElection[] | undefined; isLoading: boolean } {
  const { data, isSuccess, isLoading } = useElectionsQuery(area, userId)
  if (!area || !isSuccess) return { elections: undefined, isLoading: !!area && isLoading }
  const today = localIsoDate()
  const elections = data
    .filter((e) => e.election_date >= today)
    .sort((a, b) => a.election_date.localeCompare(b.election_date))
    .map((e) => ({ name: e.election_name, date: e.election_date, type: e.election_type }))
  return { elections, isLoading: false }
}

/**
 * Every election the member's MOST LOCAL area returns, with its races attached.
 *
 * 🔴 The area comes from `racesAreaFor` (src/lib/exploreComposition.ts), never
 * from `electionAreaFor`. See the note on that function: a state-area query
 * returns nine House races the member cannot choose between AND omits the
 * statewide ones. Federal geoid 'US' returns HTTP 500 and 'UNIFIED' is not a
 * place; `racesAreaFor` answers null rather than inventing a fallback.
 *
 * 🔴 It returns ELECTIONS, not races, because an area can return more than one
 * and each race has to keep its election's name and date. Los Angeles' city area
 * returns two — an LA County General carrying the Mayor and a CA Statewide
 * General carrying the Governor — so a single-election assumption silently loses
 * the Governor. `racesForLevel` (src/lib/races.ts) does the flatten.
 *
 * On the City tab this is the same `(geoid, mtfcc)` the banner already asked
 * about, so it costs nothing. On Federal and State it is one extra request per
 * member, deliberately, and it is the whole correctness fix.
 *
 * `elections` stays undefined while loading AND on failure; `isLoading` (false
 * once settled either way) tells the two apart.
 */
export function useRacesForArea(
  area: ElectionArea | null,
  userId: string | null,
): { elections: ElectionRecord[] | undefined; isLoading: boolean } {
  const { data, isSuccess, isLoading } = useElectionsQuery(area, userId)
  if (!area || !isSuccess) return { elections: undefined, isLoading: !!area && isLoading }
  return { elections: data, isLoading: false }
}
