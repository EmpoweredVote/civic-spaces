import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase client reads the exchanged token (not the raw accounts JWT)
// Call exchangeToken() on login before any Supabase queries
// db.schema defaults all queries to civic_spaces schema
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'civic_spaces' },
  accessToken: async () => localStorage.getItem('cs_token') ?? '',
})

// Call this once on login with the accounts JWT.
// Stores the exchanged Supabase token in localStorage as 'cs_token'.
export async function exchangeToken(accountsJwt: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/functions/v1/exchange-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accountsJwt}` },
  })
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`)
  }
  const { access_token } = await res.json()
  localStorage.setItem('cs_token', access_token)
}
