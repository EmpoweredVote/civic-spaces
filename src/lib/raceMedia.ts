/**
 * Recorded debates and candidate forums, joined to a member's races.
 *
 * 🔴 EVERY ROW IS A RECORDING OF SOMETHING THAT ALREADY HAPPENED. All 45
 * `debate` and `forum` rows in the published list are `status: 'published'`, and
 * no upcoming debate is published anywhere in the stack — there is no schedule
 * to read. Nothing in this module or the one that renders it may word a
 * recording as a coming event: a member who clicks expecting a live debate has
 * been misled by us, not by the data. (A debate *schedule* is 16-09's reserved
 * room and a handoff ask.)
 *
 * 🔴 A forum is not a debate, and the record distinguishes them. One of
 * Bloomington's two matches is a League of Women Voters candidate forum — the
 * partner model in locked decision 7, already present in this data. Carry
 * `kind` through and let the UI label it.
 *
 * 🔴 No runtime imports, deliberately: the single import below is `import type`
 * and is erased, so this file can be run by `node --experimental-strip-types`
 * over a saved API response.
 */

import type { MemberRace } from './races'

/** The `/api/meetings` list record, narrowed to what the join reads. */
export interface MediaRow {
  id: string
  /** 🔴 Genuinely null on some published rows. Never invent one. */
  title: string | null
  /** 'debate' | 'forum' | 'news_clip' | 'podcast' | 'council' | ... */
  eventKind: string
  /** 'YYYY-MM-DD'. */
  date: string
  /**
   * 🔴 Usually NOT a URL. On 41 of the 45 live debate/forum rows this is a bare
   * YouTube id ('VnurpLQd4c0'); `sourceUrl` is the watchable address. Both are
   * put through isHttpUrl rather than trusted by name.
   */
  videoUrl: string | null
  sourceUrl: string | null
  /** The races this recording covers. 157 of 171 published rows carry them. */
  raceIds: string[] | null
  status: string
}

/** One recording, as a card renders it. */
export interface RaceRecording {
  id: string
  /**
   * The published title, or null. A null title is not a hole to fill with a
   * plausible one: the UI names the recording by its KIND and the race it
   * covers, both of which are record.
   */
  title: string | null
  /** The record's own word — 'debate' or 'forum'. */
  kind: string
  /** 'YYYY-MM-DD'. */
  date: string
  /**
   * A validated http(s) address, or null. Null is common and real: three of the
   * 45 live rows carry neither a source URL nor a playable video, including the
   * CNN California Governor debate and Bloomington's LWV forum. A card without a
   * link still names a recording that exists; a card with a broken one does not.
   */
  watchUrl: string | null
}

/** The two kinds this module carries. Everything else on the route is not a race event. */
const MEDIA_KINDS = new Set(['debate', 'forum'])

/**
 * Local copy of the href guard, because this module takes no runtime import —
 * see the header. `isHttpUrl` in exploreComposition.ts is the same three lines
 * and the same reasoning: React renders a `javascript:` href without complaint,
 * and these URLs are first-party but SCRAPED.
 */
function httpUrlOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

/** Published debates and forums that name at least one race. The other 126 rows are noise. */
export function isRaceMedia(row: MediaRow): boolean {
  return (
    row.status === 'published' &&
    MEDIA_KINDS.has(row.eventKind) &&
    Array.isArray(row.raceIds) &&
    row.raceIds.length > 0
  )
}

function toRecording(row: MediaRow): RaceRecording {
  return {
    id: row.id,
    title: row.title,
    kind: row.eventKind,
    date: row.date,
    // sourceUrl first: videoUrl is a bare YouTube id on all but one live row.
    watchUrl: httpUrlOrNull(row.sourceUrl) ?? httpUrlOrNull(row.videoUrl),
  }
}

/**
 * Recordings by race id. Only a race that HAS one gets an entry, so a module can
 * render exactly the races with media and never an empty card.
 *
 * Newest first, capped — a race with a dozen clips is a list nobody reads, and
 * the most recent recording is the one that describes the race as it stands.
 */
export function joinMediaToRaces(
  media: readonly MediaRow[] | undefined,
  races: readonly MemberRace[],
  perRaceLimit = 3,
): Map<string, RaceRecording[]> {
  const byRace = new Map<string, RaceRecording[]>()
  if (!media || races.length === 0) return byRace
  const wanted = new Set(races.map((race) => race.raceId))
  const rows = [...media]
    .filter(isRaceMedia)
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const row of rows) {
    for (const raceId of row.raceIds ?? []) {
      if (!wanted.has(raceId)) continue
      const existing = byRace.get(raceId)
      if (!existing) byRace.set(raceId, [toRecording(row)])
      else if (existing.length < perRaceLimit) existing.push(toRecording(row))
    }
  }
  return byRace
}

/** True when any of these races has a recording — the Debates module's availability. */
export function hasAnyRaceMedia(
  byRace: ReadonlyMap<string, RaceRecording[]>,
  races: readonly MemberRace[],
): boolean {
  return races.some((race) => (byRace.get(race.raceId)?.length ?? 0) > 0)
}
