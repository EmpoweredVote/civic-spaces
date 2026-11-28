import type { SliceType } from '../types/database'
import { stateAbbrevFromGeoid } from './stateAbbrev'
import { FEDERAL_BANNER, STATE_BANNERS, PLACE_BANNERS } from './banners.generated'

/**
 * The org's shared place-banner library, owned by Essentials.
 *
 * Public Supabase Storage bucket — plain HTTPS GET, no auth, no SDK. The assets are
 * 1700x540 JPEGs (~3.15:1) sourced from Wikimedia Commons under free licences and
 * composed for a bottom-weighted dark gradient with a bottom-left label, which is exactly
 * what HeroBanner draws.
 *
 * Consumer guide: essentials/docs/shared-banner-assets.md
 * Credits + paths: https://essentials.empowered.vote/banners.json
 * Geoids:          https://essentials.empowered.vote/coverage.json
 *
 * 🔴 ATTRIBUTION IS A LICENCE CONDITION, NOT A COURTESY. Most of these are CC BY or
 * CC BY-SA, which require the author be named visibly. Every banner returned here carries
 * a `credit`, and HeroBanner renders it. There is no path that yields a URL without one.
 *
 * 🔴 THE TABLES ARE GENERATED — `npm run gen:banners`. Do not hand-edit
 * banners.generated.ts, and do not transcribe credits from Essentials' registry comments
 * or from a sibling app's copy of them. Both have published the wrong photographer:
 * Treasury Tracker ran three weeks crediting Texas to the previous banner's author, and
 * our own first parser put Portland, ME under Portland, OR's photographer. Essentials now
 * publishes the data as JSON keyed by bucket path, CI-guarded against going stale. Join on
 * path; never on a place name.
 */

/** A resolved banner plus the credit line that must be displayed with it. */
export interface Banner {
  url: string
  credit: string
  /**
   * CSS object-position for the image, copied from Essentials' registry: where the visible
   * band sits inside the 1700x540 asset (0% = top, 100% = bottom). Absent = centre.
   * 🔴 Part of the crop an operator chose, not decoration. Render it through
   * resolveImageFocus, never raw.
   */
  focus?: string
}

/** The centre — what `object-fit: cover` shows with no position, and every banner's default. */
export const BANNER_FOCUS_DEFAULT = '50% 50%'

/**
 * A safe object-position for a banner's `focus`. Mirrors Essentials' SectionBanner rule:
 * two space-separated tokens, each a percentage, a px length, or a keyword. Anything else
 * falls back to the centre, because an invalid value makes the browser drop the whole
 * declaration -- which looks like "the focus did nothing" and gets debugged in the wrong file.
 */
export function resolveImageFocus(focus: string | null | undefined): string {
  if (typeof focus !== 'string') return BANNER_FOCUS_DEFAULT
  const value = focus.trim()
  if (!value) return BANNER_FOCUS_DEFAULT
  const TOKEN = /^(-?\d+(\.\d+)?(%|px)|left|right|top|bottom|center)$/
  const parts = value.split(/\s+/)
  if (parts.length !== 2 || !parts.every((p) => TOKEN.test(p))) return BANNER_FOCUS_DEFAULT
  return value
}

/** A credit line split for display: who took it, under what licence, and that licence's deed. */
export interface CreditParts {
  author: string
  license: string
  /** The licence's official Creative Commons page, or null (plain "Public Domain" has none). */
  licenseUrl: string | null
}

/**
 * Splits a generated credit ("Author, Licence, via Wikimedia Commons") so the banner can
 * show a short "Photo: Author · Licence" with the licence linked to its deed. Null for
 * any other shape (the Wikipedia fallback's "Image via Wikipedia"), which the caller
 * renders verbatim. Author and licence are kept whole — only the trailing source note
 * is dropped, and the deed URL is derived from the licence text, never guessed per photo:
 * Essentials publishes no per-file source URL to link instead.
 */
export function creditParts(credit: string): CreditParts | null {
  const m = credit.match(/^(.+), ([^,]+), via Wikimedia Commons$/)
  if (!m) return null
  const [, author, license] = m as unknown as [string, string, string]
  return { author, license, licenseUrl: licenseDeedUrl(license) }
}

function licenseDeedUrl(license: string): string | null {
  // "CC0" and "CC0 / Public Domain" both name the CC0 dedication.
  if (/^CC0\b/.test(license)) return 'https://creativecommons.org/publicdomain/zero/1.0/'
  // "CC BY-SA 3.0/GFDL" is dual-licensed; the CC half has a deed.
  const cc = license.match(/^CC (BY(?:-SA|-ND|-NC|-NC-SA|-NC-ND)?) (\d\.\d)\b/)
  if (cc) return `https://creativecommons.org/licenses/${cc[1]!.toLowerCase()}/${cc[2]}/`
  return null
}

/**
 * The shared-library banner for a slice, or null when the library does not cover it.
 *
 * Synchronous and exact. Every tier resolves off the geoid's FIPS digits or the geoid
 * itself — never a place name, which Civic Spaces does not reliably have anyway. The
 * name→geoid join happens once, offline, in the generator.
 *
 * Returning null is a normal outcome, not an error: it means "fall through to the
 * Wikipedia path". That covers places Essentials has not curated, and the handful it
 * curates but publishes with no author, which we must not display.
 *
 * `unified` and `volunteer` have no jurisdiction, so no place to picture; they keep their
 * static sliceCopy photo.
 */
export function bannerFor(sliceType: SliceType, geoid: string): Banner | null {
  switch (sliceType) {
    case 'federal':
      return FEDERAL_BANNER

    case 'state': {
      const abbrev = stateAbbrevFromGeoid(geoid)
      return abbrev ? STATE_BANNERS[abbrev] ?? null : null
    }

    case 'city':
    case 'county':
      return PLACE_BANNERS[geoid] ?? null

    case 'unified':
    case 'volunteer':
    default:
      return null
  }
}
