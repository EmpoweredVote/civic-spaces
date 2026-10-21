import { useId } from 'react'
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
    <section aria-labelledby={`${id}-h`} className={`${CARD} @container overflow-hidden`}>
      {/* Header: what this is, and that it is not a proposal or a vote. */}
      <div className="flex flex-col-reverse items-start gap-3 @lg:flex-row @lg:gap-4 px-5 py-5 @xl:px-7 border-b border-gray-200/70 dark:border-white/[0.06]">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">Imagine a better neighborhood</p>
          <h3 id={`${id}-h`} className="mt-1.5 text-xl @xl:text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
            What would make your neighborhood feel better?
          </h3>
          <p className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-400">
            Try an idea and watch this block change. This is an imaginative conversation starter—not an official proposal, vote, or promise.
          </p>
        </div>
        <span className="flex-shrink-0 max-w-[7.5rem] rounded-md border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase leading-tight tracking-wider text-gray-600 dark:text-gray-400">
          Optional activity
        </span>
      </div>

      <div className="grid @xl:grid-cols-2">
        {/* The block, with its change described in words underneath (the text equivalent). */}
        <div className="flex flex-col justify-center gap-3 p-5 bg-[#EEF8F5] dark:bg-brand/[0.08] border-b @xl:border-b-0 @xl:border-r border-gray-200/70 dark:border-white/[0.06]">
          <div className="overflow-hidden rounded-xl">
            <NeighborhoodScene choice={choice} label={`Illustrated neighborhood block. ${caption}`} />
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400" aria-live="polite">{caption}</p>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <fieldset>
            <legend className="sr-only">Choose an idea</legend>
            <div className="flex flex-col gap-2">
              {IMAGINE_OPTIONS.map((o) => {
                const checked = choice === o.key
                return (
                  <label
                    key={o.key}
                    className={[
                      'flex items-center gap-3 rounded-xl border px-3.5 py-3 cursor-pointer select-none motion-safe:transition-colors',
                      checked
                        ? 'border-brand/60 dark:border-brand-light/60 bg-brand-muted dark:bg-brand/15 ring-2 ring-brand/25 dark:ring-brand-light/25'
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-gray-800/60',
                      'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand/60 dark:has-[input:focus-visible]:ring-brand-light/70',
                    ].join(' ')}
                  >
                    <input type="radio" name={`${id}-imagine`} checked={checked} onChange={() => onChoose(o.key)} className="sr-only" />
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                        checked ? 'border-brand bg-brand dark:border-brand-light dark:bg-brand-light' : 'border-gray-300 dark:border-white/20'
                      }`}
                    >
                      {checked && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white dark:text-gray-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-sm font-semibold ${checked ? 'text-brand dark:text-brand-light' : 'text-gray-900 dark:text-gray-100'}`}>
                      {o.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {option && (
            <div className="flex flex-col gap-3 border-t border-gray-200/70 dark:border-white/[0.06] pt-4">
              <p className="text-sm font-semibold text-brand dark:text-brand-light">{option.response}</p>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{option.followUp}</span>
                <textarea
                  rows={3}
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
                Saved as a draft on this device. Sharing opens a post you can edit — nothing is published until you press Post.
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

  return (
    <section aria-labelledby={`${id}-h`} className={`${CARD} @container p-6 @xl:p-7`}>
      <div className="grid gap-6 @2xl:grid-cols-2 @2xl:gap-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-muted dark:bg-brand/15 text-brand dark:text-brand-light" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            </span>
            <span className="rounded-md border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Tiny local adventure
            </span>
          </div>
          <div>
            <h4 id={`${id}-h`} className="text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100">
              How much room do you have today?
            </h4>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
              Choose a little pocket of time and we'll suggest a gentle way to look closer.
            </p>
          </div>
          {/* Segmented control — real radios, so arrow keys move between the three. */}
          <fieldset className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-white/[0.06] p-1">
            <legend className="sr-only">How much time</legend>
            {ADVENTURE_OPTIONS.map((o) => {
              const checked = current === o.key
              return (
                <label
                  key={o.key}
                  className={[
                    'cursor-pointer select-none rounded-lg px-2 py-2.5 text-center text-sm motion-safe:transition-colors',
                    checked
                      ? 'bg-white dark:bg-gray-900 font-bold text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
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

        <div aria-live="polite" className="flex items-start gap-4 @2xl:self-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-coral-text dark:text-brand-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 1114 0C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <div className="min-w-0 flex flex-col gap-1.5">
            {useMeeting ? (
              <>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Sit in on a public meeting</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{meeting.title}</span> · {meetingWhen(meeting)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">From your city's published meeting schedule.</p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{option.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
              </>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
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
              <button
                type="button"
                onClick={() => onExploreTopic(option.topic)}
                className={`inline-flex items-center gap-1.5 rounded text-sm font-bold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
              >
                {option.linkLabel} <ArrowIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
