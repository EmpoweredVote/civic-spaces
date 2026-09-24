import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { SliceType } from '../types/database'
import type { NewsArticle } from '../types/news'

/**
 * Calls the `news-proxy` Supabase Edge Function, which holds the GNews.io
 * API key server-side (never shipped in the client bundle) and builds the
 * right search query for the civic level. Returns [] on any failure so a
 * missing/undeployed function degrades to the widget's empty state rather
 * than breaking the page.
 */
async function fetchNews(level: SliceType, location: string): Promise<NewsArticle[]> {
  const { data, error } = await supabase.functions.invoke('news-proxy', {
    body: { level, location },
  })
  if (error) throw error
  return (data?.articles ?? []) as NewsArticle[]
}

export function useNews(level: SliceType, location: string | null) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['news', level, location],
    queryFn: () => fetchNews(level, location!),
    enabled: !!location,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  })

  return {
    articles: data ?? [],
    isLoading,
    isError,
  }
}
