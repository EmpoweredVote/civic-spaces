import { WidgetCard } from './WidgetCard'

export interface AboutFact {
  label: string
  value: string
}

/**
 * "About {place}" — a grid of plain facts. Only facts with a real source are passed
 * in (Census population, the member's own county/state slices); the caller omits any
 * it cannot answer, and the widget renders nothing when none are left.
 */
export function AboutWidget({ placeName, facts }: { placeName: string; facts: AboutFact[] }) {
  if (facts.length === 0) return null
  return (
    <WidgetCard title={`About ${placeName}`}>
      <dl className="grid grid-cols-2 gap-2">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-lg bg-gray-50 dark:bg-gray-800/70 px-3 py-2.5 min-w-0">
            <dt className="text-xs text-gray-500 dark:text-gray-400">{fact.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={fact.value}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </WidgetCard>
  )
}
