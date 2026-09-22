import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

/**
 * Manages the user's light/dark theme preference.
 *
 * - Default: dark (index.html seeds the .dark class so there is no flash)
 * - Authenticated: loads saved preference from connected_profiles.ui_theme
 * - Toggle: updates Supabase immediately, then updates the DOM
 */
export function useTheme(userId: string | null) {
  const [theme, setTheme] = useState<Theme>('dark')

  // Fetch saved preference once userId is known
  useEffect(() => {
    if (!userId) return

    supabase
      .schema('civic_spaces')
      .from('connected_profiles')
      .select('ui_theme')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        const saved = data?.ui_theme as Theme | undefined
        if (saved === 'light' || saved === 'dark') {
          setTheme(saved)
          applyTheme(saved)
        }
      })
  }, [userId])

  const toggleTheme = useCallback(async () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    // Apply immediately so the toggle feels instant
    setTheme(next)
    applyTheme(next)

    if (userId) {
      await supabase
        .schema('civic_spaces')
        .from('connected_profiles')
        .update({ ui_theme: next })
        .eq('user_id', userId)
    }
  }, [theme, userId])

  return { theme, toggleTheme }
}
