import { useState, useEffect } from 'react'
import { triggerSliceAssignment } from '../lib/sliceAssignment'

const ACCOUNTS_SESSION_URL = 'https://accounts-api.empowered.vote/api/auth/session'
const LOGIN_URL = `https://accounts.empowered.vote/login?redirect=${encodeURIComponent('https://civicspaces.empowered.vote')}`

// NOTE: assignment here is a best-effort head start on login, NOT the guarantee.
// It cannot be, because the stored-token path below never reaches it and because a
// member can set their address long after this ran. useEnsureSlices owns the
// guarantee: it re-asks whenever a signed-in member turns out to have no spaces.

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

/**
 * The member's INTERNAL user id — the one civic_spaces rows are keyed on.
 *
 * 🔴 NOT simply `sub`. The accounts platform accepts tokens from two issuers since the
 * WorkOS AuthKit cutover on 2026-08-28 (ev-accounts decision 0002), and they name the
 * same person differently. From ev-accounts backend/src/lib/tokenIdentity.ts:
 *
 *     Supabase `sub` is the internal UUID; WorkOS `sub` is a WorkOS id (`user_01…`).
 *
 * A WorkOS token carries the internal UUID in `external_id`. Reading `sub` alone meant a
 * WorkOS-issued member queried `user_id=eq.user_01M…`, matched nothing, and sat on
 * "Setting up your civic spaces…" forever — an empty membership list looks exactly like
 * a brand-new account, so useEnsureSlices kept trying to assign someone who was already
 * assigned.
 *
 * Kept deliberately identical in shape to civic_spaces.current_user_id() in the database
 * (20260902010000_resolve_workos_identity.sql). If these two ever disagree about who the
 * caller is, the frontend asks for rows that RLS will not return, and the failure looks
 * like missing data rather than an identity bug. Change them together.
 *
 * An unlinked WorkOS account (no external_id) falls through to its WorkOS sub, which
 * matches no row — fail-closed, and the same answer the database gives.
 */
function decodeUserId(token: string): string | null {
  const decoded = decodePayload(token)
  if (!decoded) return null

  const externalId = decoded['external_id']
  if (typeof externalId === 'string' && externalId !== '') return externalId

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

const DEV_GUEST_ID = 'dev-guest'

function b64url(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * An unsigned, local-only token for previewing the signed-in experience with
 * `npm run dev` — the accounts hub always redirects to the production origin,
 * so there is otherwise no way to reach an authenticated screen on localhost.
 *
 * It is not a credential and cannot become one: `alg: 'none'` with a stub
 * signature is rejected by PostgREST and by both verifiers. Its only job is to
 * carry the reserved `dev-guest` id, which src/lib/devMockData.ts recognises
 * and answers with fixture data. A real Supabase user id can never collide
 * with that string.
 */
function createDevFallbackToken(): string {
  const header = b64url({ alg: 'none', typ: 'JWT' })
  const payload = b64url({ sub: DEV_GUEST_ID, exp: Math.floor(Date.now() / 1000) + 31536000 })
  return `${header}.${payload}.dev-signature`
}

function storeToken(token: string): string | null {
  const userId = decodeUserId(token)
  if (userId) {
    localStorage.setItem('cs_token', token)
    return userId
  }
  return null
}

type SessionCheck =
  // ok: a live session; accessToken is the fresh JWT.
  | { ok: true; accessToken: string }
  // not ok: status 401 = signed out; status 0 = network/CORS (indeterminate).
  | { ok: false; status: number }

/**
 * One session check shared across every mounted useAuth().
 *
 * useAuth() is called by many components at once (the shell, every profile card,
 * every thread). Each instance runs resolveAuth() on mount AND a 60s logout poll,
 * so without coordination N mounted instances fire N identical requests at
 * accounts-api in the same tick — the burst this fix targets. The in-flight
 * promise is shared, then held for a short window so a cluster of mounts (and the
 * aligned 60s polls) collapse to a single network call per browser.
 */
let sessionCheckInFlight: Promise<SessionCheck> | null = null

async function checkSession(): Promise<SessionCheck> {
  if (sessionCheckInFlight) return sessionCheckInFlight

  sessionCheckInFlight = (async (): Promise<SessionCheck> => {
    try {
      const res = await fetch(ACCOUNTS_SESSION_URL, { credentials: 'include' })
      if (res.ok) {
        const { access_token } = (await res.json()) as { access_token: string }
        return { ok: true, accessToken: access_token }
      }
      return { ok: false, status: res.status }
    } catch {
      return { ok: false, status: 0 }
    }
  })()

  const result = await sessionCheckInFlight
  // Hold the resolved result briefly so a burst of near-simultaneous callers
  // share it, then clear so the next poll re-checks against the live cookie.
  setTimeout(() => {
    sessionCheckInFlight = null
  }, 2_000)
  return result
}

/**
 * Send the member to re-login, once.
 *
 * Guarded so N instances seeing the same 401 do not each start a navigation. The
 * full-page navigation is deliberate: per-instance auth state does not share, so
 * a silent local logout in one instance leaves the others holding a stale userId
 * and still issuing PostgREST queries the client can no longer authenticate —
 * the sustained 401 burst. Navigating away tears every instance down at once.
 */
let redirectingToLogin = false

function redirectToLogin(): void {
  if (redirectingToLogin) return
  redirectingToLogin = true
  localStorage.removeItem('cs_token')
  window.location.assign(LOGIN_URL)
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

      // 3. Silent SSO check via ev_session cookie (shared across instances)
      const session = await checkSession()
      if (session.ok) {
        const userId = storeToken(session.accessToken)
        if (userId) {
          triggerSliceAssignment(session.accessToken)
          setAuthState({ userId, isAuthenticated: true, isLoading: false })
          return
        }
      }

      // 4. Opt-in local dev session (?dev=1). Deliberately last: every real
      // check above wins, so this can never mask a genuine session. Stripped
      // from a production build by the import.meta.env.DEV guard.
      if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1') {
        localStorage.setItem('cs_token', createDevFallbackToken())
        setAuthState({ userId: DEV_GUEST_ID, isAuthenticated: true, isLoading: false })
        return
      }

      // 401 (signed out) or network error — show the guest UI. Do NOT redirect
      // to login here: a logged-out visitor landing on a public page must not be
      // bounced. The redirect is only for a session that dies while in use (poll).
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
      const session = await checkSession();
      // 401 = the ev_session cookie was cleared or expired (signed out elsewhere,
      // or the session simply lapsed). Send the member to re-login rather than
      // silently dropping to guest: the full navigation also ends this and every
      // other instance's polling and stops the stale-token PostgREST 401s at
      // their source. A network error (status 0) is indeterminate — don't log
      // out; the next tick retries.
      if (!session.ok && session.status === 401) {
        redirectToLogin();
      }
    };

    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [authState.isAuthenticated])

  return { ...authState, loginUrl: LOGIN_URL }
}
