// Server-side proxy for GNews.io — keeps the API key out of the client
// bundle (VITE_ env vars are shipped to the browser, so a key can never live
// there) and builds the right search query per civic level.
//
// Deploy: `supabase functions deploy news-proxy`
// Secret:  `supabase secrets set GNEWS_API_KEY=<key>` (get one at gnews.io)

const GNEWS_API_KEY = Deno.env.get('GNEWS_API_KEY')

// Mirrors SliceType in src/types/database.ts.
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
      // location is already "Buncombe County", so no second "county".
      return `${location} government`
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
    return Response.json({ error: String(err), articles: [] }, { status: 200, headers: CORS_HEADERS })
  }
})
