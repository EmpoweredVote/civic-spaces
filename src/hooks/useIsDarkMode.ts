import { useState, useEffect } from 'react'

/**
 * Tracks whether the `dark` class is currently on <html> (toggled by
 * useTheme.ts). Used by components — like react-loading-skeleton's
 * SkeletonTheme — that take colors as JS props instead of CSS classes, so
 * they can't pick up dark-mode via `dark:` Tailwind variants directly.
 */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}
