import { useId, useRef, useState } from 'react'
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
 * A real incorporated place (MTFCC G4110) with a curated banner in the shared
 * library. It resolves through `resolveChosenPlace` exactly as a picked search
 * row does — the card carries a geoid, never a typed string.
 *
 * 🔴 ONE, and it is the place the preview card is already showing. A "Popular:"
 * row of shortcut chips shipped here on 2026-11-18 and came out the same week:
 * three cities is an editorial claim this repo cannot source, and the three it
 * named were Los Angeles, Long Beach and Pasadena — one county, on a national
 * landing page. If a shortcut row comes back it needs a rule for what goes in
 * it, not a hand-picked list.
 */
const FEATURED: QuickPlace & { state: string } = { geoid: '0644000', name: 'Los Angeles', state: 'California' }

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

const GlobeIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z" />
  </Svg>
)
const ShieldIcon = () => (
  <Svg>
    <path d="M12 3l7 2.8v5.4c0 4.3-2.9 8.1-7 9.3-4.1-1.2-7-5-7-9.3V5.8L12 3z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)

type Tone = 'teal' | 'coral'

function IconTile({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
        tone === 'coral'
          ? 'bg-brand-coral/10 text-brand-coral-text dark:bg-brand-coral/15 dark:text-brand-coral'
          : 'bg-brand-muted text-brand dark:bg-brand/20 dark:text-brand-light'
      }`}
    >
      {children}
    </span>
  )
}

/** What a card's "How … works" popup says. */
interface InfoContent {
  eyebrow: string
  title: string
  lead: string
  points: string[]
  /** An optional real destination, rendered as the primary button. */
  action?: { label: string; href: string }
}

/**
 * The "How … works" popup — the same native <dialog> Explore's Coming-up and
 * What's-new details use (ExploreActivities.tsx), so Escape, focus trapping and
 * a click on the backdrop all close it the way they do there.
 */
function InfoDialog({
  dialogRef,
  icon,
  tone,
  content,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>
  icon: React.ReactNode
  tone: Tone
  content: InfoContent
}) {
  const id = useId()
  const close = () => dialogRef.current?.close()
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-t`}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200/60 bg-gray-50 p-0 shadow-2xl backdrop:bg-black/50 dark:border-white/[0.08] dark:bg-gray-950"
    >
      <div className="relative px-6 py-7 sm:px-10 sm:py-10">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className={`absolute right-5 top-5 flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 ${FOCUS}`}
        >
          <Svg>
            <path d="M6 18 18 6M6 6l12 12" />
          </Svg>
        </button>

        <IconTile tone={tone}>{icon}</IconTile>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
          {content.eyebrow}
        </p>
        <h2
          id={`${id}-t`}
          className="mt-2 pr-14 text-3xl font-medium leading-[1.1] tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100"
        >
          {content.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-600 sm:text-lg dark:text-gray-400">{content.lead}</p>

        <ul className="mt-6 flex flex-col gap-3 rounded-2xl bg-gray-100 px-5 py-5 sm:px-6 dark:bg-white/[0.04]">
          {content.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-gray-800 sm:text-base dark:text-gray-200">
              <span className="mt-0.5 flex-shrink-0 text-brand dark:text-brand-light">
                <CheckIcon />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {content.action && (
            <a
              href={content.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center rounded-xl bg-brand-yellow px-5 py-3 text-base font-bold text-gray-900 shadow-[0_4px_0_rgb(0_0_0_/_0.12)] ring-1 ring-gray-900/25 hover:bg-brand-yellow-hover motion-safe:transition-colors dark:shadow-[0_4px_0_rgb(0_0_0_/_0.45)] dark:ring-0 ${FOCUS}`}
            >
              {content.action.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <button
            type="button"
            onClick={close}
            className={`inline-flex cursor-pointer items-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-base font-bold text-gray-900 hover:bg-gray-50 dark:border-white/15 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 ${FOCUS}`}
          >
            Got it
          </button>
        </div>
      </div>
    </dialog>
  )
}

/**
 * One of the three cards under the fold. `more` opens an InfoDialog — 🔴 never a
 * link to a "how it works" page, because there is no such page, and a link to
 * nowhere is the dead-control failure `check:explore-rooms` exists to catch.
 */
function Feature({
  icon,
  tone = 'teal',
  title,
  children,
  note,
  more,
}: {
  icon: React.ReactNode
  tone?: Tone
  title: string
  children: React.ReactNode
  note?: string
  more?: { label: string; content: InfoContent }
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  return (
    <section className={`${CARD} flex items-start gap-4 p-6`}>
      <IconTile tone={tone}>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{children}</p>
        {note && <p className="mt-2 text-xs font-bold text-gray-900 dark:text-gray-100">{note}</p>}
        {more && (
          <>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => dialogRef.current?.showModal()}
              className={`mt-2 inline-flex cursor-pointer items-center gap-1 rounded text-xs font-bold text-brand underline underline-offset-2 hover:no-underline dark:text-brand-light ${FOCUS}`}
            >
              {more.label}
              <Svg className="h-3.5 w-3.5">
                <path d="m9 6 6 6-6 6" />
              </Svg>
            </button>
            <InfoDialog dialogRef={dialogRef} icon={icon} tone="teal" content={more.content} />
          </>
        )}
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
              {/* 🔴 `quick` is the preview card's resolver, and this is where its
                  failure is said out loud. The card itself is a photo with a
                  stretched link — there is nowhere inside it to put a sentence,
                  and a click that does nothing and says nothing is the worst of
                  the two. Keep them together if the card ever grows a body. */}
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
        <div className="grid gap-4 pt-10 pb-10 md:grid-cols-3 md:pt-14 md:pb-14">
          <Feature icon={<GlobeIcon />} title="Explore anywhere">
            Read what&rsquo;s happening in any community&mdash;no account needed.
          </Feature>

          <Feature
            icon={<SpeechIcon className="h-5 w-5" />}
            tone="coral"
            title="Speak where you live"
            note="One person. One voice."
            more={{
              label: 'How participation works',
              content: {
                eyebrow: 'Connected participation',
                title: 'How participation works',
                lead: 'Reading is open to everyone. Participation stays rooted in the communities people call home.',
                points: [
                  // 🔴 "public conversations", not "Civic Spaces": Volunteer did not
                  // open (D-28), so "anyone can browse Civic Spaces" is not true.
                  'Anyone can browse the public conversations in Civic Spaces.',
                  'Posting, replying, and voting belong to residents of that civic space.',
                  // 🔴 BOTH walls (D-11): an address alone is not Connected.
                  'Participation requires a Connected account with an address set.',
                  'Each person gets one voice.',
                ],
                // The destination InformUpgradePrompt already uses for the same ask.
                action: { label: 'Create a Connected account', href: 'https://accounts.empowered.vote' },
              },
            }}
          >
            {/* 🔴 BOTH walls, as D-11 asks: signing in is not enough to post. */}
            Post, reply, and vote in your own civic spaces with a Connected account.
          </Feature>

          <Feature
            icon={<ShieldIcon />}
            title="Your privacy matters"
            more={{
              label: 'How your privacy works',
              content: {
                eyebrow: 'Your address and identity',
                title: 'How your privacy works',
                lead: 'Your address connects you to the civic spaces where you live.',
                // 🔴 Never "it never leaves your browser" (Q1.8 — the geocoder sees
                // it), never "anonymous" (D-17, D-02). Geocoded once and never kept
                // is the claim, and it is true.
                points: [
                  'Your address is used once to identify the government boundaries it falls inside.',
                  'The address is not retained by Civic Spaces.',
                  'Civic Spaces receives boundary identifiers.',
                  'Members post under a handle, which keeps your name private from other members.',
                ],
              },
            }}
          >
            Your address identifies your civic spaces. Other members see your handle.
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
