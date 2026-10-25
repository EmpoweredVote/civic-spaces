import { DEV_PLACE } from '../lib/devMockData'

/**
 * Dev-only: says out loud when the fixture slices are pointed somewhere other
 * than Asheville.
 *
 * `?dev=1&place=bloomington` repoints MOCK_SLICES at the one city with real
 * council-agenda coverage. A fixture city that is not the historical one, with
 * nothing on screen saying so, is a trap for the next person — every name,
 * banner, election and agenda on the page changes and nothing explains why.
 *
 * Renders nothing on the default, so `?dev=1` looks exactly as it always has.
 *
 * 🔴 `pointer-events-none`: 16-05's gate check and 16-10's harness hit-test
 * controls with document.elementFromPoint(), and a fixed overlay that swallowed
 * a click would turn a passing check into a mystery.
 */
export function DevPlaceBadge() {
  if (!import.meta.env.DEV || DEV_PLACE === 'asheville') return null
  return (
    <p className="pointer-events-none fixed bottom-3 left-14 z-50 rounded-full border border-gray-300 bg-white/90 px-3 py-1 text-[11px] font-semibold text-gray-700 shadow-sm dark:border-white/15 dark:bg-gray-900/90 dark:text-gray-300">
      dev fixture place: {DEV_PLACE}
    </p>
  )
}
