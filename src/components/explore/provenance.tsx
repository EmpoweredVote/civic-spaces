/**
 * The honesty labels, driven by the record instead of hard-coded.
 *
 * ExploreView hard-codes three of them today: a "Sample topic" badge on the
 * featured card (`:230-232`), a "· Sample" suffix on every question card
 * (`:281`) and "Conversation starter · not an official proposal" on the topic
 * page (`:372`). All three are wrong in both directions once topics can come
 * from somewhere real: false-by-omission on an agenda-derived topic, and
 * misleadingly apologetic on a staff-written one. These two components say what
 * `topic.provenance` actually records.
 *
 * 🔴 When `topic.summaryIsGenerated` is true, SourceNote says so in plain words.
 * The title and the reference are the source's own; the summary is a machine's
 * reading of it. Presenting generated text as the record is the quietest form of
 * the invented-civic-record anti-goal, and the one a reader cannot detect.
 *
 * 🔴 Every href built from `topic.sourceUrl` passes isHttpUrl first — those URLs
 * are first-party but SCRAPED, and React will happily render a `javascript:`
 * href.
 */

import { isHttpUrl } from '../../lib/exploreComposition'
import type { ExploreTopic } from '../../types/explore'
import { FOCUS, StarterTag } from './exploreUi'

/** What this topic's provenance is called, in the member's words. */
function tagLabel(topic: ExploreTopic): string {
  switch (topic.provenance) {
    case 'staff':
      return 'Conversation starter'
    // A chapter, an agenda item and a roll call all name their own source. The
    // fallbacks say only what provenance guarantees — never a source we do not have.
    case 'chapter':
      return topic.sourceLabel ?? 'From a local partner organization'
    case 'derived-from-agenda':
      return topic.sourceLabel ?? 'From a published agenda'
    case 'derived-from-vote':
      return topic.sourceLabel ?? 'From a published roll call'
    case 'member':
      return 'Suggested by a member here'
  }
}

/**
 * Where this topic came from, as a short label.
 *
 * - `badge` is the featured card's overlay, sitting on a photo. Its colours are
 *   deliberately light-only: it is drawn over an image in both schemes.
 * - `pill` is the same label on a card with no photo, in the bordered
 *   StarterTag that carries light and dark together.
 * - `meta` is bare text for a card's uppercase meta line, inheriting its size
 *   and colour from the line it sits in.
 */
export function ProvenanceTag({
  topic,
  variant = 'pill',
  className = '',
}: {
  topic: ExploreTopic
  variant?: 'badge' | 'pill' | 'meta'
  className?: string
}) {
  const label = tagLabel(topic)
  if (variant === 'meta') return <span className={className}>{label}</span>
  if (variant === 'pill') return <StarterTag>{label}</StarterTag>
  return (
    <span
      className={`rounded-md border border-yellow-300 bg-yellow-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-800 shadow-sm ${className}`}
    >
      {label}
    </span>
  )
}

/** "3 November 2026" from a 'YYYY-MM-DD' date, at local noon so it is not a day early. */
function formatSourceDate(value: string | undefined): string | null {
  if (!value) return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!parts) return value
  const [, year = '', month = '', day = ''] = parts
  const local = new Date(Number(year), Number(month) - 1, Number(day), 12)
  if (Number.isNaN(local.getTime())) return value
  return local.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function linkLabel(topic: ExploreTopic): string {
  switch (topic.provenance) {
    case 'derived-from-agenda':
      return 'View the agenda item'
    case 'derived-from-vote':
      return 'View the roll call'
    case 'chapter':
      return topic.sourceLabel ?? 'View the source'
    default:
      return 'View the source'
  }
}

/** The sentence under a topic that says where its words came from. */
function sourceSentence(topic: ExploreTopic): string {
  switch (topic.provenance) {
    case 'staff':
      return 'A prompt for discussion, not an official proposal.'
    case 'chapter':
      return topic.sourceLabel
        ? `From ${topic.sourceLabel}, a nonpartisan organization in this community.`
        : 'From a nonpartisan organization in this community.'
    case 'derived-from-agenda': {
      const date = formatSourceDate(topic.sourceDate)
      return date ? `From the ${date} agenda.` : 'From a published agenda.'
    }
    case 'derived-from-vote': {
      const date = formatSourceDate(topic.sourceDate)
      return date ? `From the roll call of ${date}.` : 'From a published roll call.'
    }
    case 'member':
      return 'A neighbor asked for this topic. It is not an official proposal.'
  }
}

/**
 * Where this topic came from, in full: the sentence, the link to the published
 * record when there is one, and — when the summary was machine-written — the
 * line that says so.
 */
export function SourceNote({ topic, className = '' }: { topic: ExploreTopic; className?: string }) {
  const href = topic.sourceUrl && isHttpUrl(topic.sourceUrl) ? topic.sourceUrl : null

  return (
    <div className={`flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400 ${className}`}>
      <p>
        {sourceSentence(topic)}
        {href && (
          <>
            {' '}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded font-semibold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
            >
              {linkLabel(topic)}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </>
        )}
      </p>
      {topic.summaryIsGenerated && (
        <p>
          The title and the reference above are the source&rsquo;s own. The summary was written
          automatically from that record, not by the source.
        </p>
      )}
    </div>
  )
}
