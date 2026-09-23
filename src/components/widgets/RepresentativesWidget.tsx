import { useState } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import type { PoliticianFlatRecord } from '../../types/representatives'
import { BRANCH_ORDER, getRepPhoto } from '../../types/representatives'
import { WidgetCard } from './WidgetCard'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'

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
        className="w-6 h-6 text-gray-500 dark:text-gray-500"
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
  const isDark = useIsDarkMode()

  if (isLoading) {
    return (
      <WidgetCard title="Representing This Community">
        <SkeletonTheme
          baseColor={isDark ? '#4b5563' : '#e5e7eb'}
          highlightColor={isDark ? '#374151' : '#f3f4f6'}
        >
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
    .filter((rep) => {
      if (rep.is_vacant) return false
      // Only keep President/VP from NATIONAL_EXEC — secretaries are appointed
      if (rep.district_type === 'NATIONAL_EXEC') {
        return rep.office_title.toLowerCase().includes('president')
      }
      // Only keep statewide elected constitutional officers from STATE_EXEC.
      // Appointed officials (PUC commissioners, agency secretaries, etc.) are
      // excluded by not matching any of the known elected titles.
      if (rep.district_type === 'STATE_EXEC') {
        const t = rep.office_title.toLowerCase()
        return (
          t.includes('governor') ||
          t.includes('attorney general') ||
          t.includes('secretary of state') ||
          t.includes('treasurer') ||
          t.includes('controller') ||
          t.includes('comptroller') ||
          t.includes('commissioner of insurance') ||
          t.includes('insurance commissioner') ||
          t.includes('superintendent') ||
          t.includes('equalization')
        )
      }
      return true
    })
    .sort((a, b) => {
      const orderA = BRANCH_ORDER[a.district_type] ?? 99
      const orderB = BRANCH_ORDER[b.district_type] ?? 99
      if (orderA !== orderB) return orderA - orderB
      // Within STATE_EXEC, Governor first then Lieutenant Governor
      if (a.district_type === 'STATE_EXEC') {
        const titlePriority = (title: string) => {
          const t = title.toLowerCase()
          if (t === 'governor') return 0
          if (t.includes('lieutenant governor')) return 1
          return 2
        }
        return titlePriority(a.office_title) - titlePriority(b.office_title)
      }
      // Within LOCAL, the Mayor leads the city council. Real Essentials data
      // doesn't tag the mayor with a distinct district_type — LOCAL covers
      // both — so this has to go by office_title instead.
      if (a.district_type === 'LOCAL') {
        const isMayor = (title: string) => title.toLowerCase().includes('mayor')
        return Number(isMayor(b.office_title)) - Number(isMayor(a.office_title))
      }
      return 0
    })

  // The local executive (mayor/village president/etc.) is the official most
  // directly tied to this civic slice — highlighted the same way Essentials
  // marks a "primary" contact, minus party affiliation (deliberately not in
  // this data model — see the anti-partisan note in types/representatives.ts).
  const primaryRep =
    sortedReps.find((r) => r.district_type === 'LOCAL_EXEC') ??
    sortedReps.find((r) => r.district_type === 'LOCAL' && r.office_title.toLowerCase().includes('mayor')) ??
    null

  // Every US address has 2 Senators + 1 House Representative — if the list
  // has federal executive officials but neither of those, this is known-
  // incomplete data, not a real "you have no Congressional representation."
  // Say so rather than let the list look complete when it isn't.
  const hasFederalExec = sortedReps.some((r) => r.district_type === 'NATIONAL_EXEC')
  const hasFederalLegislature = sortedReps.some(
    (r) => r.district_type === 'NATIONAL_UPPER' || r.district_type === 'NATIONAL_LOWER'
  )
  const missingFederalLegislature = hasFederalExec && !hasFederalLegislature

  if (sortedReps.length === 0) {
    return (
      <WidgetCard title="Representing This Community">
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          No elected officials are listed for this community yet.{' '}
          <a
            href="https://app.empowered.vote/settings/location"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand underline hover:no-underline dark:text-brand-light"
          >
            Check your address
          </a>
          .
        </p>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Representing This Community">
      {primaryRep && (
        <a
          href={`https://essentials.empowered.vote/politician/${primaryRep.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg bg-brand-muted dark:bg-brand/10 px-3 py-2.5 mb-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300 hover:bg-brand-muted/70 dark:hover:bg-brand/15 transition-colors"
        >
          Discussions in this space are most directly connected to{' '}
          <span className="font-semibold text-brand dark:text-brand-light">
            {primaryRep.full_name}, {primaryRep.office_title}
          </span>
          .
        </a>
      )}

      <div className="flex flex-col">
        {sortedReps.map((rep, index) => {
          const isPrimary = rep.id === primaryRep?.id
          return (
            <a
              key={rep.id}
              href={`https://essentials.empowered.vote/politician/${rep.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 py-2 -mx-2 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                index < sortedReps.length - 1
                  ? 'border-b border-gray-100 dark:border-gray-800'
                  : ''
              }`}
            >
              <RepAvatar rep={rep} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {rep.full_name}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {rep.office_title}
                </span>
              </div>
              {isPrimary && (
                <span className="flex-shrink-0 rounded-full bg-brand dark:bg-brand-light text-white dark:text-gray-900 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                  Primary
                </span>
              )}
            </a>
          )
        })}
      </div>

      {missingFederalLegislature && (
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          Your U.S. Senators and Representative aren't listed yet, so this list
          is incomplete rather than complete.{' '}
          <a
            href="https://app.empowered.vote/settings/location"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand underline hover:no-underline dark:text-brand-light"
          >
            Check your address
          </a>
          .
        </p>
      )}
    </WidgetCard>
  )
}
