import { WidgetCard } from './WidgetCard'

// Only confirmed-live tool URLs are included.
// Essentials: 200 OK confirmed.
// Treasury Tracker: connection failed — excluded.
// Compass: confirmed live (used in compass calibration flow).
const LIVE_TOOLS = [
  {
    name: 'Empowered Compass',
    description: 'Discover where you stand on the issues',
    url: 'https://compassv2.empowered.vote/results',
    icon: 'compass' as const,
  },
  {
    name: 'Empowered Essentials',
    description: 'Your civic profile and voter essentials',
    url: 'https://essentials.empowered.vote',
    icon: 'essentials' as const,
  },
]

type ToolIcon = 'compass' | 'essentials'

function ToolIcon({ type }: { type: ToolIcon }) {
  if (type === 'compass') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Compass circle */}
        <circle cx="12" cy="12" r="10" />
        {/* N/S/E/W tick marks */}
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        {/* Compass needle — north pointing up */}
        <polygon points="12,6 10.5,12 12,10.5 13.5,12" fill="currentColor" />
        <polygon points="12,18 10.5,12 12,13.5 13.5,12" fill="none" />
      </svg>
    )
  }

  // essentials: person/ID card icon
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* ID card rectangle */}
      <rect x="2" y="5" width="20" height="14" rx="2" />
      {/* Person avatar circle */}
      <circle cx="8" cy="11" r="2.5" />
      {/* Name lines */}
      <line x1="13" y1="10" x2="19" y2="10" />
      <line x1="13" y1="13.5" x2="17" y2="13.5" />
    </svg>
  )
}

export function ToolsWidget() {
  if (LIVE_TOOLS.length === 0) return null

  return (
    <WidgetCard title="Tools for This Community">
      <div className="grid grid-cols-2 gap-2">
        {LIVE_TOOLS.map((tool) => (
          <a
            key={tool.url}
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            title={tool.description}
            className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer no-underline"
          >
            <span className="text-gray-600 dark:text-gray-400">
              <ToolIcon type={tool.icon} />
            </span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">
              {tool.name}
            </span>
          </a>
        ))}
      </div>
    </WidgetCard>
  )
}
