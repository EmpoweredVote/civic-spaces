import { createClient } from '@supabase/supabase-js'

// Placeholder fallbacks keep `npm run dev` from crashing on boot when there is
// no .env.local — the fixture data in src/lib/devMockData.ts then renders a
// populated dashboard with no backend at all. Any real deployment sets both;
// the warning makes a missing var loud rather than silent.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase env vars are not set — running without a backend connection. Data requests will fail.',
  )
}

/**
 * The token supabase-js should present, or '' when there is no valid session.
 *
 * An EXPIRED cs_token is not a weaker credential — it is a definitively invalid
 * one: PostgREST rejects it with 401 on every request. Presenting it turns a
 * signed-out member's each-and-every query into a 401, which under React Query's
 * retry + refetch is a sustained burst against the engine (the launch-day
 * concern). So when the stored token is missing, malformed, or expired we drop
 * it and return '' — the client then sends no bearer (anon), exactly as it did
 * before a member ever signed in, instead of re-presenting a dead JWT.
 *
 * '' is the same value the original callback returned for the no-token case, so
 * anon behaviour is unchanged; this only stops the expired-token case from
 * hammering. useAuth owns the actual session lifecycle (re-login on 401).
 */
function currentAccessToken(): string {
  const token = localStorage.getItem('cs_token')
  if (!token) return ''
  try {
    const payload = token.split('.')[1]
    if (!payload) throw new Error('malformed token')
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const claims = JSON.parse(atob(padded)) as { exp?: number }
    if (typeof claims.exp === 'number' && Date.now() / 1000 < claims.exp) {
      return token
    }
  } catch {
    // malformed — fall through and treat as no session
  }
  localStorage.removeItem('cs_token')
  return ''
}

// Supabase Third-Party Auth: accounts JWT is stored as cs_token and used directly.
// Supabase validates it against the configured JWKS from accounts.empowered.vote.
// Queries target public-schema views that forward to civic_spaces tables.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => currentAccessToken(),
})
