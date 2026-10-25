import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  adventureSuggestionsResponse,
  ADVENTURE_TOPICS,
  GENERIC_TOPICS,
  IMAGINE_TOPICS,
  productUpdatesResponse,
} from '../mocks/civicSpacesExplore'
import {
  compositionKey,
  levelFor,
  resolveComposition,
  type CompassLevelFlags,
} from './exploreComposition'
import type { ExploreComposition, ExploreTopic } from '../types/explore'

/**
 * Explore's editorial content. No API serves it yet, so each getter returns the response-
 * shaped sample from src/mocks/civicSpacesExplore.ts. When a route exists, fetch it here
 * (through EV_API_ORIGIN in src/lib/evApi.ts) and nothing else has to change.
 *
 * `getExploreTopics()` is gone with 16-03: it returned ONE topic table for every slice,
 * synchronously, at import. Topics now arrive per composition through
 * useExploreComposition below. The remaining getters are genuinely slice-independent —
 * a fifteen-minute walk and a release note do not vary by jurisdiction.
 */
export function getAdventureSuggestions() {
  return adventureSuggestionsResponse
}

export function getProductUpdates() {
  return productUpdatesResponse
}

/** The five topics the Imagine module owns and can always open. */
export function getImagineTopics(): ExploreTopic[] {
  return IMAGINE_TOPICS
}

/** The three topics the Nearby module owns and can always open. */
export function getAdventureTopics(): ExploreTopic[] {
  return ADVENTURE_TOPICS
}

// ── The composition seam ──────────────────────────────────────────────────────────────

export interface ExploreCompositionInput {
  sliceType: string
  geoid: string | null
  /** Topics derived from a real source for this exact place. 16-06 supplies Bloomington's. */
  bespoke?: ExploreTopic[]
  answeredCompassTopicIds?: ReadonlySet<string>
  compassLevelFlags?: ReadonlyMap<string, CompassLevelFlags>
}

/** What GET /api/civic-spaces/explore?sliceType=&geoid= would return. */
interface ExploreCompositionPayload {
  sliceType: string
  geoid: string | null
  generic: ExploreTopic[]
  bespoke: ExploreTopic[]
}

/**
 * The one composition for the active tab.
 *
 * The getters above are synchronous and consumed at import — exploreContent.ts calls
 * getExploreTopics() once, at module load. A real route is async, and an async source breaks
 * every consumer unless the signature is async-shaped first. So this hook goes in now, with a
 * queryFn that returns the mock synchronously; swapping to GET /api/civic-spaces/explore
 * changes that one function and nothing else.
 *
 * 🔴 The query key carries the bespoke topics' IDENTITY, not the array reference, or a
 * Bloomington agenda arriving after first paint never re-resolves.
 *
 * 🔴 answeredCompassTopicIds and compassLevelFlags are deliberately NOT in the key: they
 * reorder and filter rather than change what was fetched, and a Map in a query key is a cache
 * miss on every render. They are applied after the query instead.
 */
export function useExploreComposition(input: ExploreCompositionInput): {
  composition: ExploreComposition | null
  isLoading: boolean
} {
  const { sliceType, geoid, bespoke, answeredCompassTopicIds, compassLevelFlags } = input

  const key = compositionKey(sliceType, geoid)
  const bespokeIds = bespoke?.map((topic) => topic.id).join(',') ?? ''

  const query = useQuery({
    queryKey: ['explore-composition', key, bespokeIds],
    queryFn: (): ExploreCompositionPayload => {
      const level = levelFor(sliceType)
      return {
        sliceType,
        geoid,
        generic: level ? GENERIC_TOPICS[level] : [],
        bespoke: bespoke ?? [],
      }
    },
    staleTime: Infinity,
  })

  const data = query.data
  const composition = useMemo(
    () =>
      data
        ? resolveComposition({
            sliceType: data.sliceType,
            geoid: data.geoid,
            generic: data.generic,
            bespoke: data.bespoke,
            answeredCompassTopicIds,
            compassLevelFlags,
          })
        : null,
    [data, answeredCompassTopicIds, compassLevelFlags],
  )

  return { composition, isLoading: query.isLoading }
}
