import { useState } from 'react'
import type React from 'react'
import type { SliceType, TabKey, SliceInfo } from '../types/database'
import { useJurisdictionName } from '../hooks/useJurisdictionName'

interface NavSidebarProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  slices: Partial<Record<SliceType, SliceInfo>>
  showVolunteerTab: boolean
  isModerator?: boolean
  activePanel: 'friends' | 'directory' | null
  onTogglePanel: (panel: 'friends' | 'directory') => void
  onOpenModQueue: () => void
  theme: 'light' | 'dark'
  /** 'pinned' = the always-on desktop rail; 'drawer' = rendered inside the mobile/tablet slide-over */
  variant?: 'pinned' | 'drawer'
}

const GEO_TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'city', label: 'City', icon: 'home' },
  { key: 'county', label: 'County', icon: 'building' },
  { key: 'state', label: 'State', icon: 'flag' },
  { key: 'federal', label: 'Federal', icon: 'landmark' },
  { key: 'unified', label: 'Unified', icon: 'globe' },
]

/**
 * Resources — links to the other live Empowered Vote products, each using
 * that product's own real favicon (fetched directly from its site) rather
 * than a hand-drawn icon.
 *
 * Split into two groups by product family:
 *  - Inform Tools: help someone learn about candidates/issues/spending
 *  - Connect Tools: places to actually talk with other people
 * Kept as flat data arrays (not nested under one "resources" list) so a new
 * Connect tool (Civic Listening, debate tools, etc.) is just one more object
 * appended to CONNECT_TOOLS — no component changes needed.
 */
interface ResourceLinkDef {
  key: string
  label: string
  href: string
  logoLight: string
  logoDark: string
}

const INFORM_TOOLS: ResourceLinkDef[] = [
  {
    key: 'essentials',
    label: 'Essentials',
    href: 'https://essentials.empowered.vote/',
    logoLight: 'https://essentials.empowered.vote/essentials-favicon-light-32.png',
    logoDark: 'https://essentials.empowered.vote/essentials-favicon-dark-32.png',
  },
  {
    key: 'compass',
    label: 'Issue Alignment Compass',
    href: 'https://compass.empowered.vote/',
    logoLight: 'https://compass.empowered.vote/compass-favicon-light-32.png',
    logoDark: 'https://compass.empowered.vote/compass-favicon-dark-32.png',
  },
  {
    key: 'readrank',
    label: 'Read & Rank',
    href: 'https://readrank.empowered.vote/',
    logoLight: 'https://readrank.empowered.vote/read-and-rank-favicon-light-32.png',
    logoDark: 'https://readrank.empowered.vote/read-and-rank-favicon-dark-32.png',
  },
  {
    key: 'treasury',
    label: 'Treasury Tracker',
    href: 'https://treasurytracker.empowered.vote/',
    logoLight: 'https://treasurytracker.empowered.vote/treasury-tracker-favicon-32.png',
    logoDark: 'https://treasurytracker.empowered.vote/treasury-tracker-favicon-32.png',
  },
  {
    key: 'trivia',
    label: 'Civic Trivia Championship',
    href: 'https://ctc.empowered.vote/',
    logoLight: 'https://ctc.empowered.vote/favicon-32.png',
    logoDark: 'https://ctc.empowered.vote/favicon-dark-32.png',
  },
]

interface ConnectToolDef extends ResourceLinkDef {
  /** True only for the app the user is already inside of. */
  isCurrent?: boolean
  /** Preserves this item's pre-existing same-tab behavior from the header link it replaced. */
  sameTab?: boolean
}

const CONNECT_TOOLS: ConnectToolDef[] = [
  {
    key: 'civic-spaces',
    label: 'Civic Spaces',
    href: 'https://civicspaces.empowered.vote/',
    logoLight: '/favicon.png',
    logoDark: '/favicon.png',
    isCurrent: true,
  },
  {
    key: 'focused-communities',
    label: 'Focused Communities',
    href: 'https://fc.empowered.vote/',
    logoLight: 'https://fc.empowered.vote/favicon-32.png',
    logoDark: 'https://fc.empowered.vote/favicon-32.png',
    sameTab: true,
  },
  // Future Connect tools (Civic Listening, debate tools, ...) — add here.
]

function NavIcon({ type }: { type: string }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    className: 'h-5 w-5 flex-shrink-0',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    'aria-hidden': true,
  } as const

  switch (type) {
    case 'home':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
        </svg>
      )
    case 'building':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V6l8-3 8 3v15M4 21h16M9 21v-4h6v4M9 10h.01M9 14h.01M15 10h.01M15 14h.01" />
        </svg>
      )
    case 'flag':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4m0 1c2-1.2 4-1.2 6 0s4 1.2 6 0V13c-2 1.2-4 1.2-6 0s-4-1.2-6 0" />
        </svg>
      )
    case 'landmark':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V10m4 11V10m4 11V10m4 11V10m4 11V10M2 10l10-6 10 6" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z" />
        </svg>
      )
    case 'volunteer':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.35-9.5-8.6C.8 8.8 2.2 5 6 5c2 0 3.3 1 4 2.3C10.7 6 12 5 14 5c3.8 0 5.2 3.8 3.5 7.4C15 16.65 12 21 12 21z" />
        </svg>
      )
    case 'friends':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'directory':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.96 11.96 0 013.6 6 11.99 11.99 0 003 9.75c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.31-.21-2.57-.6-3.75h-.15c-3.2 0-6.1-1.25-8.25-3.285z" />
        </svg>
      )
    case 'chevron-down':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      )
    case 'check-circle':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5l2 2 4-4.5" />
        </svg>
      )
    default:
      return null
  }
}

function NavItem({
  icon,
  label,
  isActive,
  onClick,
  accent = false,
}: {
  icon: string
  label: string
  isActive: boolean
  onClick: () => void
  /** Yellow highlight for the selected civic space, vs. the default brand highlight elsewhere */
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
      className={[
        'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left',
        isActive
          ? accent
            ? 'bg-yellow-400 dark:bg-yellow-400 text-gray-900 dark:text-gray-900 font-semibold'
            : 'bg-brand-muted dark:bg-gray-800 text-brand dark:text-brand-light font-semibold'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
      ].join(' ')}
    >
      <NavIcon type={icon} />
      <span>{label}</span>
    </button>
  )
}

/**
 * Local and County show the real resolved place/county name (e.g.
 * "Asheville", "Buncombe County") instead of the generic tab label — State/
 * Federal/Unified keep their short generic labels, since "North Carolina"
 * or "United States of America" reads worse as a compact nav item than it
 * does as the feed's hero pill. Extracted as its own component so
 * useJurisdictionName (which fetches from the Census API for these two
 * types) is called unconditionally per React's rules of hooks, even though
 * only two of the five tabs use its result.
 */
function GeoNavItem({
  tab,
  slice,
  isActive,
  onClick,
}: {
  tab: { key: TabKey; label: string; icon: string }
  slice: SliceInfo
  isActive: boolean
  onClick: () => void
}) {
  // Called unconditionally per the rules of hooks, even though only City and
  // County use its result.
  const fetchedName = useJurisdictionName(slice, tab.label)

  const label = tab.key === 'city' || tab.key === 'county' ? fetchedName : tab.label

  return (
    <NavItem
      icon={tab.icon}
      label={label}
      isActive={isActive}
      onClick={onClick}
      accent
    />
  )
}

/**
 * These favicons are fetched from each product's live site, so a path change
 * there would otherwise render a broken-image glyph in the rail. Hide the
 * image rather than remove it, so the row's text stays aligned with its
 * siblings.
 */
function hideBrokenIcon(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = 'hidden'
}

function ResourceRow({ item, theme }: { item: ResourceLinkDef; theme: 'light' | 'dark' }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      <img
        src={theme === 'dark' ? item.logoDark : item.logoLight}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={hideBrokenIcon}
        className="h-5 w-5 flex-shrink-0 rounded"
      />
      <span className="flex-1 truncate">{item.label}</span>
    </a>
  )
}

/**
 * A Connect tool row — same shape as ResourceRow, plus a "Current" state for
 * whichever Connect tool the user is already inside of (rendered as a
 * non-navigating, aria-current row instead of a link, since clicking it
 * would just reload the same app).
 */
function ConnectToolRow({ item, theme }: { item: ConnectToolDef; theme: 'light' | 'dark' }) {
  const inner = (
    <>
      <img
        src={theme === 'dark' ? item.logoDark : item.logoLight}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={hideBrokenIcon}
        className="h-5 w-5 flex-shrink-0 rounded"
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.isCurrent && (
        <span className="flex-shrink-0 text-blue-600 dark:text-blue-300" title="You're here">
          <NavIcon type="check-circle" />
          <span className="sr-only">(current)</span>
        </span>
      )}
    </>
  )

  if (item.isCurrent) {
    return (
      <div
        aria-current="page"
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-left bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300 cursor-default"
      >
        {inner}
      </div>
    )
  }

  return (
    <a
      href={item.href}
      {...(item.sameTab ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      {inner}
    </a>
  )
}

type ToolGroupAccent = 'yellow' | 'blue'

const TOOL_GROUP_ACCENT: Record<ToolGroupAccent, { chip: string; border: string }> = {
  yellow: {
    chip: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-400/10 dark:text-yellow-300 dark:border-yellow-400/20',
    border: 'border-yellow-300/70 dark:border-yellow-400/25',
  },
  blue: {
    chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/20',
    border: 'border-blue-300/70 dark:border-blue-400/25',
  },
}

/**
 * Collapsible tool group with a color-coded label chip and a matching subtle
 * left border — the only color in the group; rows themselves stay neutral so
 * the sidebar isn't dominated by color, just clearly sectioned by it.
 */
function ToolGroup({
  label,
  accent,
  isOpen,
  onToggle,
  children,
}: {
  label: string
  accent: ToolGroupAccent
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const classes = TOOL_GROUP_ACCENT[accent]
  return (
    <div className="flex flex-col gap-1.5 border-t border-gray-100 dark:border-gray-800 pt-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex items-center justify-between px-3 pb-1 group"
      >
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${classes.chip}`}>
          {label}
        </span>
        <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
          <span className={isOpen ? 'block transition-transform' : 'block -rotate-90 transition-transform'}>
            <NavIcon type="chevron-down" />
          </span>
        </span>
      </button>
      {isOpen && (
        <div className={`flex flex-col gap-1.5 ml-3 border-l-2 pl-2 ${classes.border}`}>
          {children}
        </div>
      )}
    </div>
  )
}

function NavSidebarContent({
  activeTab,
  onTabChange,
  slices,
  showVolunteerTab,
  isModerator,
  activePanel,
  onTogglePanel,
  onOpenModQueue,
  theme,
}: Omit<NavSidebarProps, 'variant'>) {
  const [informOpen, setInformOpen] = useState(true)
  const [connectOpen, setConnectOpen] = useState(true)
  const visibleGeoTabs = GEO_TABS.filter((tab) => !!slices[tab.key as SliceType])

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Your Civic Spaces
        </span>
        {visibleGeoTabs.map((tab) => (
          <GeoNavItem
            key={tab.key}
            tab={tab}
            slice={slices[tab.key as SliceType]!}
            isActive={activeTab === tab.key}
            onClick={() => onTabChange(tab.key)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-gray-100 dark:border-gray-800 pt-5">
        <span className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Community
        </span>
        {showVolunteerTab && (
          <NavItem
            icon="volunteer"
            label="Volunteer"
            isActive={activeTab === 'volunteer'}
            onClick={() => onTabChange('volunteer')}
            accent
          />
        )}
        <NavItem
          icon="friends"
          label="Friends"
          isActive={activePanel === 'friends'}
          onClick={() => onTogglePanel('friends')}
        />
        <NavItem
          icon="directory"
          label="Member Directory"
          isActive={activePanel === 'directory'}
          onClick={() => onTogglePanel('directory')}
        />
        {isModerator && (
          <NavItem
            icon="shield"
            label="Moderation Queue"
            isActive={false}
            onClick={onOpenModQueue}
          />
        )}
      </div>

      <ToolGroup label="Inform Tools" accent="yellow" isOpen={informOpen} onToggle={() => setInformOpen((v) => !v)}>
        {INFORM_TOOLS.map((item) => (
          <ResourceRow key={item.key} item={item} theme={theme} />
        ))}
      </ToolGroup>

      <ToolGroup label="Connect Tools" accent="blue" isOpen={connectOpen} onToggle={() => setConnectOpen((v) => !v)}>
        {CONNECT_TOOLS.map((item) => (
          <ConnectToolRow key={item.key} item={item} theme={theme} />
        ))}
      </ToolGroup>
    </>
  )
}

/**
 * Left navigation rail — pinned on desktop (lg+), otherwise rendered inside
 * a slide-over drawer opened from the mobile/tablet menu button (AppShell
 * owns the drawer chrome; this component supplies the content either way).
 */
export default function NavSidebar({ variant = 'pinned', ...props }: NavSidebarProps) {
  if (variant === 'drawer') {
    return (
      <nav className="flex flex-col gap-6 p-4 overflow-y-auto contain-paint h-full scrollbar-thin" aria-label="Civic space navigation">
        <NavSidebarContent {...props} />
      </nav>
    )
  }

  return (
    <nav
      className="hidden lg:flex flex-col gap-6 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-y-auto contain-paint scrollbar-thin"
      aria-label="Civic space navigation"
    >
      <NavSidebarContent {...props} />
    </nav>
  )
}
