/**
 * What a module gets. One object, passed as a prop.
 *
 * 🔴 Deliberately NOT a React context: there is exactly one consumer tree, and a
 * context would hide which modules depend on what — which is the thing this
 * refactor exists to make visible. A module's dependencies are its `ctx.` reads,
 * and they are greppable.
 *
 * Every import here is `import type`, so this module is erased at build time and
 * the `./ExploreView` reference cannot become a runtime cycle once 16-03 has
 * ExploreView render the registry. `ExploreDestination` and `FeaturedPhoto` move
 * out of ExploreView with that change; this plan does not touch that file.
 */

import type { UpcomingElection } from '../../hooks/useNextElection'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'
import type { ExploreComposition, ExploreTopic, TopicId } from '../../types/explore'
import type { ExploreDestination, FeaturedPhoto } from './ExploreView'
import type { ExploreDraft, ExploreUiState } from './exploreStorage'

export interface ExploreCtx {
  composition: ExploreComposition
  /**
   * Every topic a module may open, by id. Wider than composition.topics: the
   * Imagine and Nearby modules contribute their own self-contained topics (see
   * ExploreModule.topics), because a module that owns its content must not break
   * when a composition omits an id it happened to reference.
   */
  topicsById: ReadonlyMap<TopicId, ExploreTopic>

  /** Where a post lands. null when signed out or with no slice for this tab. */
  destination: ExploreDestination | null
  isAuthenticated: boolean
  /**
   * True on a sibling shard of the member's own jurisdiction: readable, and every
   * write path closed by RLS. Threaded here and always false until 16-05 wires
   * it, so the gate lands in ONE place and every module inherits it.
   */
  isViewOnly: boolean

  // Data, all hoisted above this component and resolved once for the active tab.
  featuredPhoto: FeaturedPhoto | null
  meetings: UpcomingMeeting[] | undefined
  elections: UpcomingElection[] | undefined

  // UI state and actions.
  ui: ExploreUiState
  setUi: (patch: Partial<ExploreUiState>) => void
  draftFor: (topicId: TopicId) => ExploreDraft
  saveDraft: (topicId: TopicId, patch: Partial<Pick<ExploreDraft, 'title' | 'body'>>) => ExploreDraft
  discardDraft: (topicId: TopicId) => void
  /**
   * Moves a draft bound to a community the member has left onto the current
   * destination. Research Finding 3 names rebind as part of the draft API; the
   * topic page is its only caller today, and 16-04 re-keys all four together.
   */
  rebindDraft: (topicId: TopicId) => void
  openTopic: (topicId: TopicId | null) => void
  startConversation: (topicId: TopicId) => void
  onGoToView?: (view: 'explore' | 'conversations') => void
  whatsNewInSidebar: boolean
}
