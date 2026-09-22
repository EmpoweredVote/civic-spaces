import { useState, useRef, useEffect } from 'react'

export type SortMode = 'best' | 'hot' | 'new' | 'top' | 'rising'
export type ViewMode = 'card' | 'compact'

interface FeedToolbarProps {
  sort: SortMode
  onSortChange: (sort: SortMode) => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'best', label: 'Best' },
  { key: 'hot', label: 'Hot' },
  { key: 'new', label: 'New' },
  { key: 'top', label: 'Top' },
  { key: 'rising', label: 'Rising' },
]

const VIEW_OPTIONS: { key: ViewMode; label: string; icon: 'card' | 'compact' }[] = [
  { key: 'card', label: 'Card', icon: 'card' },
  { key: 'compact', label: 'Compact', icon: 'compact' },
]

function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function ViewIcon({ icon }: { icon: 'card' | 'compact' }) {
  if (icon === 'card') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <rect x="3" y="4" width="18" height="7" rx="1.5" />
        <rect x="3" y="13" width="18" height="7" rx="1.5" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="4" width="18" height="3.5" rx="1" />
      <rect x="3" y="10.25" width="18" height="3.5" rx="1" />
      <rect x="3" y="16.5" width="18" height="3.5" rx="1" />
    </svg>
  )
}

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])
  return ref
}

function SortDropdown({ sort, onSortChange }: Pick<FeedToolbarProps, 'sort' | 'onSortChange'>) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(() => setOpen(false))
  const activeLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Best'

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
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
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

/** Always-visible compact search bar, synced with the header's search field. */
function SearchBar({ query, onQueryChange }: { query: string; onQueryChange: (q: string) => void }) {
  return (
    <div className="relative flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search"
        aria-label="Search this feed"
        className="h-8 w-28 sm:w-40 pl-8 pr-3 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:bg-white dark:focus:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-200 placeholder:text-gray-700 dark:placeholder:text-gray-200 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
      />
    </div>
  )
}

function ViewDropdown({ view, onViewChange }: Pick<FeedToolbarProps, 'view' | 'onViewChange'>) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(() => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Change post view"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <ViewIcon icon={VIEW_OPTIONS.find((o) => o.key === view)?.icon ?? 'card'} />
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-36 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1.5">
          <p className="px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            View
          </p>
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                onViewChange(option.key)
                setOpen(false)
              }}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                option.key === view
                  ? 'text-brand dark:text-brand-light font-semibold bg-brand-muted dark:bg-gray-800'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              <ViewIcon icon={option.icon} />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FeedToolbar({ sort, onSortChange, view, onViewChange, searchQuery = '', onSearchChange }: FeedToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {onSearchChange && <SearchBar query={searchQuery} onQueryChange={onSearchChange} />}
      <SortDropdown sort={sort} onSortChange={onSortChange} />
      <ViewDropdown view={view} onViewChange={onViewChange} />
    </div>
  )
}
