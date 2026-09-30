import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { WidgetCard } from './WidgetCard'
import { Emoji } from '../Emoji'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import type { UpcomingElection } from '../../hooks/useNextElection'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'

/**
 * One dated civic item. Only two real sources feed this: Essentials' elections and
 * the on-the-record pipeline's scheduled meetings. There is no community-events source
 * anywhere in the platform, so festivals and cleanups are not something this can show.
 */
interface EventItem {
  key: string
  /** Sort key: an instant, or local noon for a date-only item. */
  at: number
  day: string
  month: string
  title: string
  detail: string
  url: string | null
  isElection: boolean
}

const MAX_ITEMS = 4

function fromElection(e: UpcomingElection): EventItem {
  const [y, m, d] = e.date.split('-').map(Number)
  // A local calendar date: new Date('2026-11-03') would be UTC midnight, a day early in the US.
  const local = new Date(y!, m! - 1, d!, 12)
  const type = e.type ? `${e.type.charAt(0).toUpperCase()}${e.type.slice(1)} election` : 'Election'
  return {
    key: `election-${e.date}-${e.name}`,
    at: local.getTime(),
    day: String(d),
    month: local.toLocaleDateString(undefined, { month: 'short' }),
    title: e.name,
    detail: type,
    url: null,
    isElection: true,
  }
}

function fromMeeting(m: UpcomingMeeting): EventItem {
  const zone = m.timezone ?? undefined
  const instant = m.startsAt ? new Date(m.startsAt) : new Date(`${m.date}T12:00:00`)
  // Rendered in the meeting's own zone, so a 6:30pm council meeting reads 6:30pm
  // wherever the member happens to be.
  const day = instant.toLocaleDateString(undefined, { day: 'numeric', timeZone: zone })
  const month = instant.toLocaleDateString(undefined, { month: 'short', timeZone: zone })
  const time = m.startsAt
    ? instant.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: zone }).replace(' ', '').toLowerCase()
    : null
  const kind = m.kind === 'council' ? 'Council meeting' : 'Public meeting'
  return {
    key: `meeting-${m.id}`,
    at: instant.getTime(),
    day,
    month,
    title: m.title,
    detail: time ? `${time} · ${kind}` : kind,
    url: m.url,
    isElection: false,
  }
}

export function UpcomingEventsWidget({
  placeName,
  elections,
  meetings,
  isLoading,
}: {
  placeName: string
  /** undefined while loading. */
  elections: UpcomingElection[] | undefined
  /** undefined while loading or unavailable (e.g. no city, or a CORS-blocked dev host). */
  meetings: UpcomingMeeting[] | undefined
  /** True while either source is still answering; a failed source just contributes nothing. */
  isLoading: boolean
}) {
  const isDark = useIsDarkMode()

  if (isLoading) {
    return (
      <WidgetCard title="Upcoming events">
        <SkeletonTheme baseColor={isDark ? '#4b5563' : '#e5e7eb'} highlightColor={isDark ? '#374151' : '#f3f4f6'}>
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton width={44} height={44} borderRadius={8} />
                <div className="flex-1">
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="45%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </SkeletonTheme>
      </WidgetCard>
    )
  }

  const items = [...(meetings ?? []).map(fromMeeting), ...(elections ?? []).map(fromElection)]
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_ITEMS)

  return (
    <WidgetCard title="Upcoming events">
      {items.length === 0 ? (
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          No upcoming meetings or elections on file for {placeName}.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const body = (
              <>
                {/* Date tile — EV yellow, the same accent as the countdown's family. */}
                <span className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-400/30 dark:bg-yellow-400/10">
                  <span className="text-sm font-bold leading-none text-yellow-800 dark:text-yellow-300">{item.day}</span>
                  <span className="mt-0.5 text-[10px] font-medium leading-none text-yellow-800/80 dark:text-yellow-300/80">{item.month}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100" title={item.title}>
                    {item.isElection && <Emoji symbol="🗳️" className="mr-1 text-[13px]" />}
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{item.detail}</span>
                </span>
              </>
            )
            return (
              <li key={item.key}>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {body}
                    <span className="sr-only">(agenda, opens in a new tab)</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 py-1">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </WidgetCard>
  )
}
