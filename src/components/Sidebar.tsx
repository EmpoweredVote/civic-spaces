import type { useCompassData } from '../hooks/useCompassData'
import type { useRepresentatives } from '../hooks/useRepresentatives'
import { CompassWidget } from './widgets/CompassWidget'
import { RepresentativesWidget } from './widgets/RepresentativesWidget'
import { ToolsWidget } from './widgets/ToolsWidget'

interface SidebarProps {
  compassData: ReturnType<typeof useCompassData>
  repsData: ReturnType<typeof useRepresentatives>
}

export function Sidebar({ compassData, repsData }: SidebarProps) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <CompassWidget
        categories={compassData.categories}
        answers={compassData.answers}
        isLoading={compassData.isLoading}
        isUncalibrated={compassData.isUncalibrated}
      />

      {(repsData.isLoading || (repsData.data && repsData.data.length > 0)) && (
        <RepresentativesWidget
          reps={repsData.data ?? []}
          isLoading={repsData.isLoading}
        />
      )}

      <ToolsWidget />
    </div>
  )
}
