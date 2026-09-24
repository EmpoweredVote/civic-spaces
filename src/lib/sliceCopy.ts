import type { SliceType } from '../types/database'

export interface SliceCopy {
  tagline: string
  description: string
  /**
   * Static fallback hero photo, used only when no real banner resolves for this
   * slice — a DB `photo_url`, the shared banner library, and the Wikipedia path
   * all take precedence.
   *
   * OPTIONAL, and absent on purpose for the tiers the shared library covers
   * outright (see lib/banners.ts). `state` and `federal` resolve a real banner for
   * every jurisdiction, so a generic stand-in there was unreachable in practice and
   * only ever risked showing stock photography in place of the actual state. Where
   * this is absent and nothing else resolves, HeroBanner renders its brand gradient.
   */
  defaultPhoto?: string
}

export const SLICE_COPY: Record<SliceType, SliceCopy> = {
  city: {
    tagline: 'Connect with verified residents in your city or town',
    description:
      'This local civic space is for verified residents to discuss city and neighborhood issues, explore alignment with neighbors, and access local civic tools.',
    defaultPhoto:
      'https://images.unsplash.com/photo-1516156008625-3a9d6067fab5?w=1200&h=400&fit=crop',
  },
  county: {
    tagline: 'Engage with county-wide issues and governance in your region',
    description:
      'This county civic space connects residents across your county to discuss local governance, community priorities, and civic engagement opportunities.',
    // No fallback: a stock courthouse stood in for every uncovered county, which read
    // as this county's courthouse and was not. An uncovered county gets the brand
    // gradient until the shared library or the Wikipedia path resolves a real place.
  },
  state: {
    tagline: 'Connect with fellow residents on state-level policy and governance',
    description:
      'This state civic space connects all state residents to discuss state legislation, budget priorities, and policies that affect the entire state.',
    // No fallback: the shared banner library covers all 50 states.
  },
  federal: {
    tagline: 'Participate in national discourse on federal policies and legislation',
    description:
      'This federal civic space connects Americans nationwide to discuss national legislation, federal policy priorities, and issues that affect all citizens across the country.',
    // No fallback: the shared banner library covers the federal band with one asset.
  },
  unified: {
    tagline: 'Join a global civic conversation that transcends geographic boundaries',
    description:
      'The unified civic space brings together verified members from around the world to discuss shared civic values, cross-border issues, and universal civic engagement.',
    defaultPhoto:
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop',
  },
  volunteer: {
    tagline: 'Coordinate with fellow civic volunteers to strengthen your community',
    description:
      'This volunteer civic space is for verified Empowered Vote volunteers to organize, share resources, and coordinate civic engagement initiatives.',
    defaultPhoto:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&h=400&fit=crop',
  },
}
