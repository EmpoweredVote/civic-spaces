// Server-side proxy for GNews.io — keeps the API key out of the client
// bundle (VITE_ env vars are shipped to the browser, so a key can never live
// there) and builds the right search query per civic level.
//
// Deploy: `supabase functions deploy news-proxy`
// Secret:  `supabase secrets set GNEWS_API_KEY=<key>` (gnews.io)
//
// 🔴 GNews' free tier does NOT permit commercial use and delays articles by 12
// hours, so production needs a paid plan (Essential, 1,000 req/day, was
// EUR 49.99/mo as of 2026-09). Before deploying, ADD CACHING BELOW: the query
// depends only on (level, location), never on who is asking, so a cache makes
// request volume scale with the number of active jurisdictions instead of with
// the number of members. Uncached, every visitor to a slice costs a request and
// no tier is safe.
//
// 🔴 This must stay JWT-verified. GNews bills per request, so an unauthenticated
// proxy is someone else's free search API on our quota. verify_jwt is Supabase's
// default, but it is declared explicitly in supabase/config.toml so that it is
// visible rather than inherited — do not deploy this with --no-verify-jwt.

const GNEWS_API_KEY = Deno.env.get('GNEWS_API_KEY')

type Level = 'city' | 'county' | 'state' | 'federal' | 'unified' | 'volunteer'

interface RequestBody {
  level: Level
  location: string
}

interface GNewsSource {
  name: string
  url: string
}

interface GNewsArticle {
  title: string
  description: string | null
  url: string
  image: string | null
  publishedAt: string
  source: GNewsSource
}

/** Builds the GNews search query for a civic level + resolved location name. */
function buildQuery(level: Level, location: string): string {
  switch (level) {
    case 'federal':
      return 'United States federal government'
    case 'unified':
      return 'United States news'
    case 'state':
      return `${location} state government`
    case 'county':
      return `${location} county government`
    case 'city':
      return `${location} local news`
    default:
      return `${location} news`
  }
}

function faviconFor(sourceUrl: string): string | null {
  try {
    return `${new URL(sourceUrl).origin}/favicon.ico`
  } catch {
    return null
  }
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

  if (!GNEWS_API_KEY) {
    return Response.json(
      { error: 'GNEWS_API_KEY is not configured', articles: [] },
      { status: 200, headers: CORS_HEADERS }
    )
  }

  try {
    const { level, location } = (await req.json()) as RequestBody
    if (!level || !location) {
      return Response.json({ error: 'level and location are required', articles: [] }, { status: 400, headers: CORS_HEADERS })
    }

    const query = buildQuery(level, location)
    const gnewsUrl = new URL('https://gnews.io/api/v4/search')
    gnewsUrl.searchParams.set('q', query)
    gnewsUrl.searchParams.set('lang', 'en')
    gnewsUrl.searchParams.set('country', 'us')
    gnewsUrl.searchParams.set('max', '6')
    gnewsUrl.searchParams.set('apikey', GNEWS_API_KEY)

    const resp = await fetch(gnewsUrl)
    if (!resp.ok) {
      return Response.json({ error: `GNews request failed (${resp.status})`, articles: [] }, { status: 200, headers: CORS_HEADERS })
    }

    const data = (await resp.json()) as { articles: GNewsArticle[] }
    const articles = (data.articles ?? []).map((a) => ({
      id: a.url,
      title: a.title,
      url: a.url,
      image: a.image ?? null,
      sourceName: a.source?.name ?? 'Unknown source',
      sourceIcon: a.source?.url ? faviconFor(a.source.url) : null,
      publishedAt: a.publishedAt,
    }))

    return Response.json({ articles }, { headers: CORS_HEADERS })
  } catch (err) {
    // Logged server-side only: the raw error can carry internal detail, and the
    // client's contract here is just "no articles".
    console.error('news-proxy failed:', err)
    return Response.json({ error: 'News is unavailable right now', articles: [] }, { status: 200, headers: CORS_HEADERS })
  }
})
