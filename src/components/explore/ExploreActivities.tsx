import { useId, useRef, useState } from 'react'
import type React from 'react'
import { Emoji } from '../Emoji'
import { NeighborhoodScene } from './NeighborhoodScene'
import {
  ADVENTURE_OPTIONS,
  IMAGINE_OPTIONS,
  type AdventureDuration,
  type ImagineOption,
  type TopicId,
} from './exploreContent'
import { ArrowIcon, CARD, FOCUS, PrimaryButton } from './exploreUi'
import { readSavedAdventures, writeSavedAdventures } from './exploreStorage'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'
import type { UpcomingElection } from '../../hooks/useNextElection'
import type { ExploreLevel } from '../../types/explore'


// ── Imagine a better neighborhood ─────────────────────────────────────────────────────

export function ImagineActivity({
  choice,
  onChoose,
  ideaText,
  onIdeaChange,
  onExploreTopic,
  onShareIdea,
  isAuthenticated,
  isViewOnly,
}: {
  choice: ImagineOption | null
  onChoose: (choice: ImagineOption) => void
  /** Bound to the chosen topic's draft body, so it is the same text the topic page shows. */
  ideaText: string
  /**
   * Absent while view-only — the module does not hand over a handler it will never
   * call, and the textarea that would call it is not rendered.
   */
  onIdeaChange?: (text: string) => void
  onExploreTopic: (topic: TopicId) => void
  /** Absent while view-only, for the same reason as onIdeaChange. */
  onShareIdea?: (topic: TopicId) => void
  isAuthenticated: boolean
  /**
   * 🔴 On a sibling shard of the member's own jurisdiction. The radios, the
   * illustration and the chosen option's response all STAY — they are a view
   * preference and the animation is most of why this card exists, and gating them
   * would turn another shard's Explore into a dead page. What goes is the textarea
   * (write affordance #6) and "Share an idea" (#2), the two that write.
   */
  isViewOnly?: boolean
}) {
  const id = useId()
  const option = IMAGINE_OPTIONS.find((o) => o.key === choice) ?? null
  const caption = option ? option.sceneText : 'Choose an idea to imagine a small neighborhood change.'

  return (
    <section aria-labelledby={`${id}-h`} className={`${CARD} @container/imagine overflow-hidden`}>
      {/* Header: what this is, and that it is not a proposal or a vote. */}
      <div className="flex items-start gap-4 px-5 py-4 @xl:px-6 border-b border-gray-200/70 dark:border-white/[0.06]">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">Imagine a better neighborhood</p>
          <h3 id={`${id}-h`} className="mt-1.5 text-xl @xl:text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
            What would make your neighborhood feel better?
          </h3>
          <p className="mt-1.5 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            Try an idea and watch this block change. This is an imaginative conversation starter—not an official proposal, vote, or promise.
          </p>
        </div>
      </div>

      <div className="grid @xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* The block, with its change described in words underneath (the text equivalent). */}
        <div className="flex flex-col justify-center gap-2.5 p-4 bg-[#EEF8F5] dark:bg-brand/[0.08] border-b @xl:border-b-0 @xl:border-r border-gray-200/70 dark:border-white/[0.06]">
          <div className="overflow-hidden rounded-xl">
            <NeighborhoodScene choice={choice} label={`Illustrated neighborhood block. ${caption}`} />
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400" aria-live="polite">{caption}</p>
        </div>

        <div className="@container p-4 @xl:p-5 flex flex-col gap-3">
          <fieldset>
            <legend className="sr-only">Choose an idea</legend>
            <div className="grid gap-2 @xs:grid-cols-2 @xl/imagine:grid-cols-2">
              {IMAGINE_OPTIONS.map((o) => {
                const checked = choice === o.key
                return (
                  <label
                    key={o.key}
                    className={[
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer select-none motion-safe:transition-colors',
                      checked
                        ? 'border-brand/60 dark:border-brand-light/60 bg-brand-muted dark:bg-brand/15 ring-2 ring-brand/25 dark:ring-brand-light/25'
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-gray-800/60',
                      'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand/60 dark:has-[input:focus-visible]:ring-brand-light/70',
                    ].join(' ')}
                  >
                    <input type="radio" name={`${id}-imagine`} checked={checked} onChange={() => onChoose(o.key)} className="sr-only" />
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                        checked ? 'border-brand bg-brand dark:border-brand-light dark:bg-brand-light' : 'border-gray-300 dark:border-white/20'
                      }`}
                    >
                      {checked && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white dark:text-gray-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-sm font-semibold leading-tight ${checked ? 'text-brand dark:text-brand-light' : 'text-gray-900 dark:text-gray-100'}`}>
                      {o.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {option && (
            <div className="flex flex-col gap-2.5 border-t border-gray-200/70 dark:border-white/[0.06] pt-3">
              {/* The reward for choosing, and not a write. Stays either way. */}
              <p className="text-sm font-semibold text-brand dark:text-brand-light">{option.response}</p>
              {!isViewOnly && onIdeaChange && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{option.followUp}</span>
                  <textarea
                    rows={2}
                    value={ideaText}
                    onChange={(e) => onIdeaChange(e.target.value)}
                    placeholder={option.key === 'other' ? 'Describe your idea…' : 'Add a place or a quick thought…'}
                    maxLength={10000}
                    className="w-full resize-y rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-brand dark:focus:border-brand-light focus:bg-white dark:focus:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </label>
              )}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Navigation, never a write — it opens the topic page. Stays. */}
                <button
                  type="button"
                  onClick={() => onExploreTopic(option.topic)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 motion-safe:transition-colors ${FOCUS}`}
                >
                  Explore this topic <ArrowIcon />
                </button>
                {!isViewOnly && onShareIdea && (
                  <PrimaryButton size="card" onClick={() => onShareIdea(option.topic)}>
                    {isAuthenticated ? 'Share an idea' : 'Sign in to share'}
                  </PrimaryButton>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Tiny local adventure ──────────────────────────────────────────────────────────────

function meetingWhen(m: UpcomingMeeting): string {
  const zone = m.timezone ?? undefined
  const instant = m.startsAt ? new Date(m.startsAt) : new Date(`${m.date}T12:00:00`)
  const day = instant.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone })
  if (!m.startsAt) return day
  const time = instant.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: zone })
  return `${day} · ${time}`
}

type SuggestionKind = AdventureDuration | 'meeting' | 'election'

/** Line icon on the suggestion's trail — it says what kind of outing this is at a glance. */
const SUGGESTION_ICON: Record<SuggestionKind, string[]> = {
  // A person walking
  '15m': ['M13 4.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z', 'M9.5 21l2-6 2.5 2.5V21', 'M8 11.5l2.5-3.5 3 1.5 2 3', 'M11.5 15l-1-4.5'],
  // A tree
  '1h': ['M12 22v-6', 'M12 16c-4 0-6.5-2.3-6.5-5.2 0-2.2 1.5-3.6 3.2-4A3.9 3.9 0 0112 3a3.9 3.9 0 013.3 3.8c1.7.4 3.2 1.8 3.2 4C18.5 13.7 16 16 12 16z'],
  // A crescent moon
  evening: ['M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z'],
  // A civic building with columns
  meeting: ['M3 21h18', 'M12 3l8 5H4l8-5z', 'M4 10h16', 'M6 10v8M10 10v8M14 10v8M18 10v8', 'M4 18h16'],
  // A ballot box
  election: ['M4 12h16v8H4z', 'M8 12V5h8v7', 'M10.5 8.5l1.5 1.5 2.5-3', 'M8 16h8'],
}

function SuggestionIcon({ kind }: { kind: SuggestionKind }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {SUGGESTION_ICON[kind].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

/**
 * A REAL dated thing on this place's public calendar — from the meetings API or the
 * area's election calendar, never invented. One shape, so ComingUpCard and its detail
 * page render either the same way.
 */
interface RealEvent {
  /** Small line above the card title, e.g. "Coming up · Nov 3". */
  soonLabel: string
  icon: SuggestionKind
  cardTitle: string
  cardLine: string
  eyebrow: string
  title: string
  month: string
  day: string
  timeChip: string
  placeChip: string
  aboutHeading: string
  about: string
  steps: string[]
  source: string
  url: string | null
  urlLabel: string
}

/**
 * Whose schedule this is. The copy was written for a city and the card renders
 * on County too, so the possessive comes from the level rather than being
 * baked into the sentence.
 */
function placeWordFor(level: ExploreLevel): string {
  if (level === 'city') return 'city'
  if (level === 'county') return 'county'
  return 'area'
}

function fromMeeting(m: UpcomingMeeting, level: ExploreLevel): RealEvent {
  const place = placeWordFor(level)
  const zone = m.timezone ?? undefined
  const instant = m.startsAt ? new Date(m.startsAt) : new Date(`${m.date}T12:00:00`)
  const short = instant.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: zone })
  return {
    soonLabel: `Coming up · ${short}`,
    icon: 'meeting',
    cardTitle: 'Sit in on a public meeting',
    cardLine: `${m.title} · ${meetingWhen(m)}`,
    eyebrow: `Public meeting · From your ${place}'s schedule`,
    title: m.title,
    month: instant.toLocaleDateString(undefined, { month: 'short', timeZone: zone }),
    day: instant.toLocaleDateString(undefined, { day: 'numeric', timeZone: zone }),
    timeChip: m.startsAt
      ? instant.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: zone })
      : instant.toLocaleDateString(undefined, { weekday: 'long', timeZone: zone }),
    // Only a city slice can say whose council it is; on a county the record says
    // "council" and naming the body would be putting words in the record's mouth.
    placeChip: m.kind === 'council' ? (level === 'city' ? 'City council' : 'Council meeting') : 'Public meeting',
    aboutHeading: 'About this meeting',
    about: `A scheduled public meeting where your ${place} works through real decisions. Reading the agenda first makes it much easier to follow — and to know what to ask.`,
    steps: ['Open the agenda and skim the item titles.', 'Pick one item that affects your street or neighborhood.', 'Attend or watch, and note one question to bring back.'],
    source: `This meeting is from your ${place}'s published schedule. Times are in the meeting's own time zone; check the agenda for the location and any changes.`,
    url: m.url,
    urlLabel: 'View the agenda',
  }
}

/**
 * 🔴 The step text used to read "Pick the race or measure you know least about".
 * **No ballot measure is served anywhere in the stack** — verified live
 * 2026-10-24: no field on any response, no table in ev-accounts, zero
 * measure-like names among 548 distinct race names. It invents nothing today,
 * being copy rather than data, but it promises something the product cannot
 * deliver, so ComingUpCard drops it. The `keepFrozenWording` flag that kept the
 * old wording alive for AdventureActivity went with that card in 16-03.
 */
function fromElection(e: UpcomingElection): RealEvent {
  const [y, mo, d] = e.date.split('-').map(Number)
  // A calendar date: new Date('2026-11-03') would be UTC midnight, a day early in the US.
  const local = new Date(y!, mo! - 1, d!, 12)
  const short = local.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const type = e.type ? `${e.type.charAt(0).toUpperCase()}${e.type.slice(1)} election` : 'Election'
  return {
    soonLabel: `Coming up · ${short}`,
    icon: 'election',
    cardTitle: `Get ready for the ${e.name}`,
    cardLine: `${local.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · An evening with this ballot makes election day easier.`,
    eyebrow: 'Upcoming election · From this area\'s election calendar',
    title: e.name,
    month: local.toLocaleDateString(undefined, { month: 'short' }),
    day: String(d),
    timeChip: local.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    placeChip: type,
    aboutHeading: 'About this election',
    about: 'An upcoming election on this area\'s ballot. Spending one evening with what is on it makes the day itself calmer — and gives you better questions to ask neighbors.',
    steps: [
      'Look up what will be on this ballot.',
      'Pick the race you know least about and read up on it.',
      'Write down one question to talk through with neighbors.',
    ],
    source: 'This date comes from Empowered\'s election calendar for this area. Check the local election office for polling places, hours and deadlines.',
    url: null,
    urlLabel: '',
  }
}

// ── Adventure detail ──────────────────────────────────────────────────────────────────

function Chip({ icon, children }: { icon: 'clock' | 'pin'; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px] text-brand dark:text-brand-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon === 'clock'
          ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
          : <><path d="M12 21s-7-6.2-7-11.5a7 7 0 1114 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>}
      </svg>
      {children}
    </span>
  )
}

/**
 * The detail page for one suggestion, as a modal over Explore. A suggestion is not an
 * event: it has no date, organizer or address, so none is shown — and since 16-03 it
 * never can be. The `event` branch this component used to carry served only
 * AdventureActivity; real dated things are ComingUpCard's, and ComingUpDetail renders
 * them. Keeping a dead branch here is how the two drift back together.
 */
function AdventureDetail({
  dialogRef,
  option,
  onExploreTopic,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>
  option: (typeof ADVENTURE_OPTIONS)[number]
  onExploreTopic: (topic: TopicId) => void
}) {
  const id = useId()
  const [saved, setSaved] = useState<AdventureDuration[]>(readSavedAdventures)
  const [saveFailed, setSaveFailed] = useState(false)
  const isSaved = saved.includes(option.key)
  const close = () => dialogRef.current?.close()

  const toggleSave = () => {
    const next = isSaved ? saved.filter((k) => k !== option.key) : [...saved, option.key]
    if (writeSavedAdventures(next)) {
      setSaved(next)
      setSaveFailed(false)
    } else {
      setSaveFailed(true)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-t`}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[min(56rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-gray-50 dark:bg-gray-950 p-0 shadow-2xl backdrop:bg-black/50"
    >
      {/* Header */}
      <div className="relative flex items-start gap-5 bg-white dark:bg-gray-900 px-6 py-7 sm:px-10 sm:py-10 border-b border-gray-200/70 dark:border-white/[0.06]">
        <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-gray-800" aria-hidden="true">
          <Emoji symbol={option.emoji} className="text-4xl" />
        </span>
        <div className="min-w-0 flex-1 pr-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
            Local activity · Suggestion
          </p>
          <h2 id={`${id}-t`} className="mt-2 text-3xl sm:text-[2.75rem] font-medium leading-[1.1] tracking-tight text-gray-900 dark:text-gray-100">
            {option.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className={`absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-7 px-6 py-8 sm:px-10">
        <div className="flex flex-wrap gap-3">
          <Chip icon="clock">{option.durationChip}</Chip>
          <Chip icon="pin">{option.placeChip}</Chip>
        </div>

        <div>
          <h3 className="text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">About this activity</h3>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">{option.about}</p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">How to try it</h3>
          <ol className="mt-3 flex flex-col gap-2.5">
            {option.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-base text-gray-700 dark:text-gray-300">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted dark:bg-brand/15 text-xs font-bold text-brand dark:text-brand-light">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="max-w-2xl rounded-2xl bg-[#E3F4F1] dark:bg-brand/10 px-5 py-4">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">A suggestion, not an event</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            There is nothing to sign up for and no set time — go whenever suits you. Real public
            meetings and elections appear here when they are published for this place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={isSaved}
            className={`inline-flex items-center gap-2 rounded-xl bg-brand-yellow px-5 py-3 text-base font-bold text-gray-900 ring-1 ring-gray-900/25 dark:ring-0 shadow-[0_4px_0_rgb(0_0_0_/_0.12)] hover:bg-brand-yellow-hover motion-safe:transition-colors ${FOCUS}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h12v18l-6-4-6 4V3z" />
            </svg>
            {isSaved ? 'Saved on this device' : 'Save on this device'}
          </button>
          <button
            type="button"
            onClick={close}
            className={`inline-flex items-center rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-5 py-3 text-base font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
          >
            Back to Explore
          </button>
          <button
            type="button"
            onClick={() => onExploreTopic(option.topic)}
            className={`inline-flex items-center gap-1.5 rounded px-1 text-sm font-bold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
          >
            {option.linkLabel} <ArrowIcon />
          </button>
        </div>
        {saveFailed && <p className="text-sm text-gray-600 dark:text-gray-400" role="status">Couldn't save — this browser is blocking storage.</p>}
      </div>
    </dialog>
  )
}

// ── Explore nearby (the place half of the old Adventure card) ─────────────────────────

/**
 * A time picker and a gentle suggestion, which is City/County by construction.
 * It is what was left of the old Adventure card once the real-event slot moved to
 * ComingUpCard; that card, and AdventureDetail's `event` branch with it, went in 16-03.
 *
 * `readSavedAdventures` / `writeSavedAdventures` stay exactly as they were — a
 * bookmark on this device is not a write to anything, so it survives the
 * view-only gate in 16-05.
 */
export function NearbyActivity({
  choice,
  onChoose,
  onExploreTopic,
}: {
  choice: AdventureDuration | null
  onChoose: (choice: AdventureDuration) => void
  onExploreTopic: (topic: TopicId) => void
}) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  // 15 minutes is pre-selected, so the card always shows a suggestion rather than an empty box.
  const current = choice ?? '15m'
  const option = ADVENTURE_OPTIONS.find((o) => o.key === current) ?? ADVENTURE_OPTIONS[0]
  if (!option) return null

  return (
    <section aria-labelledby={`${id}-h`} className={`${CARD} @container p-6 @xl:p-7`}>
      {/* Picker left, suggestion right on a wide column; stacked when narrow. */}
      <div className="grid gap-5 @xl:grid-cols-2 @xl:gap-6 @3xl:gap-8 @xl:items-center">
      <div className="flex flex-col gap-5">
      <div>
        {/* The same teal eyebrow as the Imagine card, with a compass for "go and look". */}
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
          </svg>
          Explore nearby
        </p>
        <h3 id={`${id}-h`} className="mt-1.5 text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
          How much room do you have today?
        </h3>
        <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
          Choose a little pocket of time and we'll suggest a gentle way to look closer.
        </p>
      </div>

      {/* Segmented control — real radios, so arrow keys move between the three. */}
      <fieldset className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 dark:bg-white/[0.06] p-1.5">
        <legend className="sr-only">How much time do you have</legend>
        {ADVENTURE_OPTIONS.map((o) => {
          const checked = current === o.key
          return (
            <label
              key={o.key}
              className={[
                'cursor-pointer select-none rounded-xl px-2 py-3 text-center text-sm font-bold motion-safe:transition-colors',
                checked
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
                'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand/60 dark:has-[input:focus-visible]:ring-brand-light/70',
              ].join(' ')}
            >
              <input type="radio" name={`${id}-time`} checked={checked} onChange={() => onChoose(o.key)} className="sr-only" />
              {o.label}
            </label>
          )
        })}
      </fieldset>
      </div>

      {/* The suggestion — its icon, then what to do and where it leads. */}
      <div aria-live="polite" className="flex gap-4 rounded-2xl bg-[#E8F6F3] dark:bg-brand/10 px-5 py-5">
        <div className="flex w-9 flex-shrink-0 flex-col items-center" aria-hidden="true">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-sm text-brand-coral-text dark:text-brand-coral">
            <SuggestionIcon kind={option.key} />
          </span>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{option.title}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.showModal()}
              className={`inline-flex items-center gap-1.5 rounded text-sm font-bold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
            >
              See the details <ArrowIcon />
            </button>
            <button
              type="button"
              onClick={() => onExploreTopic(option.topic)}
              className={`inline-flex items-center gap-1.5 rounded text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:underline ${FOCUS}`}
            >
              {option.linkLabel}
            </button>
          </div>
        </div>
      </div>
      </div>

      <AdventureDetail
        dialogRef={dialogRef}
        option={option}
        onExploreTopic={(topic) => {
          dialogRef.current?.close()
          onExploreTopic(topic)
        }}
      />
    </section>
  )
}

// ── Coming up (the real-event half of the old Adventure card) ─────────────────────────

/**
 * One REAL dated thing on this place's public calendar: the next scheduled
 * public meeting, else the next election. Never invented — if neither source
 * answers, the module's reserved room says the calendar is empty, which is a
 * real answer and worth saying.
 *
 * Unlike "Explore nearby" this is not place-scale: an election is meaningful on
 * State and Federal too, which is why the fused card had to be split.
 */
export function ComingUpCard({
  meeting,
  election,
  level,
}: {
  /** The next real scheduled public meeting, if the meetings API returned one. */
  meeting: UpcomingMeeting | null
  /** The area's next real election, used when no meeting is scheduled. */
  election: UpcomingElection | null
  /** Whose calendar this is, so the copy does not call a county a city. */
  level: ExploreLevel
}) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const event = meeting ? fromMeeting(meeting, level) : election ? fromElection(election) : null
  if (!event) return null

  return (
    <section aria-labelledby={`${id}-h`} className={`${CARD} @container p-6 @xl:p-7`}>
      <div className="flex flex-col gap-5">
        <div>
          {/* The same teal eyebrow as the cards around it, with a calendar for "a real date". */}
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
              <path d="M4 9h16M8 3v4M16 3v4" />
            </svg>
            Coming up
          </p>
          <h3 id={`${id}-h`} className="mt-1.5 text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
            {event.cardTitle}
          </h3>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            A real date from this place’s public calendar.
          </p>
        </div>

        <div className="flex gap-4 rounded-2xl bg-[#E8F6F3] dark:bg-brand/10 px-5 py-5">
          <div className="flex w-9 flex-shrink-0 flex-col items-center" aria-hidden="true">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-sm text-brand-coral-text dark:text-brand-coral">
              <SuggestionIcon kind={event.icon} />
            </span>
          </div>
          <div className="min-w-0 flex flex-col gap-1.5">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white dark:bg-gray-900 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-coral-text dark:text-brand-coral">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-coral" aria-hidden="true" />
              {event.soonLabel}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{event.cardLine}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.showModal()}
                className={`inline-flex items-center gap-1.5 rounded text-sm font-bold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
              >
                See the details <ArrowIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ComingUpDetail dialogRef={dialogRef} event={event} />
    </section>
  )
}

/**
 * The event's detail page, as a modal. Everything on it comes from the meetings
 * API or the election calendar; there is nothing to save, because a date on a
 * public calendar is not a suggestion this device can bookmark.
 */
function ComingUpDetail({
  dialogRef,
  event,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>
  event: RealEvent
}) {
  const id = useId()
  const close = () => dialogRef.current?.close()

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-t`}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[min(56rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-gray-50 dark:bg-gray-950 p-0 shadow-2xl backdrop:bg-black/50"
    >
      {/* Header */}
      <div className="relative flex items-start gap-5 bg-white dark:bg-gray-900 px-6 py-7 sm:px-10 sm:py-10 border-b border-gray-200/70 dark:border-white/[0.06]">
        <span className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-gray-800">
          <span className="text-xs font-bold uppercase text-brand-coral-text dark:text-brand-coral">{event.month}</span>
          <span className="text-3xl font-bold leading-none text-gray-900 dark:text-gray-100">{event.day}</span>
        </span>
        <div className="min-w-0 flex-1 pr-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">{event.eyebrow}</p>
          <h2 id={`${id}-t`} className="mt-2 text-3xl sm:text-[2.75rem] font-medium leading-[1.1] tracking-tight text-gray-900 dark:text-gray-100">
            {event.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className={`absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-7 px-6 py-8 sm:px-10">
        <div className="flex flex-wrap gap-3">
          <Chip icon="clock">{event.timeChip}</Chip>
          <Chip icon="pin">{event.placeChip}</Chip>
        </div>

        <div>
          <h3 className="text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">{event.aboutHeading}</h3>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">{event.about}</p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">How to make the most of it</h3>
          <ol className="mt-3 flex flex-col gap-2.5">
            {event.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-base text-gray-700 dark:text-gray-300">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted dark:bg-brand/15 text-xs font-bold text-brand dark:text-brand-light">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="max-w-2xl rounded-2xl bg-[#E3F4F1] dark:bg-brand/10 px-5 py-4">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Where this comes from</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{event.source}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-5 py-3 text-base font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
            >
              {event.urlLabel}<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <button
            type="button"
            onClick={close}
            className={`inline-flex items-center rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-5 py-3 text-base font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
          >
            Back to Explore
          </button>
        </div>
      </div>
    </dialog>
  )
}
