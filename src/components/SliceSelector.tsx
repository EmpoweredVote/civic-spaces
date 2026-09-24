import { useState, useRef, useEffect } from 'react'
import type { SiblingSlice } from '../hooks/useSiblingSlices'

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
  /** 'image' when the trigger sits on the hero photo, which needs its own contrast. */
  tone?: 'surface' | 'image'
}

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

const TRIGGER_BASE = 'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors'

// [own view, view-only] per tone. On the photo, the surface tints would sit on an
// arbitrary image, so the own view is a dark glass pill and view-only is solid amber.
const TONE_CLASSES = {
  surface: [
    'bg-brand-muted dark:bg-brand/10 text-brand dark:text-brand-light',
    'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300',
  ],
  image: [
    'bg-black/40 backdrop-blur-sm border border-white/25 text-white',
    'bg-amber-300 border border-amber-200 text-gray-900',
  ],
} as const

/** "Your Community · " drops below sm, where the banner's chips have to share a row. */
function TriggerLabel({ isOwnView, ownSiblingIndex, viewingIndex }: { isOwnView: boolean; ownSiblingIndex: number; viewingIndex: number }) {
  if (isOwnView) {
    return (
      <span>
        <span className="hidden sm:inline">Your Community · </span>Slice {ownSiblingIndex}
      </span>
    )
  }
  return <span>Slice {viewingIndex} · View Only</span>
}

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
  tone = 'surface',
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
  const toneClass = TONE_CLASSES[tone][isOwnView ? 0 : 1]

  // Fewer than 2 siblings (or we can't yet confirm there are more) — show a
  // plain, non-interactive label instead of a dropdown with nothing in it.
  // Loading/error both degrade to this same safe, non-broken state.
  const canSwitch = !isLoading && !isError && siblings.length > 1

  if (!canSwitch) {
    return (
      <span
        title={tooltip}
        className={[
          TRIGGER_BASE,
          toneClass,
        ].join(' ')}
      >
        {isOwnView ? <HomeIcon /> : <EyeIcon />}
        <TriggerLabel isOwnView={isOwnView} ownSiblingIndex={ownSiblingIndex} viewingIndex={viewingIndex} />
      </span>
    )
  }

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
          'hover:opacity-90',
          toneClass,
        ].join(' ')}
      >
        {isOwnView ? <HomeIcon /> : <EyeIcon />}
        <TriggerLabel isOwnView={isOwnView} ownSiblingIndex={ownSiblingIndex} viewingIndex={viewingIndex} />
        <ChevronIcon />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch slice"
          className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-30 py-1.5 max-h-72 overflow-y-auto"
        >
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {locationName} — {siblings.length} slices
          </p>
          {siblings.map((s) => {
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
                <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {s.memberCount.toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
