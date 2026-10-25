/**
 * The welcome for a place nobody has written a word about yet.
 *
 * 🔴 Shipped WITHOUT the vote behind it. Chris, 2026-10-24: *"show it without
 * the vote for now."* Recording which issues a member picks is a write, it
 * needs a table and a route that do not exist, and a vote that evaporates on
 * reload is worse than no vote — so it is its own later plan. **Nothing in this
 * file stores anything**: not in `localStorage`, not in `sessionStorage`, not
 * anywhere. Nothing here may pretend to, either.
 *
 * 🔴 The four shapes this card must never take, and the reason the committed
 * check `scripts/check-explore-rooms.mjs` exists rather than a comment:
 *
 *   1. A **disabled** button. Dimming a control and changing its cursor is the
 *      generic advice for something temporarily unavailable to YOU. This one is
 *      unavailable to everyone until a later phase, and dimmed-out it reads as
 *      "broken" or "you are not allowed". Both untrue.
 *   2. An **enabled** button that stores nothing. The worst of the four,
 *      because it looks alive. A member told their voice counted when nothing
 *      was stored has been lied to.
 *   3. Radios or chips that select and then evaporate on reload. The same lie
 *      with extra steps, and it looks like it worked.
 *   4. A card that says only "coming soon" — the dead end 16-DESIGN goal 6
 *      forbids, in its purest form.
 *
 * So: real content, ONE real control, and one plain sentence about what arrives
 * next. If a thing here can be clicked, clicking it does something observable.
 * If a thing cannot be done yet it is described in prose and is NOT shaped like
 * a control. There is no `disabled`, no `aria-disabled` and no
 * `cursor-not-allowed` anywhere in this file, and no `input` or `textarea`.
 *
 * 🔴 The copy trap. The questions on an unseeded page are the by-level generic
 * set ordered by `rankByCompass`, which reads the VIEWING MEMBER's own answers
 * and nothing else. Never write copy that attributes the ordering to the people
 * who live there — not "what people here care about", not "your neighbours'
 * priorities". Each of those describes a slice-wide aggregate of members'
 * political answers. **No such aggregate exists, no endpoint serves one, and
 * locked decision 7 says none should be designed**, precisely so the privacy
 * question that comes with it stays closed. A sentence is all it would take to
 * promise one.
 *
 * `ctx.isViewOnly` is deliberately NOT read here. Every write affordance is
 * gated on it; this module has none — its single control is navigation
 * (`openTopic`), which RLS has no opinion about, and gating it would reduce
 * another shard's Explore to a dead page for no gain. Stated rather than
 * silent, because "the module that forgot the gate" is the shape this repo has
 * shipped before. `scripts/check-explore-gate.mjs` is what keeps it honest.
 *
 * No entrance animation. `motion/react` ships `useReducedMotion` at runtime but
 * this version does not DECLARE it, so a reduced-motion guard would not
 * typecheck — and a welcome that slides in for someone who asked the OS to stop
 * things moving is not welcoming. A card that simply appears costs nothing.
 */

import { useId } from 'react'
import type { ExploreCtx } from '../ExploreContext'
import { ArrowIcon, CARD, PrimaryButton } from '../exploreUi'

/**
 * An empty noticeboard: one sheet pinned up, room for the rest.
 *
 * Decorative and `aria-hidden` — every word it could carry is in the prose
 * beside it, so a screen reader loses nothing. SVG, never an emoji.
 */
function NoticeboardScene() {
  return (
    <svg
      viewBox="0 0 120 100"
      className="h-24 w-32 @xl:h-44 @xl:w-60 text-brand dark:text-brand-light"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M32 66v28M88 66v28" />
      <rect x="14" y="12" width="92" height="54" rx="7" />
      <rect x="28" y="24" width="28" height="30" rx="4" />
      <path d="M34 32h16M34 39h12M34 46h16" strokeWidth={1.75} className="opacity-70" />
      <path d="M68 30h24M68 39h18M68 48h24" strokeWidth={1.75} strokeDasharray="3 7" className="opacity-55" />
    </svg>
  )
}

export function SeedInvitationModule({ ctx }: { ctx: ExploreCtx }) {
  const headingId = useId()
  const { placeName, composition } = ctx

  /**
   * Belt and braces with the registry's `available()`. An invitation that
   * cannot name the place is not an invitation, and a sentence with a hole in
   * it is worse than a frame of nothing.
   */
  if (!placeName) return null

  /**
   * The one control's destination: the first candidate topic on this page.
   * `topicsById` resolves it, and a topic that does not resolve means NO BUTTON
   * — never a dead one. TopicId has been a plain string since 16-01, so every
   * lookup is partial and this guard is real rather than ceremonial.
   */
  const firstTopicId = composition.featuredTopicId ?? composition.questionTopicIds[0] ?? null
  const firstTopic = firstTopicId ? ctx.topicsById.get(firstTopicId) : undefined

  /**
   * Is the ordering below actually this member's?
   *
   * `rankByCompass` returns source order untouched below MIN_RANKED answers,
   * and scores every topic 0 when none of them maps to something the member has
   * answered. Either way the ranking clause would be a small lie — told to most
   * members, since the dev id's Compass calls 401 and plenty of real members
   * have answered nothing. ExploreView computes this; see ExploreCtx.
   */
  const { compassRanked } = ctx

  return (
    <section
      aria-labelledby={headingId}
      className={`${CARD} @container/seed overflow-hidden`}
    >
      <div className="grid @xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        {/* The words come first in the DOM and on the left from @xl, so the place
            is named before anything else is read — on a phone too, where the
            panel below would otherwise push the welcome down the screen. */}
        <div className="flex flex-col gap-3 p-5 @xl:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
            A new civic space
          </p>
          {/* SectionHeader's heading scale, deliberately not a bigger one: this
              card introduces what is below it, and must not become the page. */}
          <h3
            id={headingId}
            className="text-2xl font-medium leading-tight tracking-tight text-gray-900 dark:text-gray-100"
          >
            {placeName} is wide open.
          </h3>

          <p className="max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            This is where people in {placeName} work out what is worth talking about,
            understanding and doing together. Nobody has shaped it yet, so there is nothing
            to catch up on and no wrong place to start.
          </p>

          {/* 🔴 The honest line. "come up in most places" and "your own answers"
              are both load-bearing — see the copy trap at the top of this file. */}
          <p className="max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            The questions below are ones that come up in most places; nothing has been
            written about {placeName} in particular yet.
            {compassRanked
              ? ' Your own Compass answers put the closest ones first.'
              : ''}
          </p>

          {firstTopic && (
            <div className="mt-1">
              {/* 🔴 One control, and it really works: it opens the first
                  candidate topic, which is a page a member can read and start a
                  conversation from right now. `lg` is the only size in
                  exploreUi's vocabulary whose box clears 44x44 on a phone. */}
              <PrimaryButton size="lg" onClick={() => ctx.openTopic(firstTopic.id)}>
                Open the first question <ArrowIcon />
              </PrimaryButton>
            </div>
          )}

          {/* 🔴 The "arrives next" sentence, in the DOM as prose — not a
              tooltip, not a `title`, not revealed on hover, so a screen reader
              and a phone both get it. Then it STOPS: no countdown, no badge, no
              waitlist, no notify-me. A notify-me is a write, and it is the
              second prohibited shape in its most tempting form. */}
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Soon you will be able to tell us which of these this space should focus on, and
            ask for one that is missing.
          </p>
        </div>

        {/* The quiet brand-tinted panel, below the words on a phone and beside
            them from @xl — the same tint and the same divider ImagineActivity
            uses, so the two cards read as one page. */}
        <div className="flex items-center justify-center border-t border-gray-200/70 bg-[#EEF8F5] p-4 dark:border-white/[0.06] dark:bg-brand/[0.08] @xl:border-t-0 @xl:border-l @xl:p-6">
          <NoticeboardScene />
        </div>
      </div>
    </section>
  )
}
