import { useCallback, useState } from 'react'

/**
 * Collapse / expand control for the two side panels — the left nav rail and the
 * right sidebar. The icon is a panel outline with its `side` column shaded and a
 * chevron pointing the way the panel will move.
 */
export function PanelToggle({
  side,
  collapsed,
  onToggle,
  label,
  className = '',
}: {
  side: 'left' | 'right'
  collapsed: boolean
  onToggle: () => void
  /** What the panel is called, for the accessible name and tooltip. */
  label: string
  className?: string
}) {
  const action = `${collapsed ? 'Expand' : 'Collapse'} ${label}`
  // Left panel: collapse moves it left, expand moves it right. Right panel mirrors that.
  const pointsLeft = side === 'left' ? !collapsed : collapsed
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={action}
      title={action}
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:focus-visible:ring-brand-light ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d={side === 'left' ? 'M9 4v16' : 'M15 4v16'} />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={
            side === 'left'
              ? pointsLeft ? 'M15 10l-2 2 2 2' : 'M13 10l2 2-2 2'
              : pointsLeft ? 'M11 10l-2 2 2 2' : 'M9 10l2 2-2 2'
          }
        />
      </svg>
    </button>
  )
}

/**
 * A boolean persisted to localStorage. Storage can throw (private windows, blocked
 * site data), and a panel that will not remember its state is fine — so every
 * access is guarded and falls back to expanded.
 */
export function usePersistedCollapse(key: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // Not remembered across visits; still toggles for this one.
      }
      return next
    })
  }, [key])
  return [collapsed, toggle]
}
