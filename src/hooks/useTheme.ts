import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'ev:color-scheme'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(KEY)) {
        const next: Theme = e.matches ? 'light' : 'dark'
        setTheme(next)
        applyTheme(next)
      }
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem(KEY, next)
    // TODO: also persist to connected_profiles.ui_theme via accounts API
    // when account preferences land in the schema.
  }, [theme])

  return { theme, toggleTheme }
}
