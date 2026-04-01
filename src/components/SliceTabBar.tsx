interface SliceTabBarProps {
  activeTab: string
  federalMemberCount: number | null
}

const TABS = [
  { key: 'neighborhood', label: 'Neighborhood' },
  { key: 'local', label: 'Local' },
  { key: 'state', label: 'State' },
  { key: 'federal', label: 'Federal' },
  { key: 'unified', label: 'Unified' },
] as const

export default function SliceTabBar({ activeTab, federalMemberCount }: SliceTabBarProps) {
  return (
    <nav
      className="flex flex-row flex-nowrap overflow-x-auto border-b border-gray-200 bg-white"
      aria-label="Slice tabs"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <button
            key={tab.key}
            type="button"
            disabled={!isActive}
            className={[
              'flex flex-col items-center px-4 py-2 text-sm font-medium whitespace-nowrap',
              isActive
                ? 'border-b-2 border-blue-600 text-blue-600 font-bold'
                : 'opacity-40 cursor-not-allowed pointer-events-none text-gray-600',
            ].join(' ')}
            aria-selected={isActive}
            aria-current={isActive ? 'true' : undefined}
          >
            <span>{tab.label}</span>
            {tab.key === 'federal' && federalMemberCount !== null && (
              <span className="text-xs font-normal text-gray-500 mt-0.5">
                {federalMemberCount.toLocaleString()} {federalMemberCount === 1 ? 'member' : 'members'}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
