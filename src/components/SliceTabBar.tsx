import type { SliceType, TabKey, SliceInfo } from '../types/database'

interface SliceTabBarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  slices: Partial<Record<SliceType, SliceInfo>>
  showVolunteerTab?: boolean
}

const LEFT_TABS: { key: TabKey; label: string }[] = [
  { key: 'neighborhood', label: 'Local' },
  { key: 'local', label: 'County' },
  { key: 'state', label: 'State' },
  { key: 'federal', label: 'Federal' },
  { key: 'unified', label: 'Unified' },
]

const RIGHT_TABS: { key: TabKey; label: string }[] = [
  { key: 'volunteer', label: 'Volunteer' },
]

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
        className={[
          'flex flex-col items-center text-sm font-medium whitespace-nowrap rounded-lg px-4 py-2',
          isActive
            ? 'bg-brand dark:bg-brand-light text-white font-semibold shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800',
        ].join(' ')}
        aria-selected={isActive}
        aria-current={isActive ? 'true' : undefined}
      >
        <span>{tab.label}</span>
        {isActive && sliceInfo ? (
          <span className="text-xs font-normal text-white/80 mt-0.5">
            {sliceInfo.memberCount.toLocaleString()} {sliceInfo.memberCount === 1 ? 'member' : 'members'}
          </span>
        ) : null}
      </button>
    )
  }

  // Only show tabs the user actually belongs to
  const visibleLeftTabs = LEFT_TABS.filter(tab => !!slices[tab.key as SliceType])

  return (
    <nav
      className="flex flex-row flex-nowrap overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5"
      aria-label="Slice tabs"
    >
      {/* Left group: geo tabs + Unified (only tabs the user has) */}
      <div className="flex flex-row flex-nowrap gap-1">
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
