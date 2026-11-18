import { useState } from 'react'
import { PlacePicker, Problem, resolveFailureCopy } from './PlacePicker'
import { CARD, FOCUS } from './explore/exploreUi'
import { bannerFor, creditParts } from '../lib/banners'
import { usePlaceResolve } from '../hooks/usePlaceResolve'
import { useCurrentWeather } from '../hooks/useCurrentWeather'
import type { PlaceSearchRow, ResolvedPlace } from '../lib/placeResolve'

/**
 * The first screen a visitor with no session sees.
 *
 * Laid out as a landing page (2026-11-18): the headline and the place picker on
 * the left, a live preview of one real civic space on the right, three short
 * cards and a footer line beneath. It keeps the app's own colours and type.
 *
 * ── 🔴 Every word here must be true on the day it ships ──────────────────────
 *
 * Reading the five public slice types is open to anyone since Phase 18
 * (2026-11-02); WRITING is not, and Volunteer is members-only to read at all.
 * So the copy may say a visitor can look and read, and must name the wall in
 * front of posting: a Connected account (D-11 — the ceiling is known before
 * anything is pressed). It never says *anonymous* or *untraceable* (D-17, D-02),
 * never implies a post will be findable by a search engine (D-25 — this is a
 * client-rendered SPA with no SSR), and the address line says only what is true
 * on every path: Civic Spaces never STORES one. Not "it never leaves your
 * browser" — the geocoder's host sees it (research Q1.8).
 *
 * ── 🔴 The preview is a real place, not a mock-up ────────────────────────────
 *
 * The preview card shows Los Angeles' real shared-library banner with its
 * licence credit (CC BY-SA — the credit is a licence condition, see
 * `banners.ts`), and live conditions from weather.gov through the same hook
 * `HeroBanner` uses, hidden when they do not answer. Nothing on it is invented:
 * no sample topic, no member count. The whole card opens that place through the
 * same resolver the picker uses, so nothing on it is a dead control.
 *
 * ── The primary action is the picker, not sign-in ────────────────────────────
 *
 * D-18: *"Anyone should be expected to observe a Civic Slice."* And
 * `9_Connect_Civil-Civics_Equal-Slices-detailed.md` § "Phase 0: Inform Lurker":
 * *"We don't create artificial friction ('You must create account to see
 * more!')."* Sign-in is secondary here and stays reachable in the header's
 * ProfileMenu, which already renders for a signed-out visitor.
 */

interface QuickPlace {
  geoid: string
  name: string
}

/**
 * Real incorporated places (MTFCC G4110), each with a curated banner in the
 * shared library. They resolve through `resolveChosenPlace` exactly as a picked
 * search row does — the chip carries a geoid, never a typed string.
 */
const FEATURED: QuickPlace & { state: string } = { geoid: '0644000', name: 'Los Angeles', state: 'California' }
const POPULAR: QuickPlace[] = [
  { geoid: '0644000', name: 'Los Angeles' },
  { geoid: '0643000', name: 'Long Beach' },
  { geoid: '0656000', name: 'Pasadena' },
]

function rowFor(place: QuickPlace): PlaceSearchRow {
  return { geo_id: place.geoid, mtfcc: 'G4110' }
}

// ── Icons. SVG only — 🔴 never an emoji as a UI icon. ─────────────────────────

function Svg({ className = 'h-5 w-5', children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const SearchIcon = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
)
const BookIcon = () => (
  <Svg>
    <path d="M12 6.5C10.5 5.3 8.4 4.75 5 4.75v13c3.4 0 5.5.55 7 1.75 1.5-1.2 3.6-1.75 7-1.75v-13c-3.4 0-5.5.55-7 1.75zM12 6.5v13" />
  </Svg>
)
const SpeechIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M7.5 19.5 4 20.5l1-3.4A8 8 0 1 1 7.5 19.5z" />
  </Svg>
)
const CheckIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Svg className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
)
const PersonIcon = () => (
  <Svg className="h-4 w-4">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Svg>
)
const CivicIcon = () => (
  <Svg className="h-4 w-4">
    <path d="M3 9.5 12 4l9 5.5M5 10v8m4.67-8v8m4.66-8v8M19 10v8M3.5 20.5h17" />
  </Svg>
)
const CloudIcon = () => (
  <Svg className="h-4 w-4">
    <path d="M7 18.5a4.5 4.5 0 0 1-.5-8.97 6 6 0 0 1 11.6 1.47A3.75 3.75 0 0 1 17.25 18.5z" />
  </Svg>
)
const ChevronIcon = () => (
  <Svg className="h-5 w-5">
    <path d="m9 6 6 6-6 6" />
  </Svg>
)

/** One of the three cards under the fold. */
function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className={`${CARD} flex items-start gap-4 p-5`}>
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand dark:bg-brand/20 dark:text-brand-light">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{children}</p>
      </div>
    </section>
  )
}

/** The right-hand card: one real civic space, opened with a click. */
function PlacePreview({ onOpen, pending }: { onOpen: () => void; pending: boolean }) {
  const banner = bannerFor('city', FEATURED.geoid)
  const credit = banner ? creditParts(banner.credit) : null
  const weather = useCurrentWeather('city', FEATURED.geoid)

  return (
    <div className={`${CARD} relative overflow-hidden shadow-xl lg:rotate-[0.6deg] motion-safe:transition-transform lg:hover:rotate-0`}>
      {/* ── Photo ── */}
      <div className="relative flex min-h-56 flex-col justify-end bg-gradient-to-br from-brand to-brand-hover p-6 sm:min-h-64 dark:from-brand-hover dark:to-[#00212B]">
        {banner && (
          <img
            src={banner.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" aria-hidden="true" />

        <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-yellow px-3 py-1.5 text-xs font-bold text-gray-900 shadow-sm">
          <CheckIcon className="h-3.5 w-3.5" />
          No account needed to explore
        </span>

        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/90">
            City &middot; {FEATURED.state}
          </p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{FEATURED.name}</p>
          {weather && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/30 bg-black/25 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
              <CloudIcon />
              {Math.round(weather.tempF)}°F &middot; {weather.summary}
            </p>
          )}
        </div>

        {/* 🔴 z-20, above the stretched button's z-10 overlay: the licence link must
            stay clickable (PR #92's credit sat under a z-10 layer and could not be). */}
        {banner && (
          <p className="absolute bottom-2 right-3 z-20 text-[10px] text-white/80">
            {credit ? (
              <>
                Photo: {credit.author} &middot;{' '}
                {credit.licenseUrl ? (
                  <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" className={`rounded underline hover:no-underline ${FOCUS}`}>
                    {credit.license}
                  </a>
                ) : (
                  credit.license
                )}
              </>
            ) : (
              banner.credit
            )}
          </p>
        )}
      </div>

      {/* ── The two tabs every civic space has — labels here, the card is the control ── */}
      <div className="flex gap-6 border-b border-gray-200 px-6 dark:border-white/10" aria-hidden="true">
        <span className="border-b-[3px] border-brand py-3 text-sm font-semibold text-brand dark:border-brand-light dark:text-brand-light">
          Explore
        </span>
        <span className="py-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Conversations</span>
      </div>

      <div className="flex flex-col gap-4 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
            Inside every civic space
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Discover what&rsquo;s happening nearby.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          disabled={pending}
          className={`flex w-full cursor-pointer items-center gap-4 rounded-xl border border-brand/20 bg-brand-muted p-4 text-left motion-safe:transition-colors hover:border-brand/40 disabled:cursor-wait disabled:opacity-70 dark:border-brand-light/20 dark:bg-brand/15 dark:hover:border-brand-light/40 after:absolute after:inset-0 after:z-10 after:content-[''] ${FOCUS}`}
        >
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm dark:bg-gray-900 dark:text-brand-light">
            <SpeechIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-gray-600 dark:text-gray-400">
              {pending ? 'Opening…' : `Open ${FEATURED.name}`}
            </span>
            <span className="mt-0.5 block text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
              Who represents it, what&rsquo;s on its calendar, and when it votes next.
            </span>
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            <ChevronIcon />
          </span>
        </button>
      </div>
    </div>
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
  // One resolver behind the chips and the preview card, so one pending state.
  const quick = usePlaceResolve()
  const [pendingGeoid, setPendingGeoid] = useState<string | null>(null)

  function openQuick(place: QuickPlace) {
    if (quick.isPending) return
    setPendingGeoid(place.geoid)
    quick.mutate(
      { kind: 'place', row: rowFor(place) },
      {
        onSuccess: (resolved) => onResolved(resolved),
        onSettled: () => setPendingGeoid(null),
      },
    )
  }

  return (
    <div data-welcome-screen="" className="flex flex-1 flex-col px-4 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
        {/* ── Hero: the pitch and the picker | one real place ─────────────── */}
        {/* The first fold, exactly: one viewport less the h-20 header, from lg up,
            so the three cards below start on the second. `dvh`, not `vh` — mobile
            browser chrome. Below lg the two columns stack and cannot share one
            screen, so the section takes its natural height there. */}
        <div className="grid items-center gap-10 py-10 md:py-16 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:py-8">
          <div className="flex min-w-0 flex-col">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand dark:text-brand-light">
              Your community, made clearer
            </p>
            {/* Wraps cleanly at 390px: no fixed width, sizes step up from sm. */}
            {/* The largest step only on a TALL wide screen: at 1366x768 a 7xl
                headline alone pushes the picker out of the first fold. */}
            <h2 className="mt-4 text-5xl font-bold leading-[0.98] tracking-tight text-gray-900 sm:text-6xl xl:[@media(min-height:860px)]:text-7xl dark:text-gray-100">
              See what&rsquo;s happening where you live.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600 md:text-xl dark:text-gray-300">
              Explore local topics, events, and conversations&mdash;all in one welcoming place.
            </p>

            {/* ── The primary action, above the fold at 390x844 ── */}
            <div className={`${CARD} mt-8 max-w-xl p-5 sm:p-6`}>
              <PlacePicker
                size="hero"
                onResolved={onResolved}
                label="Find your Civic Space"
                placeholder="Search a city or county"
                submitLabel="Explore"
                hideHelp
              />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Popular:</span>
                {POPULAR.map((place) => {
                  const featured = place.geoid === FEATURED.geoid
                  return (
                    <button
                      key={place.geoid}
                      type="button"
                      onClick={() => openQuick(place)}
                      disabled={quick.isPending}
                      className={[
                        'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium motion-safe:transition-colors disabled:cursor-wait',
                        featured
                          ? 'border-brand/40 bg-brand-muted text-brand dark:border-brand-light/40 dark:bg-brand/20 dark:text-brand-light'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-white/15 dark:text-gray-300 dark:hover:border-white/30',
                        pendingGeoid === place.geoid ? 'opacity-60' : '',
                        FOCUS,
                      ].join(' ')}
                    >
                      {pendingGeoid === place.geoid ? 'Opening…' : place.name}
                    </button>
                  )
                })}
              </div>
              {quick.isError && quick.error && <Problem>{resolveFailureCopy(quick.error.code)}</Problem>}
            </div>

            <p className="mt-5 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <PersonIcon />
              <span>
                Already a member?{' '}
                <a href={loginUrl} className={`rounded font-semibold text-brand underline hover:no-underline dark:text-brand-light ${FOCUS}`}>
                  Sign in to your Civic Spaces
                </a>
              </span>
            </p>
          </div>

          <div className="min-w-0">
            <PlacePreview onOpen={() => openQuick(FEATURED)} pending={pendingGeoid === FEATURED.geoid} />
          </div>
        </div>

        {/* ── Three cards, and no more ────────────────────────────────────── */}
        <div className="grid gap-4 pb-10 md:grid-cols-3 md:pb-14">
          <Feature icon={<SearchIcon />} title="Explore any place">
            Look up a city and see what matters locally.
          </Feature>
          <Feature icon={<BookIcon />} title="Understand the context">
            Get clear topic summaries before joining in.
          </Feature>
          <Feature icon={<SpeechIcon className="h-5 w-5" />} title="Join where you live">
            {/* 🔴 BOTH walls, as D-11 asks: signing in is not enough to post. */}
            Sign in when you&rsquo;re ready to take part. Posting needs a Connected account.
          </Feature>
        </div>

        {/* ── Footer line ─────────────────────────────────────────────────── */}
        <div className="mt-auto flex flex-col gap-3 border-t border-gray-200 py-6 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:text-gray-400">
          <p className="flex items-center gap-2">
            <CivicIcon />
            Shared facts. Shared values. Shared solutions.
          </p>
          <p className="flex items-center gap-2">
            <CheckIcon />
            Civic Spaces never stores your address &mdash; only the civic boundaries it falls inside.
          </p>
        </div>
      </div>
    </div>
  )
}
