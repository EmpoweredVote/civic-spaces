import { useState, useRef, useEffect } from 'react'
import type { SiblingSlice } from '../hooks/useSiblingSlices'
import { Emoji } from './Emoji'
import { CONTROL_BASE, CONTROL_IDLE } from './FeedTabs'

interface SliceSelectorProps {
  /** Resolved jurisdiction name, e.g. "Asheville" — used in the tooltip ("Asheville — Slice 3"). */
  locationName: string
  ownSliceId: string
  ownSiblingIndex: number
  viewingSliceId: string
  siblings: SiblingSlice[]
  isLoading: boolean
  isError: boolean
  onSelect: (sliceId: string) => void
}

function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// Exactly the tab bar's control box, so the pill sits in that row as one of its buttons.
const TRIGGER_BASE = CONTROL_BASE

/**
 * Lets a member of one slice browse "sibling" slices at the same location
 * (same jurisdiction, split apart once a slice hit its member cap) read-only.
 * Never writes anything — switching here only changes which slice's posts
 * are displayed, never the user's actual slice_members assignment.
 */
export function SliceSelector({
  locationName,
  ownSliceId,
  ownSiblingIndex,
  viewingSliceId,
  siblings,
  isLoading,
  isError,
  onSelect,
}: SliceSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isOwnView = viewingSliceId === ownSliceId
  const viewingIndex = siblings.find((s) => s.id === viewingSliceId)?.siblingIndex ?? ownSiblingIndex
  const tooltip = `${locationName} — Slice ${viewingIndex}`

  // Always a menu, even for a place with one slice: the member can see which slice
  // they are in and why there is nothing else to pick, rather than meeting a label
  // that looks like a control and does nothing. While loading, or if the query
  // failed, the list is just their own slice — the one thing known for certain.
  const listed = isLoading || isError || siblings.length === 0
    ? [{ id: ownSliceId, siblingIndex: ownSiblingIndex, memberCount: null as number | null }]
    : siblings
  const isOnlySlice = !isLoading && !isError && siblings.length <= 1

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={tooltip}
        className={[
          TRIGGER_BASE,
          // Styled as one of the tab bar's tabs (FeedTabs' inactive tab), not as a tinted
          // chip: it sits first in that row. Read-only browsing keeps an amber colour so
          // "this is not your slice" still reads at a glance.
          isOwnView
            ? CONTROL_IDLE
            : 'border-amber-300 dark:border-amber-400/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-400/10',
        ].join(' ')}
      >
        <Emoji symbol={isOwnView ? '🏠' : '👀'} className="text-[13px]" />
        {isOwnView ? `Your Community · Slice ${ownSiblingIndex}` : `Slice ${viewingIndex} · View Only`}
        <ChevronIcon />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch slice"
          className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-30 py-1.5 max-h-72 overflow-y-auto"
        >
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {isLoading || isError
              ? locationName
              : `${locationName} — ${siblings.length} ${siblings.length === 1 ? 'slice' : 'slices'}`}
          </p>
          {listed.map((s) => {
            const isMine = s.id === ownSliceId
            const isCurrent = s.id === viewingSliceId
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => {
                  onSelect(s.id)
                  setOpen(false)
                }}
                className={[
                  'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors',
                  isCurrent
                    ? 'bg-brand-muted dark:bg-gray-800 text-brand dark:text-brand-light font-semibold'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
                ].join(' ')}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">Slice {s.siblingIndex}</span>
                  {isMine && (
                    <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand dark:text-brand-light bg-brand-muted dark:bg-brand/10 rounded-full px-1.5 py-0.5">
                      Your Community
                    </span>
                  )}
                </span>
                {s.memberCount !== null && (
                  <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {s.memberCount.toLocaleString()}
                  </span>
                )}
              </button>
            )
          })}
          {isLoading && (
            <p className="px-3 pt-2 pb-1 text-xs text-gray-500 dark:text-gray-400">Loading other slices…</p>
          )}
          {isError && (
            <p className="px-3 pt-2 pb-1 text-xs text-gray-500 dark:text-gray-400">
              Couldn't load other slices. Try again in a moment.
            </p>
          )}
          {/* The cap is slices_count_max_check (current_member_count <= 6000). */}
          {isOnlySlice && (
            <p className="px-3 pt-2 pb-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 mt-1">
              This is the only slice in {locationName} so far. A new slice opens when one reaches 6,000 members.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
