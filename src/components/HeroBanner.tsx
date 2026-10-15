import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { SliceType } from '../types/database'
import type { CurrentWeather } from '../hooks/useCurrentWeather'
import { toCelsius } from '../hooks/useCurrentWeather'
import type { NextElection } from '../hooks/useNextElection'
import { daysUntil } from '../hooks/useNextElection'
import { SLICE_COPY } from '../lib/sliceCopy'
import { geoidToDisplayName } from '../lib/geoidToWiki'
import { POPULATION_SOURCE } from '../lib/geoNames'
import { creditParts } from '../lib/banners'
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
  /** Total population of the area from POPULATION_SOURCE, when Census answered. */
  population?: number
  /**
   * True when the member count and election come from local dev fixtures (?dev=1), so
   * their details say so rather than passing sample numbers off as live figures.
   */
  isSampleData?: boolean
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
const CHIP = 'inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap'

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
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days.toLocaleString()} days`
}

/** The same countdown as a phrase, for the election's details. */
function electionWhen(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days.toLocaleString()} days`
}

const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

const SAMPLE_NOTE = 'Sample data for local preview, not a live figure.'

/**
 * A banner fact: icon + short value on the chip, the full explanation in a panel.
 *
 * The panel opens on mouse hover, on keyboard focus and on tap, and closes on Escape,
 * on a tap elsewhere, or when focus leaves — so it never depends on hover alone. It is
 * a disclosure (aria-expanded) rather than role="tooltip" because it can hold a link,
 * and it stays mounted while hidden so aria-describedby still reads it.
 */
function FactChip({ icon, label, details, children }: {
  icon: string
  /** Screen-reader completion of the chip's short value, e.g. "members in this slice". */
  label: string
  details: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ type: string; wasOpen: boolean } | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Keep the panel inside the viewport: a chip at the right edge of a phone would
  // otherwise push a left-aligned panel off screen.
  useLayoutEffect(() => {
    if (!open) {
      setShift(0)
      return
    }
    const r = panelRef.current?.getBoundingClientRect()
    if (!r) return
    const vw = document.documentElement.clientWidth
    let dx = 0
    if (r.right > vw - 8) dx = vw - 8 - r.right
    if (r.left + dx < 8) dx = 8 - r.left
    setShift(dx)
  }, [open])

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false) }}
      onBlur={(e) => { if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={panelId}
        onPointerDown={(e) => { pointer.current = { type: e.pointerType, wasOpen: open } }}
        onFocus={() => setOpen(true)}
        onClick={() => {
          // A tap toggles. A mouse click or Enter only ever opens: hover or focus has
          // already opened it, so toggling there would close what the click asked for.
          const p = pointer.current
          pointer.current = null
          setOpen(p && p.type !== 'mouse' ? !p.wasOpen : true)
        }}
        className={`${CHIP} cursor-default hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 transition-colors`}
      >
        <Emoji symbol={icon} className="text-sm" />
        {children}
        <span className="sr-only"> {label}</span>
      </button>
      {/* pb-2 is a hover bridge: the gap between chip and panel is still inside the
          wrapper, so moving the mouse up into the panel does not close it. Opens
          upward, into the photo, so the sticky tab bar below never covers it. */}
      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="absolute bottom-full left-0 z-20 pb-2"
        style={shift ? { transform: `translateX(${shift}px)` } : undefined}
      >
        <div className="w-max max-w-[16rem] rounded-lg bg-gray-900/95 px-3 py-2 text-xs leading-relaxed text-white/85 shadow-lg ring-1 ring-white/15 backdrop-blur-sm">
          {details}
        </div>
      </div>
    </span>
  )
}

export function HeroBanner({
  sliceType,
  geoid,
  sliceName,
  levelLabel,
  memberCount,
  population,
  isSampleData = false,
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
  const parts = credit ? creditParts(credit) : null

  // City and county name their state too — always known from the geoid, even when the
  // place name itself could not be resolved and the title falls back to "City".
  const stateName = sliceType === 'city' || sliceType === 'county'
    ? geoidToDisplayName('state', geoid.slice(0, 2))
    : null

  const electionDays = nextElection ? daysUntil(nextElection.date) : 0

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

      {/* 🔴 pointer-events-none is load-bearing, with auto back on the content below.
          md:pb-7 reserves the strip the credit is pinned into, and padding is part of
          this box's hit area — so at md+ this layer (z-10) swallowed every click on the
          credit (z-[5]) beneath it. Harmless while the credit was plain text; the licence
          is a link now. Paint order is untouched, so the chip panels still sit above it. */}
      <div className={`pointer-events-none relative z-10 flex flex-col gap-3 p-4 sm:p-5 ${showCredit ? 'pb-2 sm:pb-2 md:pb-7' : ''}`}>
        {/* Where you are, and which slice of it */}
        <div className="pointer-events-auto min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white [text-shadow:0_0_2px_rgb(0_0_0_/_0.9),0_1px_6px_rgb(0_0_0_/_0.8)]">
            {levelLabel}
            {/* No top scrim (the photo stays clear up there), so on a phone, where the
                copy fills the banner, these two lines carry their own heavy shadow. */}
            {stateName && <span className="text-white/85"> · {stateName}</span>}
          </p>
          <h2 className="mt-0.5 text-2xl font-bold leading-tight text-white [text-shadow:0_0_3px_rgb(0_0_0_/_0.7),0_1px_8px_rgb(0_0_0_/_0.6)] md:text-3xl">
            {sliceName}
          </h2>

          {/* One row of short facts: icon + value. The sentence behind each one is in its
              details panel, so the row scans at a glance and still wraps cleanly. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FactChip
              icon="👥"
              label={memberCount === 1 ? 'member in this slice' : 'members in this slice'}
              details={
                <>
                  <span className="font-semibold text-white">
                    {memberCount.toLocaleString()} {memberCount === 1 ? 'member' : 'members'}
                  </span>{' '}
                  in this slice
                  {isSampleData && <span className="mt-1 block text-white/70">{SAMPLE_NOTE}</span>}
                </>
              }
            >
              <span className="font-semibold tabular-nums">{memberCount.toLocaleString()}</span>
            </FactChip>
            {population !== undefined && (
              <FactChip
                icon="🏘️"
                label={`residents, ${POPULATION_SOURCE.year} Census`}
                details={
                  <>
                    <span className="block font-semibold text-white">{population.toLocaleString()} residents</span>
                    <span className="block">Total population, {POPULATION_SOURCE.name}.</span>
                    <a
                      href={POPULATION_SOURCE.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 rounded font-medium text-white underline underline-offset-2 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      About this Census dataset
                      <ExternalIcon />
                      <span className="sr-only">(census.gov, opens in a new tab)</span>
                    </a>
                  </>
                }
              >
                <span className="text-white/80">Pop.</span>
                <span className="font-semibold tabular-nums">{compactNumber.format(population)}</span>
              </FactChip>
            )}
            {/* Civic facts — only what a real source answered. */}
            {nextElection && (
              <FactChip
                icon="🗳️"
                // The name is the visible value plus this, so the phrasing has to suit
                // the value: countdownLabel gives "Today"/"Tomorrow" inside two days,
                // which read as "Today until the next election" against the usual suffix.
                label={electionDays <= 1 ? 'is the next election' : 'until the next election'}
                details={
                  <>
                    <span className="block font-semibold text-white">{nextElection.name}</span>
                    <span className="block">
                      {formatElectionDate(nextElection.date)} · {electionWhen(electionDays)}
                    </span>
                    {isSampleData && <span className="mt-1 block text-white/70">{SAMPLE_NOTE}</span>}
                  </>
                }
              >
                <span className="font-semibold tabular-nums">{countdownLabel(electionDays)}</span>
              </FactChip>
            )}
            {nextElection === null && (
              <FactChip
                icon="🗳️"
                label="for upcoming elections"
                details="No upcoming election is on file for this area."
              >
                <span className="font-medium">None on file</span>
              </FactChip>
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
          content layer (z-10), so no chip details panel is ever painted over. */}
      {/* Short form, "Photo: Author · Licence": author and licence are the conditions,
          so both stay visible; the licence links to its deed when it has one. Dimmer
          than the facts, but the 11px size and shadow keep it readable on any photo. */}
      {showCredit && (
        <p
          className="relative z-[5] px-4 pb-2 text-right text-[11px] leading-tight text-white/70 sm:px-5 md:absolute md:bottom-1.5 md:right-3 md:max-w-[70%] md:p-0"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {parts ? (
            <>
              Photo: {parts.author} ·{' '}
              {parts.licenseUrl ? (
                <a
                  href={parts.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer license"
                  className="rounded underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {parts.license}
                  <span className="sr-only"> (licence, opens in a new tab)</span>
                </a>
              ) : (
                parts.license
              )}
            </>
          ) : (
            credit
          )}
        </p>
      )}
    </div>
  )
}
