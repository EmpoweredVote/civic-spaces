import type { useCompassData } from '../hooks/useCompassData'
import type { useRepresentatives } from '../hooks/useRepresentatives'
import { WidgetCard } from './widgets/WidgetCard'

interface SidebarProps {
  compassData: ReturnType<typeof useCompassData>
  repsData: ReturnType<typeof useRepresentatives>
}

export function Sidebar({ repsData }: SidebarProps) {
  const showReps = repsData.isLoading || (!!repsData.data && repsData.data.length > 0)

  return (
    <div className="flex flex-col gap-3 p-3">
      <WidgetCard title="Issue Alignment Compass">
        <p className="text-sm text-gray-500 dark:text-gray-400">Compass widget loading...</p>
      </WidgetCard>

      {showReps && (
        <WidgetCard title="Representing This Community">
          {repsData.isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Representatives widget loading...</p>
          )}
        </WidgetCard>
      )}

      <WidgetCard title="Tools for This Community">
        <p className="text-sm text-gray-500 dark:text-gray-400">Tools widget loading...</p>
      </WidgetCard>
    </div>
  )
}
