import type { ReactNode } from 'react'
import type { SliceType } from '../types/database'
import type { NextElection } from '../hooks/useNextElection'
import { daysUntil } from '../hooks/useNextElection'
import { SLICE_COPY } from '../lib/sliceCopy'
import { geoidToDisplayName } from '../lib/geoidToWiki'

interface HeroBannerProps {
  sliceType: SliceType
  /** Census geoid; its first two digits name the state for the eyebrow. */
  geoid: string
  sliceName: string
  /** The level's tab label ("City", "Federal", …), shown as the eyebrow. */
  levelLabel: string
  /** Members of the slice on screen — the member's own, or the sibling being browsed. */
  memberCount: number
  /**
   * Members across every slice of this jurisdiction, once the siblings are known and
   * there is more than one. Omitted otherwise: with one slice it equals memberCount.
   */
  locationMemberCount?: number
  /** The slice switcher (SliceSelector, image tone). Rendered by the caller, which owns the sibling query. */
  switcher: ReactNode
  /** undefined = unknown (loading or failed, render nothing); null = nothing upcoming on file. */
  nextElection: NextElection | null | undefined
  forecastUrl: string | null
  photoUrl?: string | null
  /**
   * Attribution for `photoUrl`, rendered bottom-right.
   *
   * 🔴 NOT DECORATION. The shared banner library is Wikimedia-sourced and most of it
   * is CC BY or CC BY-SA, which require the author be named visibly. If a caller has
   * a credit, this component must display it — do not hide it behind a hover, a
   * breakpoint, or a colour too faint to read.
   */
  credit?: string | null
}

// Chips sit on an arbitrary photo, so they carry their own dark ground rather than
// relying on the gradient: white on black/40 stays legible over a bright sky.
const CHIP = 'inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs font-medium text-white'

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function BallotIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function CloudIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-8 8M10 5H6a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-4" />
    </svg>
  )
}

function formatElectionDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  // Constructed as a local date: new Date('2026-11-03') would be UTC midnight and
  // print as Nov 2 anywhere west of Greenwich.
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Plain count, no urgency: ev-cto CONSTRAINTS rules out pressure mechanics. */
function countdownLabel(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export function HeroBanner({
  sliceType,
  geoid,
  sliceName,
  levelLabel,
  memberCount,
  locationMemberCount,
  switcher,
  nextElection,
  forecastUrl,
  photoUrl,
  credit,
}: HeroBannerProps) {
  const copy = SLICE_COPY[sliceType]

  // undefined = still loading — don't show defaultPhoto yet (avoids flash of wrong image)
  // null      = loaded, no wiki image — fall back to defaultPhoto
  const resolvedPhoto = photoUrl === undefined
    ? null
    : (photoUrl ?? copy?.defaultPhoto ?? null)

  const hasFacts = nextElection !== undefined || !!forecastUrl
  const showCredit = !!resolvedPhoto && !!credit

  // City and county name their state too — always known from the geoid, even when the
  // place name itself could not be resolved and the title falls back to "City".
  const stateName = sliceType === 'city' || sliceType === 'county'
    ? geoidToDisplayName('state', geoid.slice(0, 2))
    : null

  return (
    <div
      className={[
        // No overflow-hidden here: the slice switcher's menu has to drop out of the
        // banner over the feed. The photo layer below clips itself instead.
        'relative rounded-2xl',
        // PR #86's banner heights, as floors rather than fixed heights: the copy is
        // bottom-anchored, and on a narrow phone the chips can need more than 10rem, so
        // the banner grows there instead of clipping the title off the top.
        'flex flex-col justify-end min-h-40 sm:min-h-48 md:min-h-56 lg:min-h-64',
        // 🔴 shrink-0 IS LOAD-BEARING. In a flex column a flex item defaults to
        // flex-shrink:1, and once there were posts below the column squashed the banner
        // to nothing while it stayed in the DOM with its image loaded.
        'shrink-0',
        // Brand-gradient ground, not flat gray: it shows through whenever no banner
        // resolves (an uncovered county, a Wikipedia miss), and while an image decodes.
        'bg-gradient-to-br from-brand to-brand-hover',
        'dark:from-brand-hover dark:to-[#00212B]',
        'dark:ring-1 dark:ring-white/10',
      ].join(' ')}
    >
      {/* Photo layer — clipped to the rounded corners on its own. */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
        {resolvedPhoto && (
          <img
            src={resolvedPhoto}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
            style={{ opacity: 0 }}
            onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1' }}
          />
        )}
        {/* One scrim, bottom-up, fully clear at the top: all the copy sits along the
            bottom edge, and the chips carry their own dark ground, so the top of the
            photo needs no darkening. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
      </div>

      <div className={`relative z-10 flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-end md:justify-between md:gap-6 ${showCredit ? 'pb-2 sm:pb-2 md:pb-7' : ''}`}>
        {/* Where you are, and which slice of it */}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)]">
            {levelLabel}
            {stateName && <span className="text-white/70"> · {stateName}</span>}
          </p>
          <h2 className="mt-0.5 text-2xl font-bold leading-tight text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.6)] md:text-3xl">
            {sliceName}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {switcher}
            <span className={CHIP}>
              <UsersIcon />
              {memberCount.toLocaleString()}
              <span className="sm:hidden">in slice</span>
              <span className="hidden sm:inline">{memberCount === 1 ? 'member' : 'members'} in this slice</span>
            </span>
            {locationMemberCount !== undefined && (
              <span className={CHIP}>
                {locationMemberCount.toLocaleString()} across {sliceName}
              </span>
            )}
          </div>
        </div>

        {/* Civic facts — only what a real source answered */}
        {hasFacts && (
          <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end md:flex-shrink-0">
            {nextElection && (
              <span className={CHIP} title={nextElection.name}>
                <BallotIcon />
                <span>
                  <span className="hidden sm:inline">Next election </span>
                  <span className="sm:hidden">Election </span>
                  {formatElectionDate(nextElection.date)}
                  <span className="text-white/80"> · {countdownLabel(daysUntil(nextElection.date))}</span>
                </span>
              </span>
            )}
            {nextElection === null && (
              <span className={CHIP}>
                <BallotIcon />
                No upcoming election on file
              </span>
            )}
            {forecastUrl && (
              <a
                href={forecastUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${CHIP} hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 transition-colors`}
              >
                <CloudIcon />
                Forecast
                <ExternalIcon />
                <span className="sr-only">(National Weather Service, opens in a new tab)</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Image credit — a licence condition on the shared banner library, so it sits
          above the scrims and stays visible at every breakpoint. In flow on phones, where
          a credit that wraps to two lines would otherwise land on the chips; pinned
          bottom-right from md up, under the facts column. z-[5], below the content
          layer's z-10, so the slice switcher's open menu paints over it. */}
      {showCredit && (
        <p
          className="relative z-[5] px-4 pb-2 text-right text-[11px] leading-tight text-white/75 sm:px-5 md:absolute md:bottom-1.5 md:right-3 md:max-w-[70%] md:p-0"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {credit}
        </p>
      )}
    </div>
  )
}
