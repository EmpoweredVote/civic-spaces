import { useState } from 'react'
import type { SliceType } from '../types/database'
import type { CurrentWeather } from '../hooks/useCurrentWeather'
import { toCelsius } from '../hooks/useCurrentWeather'
import type { NextElection } from '../hooks/useNextElection'
import { daysUntil } from '../hooks/useNextElection'
import { SLICE_COPY } from '../lib/sliceCopy'
import { geoidToDisplayName } from '../lib/geoidToWiki'
import { Emoji } from './Emoji'

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
  /** 2020 Census total population of the area, when Census answered. */
  population?: number
  /** undefined = unknown (loading or failed, render nothing); null = nothing upcoming on file. */
  nextElection: NextElection | null | undefined
  /** Plain weather.gov link, used only when live conditions are unavailable. */
  forecastUrl: string | null
  /** Live NWS conditions for a city or county, when the lookup answered. */
  weather?: CurrentWeather
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

function ExternalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-8 8M10 5H6a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-4" />
    </svg>
  )
}

type TempUnit = 'F' | 'C'
const TEMP_UNIT_KEY = 'cs_temp_unit'

/** Per-viewer display preference only, so browser storage is enough; it can be absent or throw. */
function readTempUnit(): TempUnit {
  try {
    return localStorage.getItem(TEMP_UNIT_KEY) === 'C' ? 'C' : 'F'
  } catch {
    return 'F'
  }
}

function writeTempUnit(unit: TempUnit) {
  try {
    localStorage.setItem(TEMP_UNIT_KEY, unit)
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
}

/**
 * An emoji for NWS's short forecast ("Mostly Cloudy", "Chance Showers", ...). Checked
 * most-severe first, so "Chance T-storms, Rain" reads as a storm, not rain.
 */
function weatherEmoji(summary: string): string {
  const s = summary.toLowerCase()
  if (/thunder|t-storm|storm/.test(s)) return '⛈️'
  if (/snow|flurr|sleet|ice|blizzard/.test(s)) return '🌨️'
  if (/rain|shower|drizzle/.test(s)) return '🌧️'
  if (/fog|haze|smoke|mist/.test(s)) return '🌫️'
  if (/wind|breez/.test(s)) return '💨'
  if (/partly|mostly sunny|mostly clear/.test(s)) return '⛅'
  if (/cloud|overcast/.test(s)) return '☁️'
  if (/sun|clear|fair/.test(s)) return '☀️'
  return '🌤️'
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
  population,
  nextElection,
  forecastUrl,
  weather,
  photoUrl,
  credit,
}: HeroBannerProps) {
  const copy = SLICE_COPY[sliceType]

  // undefined = still loading — don't show defaultPhoto yet (avoids flash of wrong image)
  // null      = loaded, no wiki image — fall back to defaultPhoto
  const resolvedPhoto = photoUrl === undefined
    ? null
    : (photoUrl ?? copy?.defaultPhoto ?? null)

  const [unit, setUnit] = useState<TempUnit>(readTempUnit)
  const chooseUnit = (next: TempUnit) => {
    setUnit(next)
    writeTempUnit(next)
  }
  const showCredit = !!resolvedPhoto && !!credit

  // City and county name their state too — always known from the geoid, even when the
  // place name itself could not be resolved and the title falls back to "City".
  const stateName = sliceType === 'city' || sliceType === 'county'
    ? geoidToDisplayName('state', geoid.slice(0, 2))
    : null

  return (
    <div
      className={[
        // The photo layer below clips itself to the corners, so the frame needs no
        // overflow-hidden — and anything positioned later is free to overhang.
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

      <div className={`relative z-10 flex flex-col gap-3 p-4 sm:p-5 ${showCredit ? 'pb-2 sm:pb-2 md:pb-7' : ''}`}>
        {/* Where you are, and which slice of it */}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white [text-shadow:0_0_2px_rgb(0_0_0_/_0.9),0_1px_6px_rgb(0_0_0_/_0.8)]">
            {levelLabel}
            {/* No top scrim (the photo stays clear up there), so on a phone, where the
                copy fills the banner, these two lines carry their own heavy shadow. */}
            {stateName && <span className="text-white/85"> · {stateName}</span>}
          </p>
          <h2 className="mt-0.5 text-2xl font-bold leading-tight text-white [text-shadow:0_0_3px_rgb(0_0_0_/_0.7),0_1px_8px_rgb(0_0_0_/_0.6)] md:text-3xl">
            {sliceName}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={CHIP}>
              <Emoji symbol="👥" className="text-sm" />
              {memberCount.toLocaleString()}
              <span className="sm:hidden">in slice</span>
              <span className="hidden sm:inline">{memberCount === 1 ? 'member' : 'members'} in this slice</span>
            </span>
            {locationMemberCount !== undefined && (
              <span className={CHIP}>
                {locationMemberCount.toLocaleString()} across {sliceName}
              </span>
            )}
            {population !== undefined && (
              <span className={CHIP} title="Total population, 2020 U.S. Census">
                <Emoji symbol="🏘️" className="text-sm" />
                {population.toLocaleString()} residents
                <span className="hidden sm:inline text-white/80">· 2020 Census</span>
              </span>
            )}
            {/* Civic facts — only what a real source answered — on the same row as
                the counts, so the banner reads as one line of facts under the name. */}
            {nextElection && (
              <span className={CHIP} title={nextElection.name}>
                <Emoji symbol="🗳️" className="text-sm" />
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
                <Emoji symbol="🗳️" className="text-sm" />
                No upcoming election on file
              </span>
            )}
            {weather && (
              <span className={`${CHIP} pr-1`}>
                <a
                  href={weather.forecastUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${weather.summary} — full forecast at weather.gov`}
                  className="inline-flex items-center gap-1.5 rounded-full hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <Emoji symbol={weatherEmoji(weather.summary)} className="text-sm" />
                  <span className="font-semibold tabular-nums">
                    {unit === 'F' ? Math.round(weather.tempF) : toCelsius(weather.tempF)}°{unit}
                  </span>
                  <span className="hidden sm:inline text-white/80">· {weather.summary}</span>
                  <span className="sr-only">, now. Full forecast at the National Weather Service, opens in a new tab</span>
                </a>
                {/* Two-state switch, so the unit on screen is always the one pressed. */}
                <span role="group" aria-label="Temperature unit" className="ml-1 inline-flex rounded-full bg-white/15 p-0.5">
                  {(['F', 'C'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={unit === u}
                      onClick={() => chooseUnit(u)}
                      className={[
                        'rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold transition-colors',
                        unit === u ? 'bg-white text-gray-900' : 'text-white/85 hover:text-white',
                      ].join(' ')}
                    >
                      °{u}
                    </button>
                  ))}
                </span>
              </span>
            )}
            {!weather && forecastUrl && (
              <a
                href={forecastUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${CHIP} hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 transition-colors`}
              >
                <Emoji symbol="🌤️" className="text-sm" />
                Forecast
                <ExternalIcon />
                <span className="sr-only">(National Weather Service, opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>

      </div>

      {/* Image credit — a licence condition on the shared banner library, so it sits
          above the scrims and stays visible at every breakpoint. In flow on phones, where
          a credit that wraps to two lines would otherwise land on the chips; pinned
          bottom-right from md up, under the facts column. z-[5] keeps it beneath the
          content layer (z-10), so no chip tooltip or overlay is ever painted over. */}
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
