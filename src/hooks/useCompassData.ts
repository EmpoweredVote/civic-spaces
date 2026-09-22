import { useQuery } from '@tanstack/react-query'
import type { CompassCategory, CompassAnswer } from '../types/compass'

const COMPASS_BASE = 'https://api.empowered.vote/api/compass'

async function fetchCompassCategories(): Promise<CompassCategory[]> {
  const res = await fetch(`${COMPASS_BASE}/categories`)
  if (!res.ok) throw new Error(`Failed to fetch compass categories: ${res.status}`)
  return res.json()
}

async function fetchCompassAnswers(token: string): Promise<CompassAnswer[]> {
  if (!token) return []
  const res = await fetch(`${COMPASS_BASE}/answers`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch compass answers: ${res.status}`)
  return res.json()
}

export function buildChartData(
  categories: CompassCategory[],
  answers: CompassAnswer[]
): Array<{ category: string; value: number }> {
  const answerMap = new Map(answers.map((a) => [a.topic_id, a.value]))

  return categories
    .map((cat) => {
      const topicValues = cat.topics
        .map((t) => answerMap.get(t.id))
        .filter((v): v is number => v !== undefined)

      const avg =
        topicValues.length > 0
          ? topicValues.reduce((sum, v) => sum + v, 0) / topicValues.length
          : 0

      return { category: cat.title, value: avg }
    })
    .filter((d) => d.value > 0)
}

export function useCompassData(userId: string | null) {
  const token = localStorage.getItem('cs_token') ?? ''

  const categoriesQuery = useQuery({
    queryKey: ['compass', 'categories'],
    queryFn: fetchCompassCategories,
    staleTime: 30 * 60 * 1000,
  })

  const answersQuery = useQuery({
    queryKey: ['compass', 'answers', userId],
    queryFn: () => fetchCompassAnswers(token),
    enabled: !!userId && !!token,
    staleTime: 5 * 60 * 1000,
  })

  const categories = categoriesQuery.data ?? []
  const answers = answersQuery.data ?? []
  const isLoading = categoriesQuery.isLoading || answersQuery.isLoading
  const isUncalibrated = !userId || answers.length < 3

  return { categories, answers, isLoading, isUncalibrated }
}
