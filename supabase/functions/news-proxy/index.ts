// Server-side proxy for GNews.io — keeps the API key out of the client
// bundle (VITE_ env vars are shipped to the browser, so a key can never live
// there). Query rules, the city/county-only policy and the shared cache live in
// ./gnews.ts, which the local dev server (vite.config.ts) reuses.
//
// Deploy: `supabase functions deploy news-proxy`
// Secret:  `supabase secrets set GNEWS_API_KEY=<key>` (get one at gnews.io)

import { buildQuery, createNewsCache, type Level } from './gnews.ts'

const GNEWS_API_KEY = Deno.env.get('GNEWS_API_KEY')

// 30 minutes, shared by every visitor this isolate serves. See createNewsCache.
const cachedSearch = createNewsCache(30 * 60 * 1000)

interface RequestBody {
  level: Level
  location: string
  /** Full state name, e.g. "North Carolina" — disambiguates same-named places. */
  state?: string | null
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  // 503 / 502 rather than 200-with-no-articles: the widget then says "News isn't
  // available right now", which is true, instead of "No recent headlines", which isn't.
  if (!GNEWS_API_KEY) {
    return Response.json({ error: 'GNEWS_API_KEY is not configured', articles: [] }, { status: 503, headers: CORS_HEADERS })
  }

  try {
    const { level, location, state } = (await req.json()) as RequestBody
    if (!level || !location) {
      return Response.json({ error: 'level and location are required', articles: [] }, { status: 400, headers: CORS_HEADERS })
    }

    const query = buildQuery(level, location, state ?? null)
    // A level with no news (state, federal, ...) is an answer, not an error.
    if (!query) return Response.json({ articles: [] }, { headers: CORS_HEADERS })

    const articles = await cachedSearch(GNEWS_API_KEY, query)
    return Response.json({ articles }, { headers: CORS_HEADERS })
  } catch (err) {
    return Response.json({ error: String(err), articles: [] }, { status: 502, headers: CORS_HEADERS })
  }
})
