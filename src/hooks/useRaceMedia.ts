import { useQuery } from '@tanstack/react-query'
import { EV_API_ORIGIN } from '../lib/evApi'
import { isRaceMedia, type MediaRow } from '../lib/raceMedia'

/**
 * Every published debate and candidate-forum recording, fetched ONCE.
 *
 * `GET /api/meetings?raceId=<uuid>` exists and works, and it is the wrong shape
 * for this: a member has 10–20 races, so the per-race route is 10–20 requests
 * for a list of 171 rows. One request, filtered to the 45 `debate`/`forum` rows
 * that carry `raceIds`, and joined client-side by `joinMediaToRaces`.
 *
 * Public and unauthenticated, through the `/api` proxy in local dev — the same
 * route useAgendaItems uses, so the dev id sees real recordings rather than a
 * fixture.
 *
 * 🔴 These are RECORDINGS of events that already happened; all 45 are
 * `published` and no upcoming debate exists anywhere in the stack. Hence the
 * long staleTime: a published recording does not change.
 */
const MEETINGS_URL = `${EV_API_ORIGIN}/api/meetings`

async function fetchRaceMedia(): Promise<MediaRow[]> {
  const res = await fetch(MEETINGS_URL)
  if (!res.ok) throw new Error(`Race media request failed: ${res.status}`)
  const rows = (await res.json()) as unknown
  if (!Array.isArray(rows)) return []
  // Narrow here rather than downstream: everything past this point is a race event.
  return (rows as MediaRow[]).filter(isRaceMedia)
}

/**
 * `media` is undefined while loading AND on failure — four states the UI
 * deliberately cannot tell apart, because to a member they are one state: we
 * have nothing to show you. `enabled` is false when the member has no races, so
 * a tab with nothing to join against makes no request at all.
 */
export function useRaceMedia(enabled = true): { media: MediaRow[] | undefined; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['race-media'],
    queryFn: fetchRaceMedia,
    enabled,
    // Recordings of events that already happened. Six hours is already generous.
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })
  return { media: data, isLoading: enabled && isLoading }
}
