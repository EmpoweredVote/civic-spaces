import { useQuery } from '@tanstack/react-query'
import { EV_API_ORIGIN } from '../lib/evApi'

/**
 * The most recently published council agenda for a city, and its items.
 *
 * Two public, unauthenticated requests — the list record carries 27 fields and
 * no agenda items, so the items are a second route:
 *
 *   GET /api/meetings?city=&state=&status=scheduled
 *   GET /api/meetings/:id/agenda-items
 *
 * In local dev both go through the `/api` proxy in vite.config.ts.
 *
 * 🔴 NOT useUpcomingMeetings. That hook keeps only meetings still in the future
 * (useUpcomingMeetings.ts:43-45) and it returns zero rows much of the time —
 * Bloomington's four scheduled meetings are 2026-08-05, 09-02, 09-16 and
 * 10-14, all of them already heard. An agenda that has been heard is still the
 * best published description of what a council is working on; an empty module
 * for half the year is not. So: the most recent agenda, not the next one.
 *
 * 🔴 But not an indefinitely old one either. Beyond AGENDA_FRESHNESS_DAYS this
 * returns undefined rather than presenting a three-month-old agenda as current
 * — "what the council is working on" stops being true long before the row
 * disappears (16-RESEARCH Pitfall 3).
 *
 * Coverage is one city nationally (Bloomington, IN; Asheville has zero meetings
 * and Los Angeles zero council rows), so undefined is the common, honest answer.
 */
const MEETINGS_URL = `${EV_API_ORIGIN}/api/meetings`

/**
 * How old the newest published agenda may be and still describe what this body
 * is working on. Bloomington's council meets roughly fortnightly, so 45 days
 * spans a summer recess without reaching back into the previous season.
 */
export const AGENDA_FRESHNESS_DAYS = 45

/** The list record, narrowed to the fields the agenda module actually reads. */
interface MeetingRow {
  id: string
  title: string | null
  meetingType: string | null
  date: string
  sourceUrl: string | null
}

/**
 * One item on a published agenda.
 *
 * 🔴 `status` and `outcome` are deliberately ABSENT from this type. They exist
 * on the wire and they are not reliable: the 2026-10-14 meeting has been heard
 * and all 24 of its items still read `status: 'upcoming', outcome: null`, while
 * the 2026-09-02 meeting carries five `passed` outcomes and is also still
 * `upcoming`. The cheapest way to guarantee nothing downstream gates on them is
 * for them not to exist downstream.
 *
 * Of what remains: `titleRaw` and `legislationRef` are verbatim from the agenda
 * ("preserved for provenance", "extracted from the agenda, never invented"),
 * `stage` is adapter-encoded from the body's own rules, and `summaryPlain` is a
 * plain-language interpretation WRITTEN BY THE PIPELINE. Only the first three
 * are the council's words. See agendaTopics.ts.
 */
export interface AgendaItem {
  id: string
  /** Agenda order. The derivation keeps it. */
  position: number
  /** e.g. '7D'. */
  itemNumber: string | null
  /** Verbatim agenda title. Never paraphrase, never truncate in the data layer. */
  titleRaw: string
  /** Closed vocabulary: ordinance, resolution, appointment, report, procedural, minutes, public-comment, proclamation, other. */
  kind: string
  /** e.g. 'Ordinance 2026-22'. Verbatim. */
  legislationRef: string | null
  /** 🔴 Machine-written. Carried only with summaryIsGenerated set. */
  summaryPlain: string | null
  /** e.g. 'Second reading — final vote'. Verbatim. */
  stage: string | null
  /** The agenda file this item was read out of. */
  sourceUrl: string | null
}

/** The meeting the items came from — everything the header line needs to name it. */
export interface AgendaSource {
  id: string
  /** e.g. 'Common Council Regular Session — 2026-10-14'. The body's name lives in here. */
  title: string | null
  /** e.g. 'Regular Session'. */
  meetingType: string | null
  /** 'YYYY-MM-DD'. */
  date: string
  /** The agenda document. Render only through isHttpUrl. */
  sourceUrl: string | null
}

export interface Agenda {
  meeting: AgendaSource
  items: AgendaItem[]
}

/**
 * Is a date-only meeting date recent enough to describe current business?
 *
 * Pure and exported so the window can be reasoned about without a clock in a
 * component. A meeting in the FUTURE is always fresh — an agenda published
 * ahead of its session is the ideal case, it just is not the common one.
 */
export function isAgendaFresh(date: string, now: number, days = AGENDA_FRESHNESS_DAYS): boolean {
  const end = Date.parse(`${date}T23:59:59`)
  if (Number.isNaN(end)) return false
  return now - end <= days * 24 * 60 * 60 * 1000
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Agenda request failed: ${res.status}`)
  return res.json()
}

/**
 * Returns null — not a throw — for every "we do not have one" case: the city has
 * no scheduled meetings, or the newest is older than the freshness window. A
 * failed request and an uncovered city must be indistinguishable to the reader,
 * because to them they are the same thing: we do not know.
 */
async function fetchAgenda(city: string, state: string): Promise<Agenda | null> {
  const params = new URLSearchParams({ city, state, status: 'scheduled' })
  const rows = (await getJson(`${MEETINGS_URL}?${params}`)) as MeetingRow[]
  if (!Array.isArray(rows) || rows.length === 0) return null
  // 🔴 By date, descending. `status` stays 'scheduled' after the date passes, so
  // the list is not ordered by recency and the API promises no order at all.
  const latest = [...rows].sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!latest || !isAgendaFresh(latest.date, Date.now())) return null

  const items = (await getJson(
    `${MEETINGS_URL}/${encodeURIComponent(latest.id)}/agenda-items`,
  )) as AgendaItem[]
  if (!Array.isArray(items)) return null

  return {
    meeting: {
      id: latest.id,
      title: latest.title,
      meetingType: latest.meetingType,
      date: latest.date,
      sourceUrl: latest.sourceUrl,
    },
    items,
  }
}

/**
 * `agenda` is undefined while loading, on failure, with no city, and for every
 * city the pipeline does not cover — four states the UI deliberately cannot
 * tell apart. `isLoading` is true only while a request is actually pending.
 *
 * The meetings API is keyed on a city NAME plus a state abbreviation; it has no
 * geoid. That is a property of the source, not a decision: the derived topics
 * are stamped with the slice's geoid and re-checked against the composition's,
 * so a name collision discards topics rather than attaching them to the wrong
 * city. See agendaTopics.ts and resolveComposition.
 */
export function useAgendaItems(
  city: string | null,
  state: string | null,
): { agenda: Agenda | undefined; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['agenda-items', city, state],
    queryFn: () => fetchAgenda(city!, state!),
    enabled: !!city && !!state,
    // An agenda does not change hour to hour, and six requests would be six too
    // many: a published agenda is immutable until the next session.
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })
  return { agenda: data ?? undefined, isLoading: !!city && !!state && isLoading }
}
