import { useQuery } from '@tanstack/react-query'

/**
 * Scheduled public meetings for a city, from ev-accounts' public meetings API — the
 * on-the-record pipeline publishes each agenda as a status='scheduled' meeting with
 * its start time and the body's IANA zone. Public, no auth; ev-cto decision 0017
 * limits the public list to published + scheduled, so drafts cannot appear here.
 *
 * Coverage is only where the pipeline runs (Bloomington, IN, as of 2026-09-24), so an
 * empty list is the common, honest answer. Production allows civicspaces.empowered.vote;
 * localhost gets no CORS header, so in dev this fails and the widget simply omits it.
 */
const MEETINGS_URL = 'https://api.empowered.vote/api/meetings'

interface MeetingRecord {
  id: string
  title: string | null
  eventKind: string | null
  meetingType: string | null
  date: string
  startsAt: string | null
  timezone: string | null
  sourceUrl: string | null
}

export interface UpcomingMeeting {
  id: string
  title: string
  /** ISO instant, or null for a date-only record. */
  startsAt: string | null
  /** 'YYYY-MM-DD' in the meeting's own zone. */
  date: string
  timezone: string | null
  kind: string | null
  url: string | null
}

async function fetchMeetings(city: string, state: string): Promise<UpcomingMeeting[]> {
  const params = new URLSearchParams({ city, state, status: 'scheduled' })
  const res = await fetch(`${MEETINGS_URL}?${params}`)
  if (!res.ok) throw new Error(`Meetings request failed: ${res.status}`)
  const rows = (await res.json()) as MeetingRecord[]
  const now = Date.now()
  return rows
    .filter((m) => (m.startsAt ? Date.parse(m.startsAt) : Date.parse(`${m.date}T23:59:59`)) >= now)
    .map((m) => ({
      id: m.id,
      title: m.title ?? m.meetingType ?? 'Public meeting',
      startsAt: m.startsAt,
      date: m.date,
      timezone: m.timezone,
      kind: m.eventKind,
      url: m.sourceUrl,
    }))
}

/**
 * `meetings` is undefined while loading, on failure, or with no city; [] when the city
 * has nothing scheduled. `isLoading` is true only while a request is actually pending.
 */
export function useUpcomingMeetings(
  city: string | null,
  state: string | null,
): { meetings: UpcomingMeeting[] | undefined; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['upcoming-meetings', city, state],
    queryFn: () => fetchMeetings(city!, state!),
    enabled: !!city && !!state,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })
  return { meetings: data, isLoading: !!city && !!state && isLoading }
}
