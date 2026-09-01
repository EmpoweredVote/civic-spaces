import { useState, lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { useCompassData } from '../hooks/useCompassData'
import type { useRepresentatives } from '../hooks/useRepresentatives'
import { filterRepsByTab } from '../types/representatives'
const CompassWidget = lazy(() =>
  import('./widgets/CompassWidget').then((m) => ({ default: m.CompassWidget }))
)
import { RepresentativesWidget } from './widgets/RepresentativesWidget'
import { ToolsWidget } from './widgets/ToolsWidget'

interface SidebarMobileProps {
  compassData: ReturnType<typeof useCompassData>
  repsData: ReturnType<typeof useRepresentatives>
  activeTab: string
}

export function SidebarMobile({ compassData, repsData, activeTab }: SidebarMobileProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (activeTab === 'volunteer') return null

  const filteredReps = filterRepsByTab(repsData.data ?? [], activeTab)
  const showReps = repsData.isLoading || filteredReps.length > 0
  const showNoRepsNudge =
    !repsData.isLoading && repsData.data !== undefined && repsData.data.length === 0

  return (
    <div className="md:hidden border-b border-gray-200 dark:border-gray-700">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-expanded={isExpanded}
      >
        <span>Community Sidebar</span>
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="sidebar-mobile-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
