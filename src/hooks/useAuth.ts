import { useState, useEffect } from 'react'

const ACCOUNTS_SESSION_URL = 'https://accounts-api.empowered.vote/api/auth/session'
const SLICE_ASSIGNMENT_URL = `${import.meta.env.VITE_SLICE_ASSIGNMENT_URL ?? ''}/assign`
const LOGIN_URL = `https://accounts.empowered.vote/login?redirect=${encodeURIComponent('https://civicspaces.empowered.vote')}`

function triggerSliceAssignment(token: string) {
  // Fire-and-forget — slice membership will be ready when useFederalSlice queries
  fetch(SLICE_ASSIGNMENT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {
    // Silently ignore — useFederalSlice will show "no jurisdiction" if it fails
  })
}

interface AuthState {
  userId: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    return JSON.parse(atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

function decodeUserId(token: string): string | null {
  const decoded = decodePayload(token)
  if (!decoded) return null
  const sub = decoded['sub']
  return typeof sub === 'string' ? sub : null
}

function isTokenExpired(token: string): boolean {
  const decoded = decodePayload(token)
  if (!decoded) return true
  const exp = decoded['exp']
  if (typeof exp !== 'number') return true
  return Date.now() / 1000 > exp
}

function storeToken(token: string): string | null {
  const userId = decodeUserId(token)
  if (userId) {
    localStorage.setItem('cs_token', token)
    return userId
  }
  return null
}

export function useAuth(): AuthState & { loginUrl: string } {
  const [authState, setAuthState] = useState<AuthState>({
    userId: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    async function resolveAuth() {
      // 1. Check hash fragment for token from accounts redirect
      if (window.location.hash.includes('access_token')) {
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const token = hash.get('access_token')
        if (token) {
          const userId = storeToken(token)
          history.replaceState(null, '', window.location.pathname)
          if (userId) {
            triggerSliceAssignment(token)
            setAuthState({ userId, isAuthenticated: true, isLoading: false })
            return
          }
        }
      }

      // 2. Check localStorage for existing token
      const stored = localStorage.getItem('cs_token')
      if (stored) {
        if (!isTokenExpired(stored)) {
          const userId = decodeUserId(stored)
          if (userId) {
            setAuthState({ userId, isAuthenticated: true, isLoading: false })
            return
          }
        }
        // Token missing, invalid, or expired — remove it and fall through to SSO
        localStorage.removeItem('cs_token')
      }

      // 3. Silent SSO check via ev_session cookie
      try {
        const res = await fetch(ACCOUNTS_SESSION_URL, { credentials: 'include' })
        if (res.ok) {
          const { access_token } = await res.json() as { access_token: string }
          const userId = storeToken(access_token)
          if (userId) {
            triggerSliceAssignment(access_token)
            setAuthState({ userId, isAuthenticated: true, isLoading: false })
            return
          }
        }
      } catch {
        // Network error or CORS — fall through to unauthenticated
      }

      setAuthState({ userId: null, isAuthenticated: false, isLoading: false })
    }

    void resolveAuth()
  }, [])

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key === 'cs_token') {
        const token = event.newValue
        if (token) {
          const userId = decodeUserId(token)
          if (userId) {
            setAuthState({ userId, isAuthenticated: true, isLoading: false })
            return
          }
        }
        setAuthState({ userId: null, isAuthenticated: false, isLoading: false })
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Cross-app logout sync — detect ev_session cookie cleared by another app
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(ACCOUNTS_SESSION_URL, { credentials: 'include' });
        if (res.status === 401) {
          localStorage.removeItem('cs_token');
          setAuthState({ userId: null, isAuthenticated: false, isLoading: false });
        }
      } catch {
        // Network error — don't log out
      }
    };

    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [authState.isAuthenticated])

  return { ...authState, loginUrl: LOGIN_URL }
}
