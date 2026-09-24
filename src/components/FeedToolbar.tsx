import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Only the orders that actually re-order something. There is no vote or score yet, so
 * "Best", "Hot" and "Rising" returned the feed unchanged and read as broken — they come
 * back if and when a score exists to sort on.
 */
export type SortMode = 'new' | 'top'

interface FeedToolbarProps {
  sort: SortMode
  onSortChange: (sort: SortMode) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'top', label: 'Top' },
]

function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/**
 * Closes a menu on an outside mousedown. The listener exists only while the menu is
 * open — all six feed panels are mounted at once, so an always-on listener per menu
 * meant a dozen permanent document listeners — and `onClose` must be stable (the
 * callers pass a useCallback), or the effect would re-subscribe on every render.
 */
function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])
  return ref
}

function SortDropdown({ sort, onSortChange }: Pick<FeedToolbarProps, 'sort' | 'onSortChange'>) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useOutsideClose(open, close)
  const activeLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'New'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <span>{activeLabel}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-30 w-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1.5">
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Sort by
          </p>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                onSortChange(option.key)
                setOpen(false)
              }}
              className={[
                'w-full flex items-center px-3 py-2 text-sm text-left transition-colors',
                option.key === sort
                  ? 'text-brand dark:text-brand-light font-semibold bg-brand-muted dark:bg-gray-800'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Always-visible compact search bar for this feed. */
function SearchBar({ query, onQueryChange }: { query: string; onQueryChange: (q: string) => void }) {
  return (
    <div className="relative flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search loaded posts"
        aria-label="Search this feed"
        className="h-8 w-36 sm:w-48 pl-8 pr-3 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:bg-white dark:focus:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
      />
    </div>
  )
}

export default function FeedToolbar({ sort, onSortChange, searchQuery = '', onSearchChange }: FeedToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {onSearchChange && <SearchBar query={searchQuery} onQueryChange={onSearchChange} />}
      <SortDropdown sort={sort} onSortChange={onSortChange} />
    </div>
  )
}
