import type { ResolvedPlace } from './placeResolve'

/**
 * A signed-in viewer's own place, read from their ev-accounts account — for the viewer who
 * HAS a place but holds NO civic spaces.
 *
 * WHO THAT IS. Since ev-accounts CA_0368 (2026-11-07) a basic (Inform) account can add an
 * address, and ev-accounts keeps only its districts. `GET /api/account/me` then returns a
 * `jurisdiction` for it. But `/api/civic-spaces/assign` still refuses that account — and must,
 * because membership is the whole write gate here (`whyNoWrite` has no tier term, D-04) — so
 * it holds no slices. Before this, such a viewer saw "Add your address", having just added one.
 *
 * WHAT IT IS FOR. AppShell opens this place read-only, through the same path a visitor uses
 * to look at a named place (Phase 17). D-04 says an Inform account receives exactly what an
 * anonymous visitor receives; this keeps that, and only saves them naming their own city.
 *
 * 🔴 NO TIER TERM, here or at the call site. The rule is "has a place, holds no spaces" —
 * data, not account type — the same distinction writeAccess.ts insists on. A Connected member
 * whose assignment has not landed yet matches it too, and is better served by their own city
 * read-only than by an address prompt for an address they already gave.
 *
 * Geoids only, validated to the same shapes as `parseViewedPlace` in viewedPlace.ts, and
 * rebuilt field by field: a name, an address or any key ev-accounts adds later cannot reach a
 * consumer through this door. An answer that fails validation is treated as no place.
 */
export function ownPlaceFromAccount(me: unknown): ResolvedPlace | null {
  if (typeof me !== 'object' || me === null) return null
  const j = (me as Record<string, unknown>)['jurisdiction']
  if (typeof j !== 'object' || j === null || Array.isArray(j)) return null
  const jur = j as Record<string, unknown>

  const state = jur['state_geoid']
  if (typeof state !== 'string' || !/^\d{2}$/.test(state)) return null

  if (jur['nation_geoid'] !== 'US') return null

  // ev-accounts names the county geoid `county` (its `county_name` sits beside it).
  const rawCity = jur['city_geoid'] ?? null
  const rawCounty = jur['county'] ?? null
  if (rawCity !== null && (typeof rawCity !== 'string' || !/^\d{7}$/.test(rawCity))) return null
  if (rawCounty !== null && (typeof rawCounty !== 'string' || !/^\d{5}$/.test(rawCounty))) return null

  return {
    // null for an unincorporated address — an answer, not a failure.
    city: rawCity as string | null,
    county: rawCounty as string | null,
    state,
    nation: 'US',
    unified: 'UNIFIED',
  }
}
