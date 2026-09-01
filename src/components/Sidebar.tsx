import { lazy, Suspense } from 'react'
import type { useCompassData } from '../hooks/useCompassData'
import type { useRepresentatives } from '../hooks/useRepresentatives'
import { filterRepsByTab } from '../types/representatives'
const CompassWidget = lazy(() =>
  import('./widgets/CompassWidget').then((m) => ({ default: m.CompassWidget }))
)
import { RepresentativesWidget } from './widgets/RepresentativesWidget'
import { ToolsWidget } from './widgets/ToolsWidget'

interface SidebarProps {
  compassData: ReturnType<typeof useCompassData>
  repsData: ReturnType<typeof useRepresentatives>
  activeTab: string
}

export function Sidebar({ compassData, repsData, activeTab }: SidebarProps) {
  if (activeTab === 'volunteer') return null

  const filteredReps = filterRepsByTab(repsData.data ?? [], activeTab)
  const showReps = repsData.isLoading || filteredReps.length > 0
  const showNoRepsNudge =
    !repsData.isLoading && repsData.data !== undefined && repsData.data.length === 0

  return (
    <div className="flex flex-col gap-3 p-3">
      <Suspense fallback={<div className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
        <CompassWidget
          categories={compassData.categories}
          answers={compassData.answers}
          isLoading={compassData.isLoading}
          isUncalibrated={compassData.isUncalibrated}
        />
      </Suspense>

      {showReps && (
        <RepresentativesWidget
          reps={filteredReps}
          isLoading={repsData.isLoading}
        />
      )}

      {showNoRepsNudge && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-medium mb-0.5">No elected leaders found</p>
          <p>
            <a
              href="https://app.empowered.vote/settings/location"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-900 dark:hover:text-amber-200"
            >
              Set your location
            </a>{' '}
            to see representatives for your area.
          </p>
        </div>
      )}

      <ToolsWidget />
    </div>
  )
}
