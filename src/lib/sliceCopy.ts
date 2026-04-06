import type { SliceType } from '../types/database'

export interface SliceCopy {
  tagline: string
  description: string
  /** Placeholder photo URL — replaced in Phase 10 with Supabase Storage CDN URLs */
  placeholderPhoto: string
}

export const SLICE_COPY: Record<SliceType, SliceCopy> = {
  neighborhood: {
    tagline: 'Discuss local issues with verified residents in your community',
    description:
      'This neighborhood civic space is for verified residents to discuss local issues, explore alignment, and access local civic tools.',
    placeholderPhoto:
      'https://images.unsplash.com/photo-1516156008625-3a9d6067fab5?w=1200&h=400&fit=crop',
  },
  local: {
    tagline: 'Engage with county-level issues affecting your local community',
    description:
      'This local civic space connects residents across your county to discuss local governance, community priorities, and civic engagement opportunities.',
    placeholderPhoto:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=400&fit=crop',
  },
  state: {
    tagline: 'Connect with fellow residents on state-level policy and governance',
    description:
      'This state civic space connects all state residents to discuss state legislation, budget priorities, and policies that affect the entire state.',
    placeholderPhoto:
      'https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?w=1200&h=400&fit=crop',
  },
  federal: {
    tagline: 'Participate in national discourse on federal policies and legislation',
    description:
      'This federal civic space connects Americans nationwide to discuss national legislation, federal policy priorities, and issues that affect all citizens across the country.',
    placeholderPhoto:
      'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1200&h=400&fit=crop',
  },
  unified: {
    tagline: 'Join a global civic conversation that transcends geographic boundaries',
    description:
      'The unified civic space brings together verified members from around the world to discuss shared civic values, cross-border issues, and universal civic engagement.',
    placeholderPhoto:
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop',
  },
  volunteer: {
    tagline: 'Coordinate with fellow civic volunteers to strengthen your community',
    description:
      'This volunteer civic space is for verified Empowered Vote volunteers to organize, share resources, and coordinate civic engagement initiatives.',
    placeholderPhoto:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&h=400&fit=crop',
  },
}
