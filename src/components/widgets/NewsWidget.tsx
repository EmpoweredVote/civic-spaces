import type React from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { WidgetCard } from './WidgetCard'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useNews } from '../../hooks/useNews'
import { useJurisdictionName } from '../../hooks/useJurisdictionName'
import type { TabKey, SliceInfo } from '../../types/database'

interface NewsWidgetProps {
  level: TabKey
  locationName: string | null
}

function timeAgo(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Thumbnails and source favicons are fetched straight from the publishers, so
 * the member's browser contacts those hosts directly. `referrerPolicy` on both
 * keeps the Civic Spaces URL out of their logs, and a publisher that has moved
 * or blocked an asset hides the image rather than showing a broken one.
 */
function hideImg(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none'
}

export function NewsWidget({ level, locationName }: NewsWidgetProps) {
  const isDark = useIsDarkMode()
  const { articles, isLoading, isError } = useNews(level, locationName)
  const title = locationName ? `${locationName} News` : 'News'

  if (isLoading) {
    return (
      <WidgetCard title={title}>
        <SkeletonTheme baseColor={isDark ? '#4b5563' : '#e5e7eb'} highlightColor={isDark ? '#374151' : '#f3f4f6'}>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton width="40%" height={10} />
                  <Skeleton width="90%" height={14} />
                  <Skeleton width="60%" height={14} />
                </div>
                <Skeleton width={56} height={56} />
              </div>
            ))}
          </div>
        </SkeletonTheme>
      </WidgetCard>
    )
  }

  if (isError || articles.length === 0) {
    return (
      <WidgetCard title={title}>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          {isError
            ? "News isn't available right now — try again later."
            : `No recent headlines found for ${locationName ?? 'this space'}.`}
        </p>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title={title}>
      <div className="flex flex-col">
        {articles.map((article, index) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-start gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              index < articles.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {article.sourceIcon && (
                  <img
                    src={article.sourceIcon}
                    alt=""
                    aria-hidden="true"
                    onError={hideImg}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                  />
                )}
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{article.sourceName}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                {article.title}
              </p>
              <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">{timeAgo(article.publishedAt)}</span>
            </div>
            {article.image && (
              <img
                src={article.image}
                alt=""
                aria-hidden="true"
                onError={hideImg}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-800"
              />
            )}
          </a>
        ))}
      </div>
    </WidgetCard>
  )
}

/**
 * Resolves the slice's real place name, then renders the widget for it.
 *
 * Split out so useJurisdictionName is called unconditionally — Sidebar returns
 * early on the Volunteer tab, and a hook above that return would break the
 * rules of hooks. Volunteer has no place to search news for, so it renders
 * nothing.
 */
export function SliceNewsWidget({
  slice,
  fallbackName,
}: {
  slice: SliceInfo
  fallbackName: string
}) {
  const displayName = useJurisdictionName(slice, fallbackName)
  if (slice.sliceType === 'volunteer') return null
  return <NewsWidget level={slice.sliceType} locationName={displayName} />
}
