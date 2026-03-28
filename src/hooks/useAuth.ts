import { useState, useEffect } from 'react'

interface AuthState {
  userId: string | null
  isAuthenticated: boolean
}

function decodeUserId(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url decode the payload segment
    const payload = parts[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const decoded = JSON.parse(atob(padded)) as Record<string, unknown>
    const sub = decoded['sub']
    return typeof sub === 'string' ? sub : null
  } catch {
    return null
  }
}

function getAuthState(): AuthState {
  const token = localStorage.getItem('cs_token')
  if (!token) return { userId: null, isAuthenticated: false }
  const userId = decodeUserId(token)
  return userId
    ? { userId, isAuthenticated: true }
    : { userId: null, isAuthenticated: false }
}

export function useAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>(getAuthState)

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key === 'cs_token') {
        setAuthState(getAuthState())
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return authState
}
