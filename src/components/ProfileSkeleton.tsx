import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

export default function ProfileSkeleton() {
  return (
    <SkeletonTheme baseColor="#f3f4f6" highlightColor="#e5e7eb">
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Header area */}
        <div className="flex flex-col gap-2 pt-4">
          <Skeleton width="55%" height={28} />
          <Skeleton width="30%" height={16} />
          <Skeleton width="40%" height={14} />
          <div className="flex gap-2 mt-2">
            <Skeleton width={100} height={32} borderRadius={6} />
            <Skeleton width={90} height={32} borderRadius={6} />
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 flex flex-col items-center py-3 px-2">
              <Skeleton width={40} height={22} />
              <Skeleton width={50} height={12} className="mt-1" />
            </div>
          ))}
        </div>

        {/* Slice memberships */}
        <div className="flex flex-col gap-2">
          <Skeleton width="40%" height={14} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
              <Skeleton width="45%" height={14} />
              <Skeleton width="25%" height={12} />
            </div>
          ))}
        </div>

        {/* Friends section */}
        <div className="flex flex-col gap-2 mt-2">
          <Skeleton width="30%" height={14} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100">
              <Skeleton circle width={36} height={36} />
              <Skeleton width="50%" height={14} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonTheme>
  )
}
