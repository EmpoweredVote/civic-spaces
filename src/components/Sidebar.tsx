import type { useRepresentatives } from '../hooks/useRepresentatives'
import type { SliceInfo } from '../types/database'
import type { CoverageCatalog } from '../lib/toolCoverage'
import { filterRepsByTab } from '../types/representatives'
import { RepresentativesWidget } from './widgets/RepresentativesWidget'
import { ToolsWidget } from './widgets/ToolsWidget'
import { CompassWidget } from './widgets/CompassWidget'
import type { CompassData } from '../hooks/useCompassData'

interface SidebarProps {
  repsData: ReturnType<typeof useRepresentatives>
  activeTab: string
  coverage: CoverageCatalog | null
  activeSlice: SliceInfo | undefined
  compassData: CompassData
}

/**
 * Address changes happen in the accounts app, never here: this app does not
 * geocode or store a location (see CLAUDE.md, "Talking to the rest of the platform").
 */
export function ChangeAddressLink() {
  return (
    <a
      href="https://app.empowered.vote/settings/location"
      target="_blank"
      rel="noopener noreferrer"
      className="self-start px-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
    >
      Not my address? Change it
    </a>
  )
}

export function Sidebar({ repsData, activeTab, coverage, activeSlice, compassData }: SidebarProps) {
  if (activeTab === 'volunteer') return null

  const filteredReps = filterRepsByTab(repsData.data ?? [], activeTab)
  const showReps = repsData.isLoading || filteredReps.length > 0
  const showNoRepsNudge =
    !repsData.isLoading && repsData.data !== undefined && repsData.data.length === 0

  return (
    <div className="flex flex-col gap-3 p-3">
      <ChangeAddressLink />


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

      <CompassWidget {...compassData} />

      <ToolsWidget
        sliceType={activeSlice?.sliceType ?? null}
        geoid={activeSlice?.geoid ?? null}
        catalog={coverage}
      />
    </div>
  )
}
