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

const SIGNED_OUT_STORAGE_KEY = 'cs_signed_out'

/**
 * True only under `npm run dev`.
 *
 * Wrapped in try/catch rather than read directly, exactly as devBuild() in
 * src/lib/devMockData.ts is: a script loaded with `node --experimental-strip-types`
 * has no `import.meta.env`, and a bare `.DEV` would throw at import time. This
 * module is not loaded that way today, but the guard costs nothing and the next
 * check script that reaches for it will not have to add one. Vite still replaces
 * the expression with a literal in a production build, so the branches behind it
 * are dropped from the bundle.
 */
function devBuild(): boolean {
  try {
    return import.meta.env.DEV === true
  } catch {
    return false
  }
}

/**
 * Dev-only: has this window asked to be a signed-out visitor?
 *
 * `?signedout=1` sets it, and sessionStorage remembers it. The stored half is
 * load-bearing: wouter drops the query string the moment it navigates to
 * /post/:postId or /profile/:userId, so a flag read only from location.search
 * would silently sign the visitor back in mid-walk. Session scope rather than
 * local, for the same reason cs_dev_place is — the choice should not outlive the
 * window, and a fresh tab is signed in again.
 *
 * Every window / sessionStorage access is guarded, the way resolveDevPlace() in
 * devMockData.ts guards its own: a private window throws, and the privacy-minded
 * visitor this flag exists to simulate is the one most likely to be in one.
 */
/** Per page load, not per useAuth() mount — see where it is read. */
let devSignedOutCleared = false

function isDevSignedOut(): boolean {
  if (!devBuild()) return false
  let requested: string | null = null
  try {
    requested = new URLSearchParams(window.location.search).get('signedout')
  } catch {
    requested = null
  }
  if (requested === '1') {
    try {
      window.sessionStorage.setItem(SIGNED_OUT_STORAGE_KEY, '1')
    } catch {
      /* private window — the choice just does not survive navigation */
    }
    return true
  }
  try {
    return window.sessionStorage.getItem(SIGNED_OUT_STORAGE_KEY) === '1'
  } catch {
    /* private window */
    return false
  }
}

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
      // 0. Dev-only (?signedout=1), and checked FIRST — the one place that reverses
      // the ?dev=1 ordering rule, deliberately. CLAUDE.md says the dev token is
      // "checked last … so a real session always wins", and the asymmetry is the
      // whole justification: ?dev=1 GRANTS a session, so it must never outrank a
      // real one; this flag only ever REMOVES one, so there is no privilege it can
      // confer and nothing it can mask. Behind import.meta.env.DEV, so Vite drops
      // the branch from a production build entirely.
      //
      // The removeItem matters as much as the state: ?dev=1 persists its fallback
      // token to localStorage, so without the clear, step 2 below reads that token
      // straight back on the very next reload and signs the visitor in again.
      if (isDevSignedOut()) {
        // Cleared ONCE per page load, not once per useAuth() mount. localStorage is
        // shared across tabs, and useAuth() is called by many components: without the
        // latch, a signed-out tab left open re-ran this clear whenever a new instance
        // mounted and wiped the cs_token a DIFFERENT tab had just written — opening
        // ?dev=1 beside a ?signedout=1 tab silently signed both of them out. One clear
        // at boot is all the branch needs; the flag below keeps this window a visitor.
        if (!devSignedOutCleared) {
          devSignedOutCleared = true
          try {
            localStorage.removeItem('cs_token')
          } catch {
            /* storage blocked — nothing to clear */
          }
        }
        setAuthState({ userId: null, isAuthenticated: false, isLoading: false })
        return
      }

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
      // With no VITE_SUPABASE_URL there is no backend to sign in to, so a
      // fresh clone opens straight into this mode instead of a login wall.
      if (
        import.meta.env.DEV &&
        (new URLSearchParams(window.location.search).get('dev') === '1' ||
          !import.meta.env.VITE_SUPABASE_URL)
      ) {
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
      // Dev-only: a window that asked to be a visitor (?signedout=1) stays one.
      // Another tab signing in writes cs_token, and without this the cross-app
      // login sync below would flip this window to signed-in mid-walk — which is
      // both wrong for the developer who asked for it and, before the latch above,
      // the thing that made the signed-out tab clear the other tab's token.
      if (isDevSignedOut()) return
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
