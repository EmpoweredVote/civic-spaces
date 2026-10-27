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

import type { AgendaSource } from '../../hooks/useAgendaItems'
import type { UpcomingElection } from '../../hooks/useNextElection'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'
import type { RaceRecording } from '../../lib/raceMedia'
import type { MemberRace } from '../../lib/races'
import type { ExploreComposition, ExploreLevel, ExploreTopic, TopicId } from '../../types/explore'
import type { ExploreDestination, FeaturedPhoto } from './ExploreView'
import type { ExploreDraft, ExploreUiState } from './exploreStorage'
import type { NoWriteReason } from '../../lib/writeAccess'

export interface ExploreCtx {
  composition: ExploreComposition
  /**
   * Every topic a module may open, by id. Wider than composition.topics: the
   * Imagine and Nearby modules contribute their own self-contained topics (see
   * ExploreModule.topics), because a module that owns its content must not break
   * when a composition omits an id it happened to reference.
   */
  topicsById: ReadonlyMap<TopicId, ExploreTopic>

  /**
   * The resolved name of the place this tab is — "Bloomington", "Monroe
   * County", "Indiana" — or null.
   *
   * 🔴 null means "not resolved, or no place", and a module that names the place
   * must render NOTHING rather than a sentence with a hole in it. In particular
   * it must never fall back to the tab label: `useJurisdictionName` answers the
   * label ("City") while its offline table loads, and "Welcome to City" is worse
   * than waiting a frame. AppShell passes null for exactly that case.
   *
   * No new lookup: this is the same string `ActiveExplore` already resolves for
   * the meetings query.
   */
  placeName: string | null

  /**
   * True only when this page's ordering really is this member's own.
   *
   * 🔴 Locked decision 7, and the copy trap it protects. `rankByCompass` reads
   * the VIEWING MEMBER's own answers and nothing else — no slice-wide aggregate
   * of members' political answers is computed, stored or requested anywhere,
   * and none should be designed. This flag exists so a module can SAY the
   * ordering is theirs only when it is: below `MIN_RANKED` answers, and when
   * none of this page's topics maps to something they have answered, ranking is
   * a no-op and the sentence would be a small lie told to most members.
   */
  compassRanked: boolean

  /** Where a post lands. null when signed out or with no slice for this tab. */
  destination: ExploreDestination | null
  isAuthenticated: boolean
  /**
   * 🔴 Is the place on screen the READER'S OWN? D-10: *never show someone a
   * place as if it were already theirs.*
   *
   * This is the second person's switch and nothing else's. A module that writes
   * "where you live", "your community" or "your ballot" is making a claim about
   * the reader, and with a visited place on screen that claim is false — which
   * is what `deferred-items.md` item 2 recorded against this phase. The DATA was
   * already right (`racesAreaFor` follows `onScreenSlices` as of 17-04); only the
   * pronoun was wrong.
   *
   * 🔴 Derived from `noWriteReason`, never computed beside it, for the same
   * reason `isViewOnly` is: two values that each decide a version of the same
   * question is how they come to disagree. TRUE when the reason is `null` (their
   * own shard) and when it is `'sibling-shard'` — a sibling shares
   * `(slice_type, geoid)` with a slice the member holds, so it IS their
   * jurisdiction and only the shard differs. FALSE for `'signed-out'`,
   * `'no-slice'` and `'other-place'`.
   *
   * 🔴 NOT a synonym for `!isViewOnly`. A member on a sibling shard may not
   * WRITE there and the place is still theirs; conflating the two would make
   * Phase 16's sibling-shard presentation go cold for no reason. The two
   * questions are *may I speak here* and *is this mine*, and this phase is the
   * one that separated them.
   */
  isOwnPlace: boolean
  /**
   * True on a sibling shard of the member's own jurisdiction: readable, and every
   * write path closed by RLS. One value, computed once in AppShell and shared with
   * the feed, so the gate lands in ONE place and every module inherits it rather
   * than each remembering its own rule.
   *
   * 🔴 Every module that offers a write reads this. Research Finding 5 lists the
   * ten affordances; `scripts/check-explore-gate.mjs` is what stops nine of them
   * being enough.
   */
  isViewOnly: boolean
  /**
   * WHY the viewer may not write — 'signed-out', 'no-slice', 'other-place' or
   * 'sibling-shard' — or null when they may. Derived from `isViewOnly`'s own
   * source (whyNoWrite, in AppShell) and never computed beside it: two values
   * that each decide the same thing is how they come to disagree.
   */
  noWriteReason: NoWriteReason | null
  /**
   * The real sign-in, for the signed-out notice's control. Undefined for a
   * member, who has one already.
   */
  loginUrl?: string
  /** Which shard is on screen, for the notice's wording. Undefined when not view-only. */
  viewingSliceIndex?: number
  /** The member's OWN shard, the one posting and drafting stay in. */
  ownSliceIndex?: number
  /**
   * Leaves view-only — the same call the feed's amber banner makes
   * (`handleViewSlice(tab, ownSlice, ownSlice.id)`). Explore needs its own, because
   * the shard selector renders only in the Conversations toolbar
   * (`AppShell.tsx`, `effectiveView === 'conversations'`) and is not reachable from
   * here at all: without this a view-only member is stranded (research Pitfall 8).
   */
  onReturnToOwnSlice?: () => void

  // Data, all hoisted above this component and resolved once for the active tab.
  featuredPhoto: FeaturedPhoto | null
  meetings: UpcomingMeeting[] | undefined
  elections: UpcomingElection[] | undefined
  /**
   * The published agenda this place's bespoke topics were derived from, and the
   * topics that SURVIVED resolveComposition's geoid check — never the raw
   * derivation. The module needs both: the topics to render, and the meeting to
   * say whose agenda they are and link the document.
   *
   * Undefined for every place the pipeline does not cover, which today is every
   * place but one. That is not a failure state and must not read as one.
   */
  agenda?: { meeting: AgendaSource; topics: ExploreTopic[] }
  /**
   * The member's OWN races, by the level that renders them — Federal and State
   * only, which is where 16-DESIGN decision 8 puts them.
   *
   * 🔴 Resolved from `racesAreaFor(slices)`, the member's most LOCAL area, never
   * from `electionAreaFor`'s state fallback. A state-area query returns every
   * congressional district and omits the statewide races; nine House races a
   * member cannot choose between is worse than none. A member with neither a
   * city nor a county slice has no entry here at all, and the reserved room
   * shows instead.
   *
   * Undefined while loading and on failure alike — to a member those are one
   * state, and both are the reserved room.
   */
  races?: Partial<Record<ExploreLevel, MemberRace[]>>
  /**
   * Recorded debates and candidate forums, by `race_id`. A race with none has no
   * entry. 🔴 Recordings only: no upcoming debate is published anywhere, so
   * nothing here may be worded as a schedule.
   */
  raceMedia?: ReadonlyMap<string, RaceRecording[]>

  // UI state and actions.
  ui: ExploreUiState
  setUi: (patch: Partial<ExploreUiState>) => void
  /**
   * A module names a TOPIC; ExploreView turns that into a draft key from the
   * composition it is rendering. No module ever sees a key, so no module can
   * build one for the wrong jurisdiction.
   *
   * `rebindDraft` is gone with the moved-from banner it served: a draft whose
   * key names a place the member has left is simply never surfaced, so there is
   * nothing to re-point and no control that could re-point it (write affordance
   * #8 of research Finding 5, retired rather than gated).
   */
  draftFor: (topicId: TopicId) => ExploreDraft
  saveDraft: (topicId: TopicId, patch: Partial<Pick<ExploreDraft, 'title' | 'body'>>) => ExploreDraft
  discardDraft: (topicId: TopicId) => void
  openTopic: (topicId: TopicId | null) => void
  startConversation: (topicId: TopicId) => void
  onGoToView?: (view: 'explore' | 'conversations') => void
  whatsNewInSidebar: boolean
}
