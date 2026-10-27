import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import type { PoliticianFlatRecord } from '../types/representatives'
import type { ElectionArea } from './useNextElection'
import { EV_API_ORIGIN } from '../lib/evApi'

/**
 * The officials of the place ON SCREEN — research Pitfall 9's answer.
 *
 * 🔴 `useRepresentatives(userId)` CANNOT follow a place, and that is the whole
 * reason this file exists. It calls `GET /api/essentials/representatives/me`
 * with a bearer: it 401s without one and answers about the ACCOUNT with one.
 * There is no argument to give it. Pitfall 9 is *your* representatives
 * rendering beside *their* conversations, and it is invisible — a real answer
 * for the wrong place, which the platform treats as worse than no answer.
 *
 * The substitute was already in that file, ten lines up:
 *
 *     POST `${EV_API_ORIGIN}/api/essentials/browse/by-area`  { geo_id, mtfcc }
 *
 * Anonymous, CORS-allowed for civicspaces.empowered.vote, and in use since
 * Phase 11 to fetch Asheville's real officials for the dev id
 * (`fetchDevRepresentatives`). `src/lib/toolCoverage.ts` carries the same
 * (geoid, mtfcc) request shape.
 *
 * 🔴 SAME RETURN TYPE as `useRepresentatives`, deliberately. `Sidebar` and
 * `SidebarMobile` declare their prop as `ReturnType<typeof useRepresentatives>`,
 * so matching the shape is what makes this a two-line change in `AppShell`
 * instead of a prop refactor across four components. If either sidebar needs
 * editing to accept this, the signature here is wrong — fix it here.
 *
 * 🔴 NO FIXTURE FALLBACK, and that is the one place this deliberately differs
 * from its sibling. `useRepresentatives` falls back to `MOCK_REPRESENTATIVES`
 * for a synthetic user id because the member-only endpoint 401s for the dev id
 * and that is expected. This endpoint is PUBLIC and answers for the dev id
 * exactly as it answers in production, so a failure here is a real failure and
 * must surface as one. CLAUDE.md: if a request fails, say so and stop; never
 * swap in invented data.
 *
 * 🔴 Called ONCE, in `AppShell`, beside `useRepresentatives`. All five feed
 * panels plus Volunteer mount at once, so a hook inside one of them fires 6×.
 * Both hooks are called unconditionally — rules of hooks — and only one
 * fetches, because the other's `enabled` is false.
 * `check:explore-gate`'s `member-other-place` viewer asserts EXACTLY ONE
 * by-area request per place change, which is what pins that.
 */
const BY_AREA_URL = `${EV_API_ORIGIN}/api/essentials/browse/by-area`

async function fetchPlaceRepresentatives(area: ElectionArea): Promise<PoliticianFlatRecord[]> {
  const res = await fetch(BY_AREA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geo_id: area.geoid, mtfcc: area.mtfcc }),
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch representatives for ${area.mtfcc} ${area.geoid}: ${res.status}`)
  }
  return res.json()
}

/**
 * @param area the visited place's most LOCAL area — city (`G4110`) else county
 * (`G4020`), else `null`. Built by `racesAreaFor(onScreenSlices)`, whose doc
 * explains at length why there is no state fallback: a state-area query answers
 * about the whole state, which is a real answer for the wrong place. `null`
 * means no request at all and the sidebar's existing no-representatives state,
 * which is honest.
 *
 * 🔴 `racesAreaFor`, not `byAreaFor` from `useRepresentatives.ts`. The two walk
 * the same ladder and differ only in the key names of the pair they return
 * (`{geoid, mtfcc}` vs the wire's `{geo_id, mtfcc}`); `ElectionArea` is the one
 * `AppShell` already has in hand for this exact set of slices, and the
 * translation to the wire's names happens once, above. A third copy of the
 * ladder is what both of their docs exist to prevent.
 *
 * ONE call serves every tab: the by-area response for a city carries the whole
 * ladder — the research measured 57 politician records for Asheville, federal
 * included — and `filterRepsByTab` already narrows it per tab. That is how the
 * dev path has always worked.
 */
export function usePlaceRepresentatives(
  area: ElectionArea | null,
): UseQueryResult<PoliticianFlatRecord[], Error> {
  return useQuery({
    // Primitives only, so a fresh object from racesAreaFor on every render does
    // not look like a new query.
    queryKey: ['place-representatives', area?.geoid ?? null, area?.mtfcc ?? null],
    queryFn: () => {
      // `enabled` already guarantees this, but a queryFn that assumes its own
      // gate is one edit away from a non-null assertion that is wrong.
      if (!area) throw new Error('usePlaceRepresentatives: queryFn ran with no area')
      return fetchPlaceRepresentatives(area)
    },
    enabled: !!area,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
