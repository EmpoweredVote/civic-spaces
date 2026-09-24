import type { ReactNode } from 'react'
import type { useRepresentatives } from '../hooks/useRepresentatives'
import { filterRepsByTab } from '../types/representatives'
import { RepresentativesWidget } from './widgets/RepresentativesWidget'

interface SidebarProps {
  repsData: ReturnType<typeof useRepresentatives>
  activeTab: string
  /** Built by AppShell, which owns the name and Census lookups these need. */
  location?: ReactNode
  events?: ReactNode
  about?: ReactNode
}

/**
 * "Showing content for {place} · Change". Address changes happen in the accounts app,
 * never here: this app does not geocode or store a location (see CLAUDE.md, "Talking
 * to the rest of the platform").
 */
export function LocationCard({ label }: { label: string }) {
  return (
    // One line at the sidebar's 320px: text-xs, no wrap, and a long place name ellipsises
    // (full text on hover) rather than pushing "Change" onto a second line.
    <div className="flex items-center gap-2 rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 px-4 py-3 text-xs whitespace-nowrap">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-[#FF5740]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
      </svg>
      <p className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-400" title={`Showing content for ${label}`}>
        Showing content for <span className="font-semibold text-gray-900 dark:text-gray-100">{label}</span>
      </p>
      <a
        href="https://app.empowered.vote/settings/location"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 font-semibold text-brand dark:text-brand-light hover:underline"
      >
        Change
        <span className="sr-only"> your address (opens the Empowered Vote account settings in a new tab)</span>
      </a>
    </div>
  )
}

export function Sidebar({ repsData, activeTab, location, events, about }: SidebarProps) {
  if (activeTab === 'volunteer') return null

  const filteredReps = filterRepsByTab(repsData.data ?? [], activeTab)
  const showReps = repsData.isLoading || filteredReps.length > 0
  const showNoRepsNudge =
    !repsData.isLoading && repsData.data !== undefined && repsData.data.length === 0

  return (
    <div className="flex flex-col gap-3">
      {location}
      {events}


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

      {about}
    </div>
  )
}
