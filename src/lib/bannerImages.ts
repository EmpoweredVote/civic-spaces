import type { SliceType } from '../types/database'

/**
 * Level label shown on tab bars and hero banners — single source of truth
 * so the two never drift (previously duplicated in AppShell and HeroBanner).
 */
export const LEVEL_LABELS: Record<SliceType, string> = {
  neighborhood: 'Local',
  local: 'County',
  state: 'State',
  federal: 'Federal',
  unified: 'Unified',
  volunteer: 'Volunteer',
}

interface BannerDefault {
  tagline: string
  /**
   * Type-default hero photo shown when a slice has no DB-curated `photo_url`
   * (see `slices.photo_url`, already read into `SliceInfo.photoUrl`).
   *
   * No Essentials or Treasury Tracker checkout was available locally to pull
   * their curated place-banner assets from, so these restore this project's
   * own prior photo choices from the Phase 10 "photos-and-storage" work
   * (Bloomington/Indiana pilot) — real, license-free Wikimedia Commons
   * photos, not new approximations. Swap for Empowered Vote's shared
   * place-banner bucket (the one Essentials/Treasury Tracker read from)
   * once this app has access to it.
   */
  defaultPhoto: string
}

export const BANNER_DEFAULTS: Partial<Record<SliceType, BannerDefault>> = {
  neighborhood: {
    tagline: 'Connect with neighbors shaping decisions close to home',
    defaultPhoto:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Bloomington_IN_Kirkwood.jpg/1920px-Bloomington_IN_Kirkwood.jpg',
  },
  local: {
    tagline: 'Weigh in on county government, courts, and local services',
    defaultPhoto:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Monroe_County_Courthouse%2C_Bloomington.jpg/1920px-Monroe_County_Courthouse%2C_Bloomington.jpg',
  },
  state: {
    tagline: 'Discuss statewide legislation and policy priorities',
    defaultPhoto:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/StateCapitolIndiana.jpg/1920px-StateCapitolIndiana.jpg',
  },
  federal: {
    tagline: 'Participate in national discourse on federal policy and legislation',
    defaultPhoto:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/US_Capitol_east_side.JPG/1920px-US_Capitol_east_side.JPG',
  },
  unified: {
    tagline: 'One shared space for every Civic Spaces member nationwide',
    defaultPhoto:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Meteosat-12-fci-march-equinox-2025-noon.jpg/1920px-Meteosat-12-fci-march-equinox-2025-noon.jpg',
  },
  // volunteer intentionally has no default photo — it isn't a geographic
  // space, so HeroBanner renders its graceful no-photo fallback for it.
}
