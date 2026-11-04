/**
 * "Who represents Asheville" — conversation starters built from the public list of
 * who holds office here (src/lib/officialsTopics.ts).
 *
 * The one local source that reaches every place today: an agenda reaches a single
 * city, while the by-area officials lookup answers for any address with a
 * district. Each card opens an ordinary topic page, so the topic → question →
 * conversation flow is the same one every other starter uses.
 *
 * 🔴 Names and office titles only, verbatim from the record. The heading says
 * where they came from, and each topic page says what the question is NOT — a
 * statement by them, or a claim about anything they have done.
 */

import type { ExploreCtx } from '../ExploreContext'
import { CARD, FOCUS, SectionHeader } from '../exploreUi'

/**
 * The place in the heading only where it reads as a place. On Federal the
 * resolved name is "United States of America", and on an unresolved tab there is
 * none — both fall back to a sentence that is true without one.
 */
function headingFor(ctx: ExploreCtx): string {
  const level = ctx.composition.level
  if (level === 'federal') return 'Who represents this area in Congress'
  if (ctx.placeName && (level === 'city' || level === 'county' || level === 'state')) return `Who represents ${ctx.placeName}`
  return 'Who represents this community'
}

export function OfficialsModule({ ctx }: { ctx: ExploreCtx }) {
  const topics = ctx.officialTopics
  if (topics.length === 0) return null

  return (
    <section aria-labelledby="explore-officials" className="flex flex-col gap-3 pt-2">
      <SectionHeader id="explore-officials" eyebrow="From the public officials list" title={headingFor(ctx)} />
      <p className="px-1 -mt-1 text-sm text-gray-600 dark:text-gray-400">
        The people who hold office here, from the public record. Start a conversation about what you would ask them.
      </p>
      <div className="grid gap-4 @xl:grid-cols-2">
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => ctx.openTopic(topic.id)}
            className={`${CARD} group text-left p-5 @xl:p-6 flex gap-4 items-start hover:border-brand/40 dark:hover:border-brand-light/30 motion-safe:transition-colors ${FOCUS}`}
          >
            <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-muted dark:bg-brand/15 flex items-center justify-center text-brand dark:text-brand-light" aria-hidden="true">
              {/* A person at a lectern. */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="6" r="2.75" />
                <path d="M6.5 15.5a5.5 5.5 0 0111 0" />
                <path d="M5 15.5h14l-1.5 5h-11z" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{topic.category}</span>
              <span className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">{topic.title}</span>
              {topic.blurb && <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{topic.blurb}</span>}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className="mt-1 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400 motion-safe:transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>
    </section>
  )
}
