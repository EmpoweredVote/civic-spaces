/**
 * Explore's types and interface copy. The editorial DATA — topics, "Explore nearby"
 * suggestions, "What's new" notes — is not served by any API yet, so it lives in
 * src/mocks/civicSpacesExplore.ts and is read through src/lib/exploreData.ts; it is
 * re-exported here under the names the components already use.
 *
 * 🔴 ILLUSTRATIVE, NOT CIVIC RECORD. Nothing here is an official proposal, a vote, or a
 * description of what any one city is doing. The UI labels it as a conversation starter
 * wherever it appears. There is no topics table in civic_spaces and posts carry no topic
 * id, so a topic is NOT linked to existing posts — "Join the conversation" always opens
 * the create-post composer with an editable draft. Do not "find the related post" by
 * matching titles: two posts that share words are not the same conversation.
 *
 * Sources: none of these topics cite one, because none was written from one. The local
 * proposal topic is the exception — it lists the member's real scheduled meeting agendas
 * when the meetings API returns any (see TopicDetail). Never add a source here that the
 * text was not actually drawn from.
 */

import {
  getAdventureSuggestions,
  getAdventureTopics,
  getExploreTopics,
  getImagineTopics,
  getProductUpdates,
} from '../../lib/exploreData'
import type { ExploreTopic, TopicId } from '../../types/explore'

/**
 * The record shapes now live in src/types/explore.ts, a module that imports nothing from
 * components/ or lib/. That is what breaks the mocks -> exploreContent -> exploreData ->
 * mocks cycle, which survived only because the mock's import was type-only. Re-exported
 * here so the eight files already importing these names keep compiling unchanged;
 * `export type` is required because isolatedModules is on.
 */
export type { ExploreLevel, ExploreTopic, ModuleId, TopicId, TopicProvenance } from '../../types/explore'

const topicsData = getExploreTopics()

export const TOPICS = Object.fromEntries(topicsData.topics.map((t) => [t.id, t])) as Record<string, ExploreTopic>

export const FEATURED_TOPIC: string = topicsData.featuredTopicId
export const QUESTION_TOPICS: string[] = topicsData.questionTopicIds

/**
 * The topics the Imagine and Nearby modules OWN, read beside the option lists that name
 * them so the two cannot drift. A module that owns its content must not break when a
 * composition omits an id it happens to reference, so these are deliberately NOT in
 * GENERIC_TOPICS — scripts/check-composition.mjs asserts the three id sets are disjoint.
 */
export const IMAGINE_TOPICS: ExploreTopic[] = getImagineTopics()
export const ADVENTURE_TOPICS: ExploreTopic[] = getAdventureTopics()

// ── Imagine a better neighborhood ─────────────────────────────────────────────────────

export type ImagineOption = 'trees' | 'crossings' | 'spaces' | 'clean' | 'other'

export const IMAGINE_OPTIONS: {
  key: ImagineOption
  label: string
  emoji: string
  response: string
  followUp: string
  /** Text equivalent of what the illustration now shows. */
  sceneText: string
  topic: TopicId
}[] = [
  {
    key: 'trees',
    label: 'More trees and shade',
    emoji: '🌳',
    response: 'Shade makes a street somewhere you want to be, not just pass through.',
    followUp: 'Where would more shade make the biggest difference?',
    sceneText: 'Trees now line the sidewalk, casting shade.',
    topic: 'trees-shade',
  },
  {
    key: 'crossings',
    label: 'Safer crossings',
    emoji: '🚸',
    response: 'A comfortable crossing can help neighbors feel connected.',
    followUp: 'Which crossing would you improve first?',
    sceneText: 'A bright crosswalk now connects both sides of the street.',
    topic: 'safer-crossings',
  },
  {
    key: 'spaces',
    label: 'Welcoming public spaces',
    emoji: '🪑',
    response: 'A place to sit is often all it takes for neighbors to stop and talk.',
    followUp: 'Where would a bench or gathering spot make people stay longer?',
    sceneText: 'Benches and a shared table now invite neighbors to stay.',
    topic: 'public-spaces',
  },
  {
    key: 'clean',
    label: 'Cleaner streets',
    emoji: '🧹',
    response: 'Clean streets signal that a place is cared for — and people notice.',
    followUp: 'Is there a spot where litter keeps coming back?',
    sceneText: 'The litter on the sidewalk is gone.',
    topic: 'clean-streets',
  },
  {
    key: 'other',
    label: 'Something else',
    emoji: '💡',
    response: 'Good ideas do not always fit a list. Describe yours below.',
    followUp: 'What would you change?',
    sceneText: 'The block is unchanged — describe your idea alongside.',
    topic: 'your-idea',
  },
]

// ── Tiny local adventure ──────────────────────────────────────────────────────────────

export type AdventureDuration = '15m' | '1h' | 'evening'

/** One "Explore nearby" suggestion, keyed by how much time it takes. */
export interface AdventureSuggestion {
  key: AdventureDuration
  label: string
  /** Shown under the label in the time picker, so each choice says what it leads to. */
  hint: string
  emoji: string
  title: string
  description: string
  linkLabel: string
  /** Detail panel: how long, where, and how to try it. Generic on purpose — never a real event. */
  durationChip: string
  placeChip: string
  about: string
  steps: string[]
  topic: TopicId
}

export const ADVENTURE_OPTIONS: AdventureSuggestion[] = getAdventureSuggestions().suggestions

// ── What's new ────────────────────────────────────────────────────────────────────────

/**
 * Civic Spaces has no published release-notes feed, so the sample notes describe changes
 * that are actually in this codebase — no dates, because none was ever published.
 * WhatsNewCard's "View all updates" lists PRODUCT_UPDATES.
 */
export interface ProductUpdate {
  id: string
  category: string
  title: string
  /** One line for the card; the three fields below are the full note. */
  summary: string
  whatChanged: string
  why: string
  forYou: string
  whereToTry: string
  /** The detail page's button: back to Explore, or over to Conversations. */
  cta: { label: string; goTo: 'explore' | 'conversations' }
}

export const PRODUCT_UPDATES: ProductUpdate[] = getProductUpdates().updates
