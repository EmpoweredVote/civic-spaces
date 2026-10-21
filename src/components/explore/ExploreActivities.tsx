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
import { ArrowIcon, CARD, ChoiceChip, FOCUS, PrimaryButton, SecondaryButton, StarterTag } from './exploreUi'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'

const TEXT_FIELD = `w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-brand dark:focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand/30`

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

  return (
    <section aria-labelledby={`${id}-h`} className={`${CARD} overflow-hidden`}>
      <div className="grid @xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="border-b @xl:border-b-0 @xl:border-r border-gray-200/60 dark:border-white/[0.06]">
          <NeighborhoodScene
            choice={choice}
            label={`Illustrated neighborhood street. ${option ? option.sceneText : 'Choose an option to change the scene.'}`}
          />
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand dark:text-brand-light">Imagine a better neighborhood</p>
            <StarterTag>Just imagining — not a proposal or vote</StarterTag>
          </div>
          <fieldset>
            <legend id={`${id}-h`} className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
              What would make your neighborhood feel better?
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {IMAGINE_OPTIONS.map((o) => (
                <ChoiceChip
                  key={o.key}
                  type="radio"
                  name={`${id}-imagine`}
                  checked={choice === o.key}
                  onChange={() => onChoose(o.key)}
                  emoji={o.emoji}
                >
                  {o.label}
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {/* The text equivalent of the illustration change, announced politely. */}
      <p className="sr-only" aria-live="polite">{option ? option.sceneText : ''}</p>

      {option && (
        <div className="border-t border-gray-200/60 dark:border-white/[0.06] p-4 flex flex-col gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">{option.response}</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{option.followUp}</span>
            <textarea
              rows={2}
              value={ideaText}
              onChange={(e) => onIdeaChange(e.target.value)}
              placeholder={option.key === 'other' ? 'Describe your idea…' : 'A street, a corner, a place you know…'}
              maxLength={10000}
              className={`${TEXT_FIELD} resize-none`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton onClick={() => onExploreTopic(option.topic)}>Explore this topic</SecondaryButton>
            <PrimaryButton onClick={() => onShareIdea(option.topic)}>
              {isAuthenticated ? 'Share an idea' : 'Sign in to share'}
            </PrimaryButton>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your text is kept as a draft on this device. Sharing opens a post you can edit — nothing is published until you press Post.
          </p>
        </div>
      )}
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
  const option = ADVENTURE_OPTIONS.find((o) => o.key === choice) ?? null
  const useMeeting = option?.key === 'evening' && meeting

  return (
    <section aria-labelledby={`${id}-h`} className={`${CARD} p-4 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <Emoji symbol="🧭" className="text-lg" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand dark:text-brand-light">Tiny local adventure</p>
      </div>
      <fieldset>
        <legend id={`${id}-h`} className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
          How much room do you have today?
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ADVENTURE_OPTIONS.map((o) => (
            <ChoiceChip key={o.key} type="radio" name={`${id}-time`} checked={choice === o.key} onChange={() => onChoose(o.key)}>
              {o.label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite">
        {option ? (
          <div className="rounded-xl bg-brand-muted dark:bg-brand/10 p-3 flex flex-col gap-2">
            {useMeeting ? (
              <>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Sit in on a public meeting</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{meeting.title}</span>
                  <br />
                  {meetingWhen(meeting)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">From your city's published meeting schedule.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{option.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
              </>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {useMeeting && meeting.url && (
                <a
                  href={meeting.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 rounded text-sm font-semibold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
                >
                  View the agenda<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => onExploreTopic(option.topic)}
                className={`inline-flex items-center gap-1 rounded text-sm font-semibold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
              >
                Explore the related topic <ArrowIcon />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Pick a length of time for a small suggestion.</p>
        )}
      </div>
    </section>
  )
}
