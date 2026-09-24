import type { ReactNode } from 'react'
import { Emoji } from './Emoji'

/** How the feed is ordered. There is no vote or score yet, so these are the honest three. */
export type SortMode = 'hot' | 'new' | 'top'
/** What the feed column shows: posts in an order, or the place's news. */
export type FeedMode = SortMode | 'news'

// The secondary control colour, shared with SliceSelector's "Your Community" pill so
// the whole bar reads as one row of controls. Teal on the brand tint is 6.3:1 in
// light mode; brand-light on brand/10 over gray-900 clears 4.5:1 in dark.
export const SECONDARY =
  'text-brand dark:text-brand-light bg-brand-muted dark:bg-brand/10 hover:bg-brand/15 dark:hover:bg-brand/20'

// Same box and type as SliceSelector's TRIGGER_BASE (px-3 py-1.5, text-xs medium,
// 14px icons, a 1px border), so the pill and these controls share one height and voice.
// The border is always there — only its colour changes — so selecting a tab never
// shifts the row by a pixel, which an outline added only on the active tab would.
export const CONTROL_BASE =
  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors'

/** The outlined, not-selected look — shared with SliceSelector's pill. */
export const CONTROL_IDLE =
  'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-white/20'

function Icon({ d }: { d: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

const TABS: { key: FeedMode; label: string; emoji: string; hint: string }[] = [
  { key: 'hot', label: 'Hot', emoji: '🔥', hint: 'Most active conversations first' },
  { key: 'new', label: 'New', emoji: '✨', hint: 'Newest posts first' },
  { key: 'top', label: 'Top', emoji: '📈', hint: 'Posts with the most replies first' },
  { key: 'news', label: 'News', emoji: '📰', hint: 'Headlines for this place' },
]

/** Hot / New / Top / News — the feed's views, as a tablist. */
export function FeedTabs({
  mode,
  onChange,
  showNews = true,
}: {
  mode: FeedMode
  onChange: (mode: FeedMode) => void
  /** News is city/county only (NEWS_LEVELS), so the tab is hidden elsewhere. */
  showNews?: boolean
}) {
  return (
    <div role="tablist" aria-label="Feed view" className="flex flex-nowrap items-center gap-1 p-px [&>*]:flex-shrink-0">
      {TABS.filter((tab) => showNews || tab.key !== 'news').map((tab) => {
        const active = tab.key === mode
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            title={tab.hint}
            onClick={() => onChange(tab.key)}
            className={[
              CONTROL_BASE,
              active ? `${SECONDARY} border-brand/40 dark:border-brand-light/40` : CONTROL_IDLE,
            ].join(' ')}
          >
            <Emoji symbol={tab.emoji} className="text-[13px]" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/** The feed search field, in the header on desktop and in the tab bar on phones. */
export function FeedSearch({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand dark:text-brand-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search this feed"
        className={`h-8 w-full pl-8 pr-3 rounded-full ${SECONDARY} focus:bg-white dark:focus:bg-gray-900 text-xs font-medium placeholder:text-brand/80 dark:placeholder:text-brand-light/80 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors`}
      />
    </div>
  )
}

/** The yellow "Post" action — the desktop stand-in for the phone FAB. */
export function PostButton({ onClick, disabled, children = 'Post' }: { onClick: () => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-full bg-yellow-400 px-4 py-1.5 text-xs font-semibold text-gray-900 shadow-sm hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/60"
    >
      <Icon d="M12 5v14M5 12h14" />
      {children}
    </button>
  )
}
