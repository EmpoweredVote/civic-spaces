import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase env vars are not set — running without a backend connection. Data requests will fail.')
}

// Supabase Third-Party Auth: accounts JWT is stored as cs_token and used directly.
// Supabase validates it against the configured JWKS from accounts.empowered.vote.
// Queries target public-schema views that forward to civic_spaces tables.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => localStorage.getItem('cs_token') ?? '',
})
