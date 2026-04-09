import { useState } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import type { PoliticianFlatRecord } from '../../types/representatives'
import { BRANCH_ORDER, getRepPhoto } from '../../types/representatives'
import { WidgetCard } from './WidgetCard'

interface RepresentativesWidgetProps {
  reps: PoliticianFlatRecord[]
  isLoading: boolean
}

function FallbackAvatar() {
  return (
    <div
      className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6 text-gray-400 dark:text-gray-500"
      >
        <path
          fillRule="evenodd"
          d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  )
}

function RepAvatar({ rep }: { rep: PoliticianFlatRecord }) {
  const [imgFailed, setImgFailed] = useState(false)
  const photoUrl = getRepPhoto(rep)

  if (!photoUrl || imgFailed) {
    return <FallbackAvatar />
  }

  return (
    <img
      src={photoUrl}
      alt={rep.full_name}
      className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
      onError={() => setImgFailed(true)}
    />
  )
}

export function RepresentativesWidget({ reps, isLoading }: RepresentativesWidgetProps) {
  if (isLoading) {
    return (
      <WidgetCard title="Representing This Community">
        <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton circle width={40} height={40} />
                <div className="flex flex-col gap-1 flex-1">
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="45%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </SkeletonTheme>
      </WidgetCard>
    )
  }

  const sortedReps = [...reps]
    .filter((rep) => !rep.is_vacant && rep.is_elected)
    .sort((a, b) => {
      const orderA = BRANCH_ORDER[a.district_type] ?? 99
      const orderB = BRANCH_ORDER[b.district_type] ?? 99
      return orderA - orderB
    })

  return (
    <WidgetCard title="Representing This Community">
      <div className="flex flex-col">
        {sortedReps.map((rep, index) => (
          <div
            key={rep.id}
            className={`flex items-center gap-3 py-2 ${
              index < sortedReps.length - 1
                ? 'border-b border-gray-100 dark:border-gray-800'
                : ''
            }`}
          >
            <RepAvatar rep={rep} />
            <div className="flex flex-col min-w-0">
              <a
                href={`https://essentials.empowered.vote/politician/${rep.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate hover:underline"
              >
                {rep.full_name}
              </a>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {rep.office_title}
              </span>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}
