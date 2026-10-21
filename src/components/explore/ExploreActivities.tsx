import { useId } from 'react'
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
  // 15 minutes is pre-selected, so the card always shows a suggestion rather than an empty box.
  const current = choice ?? '15m'
  const option = ADVENTURE_OPTIONS.find((o) => o.key === current)!
  const useMeeting = option.key === 'evening' && meeting

  const title = useMeeting ? 'Sit in on a public meeting' : option.title
  const emoji = useMeeting ? '🏛️' : option.emoji

  return (
    <section aria-labelledby={`${id}-h`} className={`${CARD} @container overflow-hidden`}>
      <div className="grid @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Step 1 — the question and the time picker. */}
        <div className="flex flex-col gap-5 p-6 @xl:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">Tiny local adventure</p>
            <h3 id={`${id}-h`} className="mt-1.5 text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
              How much room do you have today?
            </h3>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
              Pick the time you have, and we'll suggest one small thing to do in your neighborhood.
            </p>
          </div>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              1 · Choose your time
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {ADVENTURE_OPTIONS.map((o) => {
                const checked = current === o.key
                return (
                  <label
                    key={o.key}
                    className={[
                      'flex cursor-pointer select-none flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center motion-safe:transition-colors',
                      checked
                        ? 'border-brand/60 dark:border-brand-light/60 bg-brand-muted dark:bg-brand/15 ring-2 ring-brand/25 dark:ring-brand-light/25'
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-gray-800/60',
                      'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand/60 dark:has-[input:focus-visible]:ring-brand-light/70',
                    ].join(' ')}
                  >
                    <input type="radio" name={`${id}-time`} checked={checked} onChange={() => onChoose(o.key)} className="sr-only" />
                    <Emoji symbol={o.emoji} className="text-xl" />
                    <span className={`text-sm font-bold leading-tight ${checked ? 'text-brand dark:text-brand-light' : 'text-gray-900 dark:text-gray-100'}`}>
                      {o.label}
                    </span>
                    <span className="text-xs leading-tight text-gray-500 dark:text-gray-400">{o.hint}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>

        {/* Step 2 — what that time buys you. Tinted, and named after the choice, so the
            link between the picker and the suggestion is obvious. */}
        <div
          aria-live="polite"
          className="flex flex-col justify-center gap-3 p-6 @xl:p-7 bg-[#EEF8F5] dark:bg-brand/[0.08] border-t @2xl:border-t-0 @2xl:border-l border-gray-200/70 dark:border-white/[0.06]"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            2 · Your suggestion for {option.label.toLowerCase()}
          </p>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white dark:bg-gray-900 shadow-sm" aria-hidden="true">
              <Emoji symbol={emoji} className="text-2xl" />
            </span>
            <div className="min-w-0 flex flex-col gap-1">
              <p className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100">{title}</p>
              {useMeeting ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{meeting.title}</span> · {meetingWhen(meeting)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">From your city's published meeting schedule.</p>
                </>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-1 @2xl:pl-16">
            <button
              type="button"
              onClick={() => onExploreTopic(option.topic)}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 motion-safe:transition-colors ${FOCUS}`}
            >
              {option.linkLabel} <ArrowIcon />
            </button>
            {useMeeting && meeting.url && (
              <a
                href={meeting.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 rounded text-sm font-bold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
              >
                View the agenda<span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
