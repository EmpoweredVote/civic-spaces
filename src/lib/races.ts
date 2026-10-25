/**
 * The member's own races, from the elections response their MOST LOCAL area
 * returns.
 *
 * 🔴 This module has no runtime imports, deliberately — the two imports below
 * are `import type` and are erased, so `node --experimental-strip-types` can
 * load this file and run the SHIPPED functions rather than a transcription of
 * them. Adding a value import here (devMockData, React, anything) would make
 * that impossible and the only check this code has would start testing a copy.
 *
 * Four jobs, in order: merge across elections, drop withdrawn candidates,
 * classify each race to a level BY ITS OFFICE NAME, and sort within a level.
 *
 * 🔴 Everything here is a published civic record carried verbatim. No name is
 * reworded, shortened or title-cased on its way through: `position_name` is the
 * office as the state records it and `full_name` is the candidate as they filed.
 */

import type { CandidateRecord, ElectionRecord, RaceRecord } from '../hooks/useNextElection'

/**
 * 'other' is every race that is neither federal nor state — township boards,
 * county offices, circuit judges, school boards, city councils.
 *
 * It is a real answer, not a failure: Explore puts races on Federal and State
 * (16-DESIGN decision 8), so an 'other' race is shown on neither. See
 * classifyRace for why that is the right failure mode.
 */
export type RaceLevel = 'federal' | 'state' | 'other'

export interface MemberCandidate {
  id: string
  /** Verbatim, as filed. */
  name: string
  photoUrl: string | null
  isIncumbent: boolean
  isWriteIn: boolean
  politicianId: string | null
}

export interface MemberRace {
  raceId: string
  /** Verbatim, as the state records the office. */
  positionName: string
  seats: number
  districtType: string | null
  level: RaceLevel
  /** The election this race belongs to — an area can return more than one. */
  electionName: string
  /** 'YYYY-MM-DD'. */
  electionDate: string
  /** Active only. A race with none is dropped before it gets this far. */
  candidates: MemberCandidate[]
}

// ── Classification ──────────────────────────────────────────────────────────

/**
 * A federal office, by name. Generous on the US-office prefixes because the
 * corpus spells them several ways: `U.S. Representative District 9`,
 * `U.S. Senate North Carolina`, `United States Senator`.
 */
const FEDERAL_NAME =
  /\b(?:u\.?\s?s\.?|united\s+states)\s+(?:senat(?:e|or)|represent|house|congress)|\b(?:member\s+of\s+congress|congressional\s+district)\b/i

/**
 * 🔴 Tested BEFORE any state pattern, and it is what keeps a county office off
 * the State tab.
 *
 * `Treasurer of State` and `Comptroller (Auditor of State)` are statewide and
 * arrive as district_type LOCAL, so the state test below has to match bare
 * office titles — `Treasurer`, `Comptroller`, `Controller`, `Auditor`. Those
 * same words name a county office in almost every county in the country
 * (`Monroe County Treasurer`), and without this guard every one of them would
 * be promoted onto the State tab.
 *
 * Deliberately NOT in here: a bare `district`. `U.S. Representative District 9`
 * and `State Representative, District 061` both carry it.
 */
const LOCAL_BODY_NAME =
  /\b(?:count(?:y|ies)|city|cities|town|township|village|borough|parish|municipal|school|college|precinct|ward|district\s+attorney|prosecuting\s+attorney|circuit\s+court|superior\s+court|district\s+court|probate|justice\s+of\s+the\s+peace|coroner|constable|sheriff|assessor|recorder|mayor|alderman|councilmember|council\s+district|trustee)\b/i

/** A state legislature or a state board: `State Representative`, `State Senate District 20`. */
const STATE_BODY_NAME = /^state\b|\bstate\s+(?:senat(?:e|or)|house|assembly|represent|delegate|board)\b/i

/**
 * The statewide executive offices, as the corpus spells them. Verified live
 * 2026-10-24 against Indiana, California and North Carolina.
 *
 * `Controller` and `Comptroller` are both here: California records its statewide
 * office as `Controller` and Indiana as `Comptroller (Auditor of State)`.
 */
const STATE_EXEC_NAME =
  /\b(?:governor|lieutenant\s+governor|attorney\s+general|secretary\s+of\s+state|treasurer|comptroller|controller|auditor|superintendent|insurance\s+commissioner|commissioner\s+of\s+(?:agriculture|labor|insurance))\b/i

/** district_type values that are unambiguous about their level. Tiebreak only. */
const FEDERAL_DISTRICT_TYPE = /^national[_-]/i
const STATE_DISTRICT_TYPE = /^state[_-]/i

/**
 * Which tab a race belongs on.
 *
 * 🔴 By OFFICE NAME first. `district_type` is unreliable for exactly the offices
 * that matter most here, verified live: `Comptroller (Auditor of State)` and
 * `Treasurer of State` arrive as `LOCAL`, while `Secretary of State` arrives as
 * `STATE_EXEC`. Classifying on it alone drops two of Indiana's three statewide
 * offices off the State tab and leaves the third.
 *
 * `district_type` is consulted LAST, and only when the name decided nothing: it
 * is the hedge for an office spelled in a way nobody anticipated, and a
 * `NATIONAL_*` or `STATE_*` value is a real signal when there is nothing else.
 * It never overrides a name match.
 *
 * 🔴 An unclassified race is 'other' and is shown on neither tab. Showing a race
 * on the wrong level is the exact mismatch this phase exists to remove, and a
 * heuristic over free text WILL meet a name nobody anticipated. Silence is the
 * correct failure: a member who cannot see a race is missing something, a member
 * shown someone else's race has been told something untrue.
 */
export function classifyRace(positionName: string, districtType: string | null): RaceLevel {
  const name = positionName ?? ''
  if (FEDERAL_NAME.test(name)) return 'federal'
  // 🔴 Before the state tests. See LOCAL_BODY_NAME.
  if (LOCAL_BODY_NAME.test(name)) return 'other'
  if (STATE_BODY_NAME.test(name) || STATE_EXEC_NAME.test(name)) return 'state'
  if (districtType) {
    if (FEDERAL_DISTRICT_TYPE.test(districtType)) return 'federal'
    if (STATE_DISTRICT_TYPE.test(districtType)) return 'state'
  }
  return 'other'
}

// ── Sorting ─────────────────────────────────────────────────────────────────

/** Senate before House, then anything else. */
function federalRank(name: string): number {
  if (/\bsenat(?:e|or)\b/i.test(name)) return 0
  if (/\b(?:represent|house)\b/i.test(name)) return 1
  return 2
}

/**
 * Statewide executives before the legislature. The exec test runs first because
 * `Secretary of State` and `State Senate District 20` both contain 'state'.
 */
function stateRank(name: string): number {
  if (STATE_BODY_NAME.test(name)) return 1
  if (STATE_EXEC_NAME.test(name)) return 0
  return 2
}

// ── Merge, filter, classify ─────────────────────────────────────────────────

/**
 * 🔴 The LIST route returns withdrawn candidates; only `getCandidateById`
 * filters. 4 of 1490 across the live corpus, which is few enough to look like a
 * clean dataset right up until a member reads a withdrawn name as a choice.
 */
function activeCandidates(race: RaceRecord): MemberCandidate[] {
  return (race.candidates ?? [])
    .filter((candidate: CandidateRecord) => candidate.candidate_status === 'active')
    .map((candidate) => ({
      id: candidate.candidate_id,
      name: candidate.full_name,
      photoUrl: candidate.photo_url,
      isIncumbent: !!candidate.is_incumbent,
      isWriteIn: !!candidate.is_write_in,
      politicianId: candidate.politician_id,
    }))
}

/**
 * Every race the area returned, across every election it returned, with
 * withdrawn candidates dropped and a level attached.
 *
 * 🔴 Flattened across elections. Los Angeles' city area returns two — a 2026 LA
 * County General carrying the Mayor and a CA Statewide General carrying the
 * Governor — so reading only the first loses the Governor entirely.
 *
 * A race left with no active candidate is dropped: an office with nobody
 * standing is not something a member can do anything with, and an empty card
 * reads as a loading failure.
 */
export function memberRaces(elections: readonly ElectionRecord[] | undefined): MemberRace[] {
  if (!elections) return []
  const races: MemberRace[] = []
  for (const election of elections) {
    for (const race of election.races ?? []) {
      const candidates = activeCandidates(race)
      if (candidates.length === 0) continue
      races.push({
        raceId: race.race_id,
        positionName: race.position_name,
        seats: race.seats,
        districtType: race.district_type,
        level: classifyRace(race.position_name, race.district_type),
        electionName: election.election_name,
        electionDate: election.election_date,
        candidates,
      })
    }
  }
  return races
}

/**
 * The races for one tab, sorted — Senate before House on Federal, statewide
 * executives before the legislature on State. Stable: ties keep the order the
 * API sent, so a reload never reshuffles the page.
 *
 * `'other'` is a level nothing asks for by design; passing it returns those
 * races in source order, which is what makes it checkable.
 */
export function racesForLevel(
  elections: readonly ElectionRecord[] | undefined,
  level: RaceLevel,
): MemberRace[] {
  const rank = level === 'federal' ? federalRank : level === 'state' ? stateRank : () => 0
  return memberRaces(elections)
    .filter((race) => race.level === level)
    .map((race, index) => ({ race, index, rank: rank(race.positionName) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.race)
}
