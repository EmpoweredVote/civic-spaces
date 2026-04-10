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

      <ToolsWidget />
    </div>
  )
}
