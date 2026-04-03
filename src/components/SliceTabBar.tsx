import type { SliceType, TabKey, SliceInfo } from '../types/database'

interface SliceTabBarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  slices: Partial<Record<SliceType, SliceInfo>>
  disabledTabs?: TabKey[]
}

const LEFT_TABS: { key: TabKey; label: string }[] = [
  { key: 'neighborhood', label: 'Neighborhood' },
  { key: 'local', label: 'Local' },
  { key: 'state', label: 'State' },
  { key: 'federal', label: 'Federal' },
  { key: 'unified', label: 'Unified' },
]

const RIGHT_TABS: { key: TabKey; label: string }[] = [
  { key: 'volunteer', label: 'Volunteer' },
]

export default function SliceTabBar({ activeTab, onTabChange, slices, disabledTabs = [] }: SliceTabBarProps) {
  const renderTab = (tab: { key: TabKey; label: string }) => {
    const isActive = tab.key === activeTab
    const isDisabled = disabledTabs.includes(tab.key)
    const sliceType = tab.key as SliceType
    const sliceInfo = slices[sliceType]

    return (
      <button
        key={tab.key}
        type="button"
        disabled={isDisabled}
        onClick={isDisabled ? undefined : () => onTabChange(tab.key)}
        className={[
          'flex flex-col items-center px-4 py-2 text-sm font-medium whitespace-nowrap',
          isActive && !isDisabled
            ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
            : isDisabled
            ? 'opacity-40 cursor-not-allowed text-gray-600'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
        ].join(' ')}
        aria-selected={isActive && !isDisabled}
        aria-current={isActive && !isDisabled ? 'true' : undefined}
        aria-disabled={isDisabled}
      >
        <span>{tab.label}</span>
        {isDisabled ? (
          <span className="text-xs font-normal text-gray-400 mt-0.5">Coming soon</span>
        ) : isActive && sliceInfo ? (
          <span className="text-xs font-normal text-gray-500 mt-0.5">
            {sliceInfo.memberCount.toLocaleString()} {sliceInfo.memberCount === 1 ? 'member' : 'members'}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <nav
      className="flex flex-row flex-nowrap overflow-x-auto border-b border-gray-200 bg-white"
      aria-label="Slice tabs"
    >
      {/* Left group: geo tabs + Unified */}
      <div className="flex flex-row flex-nowrap">
        {LEFT_TABS.map(renderTab)}
      </div>

      {/* Separator */}
      <div className="flex-1" />

      {/* Right group: Volunteer */}
      <div className="flex flex-row flex-nowrap border-l border-gray-200">
        {RIGHT_TABS.map(renderTab)}
      </div>
    </nav>
  )
}
