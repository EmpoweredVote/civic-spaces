import { CivicSpacesMark } from './CivicSpacesMark'
import { PlacePicker } from './PlacePicker'
import { CARD, FOCUS } from './explore/exploreUi'
import type { ResolvedPlace } from '../lib/placeResolve'

/**
 * The first screen a visitor with no session sees.
 *
 * It replaces one grey sentence, one button, and 580 words of `geoid: null`
 * Explore addressed to a community nobody is in (D-06, D-09).
 *
 * ── 🔴 Every word here must be true on the day it ships ──────────────────────
 *
 * In Phase 17 conversations are still members-only: every `civic_spaces` grant
 * is `TO authenticated`, and `posts_select_sibling_slice` requires `geoid`
 * equality, so an observer reads zero forum rows and so does a signed-in member
 * looking at another city. D-07's "observation covers Explore AND conversations"
 * and D-08's "fully public, and scrapable" are **Phase 18**.
 *
 * So the copy below never says conversations are public, open or readable by
 * anyone; never implies a post will be findable (🔴 D-25 and Pitfall 11 — this
 * is a client-rendered Vite SPA with no SSR, no prerender, no `robots.txt` and
 * one static set of `og:` tags, so crawlable is not indexed even after Phase 18,
 * and the exposure that phase creates is the PostgREST endpoint, not these
 * pages); and never says *anonymous* or *untraceable* (🔴 D-17, D-02 — Connect
 * privacy is not protection from consequence, there is a paper trail, and that
 * is how mis- and disinformation sources are identified). The honest words are
 * **private from other members**.
 *
 * D-05's target feeling — a town square rather than an anonymous internet forum
 * — is aimed at rather than stated, which is also why "4chan" is nowhere near
 * this file: it is Chris's shorthand for the anti-goal, not public copy.
 *
 * ── The pillar copy is QUOTED, not invented ──────────────────────────────────
 *
 * Research Q5 searched `ev-ui`, the landing site and the accounts app and found
 * no shipped pillar copy anywhere. The canonical source is
 * `empowered-vote-primer.md` § The Three Pillars, committed in this repo, and it
 * already carries Chris's line:
 *
 *   > **Philosophy:** Authenticated, pseudonymous community. We don't need to
 *   > know who users are — we need to ensure each person has exactly one voice
 *   > and lives where they claim.
 *
 * It is below in the second person with nothing else changed. 🔴 The second half
 * is not decoration: *lives where they claim* is the entire reason an address is
 * asked for, and it is the bridge into the privacy block.
 *
 * 🔴 Terminology, from the primer: the PILLAR is *Connect*; the TIER is
 * *Connected* (`tier: 'connected'` in `database.ts`). Never "Connect account".
 *
 * ── The primary action is the picker, not sign-in ────────────────────────────
 *
 * D-18: *"Anyone should be expected to observe a Civic Slice."* And
 * `9_Connect_Civil-Civics_Equal-Slices-detailed.md` § "Phase 0: Inform Lurker":
 * *"We don't create artificial friction ('You must create account to see
 * more!')."* Sign-in is secondary here and stays reachable in the header's
 * ProfileMenu, which already renders for a signed-out visitor.
 */

/** One block of the three. SVG marks only — 🔴 never an emoji as a UI icon. */
function Block({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className={`${CARD} flex flex-col gap-3 p-5`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand dark:bg-brand/20 dark:text-brand-light">
          {icon}
        </span>
        <h3 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </section>
  )
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function SpeechIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3-3h11a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14z" />
    </svg>
  )
}

function ShieldPinIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.7l7 2.8v5.1c0 4.4-2.9 8.4-7 9.7-4.1-1.3-7-5.3-7-9.7V5.5l7-2.8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.2s-2.6-2.1-2.6-3.9a2.6 2.6 0 115.2 0c0 1.8-2.6 3.9-2.6 3.9z" />
    </svg>
  )
}

export function WelcomeScreen({
  loginUrl,
  onResolved,
}: {
  loginUrl: string
  /** The geoids of the place the visitor named. AppShell holds them from here. */
  onResolved: (place: ResolvedPlace) => void
}) {
  return (
    <div data-welcome-screen="" className="flex flex-1 justify-center px-4 py-8 md:py-14">
      {/* Capped around 65–75 characters at desktop width, not the full grid: a
          line of body copy the width of a 1440px page is unreadable. */}
      <div className="flex w-full max-w-2xl flex-col gap-8 md:gap-10">
        {/* ── 1. The mark, the name, and one sentence of what this is ──────── */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <CivicSpacesMark className="h-8 w-8 flex-shrink-0" />
            <p className="text-lg font-extrabold tracking-tight">
              <span className="text-brand dark:text-brand-light">Civic</span>{' '}
              <span className="text-brand-coral-text dark:text-brand-coral">Spaces</span>
            </p>
          </div>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            A civic space for every government you live under — your city, your county, your
            state, and the country. Part of Empowered Vote&rsquo;s Connect pillar.
          </p>
        </header>

        {/* ── 2. The headline, and the invitation to look ──────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Wraps cleanly at 390px: no fixed width, and the largest step only
              from md up. */}
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-4xl dark:text-gray-100">
            Look at any place.
            <br />
            Speak where you live.
          </h2>
          <p className="text-base leading-relaxed text-gray-600 dark:text-gray-300">
            Name a city, town or county and its civic spaces open: what its government is working
            on, who represents it, what is on its calendar, and when it votes next. No account
            needed to look.
          </p>
        </div>

        {/* ── 3. The primary action, above the fold at 390x844 ─────────────── */}
        <div className={`${CARD} p-5`}>
          <PlacePicker size="hero" onResolved={onResolved} />
        </div>

        {/* ── The Connect pillar, quoted from the primer ───────────────────── */}
        <blockquote className="border-l-4 border-brand/40 pl-4 dark:border-brand-light/40">
          <p className="text-base leading-relaxed text-gray-700 md:text-lg dark:text-gray-200">
            &ldquo;We don&rsquo;t need to know who you are. We need to be sure that{' '}
            <strong className="font-bold text-gray-900 dark:text-gray-100">
              each person has exactly one voice
            </strong>{' '}
            — and lives where they claim.&rdquo;
          </p>
          <footer className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
            Connect &middot; Unpacking Shared Values
          </footer>
        </blockquote>

        {/* ── 4. Three blocks, and no more ─────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Block icon={<EyeIcon />} title="Look anywhere">
            <p>
              Any city, town or county in the country — not only the ones you live in. What its
              government has on the agenda, who represents it, what is on its calendar, and when
              it votes next.
            </p>
            <p>
              Looking somewhere you do not live is normal use, not an edge case.
            </p>
          </Block>

          <Block icon={<SpeechIcon />} title="Speak where you live">
            <p>
              Posting, replying and voting belong to the people who live under that government.
              Each person gets one voice in their own civic spaces, which is also what keeps bots
              out of them.
            </p>
            {/*
              🔴 PHASE 18 REVISES THIS PARAGRAPH. Today conversations are
              members-only — every civic_spaces grant is TO authenticated — so
              "and reading them needs an account too" is TRUE and must be said.
              Phase 18 (The Public Square) opens anon read, and on the day that
              migration lands this sentence becomes false. Recorded in
              17-VALIDATION.md § Known gaps so that phase can grep for
              "PHASE 18" rather than re-read the screen.
            */}
            <p>
              Conversations are for members right now, and reading them needs an account too.
            </p>
            <p>
              {/* 🔴 BOTH walls. "Make an account" is only the first: Civic Spaces
                  needs the Connected tier, and Connected means an address has
                  been set, because slice assignment runs off encrypted
                  coordinates. Copy that stops at "make an account" strands
                  exactly the person it was written for — and D-11 asks that the
                  ceiling be known before anything is pressed, not after. */}
              An Empowered Vote account with an address set opens your own spaces. You cannot post
              here yet — that is what an account is for.
            </p>
          </Block>

          <Block icon={<ShieldPinIcon />} title="What happens to an address">
            {/*
              🔴 The three things this block must not say, each already decided:
              not "your address never leaves your browser" (research Q1.8 — the
              geocoder's host sees it on every path, GET or POST, and the member
              path has the same property); not "anonymous" or "untraceable"
              (D-17, D-02); and nothing about conversations being public or
              findable (D-25, the phase boundary). D-16's claim as written —
              geocoded once and never kept — is true, and must not be allowed to
              grow into any of those.
            */}
            <p>
              An address is geocoded <strong className="font-semibold text-gray-900 dark:text-gray-100">once</strong>, to
              work out which boundaries it falls inside, and then it is gone: not stored, not
              shown back to you, and not in any profile Civic Spaces holds.
            </p>
            <p>
              Civic Spaces only ever learns the boundary geoids. A boundary geoid is a category;
              an address is not.
            </p>
            <p>
              Members post under a handle, which keeps your name private from other members.
            </p>
          </Block>
        </div>

        {/* ── 5. The secondary action, naming both walls again ─────────────── */}
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          Already have an Empowered Vote account?{' '}
          <a
            href={loginUrl}
            className={`rounded font-semibold text-brand underline hover:no-underline dark:text-brand-light ${FOCUS}`}
          >
            Sign in
          </a>
          . Your spaces appear once an address is set on your account — an account without one
          opens none yet.
        </p>

        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
          Empowered Vote: Shared Facts &middot; Shared Values &middot; Shared Solutions.
        </p>
      </div>
    </div>
  )
}
