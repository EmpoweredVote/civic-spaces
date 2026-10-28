import { useEffect, useRef } from 'react'
import type { SliceType, TabKey, SliceInfo } from '../types/database'
import { useSliceNavLabel } from '../hooks/useJurisdictionName'

interface SliceTabBarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  slices: Partial<Record<SliceType, SliceInfo>>
  showVolunteerTab?: boolean
}

const LEFT_TABS: { key: TabKey; label: string }[] = [
  { key: 'city', label: 'City' },
  { key: 'county', label: 'County' },
  { key: 'state', label: 'State' },
  { key: 'federal', label: 'Federal' },
  { key: 'unified', label: 'Unified' },
]

const RIGHT_TABS: { key: TabKey; label: string }[] = [
  { key: 'volunteer', label: 'Volunteer' },
]

/**
 * The tab's name: the place, not the level — the same label the nav rail shows
 * (`useSliceNavLabel`). Its own component so the hook runs once per tab.
 *
 * The bar scrolls sideways, so a long place name is capped rather than allowed to
 * push every other tab off screen. The cap is visual only: the full name stays in
 * the text (and so in the accessible name) and in the tooltip.
 */
function SliceTabLabel({ slice, levelLabel }: { slice: SliceInfo; levelLabel: string }) {
  const label = useSliceNavLabel(slice, levelLabel)
  return (
    <span className="block max-w-[11rem] truncate" title={label}>
      {label}
    </span>
  )
}

export default function SliceTabBar({ activeTab, onTabChange, slices, showVolunteerTab = false }: SliceTabBarProps) {
  const renderTab = (tab: { key: TabKey; label: string }) => {
    const isActive = tab.key === activeTab
    const sliceType = tab.key as SliceType
    const sliceInfo = slices[sliceType]
    return (
      <button
        key={tab.key}
        type="button"
        onClick={() => onTabChange(tab.key)}
        /* 🔴 The same handle the nav rail carries (NavSidebar's `tabKey`), so a
           check can walk City and Federal at ANY width without knowing where the
           place is. Below lg this bar IS the navigation — the rail is a drawer —
           which is exactly the surface a desktop-only run never sees. */
        data-slice-tab={tab.key}
        className={[
          'flex flex-col items-center text-sm font-medium whitespace-nowrap rounded-lg px-4 py-2',
          isActive
            ? 'bg-brand dark:bg-brand-light text-white font-semibold shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800',
        ].join(' ')}
        aria-selected={isActive}
        aria-current={isActive ? 'true' : undefined}
      >
        {sliceInfo ? <SliceTabLabel slice={sliceInfo} levelLabel={tab.label} /> : <span>{tab.label}</span>}
        {/* 🔴 Omitted, never zero. A VISITED place has no slices row and so no
            count (SliceInfo.memberCount is null there), and this subtitle would
            otherwise have said "0 members" about a real jurisdiction — on
            phones and tablets only, since this bar replaces the nav rail below
            lg, which is where a false number is least likely to be noticed. The
            same omission HeroBanner makes, found by widening the type. */}
        {isActive && sliceInfo && sliceInfo.memberCount !== null ? (
          <span className="text-xs font-normal text-white/80 mt-0.5">
            {sliceInfo.memberCount.toLocaleString()} {sliceInfo.memberCount === 1 ? 'member' : 'members'}
          </span>
        ) : null}
      </button>
    )
  }

  // Only show tabs the user actually belongs to
  const visibleLeftTabs = LEFT_TABS.filter(tab => !!slices[tab.key as SliceType])

  // Place names are longer than "State" / "Federal", so on a phone the active tab can
  // start off the edge of this scroller. Bring it into view — horizontally only, by
  // moving the bar's own scrollLeft, so the page itself never jumps. Re-checked when
  // the row resizes too: City and County resolve their names after first paint, and
  // the wider tabs would otherwise push the active one back out.
  const navRef = useRef<HTMLElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const nav = navRef.current
    const row = rowRef.current
    if (!nav || !row) return
    const reveal = () => {
      const tab = nav.querySelector<HTMLElement>(`[data-slice-tab="${activeTab}"]`)
      if (!tab) return
      const navBox = nav.getBoundingClientRect()
      const tabBox = tab.getBoundingClientRect()
      if (tabBox.left < navBox.left) nav.scrollLeft -= navBox.left - tabBox.left + 8
      else if (tabBox.right > navBox.right) nav.scrollLeft += tabBox.right - navBox.right + 8
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(row)
    return () => observer.disconnect()
  }, [activeTab])

  return (
    <nav
      ref={navRef}
      className="flex flex-row flex-nowrap overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5"
      aria-label="Slice tabs"
    >
      {/* Left group: geo tabs + Unified (only tabs the user has) */}
      <div ref={rowRef} className="flex flex-row flex-nowrap gap-1">
        {visibleLeftTabs.map(renderTab)}
      </div>

      {/* Separator */}
      <div className="flex-1" />

      {/* Right group: Volunteer — only shown when user has volunteer slice */}
      {showVolunteerTab && (
        <div className="flex flex-row flex-nowrap gap-1 border-l border-gray-200 dark:border-gray-700 pl-2">
          {RIGHT_TABS.map(renderTab)}
        </div>
      )}
    </nav>
  )
}
