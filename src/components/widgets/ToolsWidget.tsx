import type { SliceType } from '../../types/database'
import { buildToolRows, type CoverageCatalog, type ToolIconName } from '../../lib/toolCoverage'
import { WidgetCard } from './WidgetCard'

import compassLight from '../../assets/tools/compass-symbol-light.svg'
import compassDark from '../../assets/tools/compass-symbol-dark.svg'
import essentialsLight from '../../assets/tools/essentials-symbol-light.svg'
import essentialsDark from '../../assets/tools/essentials-symbol-dark.svg'

const ICONS: Record<ToolIconName, { light: string; dark: string }> = {
  compass: { light: compassLight, dark: compassDark },
  essentials: { light: essentialsLight, dark: essentialsDark },
}

interface ToolsWidgetProps {
  sliceType: SliceType | null
  geoid: string | null
  catalog: CoverageCatalog | null
}

/**
 * Brand symbols come in light/dark pairs and do NOT share an aspect ratio
 * (compass 167x167, essentials 142x167 — and treasury, when it lands, 214x162).
 * So each renders in a fixed square box with object-contain; sizing by raw
 * height would leave the marks visibly misaligned.
 *
 * Variants are swapped with class-based visibility, NOT prefers-color-scheme:
 * this app's dark mode is a `.dark` class toggled by useTheme(), which a media
 * query inside the SVG would ignore.
 *
 * Both marks are decorative (`alt=""`, aria-hidden): the row's text label
 * already names the link, so captioning the icon too would make a screen
 * reader announce the tool twice.
 */
function ToolIcon({ type }: { type: ToolIconName }) {
  const { light, dark } = ICONS[type]
  return (
    <span className="w-6 h-6 shrink-0 flex items-center justify-center">
      <img
        src={light}
        alt=""
        aria-hidden="true"
        className="block dark:hidden w-full h-full object-contain"
      />
      <img
        src={dark}
        alt=""
        aria-hidden="true"
        className="hidden dark:block w-full h-full object-contain"
      />
    </span>
  )
}

export function ToolsWidget({ sliceType, geoid, catalog }: ToolsWidgetProps) {
  const rows = buildToolRows({ sliceType, geoid, catalog })
  if (rows.length === 0) return null

  return (
    <WidgetCard title="Tools for This Community">
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <a
            key={row.key}
            href={row.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer no-underline"
          >
            <ToolIcon type={row.icon} />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">
              {row.name}
            </span>
          </a>
        ))}
      </div>
    </WidgetCard>
  )
}
