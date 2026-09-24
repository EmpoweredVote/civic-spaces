// GNews search for Civic Spaces' news widget — runtime-neutral (plain fetch, no Deno
// or Node APIs), so the deployed edge function (index.ts) and the local dev server
// (vite.config.ts) share one copy of the query rules instead of two that drift.

// Mirrors SliceType in src/types/database.ts.
export type Level = 'city' | 'county' | 'state' | 'federal' | 'unified' | 'volunteer'

export interface NewsArticle {
  id: string
  title: string
  url: string
  image: string | null
  sourceName: string
  sourceIcon: string | null
  publishedAt: string
}

interface GNewsArticle {
  title: string
  description: string | null
  url: string
  image: string | null
  publishedAt: string
  source: { name: string; url: string }
}

/**
 * The GNews query for a level, or null when that level gets no news.
 *
 * 🔴 CITY AND COUNTY ONLY, ON PURPOSE. GNews cannot filter by source, and a
 * state-government query tested 2026-09-24 ("North Carolina" AND legislature/governor)
 * returned mostly openly partisan outlets. EV's rules require neutrality, so state and
 * federal news stay off until there is a source policy (an allowlist of outlets, say).
 * Place queries return local newsrooms, which is what the widget is for.
 *
 * Quoted names, AND-ed with the state, so "Springfield" means the member's Springfield.
 * "Asheville local news" (the first version) matched almost nothing recent; the bare
 * quoted name matches the local paper's own coverage.
 */
export function buildQuery(level: Level, location: string, state: string | null): string | null {
  const place = `"${location.replace(/"/g, '')}"`
  const inState = state ? ` AND "${state.replace(/"/g, '')}"` : ''
  switch (level) {
    case 'city':
    case 'county':
      return place + inState
    default:
      return null
  }
}

function faviconFor(sourceUrl: string): string | null {
  try {
    return `${new URL(sourceUrl).origin}/favicon.ico`
  } catch {
    return null
  }
}

/** One GNews request. Throws on a non-OK response, so the caller never caches a failure. */
export async function searchGNews(apiKey: string, query: string): Promise<NewsArticle[]> {
  const url = new URL('https://gnews.io/api/v4/search')
  url.searchParams.set('q', query)
  url.searchParams.set('lang', 'en')
  url.searchParams.set('country', 'us')
  url.searchParams.set('max', '6')
  url.searchParams.set('sortby', 'publishedAt')
  url.searchParams.set('apikey', apiKey)

  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`GNews request failed (${resp.status})`)
  const data = (await resp.json()) as { articles?: GNewsArticle[] }
  return (data.articles ?? []).map((a) => ({
    id: a.url,
    title: a.title,
    url: a.url,
    image: a.image ?? null,
    sourceName: a.source?.name ?? 'Unknown source',
    sourceIcon: a.source?.url ? faviconFor(a.source.url) : null,
    publishedAt: a.publishedAt,
  }))
}

/**
 * Shared headlines, fetched once per query and reused by every visitor for `ttlMs`.
 *
 * Needed, not an optimisation: the free plan allows ~100 requests a day and about one
 * a second. Without this, every viewer's browser costs a request, and a few dozen
 * visitors would exhaust the day for everyone. Concurrent misses share one in-flight
 * request. In-memory, so it lives as long as the server instance — a warm edge-function
 * isolate, or the dev server — which is enough to keep traffic far under the limits.
 */
export function createNewsCache(ttlMs: number) {
  const entries = new Map<string, { at: number; articles: NewsArticle[] }>()
  const inflight = new Map<string, Promise<NewsArticle[]>>()

  return async function cachedSearch(apiKey: string, query: string): Promise<NewsArticle[]> {
    const hit = entries.get(query)
    if (hit && Date.now() - hit.at < ttlMs) return hit.articles
    const pending = inflight.get(query)
    if (pending) return pending

    const request = searchGNews(apiKey, query)
      .then((articles) => {
        entries.set(query, { at: Date.now(), articles })
        return articles
      })
      .finally(() => inflight.delete(query))
    inflight.set(query, request)
    return request
  }
}
