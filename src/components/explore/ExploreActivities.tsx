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


// ── Imagine a better neighborhood ─────────────────────────────────────────────────────

export function ImagineActivity({
  choice,
  onChoose,
  ideaText,
  onIdeaChange,
  onExploreTopic,
  onShareIdea,
  isAuthenticated,
}: {
  choice: ImagineOption | null
  onChoose: (choice: ImagineOption) => void
  /** Bound to the chosen topic's draft body, so it is the same text the topic page shows. */
  ideaText: string
  onIdeaChange: (text: string) => void
  onExploreTopic: (topic: TopicId) => void
  onShareIdea: (topic: TopicId) => void
  isAuthenticated: boolean
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
              <p className="text-sm font-semibold text-brand dark:text-brand-light">{option.response}</p>
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
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onExploreTopic(option.topic)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 motion-safe:transition-colors ${FOCUS}`}
                >
                  Explore this topic <ArrowIcon />
                </button>
                <PrimaryButton size="card" onClick={() => onShareIdea(option.topic)}>
                  {isAuthenticated ? 'Share an idea' : 'Sign in to share'}
                </PrimaryButton>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Saved as a draft on this device · nothing is published until you press Post.
              </p>
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

export function AdventureActivity({
  choice,
  onChoose,
  meeting,
  onExploreTopic,
}: {
  choice: AdventureDuration | null
  onChoose: (choice: AdventureDuration) => void
  /** The next real scheduled public meeting, if the meetings API returned one. Never invented. */
  meeting: UpcomingMeeting | null
  onExploreTopic: (topic: TopicId) => void
}) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  // 15 minutes is pre-selected, so the card always shows a suggestion rather than an empty box.
  const current = choice ?? '15m'
  const option = ADVENTURE_OPTIONS.find((o) => o.key === current)!
  const realMeeting = option.key === 'evening' ? meeting : null

  return (
    <section aria-labelledby={`${id}-h`} className={`${CARD} @container p-6 @xl:p-7`}>
      {/* Picker left, suggestion right on a wide column; stacked when narrow. */}
      <div className="grid gap-5 @xl:grid-cols-2 @xl:gap-6 @3xl:gap-8 @xl:items-center">
      <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E3F4F1] dark:bg-brand/15 text-brand dark:text-brand-light" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </span>
        <span className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
          Tiny local adventure
        </span>
      </div>

      <div>
        <h3 id={`${id}-h`} className="text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
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

      {/* The suggestion — a pin on a dotted trail, then what to do and where it leads. */}
      <div aria-live="polite" className="flex gap-4 rounded-2xl bg-[#E8F6F3] dark:bg-brand/10 px-5 py-5">
        <div className="flex w-9 flex-shrink-0 flex-col items-center" aria-hidden="true">
          <span className="h-6 border-l-2 border-dashed border-brand/50 dark:border-brand-light/50" />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-sm text-brand-coral-text dark:text-brand-coral">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 1114 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
          </span>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
            {realMeeting ? 'Sit in on a public meeting' : option.title}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {realMeeting ? <><span className="font-semibold text-gray-900 dark:text-gray-100">{realMeeting.title}</span> · {meetingWhen(realMeeting)}</> : option.description}
          </p>
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
        meeting={realMeeting}
        onExploreTopic={(topic) => {
          dialogRef.current?.close()
          onExploreTopic(topic)
        }}
      />
    </section>
  )
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
 * event: it has no date, organizer or address, so none is shown. Only a REAL scheduled
 * meeting (from the meetings API) gets a date tile, a time and an agenda link.
 */
function AdventureDetail({
  dialogRef,
  option,
  meeting,
  onExploreTopic,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>
  option: (typeof ADVENTURE_OPTIONS)[number]
  meeting: UpcomingMeeting | null
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

  const zone = meeting?.timezone ?? undefined
  const instant = meeting ? (meeting.startsAt ? new Date(meeting.startsAt) : new Date(`${meeting.date}T12:00:00`)) : null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-t`}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[min(56rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-gray-50 dark:bg-gray-950 p-0 shadow-2xl backdrop:bg-black/50"
    >
      {/* Header */}
      <div className="relative flex items-start gap-5 bg-white dark:bg-gray-900 px-6 py-7 @container sm:px-10 sm:py-10 border-b border-gray-200/70 dark:border-white/[0.06]">
        {instant ? (
          <span className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-gray-800">
            <span className="text-xs font-bold uppercase text-brand-coral-text dark:text-brand-coral">
              {instant.toLocaleDateString(undefined, { month: 'short', timeZone: zone })}
            </span>
            <span className="text-3xl font-bold leading-none text-gray-900 dark:text-gray-100">
              {instant.toLocaleDateString(undefined, { day: 'numeric', timeZone: zone })}
            </span>
          </span>
        ) : (
          <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-gray-800" aria-hidden="true">
            <Emoji symbol={option.emoji} className="text-4xl" />
          </span>
        )}
        <div className="min-w-0 flex-1 pr-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
            {meeting ? 'Public meeting · From your city\'s schedule' : 'Local activity · Suggestion'}
          </p>
          <h2 id={`${id}-t`} className="mt-2 text-3xl sm:text-[2.75rem] font-medium leading-[1.1] tracking-tight text-gray-900 dark:text-gray-100">
            {meeting ? meeting.title : option.title}
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
          {meeting && instant ? (
            <>
              <Chip icon="clock">
                {meeting.startsAt
                  ? instant.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: zone })
                  : instant.toLocaleDateString(undefined, { weekday: 'long', timeZone: zone })}
              </Chip>
              <Chip icon="pin">{meeting.kind === 'council' ? 'City council' : 'Public meeting'}</Chip>
            </>
          ) : (
            <>
              <Chip icon="clock">{option.durationChip}</Chip>
              <Chip icon="pin">{option.placeChip}</Chip>
            </>
          )}
        </div>

        <div>
          <h3 className="text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
            {meeting ? 'About this meeting' : 'About this activity'}
          </h3>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            {meeting
              ? 'A scheduled public meeting. Reading the agenda first makes it much easier to follow — and to know what to ask.'
              : option.about}
          </p>
        </div>

        {!meeting && (
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
        )}

        <div className="max-w-2xl rounded-2xl bg-[#E3F4F1] dark:bg-brand/10 px-5 py-4">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{meeting ? 'Where this comes from' : 'A suggestion, not an event'}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {meeting
              ? 'This meeting is from your city\'s published schedule. Times are shown in the meeting\'s own time zone; check the agenda for the location and any changes.'
              : 'There is nothing to sign up for and no set time — go whenever suits you. Real public meetings appear here when your city publishes them.'}
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
          {meeting?.url && (
            <a
              href={meeting.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-5 py-3 text-base font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
            >
              View the agenda<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
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
