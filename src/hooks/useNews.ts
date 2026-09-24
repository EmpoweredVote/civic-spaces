import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { SliceType } from '../types/database'
import type { NewsArticle } from '../types/news'

/** Levels that get news. Mirrors buildQuery in supabase/functions/news-proxy/gnews.ts. */
export const NEWS_LEVELS: readonly SliceType[] = ['city', 'county']

/**
 * Calls the `news-proxy` Supabase Edge Function, which holds the GNews.io API key
 * server-side (never shipped in the client bundle), builds the query and caches the
 * result for every visitor. Any failure throws, so the widget says "News isn't
 * available right now" rather than claiming there are no headlines.
 *
 * In `npm run dev` the same request goes to the dev server's /__dev/news-proxy
 * (vite.config.ts), which runs the same gnews.ts with GNEWS_API_KEY from .env.local —
 * so local previews show real headlines without the function being deployed.
 */
async function fetchNews(level: SliceType, location: string, state: string | null): Promise<NewsArticle[]> {
  const body = { level, location, state }
  if (import.meta.env.DEV) {
    const res = await fetch('/__dev/news-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Dev news proxy failed: ${res.status}`)
    return ((await res.json())?.articles ?? []) as NewsArticle[]
  }
  const { data, error } = await supabase.functions.invoke('news-proxy', { body })
  if (error) throw error
  return (data?.articles ?? []) as NewsArticle[]
}

export function useNews(level: SliceType, location: string | null, state: string | null) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['news', level, location, state],
    queryFn: () => fetchNews(level, location!, state),
    enabled: !!location && NEWS_LEVELS.includes(level),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  })

  return {
    articles: data ?? [],
    isLoading,
    isError,
  }
}
