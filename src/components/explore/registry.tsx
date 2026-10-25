/**
 * The module contract, and the only file that knows the module list.
 *
 * A composition (src/lib/exploreComposition.ts) names an ordered set of
 * `ModuleId`s; this table says, for each one, whether it may render here and
 * now, what renders it, and what the page says when it cannot.
 *
 * 🔴 `Record<ModuleId, ExploreModule>` has no index signature, so EVERY ModuleId
 * must have an entry or the build fails. That exhaustiveness is the point: a
 * composition can never name a module nobody wrote. Never satisfy it with a
 * type assertion of any kind — one would survive into the merge and defeat the
 * only guard there is. 16-02's verification greps this file to prove there is
 * none, so do not write one in a comment either.
 */

import { useId } from 'react'
import type { ReactElement } from 'react'
import type { ExploreComposition, ExploreTopic, ModuleId } from '../../types/explore'
import type { ExploreCtx } from './ExploreContext'
import { AgendaModule } from './modules/AgendaModule'
import { ComingUpModule } from './modules/ComingUpModule'
import { DebatesModule, racesWithMedia } from './modules/DebatesModule'
import { FeaturedModule } from './modules/FeaturedModule'
import { ImagineModule, imagineModuleTopics } from './modules/ImagineModule'
import { IntroModule } from './modules/IntroModule'
import { NearbyModule, nearbyModuleTopics } from './modules/NearbyModule'
import { QuestionsModule } from './modules/QuestionsModule'
import { RacesModule } from './modules/RacesModule'
import { WhatsNewModule } from './modules/WhatsNewModule'

export interface ExploreModule {
  /** May this module render at all, here, now? Pure and cheap: called every render. */
  available: (ctx: ExploreCtx) => boolean
  Component: (props: { ctx: ExploreCtx }) => ReactElement | null
  /**
   * What to show when available() is false.
   *
   * 'hide' means the module genuinely does not belong here — Imagine on Federal.
   * A reserved room means it DOES belong and has no source or is not built yet,
   * and it says so. Hiding an empty module silently is the anti-pattern: a
   * reserved room is how the design gives the coming Connect features somewhere
   * obvious to arrive without re-opening the design.
   *
   * 🔴 A reserved room NEVER renders a placeholder fact and NEVER renders a
   * control. It is a sentence about what this space becomes.
   */
  emptyState: 'hide' | { title: string; body: string }
  /**
   * Topics this module owns and can open, beyond the composition's own list.
   * Imagine and Nearby use it: their option lists name topic ids, and a
   * composition is free not to contain them.
   */
  topics?: (composition: ExploreComposition) => ExploreTopic[]
}

/**
 * A room the design has reserved and nothing has moved into yet. Quieter than a
 * real module on purpose — dashed, unfilled, no button — so a page with several
 * does not read as a page full of features.
 *
 * `data-explore-room` is a stable hook for 16-09's check and 16-10's harness;
 * both read the page's structure, and a text selector would break on a comma.
 */
export function ReservedRoom({ id, title, body }: { id: ModuleId; title: string; body: string }) {
  const headingId = useId()
  return (
    <section
      data-explore-room={id}
      aria-labelledby={headingId}
      className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-gray-900/50 px-5 py-4"
    >
      <h3 id={headingId} className="text-base font-semibold text-gray-700 dark:text-gray-300">
        {title}
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{body}</p>
    </section>
  )
}

/**
 * A reserved room's registry entry: never available, and it says what the space
 * becomes. 16-09 reviews every line of this copy; it is deliberately a promise
 * about the space and never a fact about a place.
 */
function reserved(title: string, body: string): ExploreModule {
  return { available: () => false, Component: () => null, emptyState: { title, body } }
}

export const MODULE_REGISTRY: Record<ModuleId, ExploreModule> = {
  // ── The content modules ───────────────────────────────────────────────────
  intro: {
    available: () => true,
    Component: IntroModule,
    emptyState: 'hide',
  },
  featured: {
    // 16-01's selectForModules only sets featuredTopicId when the composition
    // HAS this module, so the two cannot disagree.
    available: (ctx) => ctx.composition.featuredTopicId !== null,
    Component: FeaturedModule,
    emptyState: 'hide',
  },
  questions: {
    available: (ctx) => ctx.composition.questionTopicIds.length > 0,
    Component: QuestionsModule,
    emptyState: 'hide',
  },
  imagine: {
    // Place-scale by construction: locked decision 9 keeps it City/County.
    available: (ctx) => ctx.composition.level === 'city' || ctx.composition.level === 'county',
    Component: ImagineModule,
    emptyState: 'hide',
    topics: imagineModuleTopics,
  },
  'whats-new': {
    available: () => true,
    Component: WhatsNewModule,
    emptyState: 'hide',
  },

  nearby: {
    // Place-scale by construction, same as Imagine.
    available: (ctx) => ctx.composition.level === 'city' || ctx.composition.level === 'county',
    Component: NearbyModule,
    emptyState: 'hide',
    topics: nearbyModuleTopics,
  },
  'coming-up': {
    available: (ctx) => !!ctx.meetings?.[0] || !!ctx.elections?.[0],
    Component: ComingUpModule,
    // An empty calendar is a real answer and worth saying, so this one does NOT
    // hide. Absent from the Unified composition entirely: it is not a place.
    emptyState: {
      title: 'Coming up',
      body: 'Nothing is scheduled for your area right now. Public meetings and elections appear here as soon as they are published.',
    },
  },

  agenda: {
    // Both halves are needed. A meeting with no qualifying items is a real
    // outcome — an agenda of nothing but minutes and appointments — and it is
    // the reserved room's case, not an empty section's.
    available: (ctx) => ctx.agenda !== undefined && ctx.agenda.topics.length > 0,
    Component: AgendaModule,
    // 🔴 NOT 'hide'. Agenda coverage is one city nationally, so this room is
    // what almost every member sees, and the common case must read as a promise
    // rather than an apology (goal 6). It says what the space becomes and
    // states nothing about this place that is not true of it.
    emptyState: {
      title: 'What your local government is working on',
      body: 'When your city publishes its council agendas here, the items it is working on will appear in this space — in the words of the agenda itself.',
    },
  },

  races: {
    available: (ctx) => (ctx.races?.[ctx.composition.level]?.length ?? 0) > 0,
    Component: RacesModule,
    /**
     * 🔴 NOT 'hide'. This room is the state most members are in for most of the
     * year: no 2027 races exist yet, and a general drops off the list on 1
     * January. It is also the state of every member with no city or county
     * slice, because `racesAreaFor` refuses to fall back to their state.
     *
     * So the sentence is neither an apology nor a promise of a date — it says
     * what the space is for and why it is empty right now, and it asserts
     * nothing about this place that is not true of it.
     */
    emptyState: {
      title: 'The races on your ballot',
      body: 'Nothing is on your ballot right now. Races appear here as your area’s elections are scheduled.',
    },
  },
  debates: {
    available: (ctx) => racesWithMedia(ctx).length > 0,
    Component: DebatesModule,
    // 🔴 "Recorded ... when they are published" — never a schedule. No upcoming
    // debate exists anywhere in the stack; `debate-schedule` below is the
    // reserved room for one, and these two rooms must not blur into each other.
    emptyState: {
      title: 'Candidate debates and forums',
      body: 'Recorded debates and candidate forums appear here when they are published for your races.',
    },
  },
  /**
   * 🔴 The conditional half of the invitation, and nothing more.
   *
   * 16-03 left a note here: a reserved room's copy is STATIC, so this one said
   * "nobody has set this place up yet" on every city, county and state —
   * including one that has bespoke topics — and that sentence stops being true
   * the moment Bloomington's agenda lands. 16-06 is the plan that lands it, so
   * 16-06 is the plan that has to stop the page claiming otherwise.
   *
   * `available()` is the only per-composition hook the contract has, so it is
   * used INVERTED: true for a SEEDED place, where the component renders
   * nothing; false for an unseeded one, where the reserved room below shows and
   * its sentence is true. The room still renders no fact and no control.
   *
   * This is a truthfulness guard, not the invitation. **16-08 Task 1 replaces
   * this entry outright** with the real module — `available` becomes
   * `composition.isUnseeded` and `emptyState` becomes `'hide'`, the right way
   * round, with a card that names the place. Nothing here should be preserved.
   */
  'seed-invitation': {
    available: (ctx) => !ctx.composition.isUnseeded,
    Component: () => null,
    emptyState: {
      title: 'Help shape this space',
      body: 'Nobody has set this place up yet. An invitation to say which issues matter here is coming to this spot.',
    },
  },

  // ── Reserved: a real source exists, out of this phase's scope ─────────────
  'legislator-votes': reserved(
    'How your legislators voted',
    'Roll call records for the people who represent you are published for some offices. This space is where they will be shown.',
  ),

  // ── Reserved: no source anywhere in the stack (16-09 and the handoff) ─────
  'ballot-measures': reserved(
    'Measures on your ballot',
    'Nothing in Empowered Vote publishes ballot measures yet, so none are shown. This space is held for them rather than filled with guesses.',
  ),
  'federal-votes': reserved(
    'A recent vote, explained',
    'A federal vote is only worth reading with a plain-language summary of the bill beside it, and no such summary exists in our data yet. This space waits for one.',
  ),
  'debate-schedule': reserved(
    'Upcoming debates',
    'Debate recordings are published after the fact; no schedule of upcoming debates is. This space is held for one.',
  ),

  // ── Reserved: the coming Connect features. Slots only, nothing is built. ──
  symposiums: reserved(
    'Symposiums',
    'A longer, structured conversation on one question, with people who disagree. Coming to this space.',
  ),
  'civic-listening': reserved(
    'Civic Listening',
    'A way to hear what neighbors actually think before replying to it. Coming to this space.',
  ),
  'common-grounds': reserved(
    'Common Grounds',
    'What this community already agrees on, found from what its members have said. Coming to this space.',
  ),
  'focused-communities': reserved(
    'Focused Communities',
    'Smaller groups inside this space for people working on one thing together. Coming to this space.',
  ),
  'slice-action-votes': reserved(
    'What should we do about it?',
    'A vote on what this community wants to do about the topics it has been discussing. Coming to this space.',
  ),
}
