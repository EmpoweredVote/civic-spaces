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
 *
 * ── 🔴 Phase 17: the same welcome, read by somebody who does not live here ───
 *
 * "Welcome to YOUR Civic Space / Discover what's happening in YOUR community"
 * over Asheville, read by a visitor from anywhere, is the sentence
 * `deferred-items.md` item 2 is about and the one D-10 forbids: *never show
 * someone a place as if it were already theirs.* The DATA under it was already
 * right — `racesAreaFor` follows `onScreenSlices` as of 17-04 — and only the
 * second person was wrong.
 *
 * Two independent switches, and they are deliberately not the same one:
 *
 *   `ctx.isOwnPlace`  — is this place the reader's? City, County and State NAME
 *                       the place instead of claiming it. The name is resolved
 *                       from the geoid the reader chose (`geoNames.ts`), never
 *                       from anything they typed, so it is not an echo (D-13).
 *                       Federal and Unified need no variant at all: "the
 *                       national Civic Space" and "around the world" claim
 *                       nothing about where anyone lives.
 *   `ctx.isViewOnly`  — may the reader speak here? Every subhead ends in an
 *                       invitation to "share your perspective", and a view-only
 *                       reader cannot take it up. 16-CONTEXT locked decision 4:
 *                       Explore must not OFFER what RLS refuses. This one also
 *                       covers a member on a SIBLING shard, where the place IS
 *                       theirs and the write still is not.
 */

import type { ExploreLevel } from '../../../types/explore'
import type { ExploreCtx } from '../ExploreContext'

interface IntroCopy {
  eyebrow: string
  heading: string
  /** The invitation. Shown only when the reader can actually take it up. */
  subhead: string
  /** The same sentence with the invitation removed — never a disabled version of it. */
  subheadViewOnly: string
}

const PLACE_COPY: IntroCopy = {
  eyebrow: 'Welcome to your Civic Space',
  heading: "Discover what's happening in your community.",
  subhead: 'Explore local topics, find something to do, and share your perspective.',
  subheadViewOnly: 'Explore local topics and find something to do.',
}

const INTRO_COPY: Record<ExploreLevel, IntroCopy> = {
  city: PLACE_COPY,
  county: PLACE_COPY,
  state: {
    eyebrow: "Welcome to your state's Civic Space",
    heading: "Discover what's happening across your state.",
    subhead: 'Explore statewide topics, follow the races, and share your perspective.',
    subheadViewOnly: 'Explore statewide topics and follow the races.',
  },
  federal: {
    eyebrow: 'Welcome to the national Civic Space',
    heading: "Discover what's happening at the national level.",
    subhead: 'Explore national topics, follow the races, and share your perspective.',
    subheadViewOnly: 'Explore national topics and follow the races.',
  },
  unified: {
    eyebrow: 'Welcome to the Unified Civic Space',
    heading: "Discover what's happening around the world.",
    subhead: 'Explore questions that cross borders, and share your perspective.',
    subheadViewOnly: 'Explore questions that cross borders.',
  },
}

/**
 * The eyebrow and heading for a place that is not the reader's.
 *
 * 🔴 `placeName` is null while `useJurisdictionName` is still answering with the
 * tab label, so the fallback says "this community" rather than "Welcome to
 * City" — the same rule `ExploreCtx.placeName` states and the seed invitation
 * already follows. A sentence with a hole in it is worse than waiting a frame.
 */
function namedForVisitor(level: ExploreLevel, placeName: string | null, own: IntroCopy): IntroCopy {
  if (level === 'city' || level === 'county') {
    return {
      ...own,
      eyebrow: placeName ? `Welcome to ${placeName}'s Civic Space` : 'Welcome to this Civic Space',
      heading: placeName
        ? `Discover what's happening in ${placeName}.`
        : "Discover what's happening in this community.",
    }
  }
  if (level === 'state') {
    return {
      ...own,
      eyebrow: placeName ? `Welcome to ${placeName}'s Civic Space` : "Welcome to this state's Civic Space",
      heading: placeName
        ? `Discover what's happening across ${placeName}.`
        : "Discover what's happening across this state.",
    }
  }
  // federal and unified claim no place, so there is nothing to re-point.
  return own
}

export function IntroModule({ ctx }: { ctx: ExploreCtx }) {
  const own = INTRO_COPY[ctx.composition.level]
  const copy = ctx.isOwnPlace ? own : namedForVisitor(ctx.composition.level, ctx.placeName, own)
  return (
    <div className="px-1 pt-2">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
        {copy.eyebrow}
      </p>
      <h2 className="mt-1.5 text-[1.75rem] @lg:text-[2.5rem] font-medium leading-[1.1] tracking-tight text-gray-900 dark:text-gray-100">
        {copy.heading}
      </h2>
      <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
        {ctx.isViewOnly ? copy.subheadViewOnly : copy.subhead}
      </p>
    </div>
  )
}
