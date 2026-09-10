import type { SliceType } from '../types/database'
import { stateAbbrevFromGeoid } from './stateAbbrev'

/**
 * The org's shared place-banner library, owned by Essentials.
 *
 * Public Supabase Storage bucket — plain HTTPS GET, no auth, no SDK. The assets are
 * 1700x540 JPEGs (~3.15:1) sourced from Wikimedia Commons under free licences and
 * composed for a bottom-weighted dark gradient with a bottom-left label, which is
 * exactly what HeroBanner draws.
 *
 * Consumer guide:   essentials/docs/shared-banner-assets.md
 * Source of truth:  essentials/src/lib/buildingImages.js
 *
 * 🔴 ATTRIBUTION IS A LICENCE CONDITION, NOT A COURTESY. Most of these are CC BY or
 * CC BY-SA, which require the author be named visibly. Every banner this module
 * returns carries a `credit`, and HeroBanner renders it. If you add a path here
 * without a credit, do not ship it.
 *
 * 🔴 CREDITS WERE GENERATED FROM ESSENTIALS' REGISTRY, NOT COPIED FROM A SIBLING APP.
 * Treasury Tracker holds the same table in src/utils/wikiImage.ts and it is stale in
 * two places (FL and TX both had their banners replaced after TT transcribed them).
 * A hand-copied attribution is a wrong photographer published publicly — re-derive
 * from buildingImages.js rather than porting someone else's port.
 */
const BANNER_BASE =
  'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos'

/** A resolved banner plus the credit line that must be displayed with it. */
export interface Banner {
  url: string
  credit: string
}

/**
 * Federal band — one asset for every congressional district, because the subject is
 * the Capitol rather than the district. Versioned filename: Essentials found that
 * overwriting a bucket object does not reliably purge the edge cache.
 */
const FEDERAL_BANNER: Banner = {
  url: `${BANNER_BASE}/national/us-capitol-banner-v2.jpg`,
  credit: 'DiscoA340, CC BY-SA 4.0, leveled and cropped, via Wikimedia Commons',
}

/**
 * States whose asset is NOT at the default `states/<ABBR>.jpg`.
 *
 * 🔴 Essentials versions a filename whenever it re-crops or replaces a banner,
 * because an in-place overwrite was measured still serving the OLD bytes on the
 * plain URL while a cache-busted request returned the new one. Point at the name
 * Essentials designates as canonical; do not assume `<ABBR>.jpg` is current.
 */
const STATE_BANNER_FILES: Record<string, string> = {
  CA: 'CA-v2.jpg',
  FL: 'FL-v2.jpg',
  TX: 'TX-v2.jpg',
}

/**
 * Per-state credits, generated 2026-09-10 from the attribution block above
 * STATE_PANORAMAS in essentials/src/lib/buildingImages.js. Verbatim author and
 * licence; "brightened" is carried through because CC BY / CC BY-SA ask that
 * modifications be indicated. Cropping to the panoramic frame is inherent to the
 * format and is not called out per image.
 *
 * All 50 states are covered. DC is deliberately absent — Essentials has no DC
 * banner, so a DC slice falls through to the Wikipedia path.
 */
const STATE_BANNER_CREDITS: Record<string, string> = {
  AK: "Paxson Woelber, CC BY 2.0, via Wikimedia Commons",
  AL: "WeaponizingArchitecture, CC BY-SA 4.0, via Wikimedia Commons",
  AR: "Daniel Schwen, CC BY-SA 4.0, via Wikimedia Commons",
  AZ: "DPPed, CC BY-SA 3.0, via Wikimedia Commons",
  CA: "Brocken Inaglory, CC BY-SA 4.0, via Wikimedia Commons",
  CO: "Quintin Soloviev, CC BY 4.0, via Wikimedia Commons",
  CT: "KyleConstable, CC BY-SA 4.0, brightened, via Wikimedia Commons",
  DE: "Tim Kiser, CC BY-SA 2.5, via Wikimedia Commons",
  FL: "RW at RookeryBay, CC BY-SA 4.0, via Wikimedia Commons",
  GA: "Marc Merlin, CC BY-SA 4.0, via Wikimedia Commons",
  HI: "Cristo Vlahos, CC BY-SA 3.0, via Wikimedia Commons",
  IA: "Tony Webster, CC BY 2.0, via Wikimedia Commons",
  ID: "Tamanoeconomico, CC BY-SA 4.0, via Wikimedia Commons",
  IL: "King of Hearts, CC BY-SA 3.0, brightened, via Wikimedia Commons",
  IN: "Momoneymoproblemz, CC BY-SA 4.0, via Wikimedia Commons",
  KS: "Quintin Soloviev, CC BY 4.0, via Wikimedia Commons",
  KY: "Anindya Chakraborty, CC BY-SA 3.0, brightened, via Wikimedia Commons",
  LA: "Michael Maples (USACE), public domain, via Wikimedia Commons",
  MA: "King of Hearts, CC BY-SA 4.0, via Wikimedia Commons",
  MD: "Quintin Soloviev, CC BY 4.0, via Wikimedia Commons",
  ME: "Kristen Wheatley, CC BY 2.0, via Wikimedia Commons",
  MI: "TheWxResearcher, CC0, via Wikimedia Commons",
  MN: "w_lemay, CC BY-SA 2.0, via Wikimedia Commons",
  MO: "Buphoff, CC BY-SA 3.0, via Wikimedia Commons",
  MS: "chmeredith, CC BY 2.0, via Wikimedia Commons",
  MT: "TerryDOtt, CC BY 2.0, via Wikimedia Commons",
  NC: "Bruce Emmerling, CC BY-SA 4.0, via Wikimedia Commons",
  ND: "Acroterion, CC BY-SA 4.0, via Wikimedia Commons",
  NE: "SounderBruce, CC BY-SA 4.0, via Wikimedia Commons",
  NH: "YubYub41, CC BY-SA 3.0, via Wikimedia Commons",
  NJ: "King of Hearts, CC BY-SA 4.0, via Wikimedia Commons",
  NM: "Daniel Schwen, CC BY-SA 4.0, via Wikimedia Commons",
  NV: "Paul Harrison, CC BY-SA 4.0, via Wikimedia Commons",
  NY: "King of Hearts, CC BY-SA 4.0, via Wikimedia Commons",
  OH: "Ynsalh, CC BY-SA 4.0, via Wikimedia Commons",
  OK: "Soonerfever, public domain, via Wikimedia Commons",
  OR: "Oregon's Mt. Hood Territory, public domain, via Wikimedia Commons",
  PA: "Cbaile19, CC0, via Wikimedia Commons",
  RI: "boliyou, CC BY-SA 2.0, via Wikimedia Commons",
  SC: "bbatsell, CC BY-SA 2.5, via Wikimedia Commons",
  SD: "Nick Amoscato, CC BY 2.0, via Wikimedia Commons",
  TN: "Kaldari, public domain, via Wikimedia Commons",
  TX: "Tlshands, CC BY-SA 3.0, via Wikimedia Commons",
  UT: "Invictus323, CC BY 4.0, via Wikimedia Commons",
  VA: "Don.s.okeefe, CC BY-SA 3.0, brightened, via Wikimedia Commons",
  VT: "chensiyuan, CC BY-SA 4.0, via Wikimedia Commons",
  WA: "Iamsridhar, CC BY-SA 3.0, via Wikimedia Commons",
  WI: "Dori, CC BY-SA 3.0 US, via Wikimedia Commons",
  WV: "Gabor Eszes (UED77), CC BY-SA 3.0, via Wikimedia Commons",
  WY: "GrandTetonNPS, public domain, via Wikimedia Commons",
}

/**
 * Curated county banners, keyed by 5-digit county FIPS.
 *
 * 🔴 GEOID, NOT NAME — and this is the one tier where Essentials agrees. Its city
 * registry is keyed by city label and matched by substring, which cannot express a
 * county: a 'palm beach' key would match West Palm Beach and Palm Beach Gardens and
 * miss Boca Raton, which is equally in the county. A geoid is exact.
 *
 * Only counties with no city half belong here. Miami-Dade deliberately has no entry.
 */
const COUNTY_BANNERS: Record<string, Banner> = {
  // Palm Beach County, FL
  '12099': {
    url: `${BANNER_BASE}/counties/palm-beach-fl.jpg`,
    credit: 'Ebyabe, CC BY-SA 3.0, levelled, via Wikimedia Commons',
  },
}

/**
 * The shared-library banner for a slice, or null when the library does not cover it.
 *
 * Synchronous and exact — every tier resolved here keys off the geoid's FIPS digits
 * or the geoid itself, never a place name. Returning null is a normal outcome and
 * means "fall through to the Wikipedia path", not an error.
 *
 * Not covered here, on purpose:
 * - `city`: Essentials keys city banners by city NAME and we only ever hold a geoid.
 *   The join is possible (via coverage.json's geoid->label, or by verifying a
 *   /location-search candidate's geo_id against ours) but it is a separate change.
 * - `unified` / `volunteer`: no jurisdiction, so no place to picture. These keep
 *   their static sliceCopy photo.
 */
export function bannerFor(sliceType: SliceType, geoid: string): Banner | null {
  switch (sliceType) {
    case 'federal':
      return FEDERAL_BANNER

    case 'state': {
      const abbrev = stateAbbrevFromGeoid(geoid)
      if (!abbrev) return null
      const credit = STATE_BANNER_CREDITS[abbrev]
      // No credit means no licence notice, which means we must not display it.
      if (!credit) return null
      const file = STATE_BANNER_FILES[abbrev] ?? `${abbrev}.jpg`
      return { url: `${BANNER_BASE}/states/${file}`, credit }
    }

    case 'county':
      return COUNTY_BANNERS[geoid] ?? null

    case 'city':
    case 'unified':
    case 'volunteer':
    default:
      return null
  }
}
