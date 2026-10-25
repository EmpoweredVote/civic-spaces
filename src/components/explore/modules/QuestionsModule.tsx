/**
 * "Questions for your community" — the card grid.
 *
 * Re-seated from ExploreView.tsx:261-292 with one real fix: the icon was chosen
 * by ARRAY INDEX (`i === 0 ? heart : book`, `:275-277`), so position rather than
 * content picked the picture. That breaks the moment the list is composed per
 * slice and reordered by Compass — the heart would land on whatever happened to
 * be first. The icon now comes from the topic's own category.
 *
 * The cards come from composition.questionTopicIds, each resolved through
 * topicsById and skipped when absent: TopicId is a string since 16-01, so every
 * lookup is partial and a missing topic is a card we must not draw.
 */

import type { ExploreTopic } from '../../../types/explore'
import type { ExploreCtx } from '../ExploreContext'
import { CARD, FOCUS, SectionHeader } from '../exploreUi'
import { ProvenanceTag } from '../provenance'

/**
 * Category to picture. Matched on substrings, in order, because a category is
 * free text — an agenda-derived topic carries whatever the agenda called it, so
 * an exact-match table would fall through to the default for every real one.
 * The paths are the icon vocabulary already in ExploreActivities.
 */
const QUESTION_ICONS: readonly { match: readonly string[]; paths: readonly string[] }[] = [
  {
    // A person walking.
    match: ['street', 'road', 'transit', 'getting around', 'walk', 'crossing', 'traffic'],
    paths: ['M13 4.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z', 'M9.5 21l2-6 2.5 2.5V21', 'M8 11.5l2.5-3.5 3 1.5 2 3', 'M11.5 15l-1-4.5'],
  },
  {
    // A tree.
    match: ['tree', 'park', 'green', 'shade', 'public space', 'climate', 'environment', 'energy', 'water'],
    paths: ['M12 22v-6', 'M12 16c-4 0-6.5-2.3-6.5-5.2 0-2.2 1.5-3.6 3.2-4A3.9 3.9 0 0112 3a3.9 3.9 0 013.3 3.8c1.7.4 3.2 1.8 3.2 4C18.5 13.7 16 16 12 16z'],
  },
  {
    // A house.
    match: ['hous', 'rent', 'home', 'zoning', 'growth', 'development'],
    paths: ['M4 11l8-6 8 6', 'M6 10v9h12v-9', 'M10 19v-5h4v5'],
  },
  {
    // A civic building with columns.
    match: ['budget', 'tax', 'service', 'government', 'council', 'ordinance', 'town', 'county'],
    paths: ['M3 21h18', 'M12 3l8 5H4l8-5z', 'M4 10h16', 'M6 10v8M10 10v8M14 10v8M18 10v8', 'M4 18h16'],
  },
  {
    // A ballot box.
    match: ['election', 'ballot', 'vote', 'candidate'],
    paths: ['M4 12h16v8H4z', 'M8 12V5h8v7', 'M10.5 8.5l1.5 1.5 2.5-3', 'M8 16h8'],
  },
  {
    // A globe.
    match: ['world', 'foreign', 'global', 'trade', 'cities worldwide'],
    paths: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M3.5 9h17', 'M3.5 15h17', 'M12 3c2.4 2.3 3.7 5.4 3.7 9s-1.3 6.7-3.7 9c-2.4-2.3-3.7-5.4-3.7-9S9.6 5.3 12 3z'],
  },
  {
    // A heart.
    match: ['neighborhood', 'communit', 'life', 'safety', 'health', 'care', 'people'],
    paths: ['M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z'],
  },
]

/** An open book — "something to read up on", and the honest answer for anything else. */
const DEFAULT_ICON: readonly string[] = [
  'M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5v-13zM13 4h5.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H13V4z',
]

function iconPathsFor(category: string): readonly string[] {
  const needle = category.toLowerCase()
  for (const { match, paths } of QUESTION_ICONS) {
    if (match.some((m) => needle.includes(m))) return paths
  }
  return DEFAULT_ICON
}

export function QuestionsModule({ ctx }: { ctx: ExploreCtx }) {
  const topics = ctx.composition.questionTopicIds
    .map((topicId) => ctx.topicsById.get(topicId))
    .filter((topic): topic is ExploreTopic => topic !== undefined)
  if (topics.length === 0) return null

  return (
    <section aria-labelledby="explore-questions" className="flex flex-col gap-5 pt-2">
      <SectionHeader id="explore-questions" eyebrow="Start somewhere specific" title="Questions for your community" />
      <div className="grid gap-4 @xl:grid-cols-2">
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => ctx.openTopic(topic.id)}
            className={`${CARD} group text-left p-5 @xl:p-6 flex gap-4 items-start hover:border-brand/40 dark:hover:border-brand-light/30 motion-safe:transition-colors ${FOCUS}`}
          >
            <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-muted dark:bg-brand/15 flex items-center justify-center text-brand dark:text-brand-light" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                {iconPathsFor(topic.category).map((d) => <path key={d} d={d} />)}
              </svg>
            </span>
            <span className="min-w-0 flex-1 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {topic.category} · <ProvenanceTag topic={topic} variant="meta" />
              </span>
              <span className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">{topic.title}</span>
              {topic.blurb && <span className="text-sm text-gray-600 dark:text-gray-400">{topic.blurb}</span>}
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
