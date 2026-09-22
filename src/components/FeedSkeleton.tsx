import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useIsDarkMode } from '../hooks/useIsDarkMode'

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      {/* Top row: avatar circle + name/time */}
      <div className="flex items-center gap-3">
        <Skeleton circle width={40} height={40} />
        <div className="flex-1">
          <Skeleton width="40%" height={14} />
          <Skeleton width="25%" height={12} className="mt-1" />
        </div>
      </div>
      {/* Body lines */}
      <div className="mt-2">
        <Skeleton height={14} />
        <Skeleton height={14} className="mt-1" />
        <Skeleton height={14} width="75%" className="mt-1" />
      </div>
      {/* Reply count */}
      <div className="mt-2">
        <Skeleton width="20%" height={12} />
      </div>
    </div>
  )
}

export default function FeedSkeleton() {
  const isDark = useIsDarkMode()
  return (
    <SkeletonTheme
      baseColor={isDark ? '#374151' : '#f3f4f6'}
      highlightColor={isDark ? '#4b5563' : '#e5e7eb'}
    >
      <div className="flex flex-col gap-3 p-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </SkeletonTheme>
  )
}
