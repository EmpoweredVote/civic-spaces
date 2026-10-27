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
import { SeedInvitationModule } from './modules/SeedInvitationModule'
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
  /**
   * 🔴 True only for a module that can NEVER render — no source anywhere, or a
   * Connect feature nobody has built. Set by `reserved()` and nowhere else.
   *
   * It is not a synonym for "has an emptyState". `agenda`, `coming-up`, `races`
   * and `debates` all have one, and all four are real modules whose room is a
   * statement about THIS place THIS week: the agenda is not published here yet,
   * nothing is on the ballot right now. Those stay where the module sits.
   *
   * A reserved room says nothing about the place at all, so nine of them in a
   * column say the same nothing nine times. `ReservedRoomGroup` collapses them
   * into one card — see the measurement in its own comment.
   */
  reserved?: true
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
      data-explore-room-card="standalone"
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

/** One reserved room's copy, lifted out of the registry for the group below. */
export interface ReservedRoomCopy {
  id: ModuleId
  title: string
  body: string
}

/**
 * Every reserved room a composition names, in the composition's own order.
 *
 * Deliberately a function of the module list rather than of the registry, so
 * the order on screen is the order the design chose: the rooms with a civic
 * record behind them first, the coming Connect features after.
 */
export function reservedRoomsIn(modules: readonly ModuleId[]): ReservedRoomCopy[] {
  const out: ReservedRoomCopy[] = []
  for (const id of modules) {
    const mod = MODULE_REGISTRY[id]
    if (!mod.reserved || mod.emptyState === 'hide') continue
    out.push({ id, title: mod.emptyState.title, body: mod.emptyState.body })
  }
  return out
}

/**
 * 🔴 All of a page's reserved rooms, as ONE card.
 *
 * Measured on this branch before it existed, dark desktop at 1440×1100:
 *
 *   State    9 rooms, 758px — 33% of the Explore panel
 *   City     7 rooms, 614px — 20%
 *   Federal  7 rooms, 594px — 27%
 *
 * Read one at a time each sentence was fine. Read together they were six or
 * seven identical dashed cards closing the page, four of them ending in the
 * same three words, and the last thing a member saw was a column of promises —
 * the "welcome, not a dead end" goal failing in aggregate while every part of
 * it passed. Better sentences could not have fixed that; there were simply too
 * many cards, so this cuts the cards instead.
 *
 * Nothing is dropped and nothing is hidden: every reserved `ModuleId` still has
 * its registry entry, still renders, still carries `data-explore-room` for the
 * checks and the harness. It is one card with several lines instead of several
 * cards with one line, which is a rendering decision — the registry and the
 * composition are untouched by it.
 *
 * 🔴 The four rooms that are NOT in here are the point of `reserved`. `agenda`,
 * `coming-up`, `races` and `debates` are real modules reporting on this place
 * this week, and each belongs where its module sits, in the body of the page.
 */
export function ReservedRoomGroup({ rooms }: { rooms: readonly ReservedRoomCopy[] }) {
  const headingId = useId()
  if (rooms.length === 0) return null
  return (
    <section
      data-explore-room-card="group"
      aria-labelledby={headingId}
      className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-gray-900/50 px-5 py-5"
    >
      <h3 id={headingId} className="text-base font-semibold text-gray-700 dark:text-gray-300">
        What this space becomes
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Each of these has a place here and nothing in it yet — held open on purpose, rather than
        filled with something that only looks like content.
      </p>
      <ul className="mt-4 divide-y divide-gray-200 dark:divide-white/[0.06]">
        {rooms.map((room) => (
          <li key={room.id} data-explore-room={room.id} className="py-3 first:pt-0 last:pb-0">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{room.title}</h4>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{room.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A reserved room's registry entry: never available, and it says what the space
 * becomes. Rendered inside `ReservedRoomGroup`, one line each.
 *
 * 🔴 The copy rules, which every body below obeys:
 *
 * - **Never a fact about a place.** These rooms exist precisely because no
 *   source serves them; a sample measure or a plausible bill number here would
 *   be invented civic record in its purest form.
 * - **Never "for your area" or "in your community"** when the gap is universal.
 *   Ballot measures, bill summaries and debate schedules are missing for
 *   everyone, and telling a member their place is the poorly-served one is both
 *   untrue and dispiriting. (`agenda` is the one room allowed to be per-place,
 *   because agenda coverage genuinely is. It is not a `reserved()` room.)
 * - 🔴 **Never "your" about the place at all** — D-10, added by 17-06. Since
 *   Phase 17 the reader may be looking at a place they do not live in, so "your
 *   ballot", "your legislators", "your races" and "none of yours" are all claims
 *   that can be false on screen. An `emptyState` is a static string with no
 *   `ctx` to branch on, so these are written to be true of BOTH readers —
 *   "this ballot", "these legislators", "here". A module that CAN branch uses
 *   `ctx.isOwnPlace`, which is what `intro`, `questions` and `races` do.
 * - **What a member would get, not what we would build.** "What a yes and a no
 *   would each do" is a benefit; "measure ingestion" is a ticket.
 * - **No date, no "soon", no roadmap, no apology, no control.** Saying what
 *   arrives and then stopping is the whole technique.
 */
function reserved(title: string, body: string): ExploreModule {
  return { available: () => false, Component: () => null, emptyState: { title, body }, reserved: true }
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
    // 🔴 "here", not "for your area" — D-10. An emptyState is a static string
    // with no ctx, so a place that is not the reader's cannot be branched on;
    // the sentence is rewritten to be true of both instead, which it is.
    emptyState: {
      title: 'Coming up',
      body: 'Nothing is on the public calendar here right now. Meetings and election dates appear here as they are published.',
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
      title: 'What the local government here is working on',
      // 🔴 Not "your city" — this module is City AND County, and Buncombe County
      // has no city. The body names the governing body generically and lets the
      // AgendaModule name the real one from the record when there is one.
      body: 'Published agendas open here as the items themselves — the governing body’s own wording, each with a link to the document it came from. Empowered Vote does not carry agendas for this place yet.',
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
      title: 'The races on this ballot',
      body: 'Nothing is on the ballot here right now. The races for this area, and who is running in each of them, open here once an election is scheduled.',
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
      body: 'When a debate or a candidate forum is recorded for one of the races on this ballot, it opens here to watch. None of them has one published yet.',
    },
  },
  /**
   * The welcome for a place nobody has written a word about yet.
   *
   * 16-06 parked an inverted guard here — `available: !isUnseeded` with a null
   * Component — so a reserved room's STATIC sentence ("nobody has set this
   * place up yet") could not be told about Bloomington once its agenda landed.
   * That was a truthfulness guard, never the invitation, and it said so. This
   * entry replaces it outright; nothing from it is preserved.
   *
   * 🔴 `placeName` is in `available()` on purpose. An invitation that cannot
   * name the place is not an invitation, and `useJurisdictionName` answers the
   * tab label ("City") until its offline table lands — so AppShell passes null
   * for that window. Hiding until the name resolves is a frame or two of
   * nothing, which is better than a sentence with a gap in it. 16-10 checks the
   * unresolved case.
   *
   * 🔴 `emptyState: 'hide'`, and the quiet SEEDED-case variant 16-DESIGN
   * suggested is deliberately NOT built. Its only purpose is to let a member
   * nudge what this space focuses on — which is the vote. With no vote there is
   * nothing for it to offer, and a quiet card that offers nothing is the
   * "coming soon" dead end goal 6 forbids. Considered and deferred, not
   * forgotten: it ships with the vote, in the vote's own plan.
   */
  'seed-invitation': {
    /**
     * 🔴 Four terms, and the last two are Phase 17's.
     *
     * This module INVITES A VOTE. `16-CONTEXT.md` locked decision 6 made seeding
     * a vote, and 16-08 shipped the invitation *without* it — so it is already
     * an invitation to something that does not yet count. Opening it for someone
     * who could not cast one even when it does is D-11's failure one step
     * further out: an observer is never offered an action they cannot take.
     *
     * `isAuthenticated && !isViewOnly` is the whole addition. Both are false for
     * a signed-out visitor; `isViewOnly` alone is true for a member looking at
     * another place and on a sibling shard, which is the same answer RLS gives.
     *
     * 🔴 The gate belongs HERE and not inside the module. `SeedInvitationModule`'s
     * own header explains why it deliberately does not read `ctx.isViewOnly` in
     * its body — its single control is navigation, and gating navigation makes
     * another shard's Explore a dead page. That comment is still correct and must
     * stay. The question this predicate answers is whether the room opens at all,
     * which is a different question from what the room renders.
     *
     * Checked by `check:explore-gate` viewers 5 (`member-other-place`) and 6
     * (`observer-with-a-place`), which assert this module is ABSENT on a place
     * that is genuinely unseeded. `check:explore-rooms` 1 covers the other half —
     * that it is PRESENT for the authenticated dev guest on their own shard.
     */
    available: (ctx) =>
      ctx.composition.isUnseeded && !!ctx.placeName && ctx.isAuthenticated && !ctx.isViewOnly,
    Component: SeedInvitationModule,
    emptyState: 'hide',
  },

  /**
   * ── Reserved: a real source exists, out of this phase's scope ─────────────
   *
   * Research Finding 6: of 12 members probed, 5 had roll-call votes. Federal
   * rows are stale to 2026-03-02 while the CA Assembly is current to
   * 2026-09-01, and none of it is slice-scoped — so coverage is not predictable
   * from `(slice_type, geoid)`. Open Question 5's default is reserve, do not
   * build, and the sentence says why in the member's terms rather than ours.
   */
  'legislator-votes': reserved(
    // 🔴 "these legislators" — the ones this space is about, which the reader may
    // or may not be represented by (D-10). The BODY stays universal, as the copy
    // rules above require: the gap is everyone's, not this place's.
    'How these legislators voted',
    'Roll-call records exist for some elected officials and not for others, and a page that answers for half of them answers for nobody — so this space waits until the record is even.',
  ),

  /**
   * ── Reserved: no source anywhere in the stack (handoff Asks 2, 3 and 4) ───
   *
   * 🔴 Each of these three gaps is UNIVERSAL, not local. No member anywhere
   * sees a ballot measure, a bill summary or a debate schedule, so none of
   * these sentences may imply that this member's place is the unlucky one.
   * They name the missing thing in the world, not a shortfall in the reader's
   * city. The evidence for each is in `EXPLORE-HANDOFF.md`.
   */
  'ballot-measures': reserved(
    'Measures on this ballot',
    'No ballot measures are published anywhere in Empowered Vote yet; when they are, each one opens here with what a yes and a no would actually do.',
  ),
  'federal-votes': reserved(
    'A recent vote, explained',
    'A tally is only worth reading beside a plain-language account of the bill it settled, and no such account exists in our data yet — so the number waits here for one.',
  ),
  // 🔴 Not 'Upcoming debates' beside a `debates` room called 'Candidate debates
  // and forums'. The two must not blur: one is recordings, which exist; this is
  // notice in advance, which does not.
  'debate-schedule': reserved(
    'Debates still to come',
    'Debates reach Empowered Vote only after they air; when one is announced ahead of time, this is where you would hear about it in time to watch.',
  ),

  /**
   * ── Reserved: the coming Connect features. Slots only, nothing is built. ──
   *
   * A DESIGN non-goal five times over: *"This design reserves their slots and
   * stops."* The slot IS the deliverable, so each line describes what a member
   * would get and then stops — no date, no roadmap, nothing to press.
   *
   * Read these five consecutively and out loud, because that is how they are
   * met: five variations of one sentence is its own kind of noise, so the shape
   * changes line to line while the voice does not.
   */
  symposiums: reserved(
    'Symposiums',
    'One question, taken slowly, with everyone who disagrees about it still in the room.',
  ),
  // 🔴 "the people here", never "your neighbors": this room is reserved on
  // Unified too, where the people here are on the other side of the world.
  'civic-listening': reserved(
    'Civic Listening',
    'A turn spent hearing what the people here think, before anyone answers them.',
  ),
  'common-grounds': reserved(
    'Common Grounds',
    'The things already agreed on here, found in what members have said rather than asked in a poll.',
  ),
  'focused-communities': reserved(
    'Focused Communities',
    'Smaller rooms inside this one, for the handful who are working on the same thing.',
  ),
  // 🔴 The extra line is the point of this entry. It is the SAME voting
  // primitive as the seed vote at the other end of a topic's life — chosen
  // before a topic arrives, used again after — and saying so sets the right
  // expectation now and keeps whoever builds it from building it twice.
  'slice-action-votes': reserved(
    'What should we do about it?',
    'Once a topic here has been talked through, a vote on what this community actually does about it. It is the same vote that chooses which topics arrive in the first place, at the other end of a topic’s life, so it lands in both places at once.',
  ),
}
