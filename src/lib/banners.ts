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
