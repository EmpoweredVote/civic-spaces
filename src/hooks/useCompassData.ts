import { useQuery } from '@tanstack/react-query'
import type {
  CompassAnswer,
  CompassSpokes,
  CompassTopic,
  InvertedSpokes,
} from '../types/compass'
import { isSyntheticUserId, MOCK_COMPASS_ANSWERS, MOCK_COMPASS_TOPICS } from '../lib/devMockData'

const COMPASS_BASE = 'https://api.empowered.vote/api/compass'

/** Below this the chart says nothing useful, so the widget renders nothing. */
export const MIN_SPOKES = 3

async function getJson<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${COMPASS_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new Error(`compass${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export interface CompassData {
  topics: CompassTopic[]
  /** short_title -> answered value, for the spokes to draw. */
  spokes: CompassSpokes
  invertedSpokes: InvertedSpokes
  isLoading: boolean
  /** Too few answered topics for a chart to mean anything. */
  isUncalibrated: boolean
}

/**
 * The member's compass, ready for RadarChartCore.
 *
 * Spoke order follows `selected-topics` — the order chosen during calibration —
 * so the chart here matches the one in Compass itself. When that call returns
 * nothing (a member who answered questions but never curated a set), it falls
 * back to whatever they have answered, so the widget still has something to say.
 *
 * 🔴 Hoisted: call this once in AppShell, never inside SliceFeedPanel. All six
 * feed panels mount at once, so a hook in there fires six times.
 */
export function useCompassData(userId: string | null): CompassData {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('cs_token') : null
  const synthetic = isSyntheticUserId(userId)

  // Public, and effectively static — 60 topics that change on a release cadence.
  const topicsQuery = useQuery({
    queryKey: ['compass', 'topics'],
    queryFn: () => getJson<CompassTopic[]>('/topics'),
    staleTime: 60 * 60 * 1000,
    enabled: !synthetic,
  })

  const answersQuery = useQuery({
    queryKey: ['compass', 'answers', userId],
    queryFn: async () => {
      const [answers, selected] = await Promise.all([
        getJson<CompassAnswer[]>('/answers', token ?? undefined),
        getJson<string[]>('/selected-topics', token ?? undefined).catch(() => [] as string[]),
      ])
      return { answers, selected }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !synthetic && !!userId && !!token,
  })

  const topics = synthetic ? MOCK_COMPASS_TOPICS : topicsQuery.data ?? []
  const answers = synthetic ? MOCK_COMPASS_ANSWERS : answersQuery.data?.answers ?? []
  const selected = synthetic ? MOCK_COMPASS_TOPICS.map((t) => t.id) : answersQuery.data?.selected ?? []

  const byTopicId = new Map(answers.map((a) => [a.topic_id, a]))
  const titleById = new Map(topics.map((t) => [t.id, t.short_title]))

  // Selected order first; anything answered but not selected fills in after, so
  // a member who never curated a set still gets a chart.
  const orderedIds = selected.length > 0
    ? selected
    : answers.map((a) => a.topic_id)

  const spokes: CompassSpokes = {}
  const invertedSpokes: InvertedSpokes = {}
  for (const id of orderedIds) {
    const shortTitle = titleById.get(id)
    const answer = byTopicId.get(id)
    // An unanswered spoke reads as disagreement rather than absence, so leave
    // it out entirely instead of plotting it at zero.
    if (!shortTitle || !answer || !(answer.value > 0)) continue
    spokes[shortTitle] = answer.value
    if (answer.inverted) invertedSpokes[shortTitle] = true
  }

  const isLoading = synthetic
    ? false
    : topicsQuery.isLoading || (!!userId && !!token && answersQuery.isLoading)

  return {
    topics,
    spokes,
    invertedSpokes,
    isLoading,
    isUncalibrated: !isLoading && Object.keys(spokes).length < MIN_SPOKES,
  }
}
