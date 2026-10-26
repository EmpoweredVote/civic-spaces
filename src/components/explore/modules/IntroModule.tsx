/**
 * The welcome at the top of Explore — one copy triple per level.
 *
 * Today ExploreView hard-codes "your community" and "local topics" on every tab
 * (`:202-212`). On Federal that is the phase's bug in miniature: a nation-wide
 * space asking about the neighborhood. City and County share their copy; State,
 * Federal and Unified say what they actually are.
 *
 * Each triple keeps the same shape and roughly the same length, so the page's
 * rhythm does not change when the member switches tab.
 */

import type { ExploreLevel } from '../../../types/explore'
import type { ExploreCtx } from '../ExploreContext'

interface IntroCopy {
  eyebrow: string
  heading: string
  subhead: string
}

const PLACE_COPY: IntroCopy = {
  eyebrow: 'Welcome to your Civic Space',
  heading: "Discover what's happening in your community.",
  subhead: 'Explore local topics, find something to do, and share your perspective.',
}

const INTRO_COPY: Record<ExploreLevel, IntroCopy> = {
  city: PLACE_COPY,
  county: PLACE_COPY,
  state: {
    eyebrow: "Welcome to your state's Civic Space",
    heading: "Discover what's happening across your state.",
    subhead: 'Explore statewide topics, follow the races, and share your perspective.',
  },
  federal: {
    eyebrow: 'Welcome to the national Civic Space',
    heading: "Discover what's happening at the national level.",
    subhead: 'Explore national topics, follow the races, and share your perspective.',
  },
  unified: {
    eyebrow: 'Welcome to the Unified Civic Space',
    heading: "Discover what's happening around the world.",
    subhead: 'Explore questions that cross borders, and share your perspective.',
  },
}

export function IntroModule({ ctx }: { ctx: ExploreCtx }) {
  const copy = INTRO_COPY[ctx.composition.level]
  return (
    <div className="px-1 pt-2">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
        {copy.eyebrow}
      </p>
      <h2 className="mt-1.5 text-[1.75rem] @lg:text-[2.5rem] font-medium leading-[1.1] tracking-tight text-gray-900 dark:text-gray-100">
        {copy.heading}
      </h2>
      <p className="mt-2 text-base text-gray-600 dark:text-gray-400">{copy.subhead}</p>
    </div>
  )
}
