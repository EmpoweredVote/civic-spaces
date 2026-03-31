import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase Third-Party Auth: accounts JWT is stored as cs_token and used directly.
// Supabase validates it against the configured JWKS from accounts.empowered.vote.
// Queries target public-schema views that forward to civic_spaces tables.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => localStorage.getItem('cs_token') ?? '',
})
