import { useState, useEffect, useCallback } from 'react'
import {
  applyColorScheme,
  resolveColorScheme,
  writeColorScheme,
  type ColorScheme,
} from '../lib/colorScheme'

export type Theme = ColorScheme

/**
 * Reads the scheme the inline bootstrap in index.html already applied, and
 * lets the member invert it.
 *
 * The default is dark and `prefers-color-scheme` is deliberately not consulted:
 * an EV visitor gets dark until they choose otherwise. The choice is written to
 * a `.empowered.vote` cookie so it carries to the other EV products rather than
 * resetting at every subdomain — see src/lib/colorScheme.ts.
 */
export function useTheme() {
  // index.html sets the class before first paint, so trusting the DOM here
  // keeps the hook and the rendered page from ever disagreeing.
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light',
  )

  // Another EV tab (or another EV product sharing the cookie) may have changed
  // the preference since this tab loaded. Re-sync when the tab regains focus.
  useEffect(() => {
    function resync() {
      const next = resolveColorScheme()
      setTheme((prev) => {
        if (prev === next) return prev
        applyColorScheme(next)
        return next
      })
    }
    window.addEventListener('focus', resync)
    return () => window.removeEventListener('focus', resync)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      applyColorScheme(next)
      writeColorScheme(next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
