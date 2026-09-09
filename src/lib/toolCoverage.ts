import type { SliceType } from '../types/database'
import { stateAbbrevFromGeoid } from './stateAbbrev'

/**
 * Essentials' public coverage catalog, as served at `/coverage.json`.
 *
 * Shape mirrors treasury-tracker/src/utils/essentialsCoverage.ts so the two
 * consumers agree on one contract. Every field is optional because this is
 * remote data from an origin we do not control — see T-125-01 below.
 */
export interface CoverageCatalog {
  generatedAt?: string
  cities?: Array<{ label?: string; geoids?: string[]; state?: string }>
  counties?: Array<{ label?: string; geoids?: string[]; state?: string }>
  states?: Array<{ label?: string; abbrev?: string }>
  federal?: { label?: string; target?: string }
}

export type ToolIconName = 'compass' | 'essentials'

export interface ToolRow {
  key: string
  name: string
  href: string
  icon: ToolIconName
}

export const ESSENTIALS_URL = 'https://essentials.empowered.vote'
const COMPASS_URL = 'https://compass.empowered.vote'

/**
 * T-125-01: the catalog is untrusted remote data. `federal.target` is treated as
 * an OPAQUE root-relative path and must resolve to the Essentials origin.
 *
 * Rejects: absent, absolute URLs, and protocol-relative `//host/...` (which
 * passes a naive startsWith('/') check but resolves to a different origin).
 */
function safeTargetHref(target: string | undefined): string | null {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return null
  try {
    const resolved = new URL(target, ESSENTIALS_URL)
    if (resolved.origin !== new URL(ESSENTIALS_URL).origin) return null
    return resolved.toString()
  } catch {
    return null
  }
}

/** A place record is usable only with a label and at least one geoid. */
function placeHref(
  record: { label?: string; geoids?: string[]; state?: string } | undefined,
  geoid: string
): string | null {
  if (!record?.label) return null
  const url = new URL('/results', ESSENTIALS_URL)
  url.searchParams.set('browse_government_list', geoid)
  if (record.state) url.searchParams.set('browse_state', record.state)
  url.searchParams.set('browse_label', record.label)
  return url.toString()
}

/**
 * Resolves the Essentials deep link for the active slice, or null when the
 * jurisdiction is not covered.
 *
 * Matching is EXACT on Census FIPS geoid: the catalog keys cities by 7-digit
 * place FIPS and counties by 5-digit county FIPS, which is precisely what
 * civic_spaces.slices.geoid stores. So no name normalisation, no Census API
 * call, and no dependency on useJurisdictionName.
 *
 * Deliberately unmatched: an 11-digit census-tract city geoid cannot match a
 * place-keyed catalog, and the catalog's handful of 5- and 10-digit `cities`
 * entries will not match a 7-digit slice. Both correctly yield null.
 */
function essentialsHref(
  sliceType: SliceType,
  geoid: string,
  catalog: CoverageCatalog
): string | null {
  switch (sliceType) {
    case 'city':
      return placeHref(
        catalog.cities?.find((c) => c.geoids?.includes(geoid)),
        geoid
      )

    case 'county':
      return placeHref(
        catalog.counties?.find((c) => c.geoids?.includes(geoid)),
        geoid
      )

    case 'state': {
      const abbrev = stateAbbrevFromGeoid(geoid)
      if (!abbrev) return null
      const record = catalog.states?.find((s) => s.abbrev === abbrev)
      if (!record?.label) return null
      const url = new URL('/results', ESSENTIALS_URL)
      url.searchParams.set('browse_state_officials', abbrev)
      url.searchParams.set('browse_label', record.label)
      return url.toString()
    }

    case 'federal':
      return safeTargetHref(catalog.federal?.target)

    // No jurisdiction to scope to.
    case 'unified':
    case 'volunteer':
    default:
      return null
  }
}

/**
 * The rows the Tools widget should render, in order.
 *
 * Compass is unconditional — it has no per-jurisdiction view, so it is always a
 * home link. Essentials appears ONLY when a real deep link resolves: no
 * home-page fallback, and never another jurisdiction's link (Chris, 2026-09-08).
 * A failed catalog fetch therefore degrades to Compass alone.
 */
export function buildToolRows({
  sliceType,
  geoid,
  catalog,
}: {
  sliceType: SliceType | null
  geoid: string | null
  catalog: CoverageCatalog | null
}): ToolRow[] {
  const rows: ToolRow[] = [
    {
      key: 'compass',
      name: 'Empowered Compass',
      href: COMPASS_URL,
      icon: 'compass',
    },
  ]

  if (sliceType && geoid && catalog) {
    const href = essentialsHref(sliceType, geoid, catalog)
    if (href) {
      rows.push({
        key: 'essentials',
        name: 'Empowered Essentials',
        href,
        icon: 'essentials',
      })
    }
  }

  return rows
}
