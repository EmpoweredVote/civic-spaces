import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { useCompassData } from '../hooks/useCompassData'
import type { useRepresentatives } from '../hooks/useRepresentatives'
import { WidgetCard } from './widgets/WidgetCard'

interface SidebarMobileProps {
  compassData: ReturnType<typeof useCompassData>
  repsData: ReturnType<typeof useRepresentatives>
}

export function SidebarMobile({ repsData }: SidebarMobileProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const showReps = repsData.isLoading || (!!repsData.data && repsData.data.length > 0)

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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
