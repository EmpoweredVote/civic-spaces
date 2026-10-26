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
import { agendaItemsToTopics } from './agendaTopics'
import { useAgendaItems, type AgendaSource } from '../hooks/useAgendaItems'
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
  /**
   * The resolved city NAME and state abbreviation, or null on every other tab.
   *
   * 🔴 Fetch by name; attach by geoid. The meetings API has no geoid — a city
   * name plus a state abbreviation is the only key it accepts — so the request
   * has to be made this way. The topics it produces are stamped with `geoid`
   * above, and resolveComposition re-checks that stamp, so a name collision
   * discards topics rather than attaching one city's agenda to another.
   */
  city?: string | null
  stateAbbrev?: string | null
  /** Topics derived from a real source for this exact place, beyond the agenda. */
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
  /** The meeting the agenda topics came from, so the module can name and link it. */
  agendaMeeting: AgendaSource | undefined
  isLoading: boolean
} {
  const { sliceType, geoid, city, stateAbbrev, bespoke, answeredCompassTopicIds, compassLevelFlags } =
    input

  /**
   * 🔴 The bespoke layer, as of 16-06: one real jurisdiction's published council
   * agenda. Two client-side requests and a pure mapping, called HERE so that
   * Explore's content still enters through exactly one file.
   *
   * 🔴 Stepping stone, not the destination. When
   * `GET /api/civic-spaces/explore?sliceType=&geoid=` lands (16-09's handoff Ask
   * 1), that route returns the composition with its bespoke topics already in
   * it: the queryFn below becomes the fetch, and useAgendaItems.ts,
   * agendaTopics.ts and these two blocks are deleted outright.
   *
   * It does not block first paint. The agenda arrives after the composition has
   * already resolved from the generic pool, which is why the query key below
   * carries the bespoke topics' identity — without it the arrival would never
   * re-resolve and Bloomington would look like every other city.
   */
  const { agenda } = useAgendaItems(city ?? null, stateAbbrev ?? null)
  const agendaTopics = useMemo(() => {
    const level = levelFor(sliceType)
    // No geoid means no place to attach to, and nothing to be bespoke ABOUT.
    if (!agenda || !level || !geoid) return []
    return agendaItemsToTopics(agenda.items, agenda.meeting, level, geoid)
  }, [agenda, sliceType, geoid])

  const allBespoke = useMemo(
    () => (bespoke && bespoke.length > 0 ? [...agendaTopics, ...bespoke] : agendaTopics),
    [agendaTopics, bespoke],
  )

  const key = compositionKey(sliceType, geoid)
  const bespokeIds = allBespoke.map((topic) => topic.id).join(',')

  const query = useQuery({
    queryKey: ['explore-composition', key, bespokeIds],
    queryFn: (): ExploreCompositionPayload => {
      const level = levelFor(sliceType)
      return {
        sliceType,
        geoid,
        generic: level ? GENERIC_TOPICS[level] : [],
        bespoke: allBespoke,
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

  return { composition, agendaMeeting: agenda?.meeting, isLoading: query.isLoading }
}
