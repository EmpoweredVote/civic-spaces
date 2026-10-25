/**
 * The module contract, and the only file that knows the module list.
 *
 * A composition (src/lib/exploreComposition.ts) names an ordered set of
 * `ModuleId`s; this table says, for each one, whether it may render here and
 * now, what renders it, and what the page says when it cannot.
 *
 * 🔴 `Record<ModuleId, ExploreModule>` has no index signature, so EVERY ModuleId
 * must have an entry or the build fails. That exhaustiveness is the point: a
 * composition can never name a module nobody wrote. Never satisfy it with
 * `as Record<...>` or `as unknown` — the assertion would survive into the merge
 * and defeat the only guard there is.
 */

import { useId } from 'react'
import type { ReactElement } from 'react'
import type { ExploreComposition, ExploreTopic, ModuleId } from '../../types/explore'
import type { ExploreCtx } from './ExploreContext'

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

/**
 * A module this plan set builds, before the task that builds it. Hidden rather
 * than reserved: a room saying "a welcome goes here" would be noise, and these
 * entries are replaced within Phase 16 rather than waiting on a source.
 */
function pending(): ExploreModule {
  return { available: () => false, Component: () => null, emptyState: 'hide' }
}

export const MODULE_REGISTRY: Record<ModuleId, ExploreModule> = {
  // ── Built in this plan (16-02 Tasks 2 and 3) ──────────────────────────────
  intro: pending(),
  featured: pending(),
  questions: pending(),
  imagine: pending(),
  nearby: pending(),
  'coming-up': pending(),
  'whats-new': pending(),

  // ── Built later in this phase ─────────────────────────────────────────────
  agenda: reserved(
    'What your local government is working on',
    'The items on this place’s published agenda will appear here, in the words of the agenda itself.',
  ),
  races: reserved(
    'The races on your ballot',
    'The contests you can actually vote in, for the area you live in, will be listed here.',
  ),
  debates: reserved(
    'Candidate debates and forums',
    'Recorded debates and candidate forums for your races will appear here when they are published.',
  ),
  'seed-invitation': reserved(
    'Help shape this space',
    'Nobody has set this place up yet. An invitation to say which issues matter here is coming to this spot.',
  ),

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
