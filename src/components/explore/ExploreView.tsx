import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  readDrafts,
  readResume,
  useExploreDrafts,
  useExploreUiState,
  writeDraft,
  writeDrafts,
  writeResume,
  type ExploreDraft,
} from './exploreStorage'
import { ArrowIcon, CARD, CategoryLabel, FOCUS, PrimaryButton, TEXT_FIELD } from './exploreUi'
import { QuestionPicker } from '../QuestionPicker'
import { questionsFor } from '../../lib/writingGuidance'
import { focusAtEnd } from '../../lib/focusAtEnd'
import { ProvenanceTag, SourceNote } from './provenance'
import { MODULE_REGISTRY, ReservedRoom, ReservedRoomGroup, reservedRoomsIn } from './registry'
import { ReadOnlyNotice } from '../ReadOnlyNotice'
import type { ExploreCtx } from './ExploreContext'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'
import type { UpcomingElection } from '../../hooks/useNextElection'
import type { RaceRecording } from '../../lib/raceMedia'
import type { MemberRace } from '../../lib/races'
import type { NoWriteReason } from '../../lib/writeAccess'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useExploreComposition } from '../../lib/exploreData'
import {
  canPostDraft,
  draftKey,
  MIN_RANKED,
  isHttpUrl,
  migrateSignedOutDrafts,
  shouldResume,
  type CompassLevelFlags,
  type DraftTargetSlice,
} from '../../lib/exploreComposition'
import type { ExploreLevel, ExploreTopic, TopicId } from '../../types/explore'
import type { TabKey } from '../../types/database'

/** How long a "post this after sign-in" marker stays good for. The round trip is minutes. */
const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** A licensed place photo for the featured card. The credit is a licence condition — always shown. */
export interface FeaturedPhoto {
  url: string
  alt: string
  credit: string
}

/**
 * Where a topic's conversation happens: the member's most local OWN community, never a
 * sibling shard they are browsing (RLS would reject the insert) and never "whatever tab
 * is showing" — so flipping between City and State cannot move a draft between places.
 */
export interface ExploreDestination {
  sliceId: string
  tab: TabKey
  name: string
}

interface ExploreViewProps {
  /** Which composition to render. With `geoid` this is the key the whole view scopes to. */
  sliceType: string
  /** null for a placeless level, a signed-out visitor, or a member with no slice here. */
  geoid: string | null
  /**
   * The resolved city name and state abbreviation for this tab, or absent.
   *
   * 🔴 Fetch by name; attach by geoid. The meetings API accepts no geoid, so the
   * agenda request is made by name — but the topics it yields are stamped with
   * `geoid` above and re-checked against it in resolveComposition. Absent on
   * every tab but City, and whenever the name has not resolved: the API would
   * have nothing to match, and a tab label is not a city.
   */
  city?: string | null
  stateAbbrev?: string | null
  /**
   * The resolved place name for this tab, for the modules that name the place.
   *
   * 🔴 Absent, or null, until it resolves — never the tab label. AppShell holds
   * the one lookup and passes `null` while `useJurisdictionName` is still
   * answering with its fallback. See ExploreCtx.placeName.
   */
  placeName?: string | null
  /**
   * Where a conversation started on this tab would land.
   *
   * null when signed out, when the member has no local community, and — since
   * 17-04 — when the community ON SCREEN IS NOT THEIRS. A visited place's slice
   * carries a `place:<type>:<geoid>` sentinel rather than a real `slices.id`, so
   * a destination built from it names something nobody can write to. Every write
   * affordance is gated already; this is what stops the sentinel being handed to
   * one at all. `AppShell`'s `ActiveExplore` takes `destinationEnabled` for it.
   */
  destination: ExploreDestination | null
  isAuthenticated: boolean
  /**
   * True when the viewer may NOT write here, for any of four reasons: they are
   * signed out, they hold no slice at this level, this is somebody else's place,
   * or it is a sibling shard of their own jurisdiction. RLS refuses the insert in
   * all four.
   *
   * It used to mean the last of those alone — "pointed at a SIBLING shard of the
   * member's own jurisdiction" — and that sentence is why this doc is rewritten
   * rather than left: research Q3.6 is explicit that a stale comment here would
   * send the next reader off to re-derive the sibling rule at a call site, which
   * is exactly where the rule must not live. `whyNoWrite()` is the only place it
   * is decided (src/lib/writeAccess.ts); `noWriteReason` below says which.
   *
   * 🔴 Required, not optional. An optional boolean defaulting to "not gated" is
   * the wrong default for this field — a new call site that forgets it would
   * silently offer writes RLS can only reject. That argument is unchanged, and
   * the two call sites that used to pass a hard-coded `false` (signed out, no
   * slice for this tab) are precisely the two the old default got wrong: both
   * are gated now, and both pass the real answer.
   */
  isViewOnly: boolean
  /**
   * WHY the viewer may not write here, or null when they may. Required for the
   * same reason `isViewOnly` is: a call site that forgot it would render a notice
   * that cannot say which of the four states it is in.
   */
  noWriteReason: NoWriteReason | null
  /** The real sign-in, for the signed-out notice's control. Absent for a member. */
  loginUrl?: string
  /** The shard on screen and the member's own, for the notice. Only meaningful while view-only. */
  viewingSliceIndex?: number
  ownSliceIndex?: number
  /** Leaves view-only. Explore's only way back: the shard selector is in the Conversations bar. */
  onReturnToOwnSlice?: () => void
  /**
   * Every slice the member holds, by type — at most one per type. Not for
   * rendering: it is what canPostDraft() checks a stored draft key against, so a
   * resume marker for a place they have left is dropped rather than posted.
   * Absent while signed out, where there is nothing to check against.
   */
  slices?: Partial<Record<string, DraftTargetSlice | undefined>>
  /** Real scheduled meetings for the destination city; undefined when there is no source. */
  meetings?: UpcomingMeeting[]
  /** Real upcoming elections for the member's area, soonest first. */
  elections?: UpcomingElection[]
  /**
   * The member's OWN races, by the level that renders them.
   *
   * 🔴 Resolved in AppShell from `racesAreaFor(slices)` — the member's most
   * LOCAL area — never from the state fallback `electionAreaFor` uses for the
   * election calendar. The two differ by that fallback and must never be merged.
   */
  races?: Partial<Record<ExploreLevel, MemberRace[]>>
  /** Recorded debates and forums by race id. Recordings only; nothing upcoming exists. */
  raceMedia?: ReadonlyMap<string, RaceRecording[]>
  /**
   * The VIEWING MEMBER's own answered Compass topics, which ORDER the generic
   * topics, and the catalog's level flags, which EXCLUDE a local-only topic from
   * Federal.
   *
   * 🔴 Nothing aggregates — locked decision 7. These are one member's own
   * answers, used to order one member's own page. No slice-wide view of
   * members' political answers is computed, stored or requested anywhere; no
   * endpoint serves one, and the design is explicit that none should be
   * designed.
   *
   * 🔴 Ranking REORDERS; it never adds or removes. If a topic disappears when
   * Compass loads, the level filter has leaked into the ranking path.
   */
  answeredCompassTopicIds?: ReadonlySet<string>
  compassLevelFlags?: ReadonlyMap<string, CompassLevelFlags>
  /**
   * Open the composer for this draft (AppShell signs a visitor in first).
   *
   * The first argument is the DRAFT KEY, not a topic id: where a draft posts is
   * decided by `(sliceType, geoid, topicId)`, and AppShell re-checks it against
   * the member's slices before anything reaches the composer. `destinationName`
   * is the resolved place name for that key's slice — ExploreView only ever
   * builds a key from the composition it is rendering, so the two always agree.
   */
  onStartConversation: (key: string, draft: ExploreDraft, destinationName: string | null, topic?: ExploreTopic) => void
  /** Brings the column back to its top when the view inside it changes. */
  onScrollTop?: () => void
  /** True when the right sidebar shows What's new (md+), so the column keeps it only below md. */
  whatsNewInSidebar?: boolean
  /** The member's own place photo; null/undefined falls back to the drawn street. */
  featuredPhoto?: FeaturedPhoto | null
  /** Lets an update's button switch the forum view; absent when signed out. */
  onGoToView?: (view: 'explore' | 'conversations') => void
}


/**
 * Explore is now a RENDERER: it resolves the composition for this slice, builds the
 * context every module reads, and walks `composition.modules`. It owns no section
 * markup — the modules in ./modules do, and the registry says which of them this
 * slice has, in what order, and what the page says where one cannot render.
 */
export function ExploreView({
  sliceType,
  geoid,
  city,
  stateAbbrev,
  placeName,
  destination,
  isAuthenticated,
  isViewOnly,
  noWriteReason,
  loginUrl,
  viewingSliceIndex,
  ownSliceIndex,
  onReturnToOwnSlice,
  slices,
  meetings,
  elections,
  races,
  raceMedia,
  answeredCompassTopicIds,
  compassLevelFlags,
  onStartConversation,
  onScrollTop,
  whatsNewInSidebar,
  featuredPhoto,
  onGoToView,
}: ExploreViewProps) {
  const drafts = useExploreDrafts()
  const [ui, setUi] = useExploreUiState()
  const { composition, agendaMeeting, isLoading } = useExploreComposition({
    sliceType,
    geoid,
    city,
    stateAbbrev,
    answeredCompassTopicIds,
    compassLevelFlags,
  })

  /**
   * The agenda section's content, assembled from what the composition ACTUALLY
   * kept — not from the derivation.
   *
   * 🔴 That distinction is the geoid guard. resolveComposition discards a
   * bespoke topic stamped with a different geoid, so reading the topics back off
   * the composition is what makes the module unable to render a discarded one.
   * Deriving ctx.agenda from the hook's raw output instead would route straight
   * round the check that exists to prevent one city's agenda appearing on
   * another's tab.
   */
  const agenda = useMemo(() => {
    if (!composition || !agendaMeeting) return undefined
    const topics = composition.topics.filter((topic) => topic.provenance === 'derived-from-agenda')
    return topics.length > 0 ? { meeting: agendaMeeting, topics } : undefined
  }, [composition, agendaMeeting])

  /**
   * Did this member's own Compass answers actually order the page?
   *
   * 🔴 Both halves are needed, and both are the difference between a true
   * sentence and a plausible one. `rankByCompass` returns source order untouched
   * below MIN_RANKED, and scores every topic 0 — another no-op — when none of
   * them maps to something answered. A module that says "your own answers put
   * the closest ones first" may only say it when this is true. Nothing
   * aggregates: this is one member's answers ordering one member's page.
   */
  const compassRanked = useMemo(() => {
    if (!composition || !answeredCompassTopicIds || answeredCompassTopicIds.size < MIN_RANKED) return false
    return composition.topics.some((t) => !!t.compassTopicId && answeredCompassTopicIds.has(t.compassTopicId))
  }, [composition, answeredCompassTopicIds])

  /**
   * Every topic any module may open, by id.
   *
   * Wider than `composition.topics` on purpose: Imagine and Nearby own their own
   * topics (research Finding 3 item 3) and a composition is free not to list
   * them, so without this merge their cards open a topic that resolves to
   * nothing. Every registered module contributes, not only the ones this
   * composition names — `topics()` is pure and cheap, and a module's topics
   * resolving is never conditional on the page it happens to be on.
   *
   * The composition's own topics are set LAST, so a bespoke record for an id
   * wins over a module's generic one.
   */
  const topicsById = useMemo(() => {
    const map = new Map<TopicId, ExploreTopic>()
    if (!composition) return map
    for (const mod of Object.values(MODULE_REGISTRY)) {
      for (const topic of mod.topics?.(composition) ?? []) map.set(topic.id, topic)
    }
    for (const topic of composition.topics) map.set(topic.id, topic)
    return map
  }, [composition])

  /**
   * 🔴 The one place a draft key is built. Modules keep calling
   * `ctx.draftFor(topicId)`; the jurisdiction comes from the composition being
   * rendered, so no module ever sees a key and no module can build a wrong one.
   */
  const keyFor = useCallback(
    (topicId: TopicId) => draftKey(sliceType, geoid, topicId),
    [sliceType, geoid],
  )

  const draftFor = useCallback(
    (topicId: TopicId): ExploreDraft =>
      drafts[keyFor(topicId)] ?? {
        title: topicsById.get(topicId)?.suggestedTitle ?? '',
        body: '',
        updatedAt: 0,
      },
    [drafts, keyFor, topicsById],
  )

  /**
   * Saves a draft. There is no binding step any more: a draft is title, body and
   * when it was touched, and WHERE it posts is its key — checked at post time by
   * canPostDraft() against the slices the member holds then.
   *
   * Returns what it wrote, so a caller never has to read storage back to find out.
   */
  const saveDraft = useCallback(
    (topicId: TopicId, patch: Partial<Pick<ExploreDraft, 'title' | 'body'>>): ExploreDraft => {
      const next: ExploreDraft = { ...draftFor(topicId), ...patch, updatedAt: Date.now() }
      writeDraft(keyFor(topicId), next)
      return next
    },
    [draftFor, keyFor],
  )

  const discardDraft = useCallback((topicId: TopicId) => writeDraft(keyFor(topicId), null), [keyFor])

  const startConversation = useCallback(
    (topicId: TopicId) => {
      /**
       * 🔴 The chokepoint. All three composer paths — the Join submit, "Share an
       * idea", and the resume effect that reaches it with no button press at all —
       * funnel through here, so this is the one place that can close all three.
       *
       * Belt and braces WITH Task 5's hiding, not instead of it: a no-op on its own
       * leaves a button that silently does nothing, which is its own kind of lie.
       * Every caller is hidden while view-only; this is what guarantees a stale
       * closure or a future module cannot find a way round that.
       */
      if (isViewOnly) return
      // Persist first: the draft is what survives sign-in. Hand the same object over
      // rather than making AppShell read it back — storage may have refused the write.
      onStartConversation(keyFor(topicId), saveDraft(topicId, {}), destination?.name ?? null, topicsById.get(topicId))
    },
    [saveDraft, keyFor, destination, onStartConversation, isViewOnly, topicsById],
  )

  // An open topic is stored with the composition it was opened in, so switching tab
  // cannot carry it onto a slice whose Join button points somewhere else.
  const compositionKey = composition?.key ?? null
  // Where the list was scrolled when a topic opened, so Back returns to the same card
  // rather than to the top of the page.
  const listScrollRef = useRef<number | null>(null)
  const openTopic = useCallback(
    (topicId: TopicId | null) => {
      setUi({ openTopic: topicId && compositionKey ? { key: compositionKey, topicId } : null })
      if (topicId) {
        listScrollRef.current = window.scrollY
        onScrollTop?.()
        return
      }
      const y = listScrollRef.current
      listScrollRef.current = null
      if (y === null) onScrollTop?.()
      else requestAnimationFrame(() => window.scrollTo({ top: y }))
    },
    [setUi, onScrollTop, compositionKey],
  )

  /**
   * A draft typed signed out is stored with no geoid (`city||<topicId>`). On sign-in the
   * member has a real city slice, so it moves to `city|<geoid>|<topicId>` — which is what
   * every reader looks for from then on. Without this, signing in FROM THE HEADER rather
   * than by pressing Join loses the draft silently: the resume effect below only covers
   * the member who pressed the button.
   *
   * 🔴 Declared BEFORE the resume effect, and effects run in declaration order: the
   * marker's key has to be looked up after the draft has moved, or resume reads the old
   * key and finds nothing. The resume effect reads storage directly, so it sees this
   * write in the same pass.
   */
  const migratedRef = useRef(false)
  useEffect(() => {
    // An empty map is "still loading" as much as it is "holds nothing", and this runs
    // once — migrating against it would do nothing and then never run again.
    if (migratedRef.current || !isAuthenticated || !slices || Object.keys(slices).length === 0) return
    migratedRef.current = true
    const { next, changed } = migrateSignedOutDrafts(readDrafts(), slices)
    if (changed) writeDrafts(next)
  }, [isAuthenticated, slices])

  /**
   * The other half of a signed-out "Join": the visitor went to sign in, came back to a
   * fresh page, and the resume marker says which draft they meant to post. Rebuild its
   * key, prove the member may still post there, and hand it to AppShell exactly as if
   * they had pressed the button now.
   *
   * 🔴 This reaches the composer with NO button press — write affordance #3 of
   * research Finding 5, and the one no amount of hiding buttons would have caught.
   * The decision itself is `shouldResume`, a pure function, because a browser
   * cannot reliably reach its view-only branch: see that function's note, and
   * scripts/check-composition.mjs 48–55.
   */
  const resumedRef = useRef(false)
  useEffect(() => {
    // Wait for the slices to arrive. An empty map would read as "you hold nothing",
    // and the marker would be dropped for a member who holds the slice perfectly well.
    if (resumedRef.current || !isAuthenticated || !slices || Object.keys(slices).length === 0) return
    const marker = readResume()
    // A marker written signed out carries no geoid; the member now has one. Resolve it
    // against the slice they hold for that type, which is where the draft now lives.
    const boundGeoid = marker ? marker.geoid ?? slices[marker.sliceType]?.geoid ?? null : null
    const key = marker ? draftKey(marker.sliceType, boundGeoid, marker.topicId) : ''
    const draft = marker ? readDrafts()[key] : undefined
    const action = shouldResume({
      marker,
      draft,
      now: Date.now(),
      maxAgeMs: RESUME_MAX_AGE_MS,
      isViewOnly,
      hasDestination: !!destination,
      postVerdict: marker ? canPostDraft(key, slices) : { ok: false },
    })
    // 🔴 'none' and 'defer' leave resumedRef ALONE. Setting it on 'defer' would make
    // deferring permanent — "later" would quietly mean "never" — and the whole point
    // of deferring is that the member switches back and it fires then.
    if (action === 'none' || action === 'defer') return
    resumedRef.current = true
    writeResume(null)
    // 'drop-stale' and 'drop-unpostable' both end here: the marker is gone and the
    // draft, if there is one, stays exactly where it is.
    if (action !== 'resume' || !marker || !draft) return
    /**
     * 🔴 The MARKER'S key, never keyFor(). A visitor signs in from the city page and
     * comes back to whatever tab cs_active_tab held — 'federal' by default, since the
     * signed-out screen has no tab bar to have changed it. Re-keying to the rendered
     * composition would either lose the draft or, worse, aim it at the wrong
     * jurisdiction. AppShell re-checks this key with the same guard and switches to
     * the tab it names.
     *
     * The destination NAME is only passed when this composition is the one that owns
     * the key; otherwise the note says "your City community" rather than naming the
     * wrong place.
     */
    onStartConversation(key, draft, key === keyFor(marker.topicId) ? destination?.name ?? null : null, topicsById.get(marker.topicId))
    // 🔴 isViewOnly is a DEPENDENCY, and it is the only thing that changes when the
    // member presses Switch back: `destination` and `isAuthenticated` are identical
    // either side of that transition. Without it React never re-runs this effect and a
    // deferred marker sits there until the next mount.
  }, [isAuthenticated, destination, slices, keyFor, onStartConversation, isViewOnly, topicsById])

  if (isLoading) return <ExploreSkeleton />
  // Volunteer has no Explore and never has — levelFor() returns null and so does this.
  if (!composition) return null

  const ctx: ExploreCtx = {
    composition,
    topicsById,
    placeName: placeName ?? null,
    compassRanked,
    destination,
    isAuthenticated,
    isViewOnly,
    noWriteReason,
    /**
     * 🔴 Derived from the SAME value `isViewOnly` is, one line above, so the two
     * cannot drift. `'sibling-shard'` is own-place-but-not-writable, which is why
     * this is not `!isViewOnly` — see ExploreCtx.isOwnPlace for the whole rule.
     */
    isOwnPlace: noWriteReason === null || noWriteReason === 'sibling-shard',
    loginUrl,
    viewingSliceIndex,
    ownSliceIndex,
    onReturnToOwnSlice,
    featuredPhoto: featuredPhoto ?? null,
    meetings,
    elections,
    races,
    raceMedia,
    agenda,
    ui,
    setUi,
    draftFor,
    saveDraft,
    discardDraft,
    openTopic,
    startConversation,
    onGoToView,
    whatsNewInSidebar: whatsNewInSidebar ?? false,
  }

  /**
   * The topic page replaces the whole view — but only for THIS composition's topics.
   * Two guards, failing the same way: the key check catches a tab change, and the
   * lookup catches a topic that has since left (a Compass re-rank, an agenda item that
   * rolled off). Either way we fall through to the list silently. The member pressed
   * nothing; there is nothing to apologise for.
   */
  const open = ui.openTopic
  if (open && open.key === composition.key) {
    const topic = topicsById.get(open.topicId)
    if (topic) {
      const detail = <TopicDetail topic={topic} ctx={ctx} />
      // 🔴 The topic page gets the notice too. It is the page the draft form lived
      // on, so it is the one a member is most likely to be looking at when they
      // wonder why there is nothing to write in — and the Switch-back control has
      // to be reachable from here, not only from the list.
      //
      // The wrapper exists only while view-only: without it the topic page is the
      // whole view, exactly as it was.
      return ctx.isViewOnly ? (
        <div className="flex flex-col gap-4">
          <ReadOnlyNotice
            reason={ctx.noWriteReason}
            surface="explore"
            viewingSliceIndex={viewingSliceIndex}
            ownSliceIndex={ownSliceIndex}
            onReturnToOwnSlice={onReturnToOwnSlice}
            loginUrl={ctx.loginUrl}
          />
          {detail}
        </div>
      ) : (
        detail
      )
    }
  }

  // Every reserved room this composition names, in its order, and the id the one
  // grouped card is drawn at. Cheap — a walk of a dozen string ids — and outside
  // the map so the list is built once rather than per module.
  // (Indexed rather than `.at(-1)` — tsconfig's lib target predates it.)
  const reservedRooms = reservedRoomsIn(composition.modules)
  const lastReservedId = reservedRooms.length ? reservedRooms[reservedRooms.length - 1]?.id ?? null : null

  return (
    <div className="@container flex flex-col gap-6 @lg:gap-8 pb-2">
      {/* Above the module list AND above TopicDetail (below): the flag can be true
          while the member is deep in a topic page, and that page is where the draft
          form used to be. Rendering it in only one of the two is how half a gate
          ships — see the feed-but-not-the-thread note in CLAUDE.md. */}
      {ctx.isViewOnly && (
        <ReadOnlyNotice
          reason={ctx.noWriteReason}
          surface="explore"
          viewingSliceIndex={viewingSliceIndex}
          ownSliceIndex={ownSliceIndex}
          onReturnToOwnSlice={onReturnToOwnSlice}
          loginUrl={ctx.loginUrl}
        />
      )}
      {composition.modules.map((id) => {
        const mod = MODULE_REGISTRY[id]
        if (mod.available(ctx)) {
          // `contents` so the wrapper is a hook for 16-10's harness and NOT a box:
          // it adds no flex item of its own, so a module that renders null or hides
          // itself at a breakpoint cannot leave a gap behind.
          return (
            <div key={id} data-explore-module={id} className="contents">
              <mod.Component ctx={ctx} />
            </div>
          )
        }
        if (mod.emptyState === 'hide') return null
        // 🔴 A reserved room renders inside ONE grouped card, drawn where the LAST
        // of them sits — which in every composition is immediately before 'whats-new'.
        //
        // That keeps a real module as the page's final word ON MOBILE only.
        // WhatsNewModule is `md:hidden` whenever the sidebar already carries the
        // card (see WhatsNewModule.tsx), so from md up this grouped card IS the
        // last block in the Explore column. Verified in the browser, both widths.
        //
        // Not where the FIRST sits: Federal lists 'federal-votes' third, and a
        // nine-line "what this becomes" card above the races and the questions is
        // the wall moved rather than removed.
        //
        // See ReservedRoomGroup for the measurement that put it here. Every room
        // still renders and still carries data-explore-room; only the card count
        // changes, and that is a rendering decision — DEFAULT_MODULES is untouched.
        if (mod.reserved) {
          return id === lastReservedId ? <ReservedRoomGroup key={id} rooms={reservedRooms} /> : null
        }
        return <ReservedRoom key={id} id={id} {...mod.emptyState} />
      })}
    </div>
  )
}

/**
 * The composition is resolved through React Query, so there is a first frame with
 * nothing to render. Same library and the same two theme colours as FeedSkeleton —
 * the column must not acquire a second loading style.
 */
function ExploreSkeleton() {
  const isDark = useIsDarkMode()
  return (
    <SkeletonTheme
      baseColor={isDark ? '#374151' : '#f3f4f6'}
      highlightColor={isDark ? '#4b5563' : '#e5e7eb'}
    >
      <div className="flex flex-col gap-6 pb-2">
        <div className="px-1 pt-2">
          <Skeleton width="35%" height={12} />
          <Skeleton width="80%" height={32} className="mt-2" />
          <Skeleton width="55%" height={16} className="mt-2" />
        </div>
        <div className={`${CARD} overflow-hidden p-5`}>
          <Skeleton height={160} />
          <Skeleton width="30%" height={12} className="mt-4" />
          <Skeleton width="70%" height={24} className="mt-2" />
          <Skeleton height={14} className="mt-2" />
        </div>
        <div className={`${CARD} p-5`}>
          <Skeleton width="45%" height={20} />
          <Skeleton height={14} className="mt-3" />
          <Skeleton width="85%" height={14} className="mt-1" />
        </div>
      </div>
    </SkeletonTheme>
  )
}

// ── Topic detail ──────────────────────────────────────────────────────────────────────

/**
 * One topic, as a page. It takes the RESOLVED topic rather than an id: the caller has
 * already proven it exists in this composition, which is what removes the last
 * `TOPICS[...]` dereference from the codebase.
 */
function TopicDetail({ topic, ctx }: { topic: ExploreTopic; ctx: ExploreCtx }) {
  const id = useId()
  const { destination, isAuthenticated, meetings } = ctx
  const draft = ctx.draftFor(topic.id)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const questions = useMemo(() => questionsFor(topic), [topic])
  // The question being answered: shown as the box's label and placeholder, never written
  // into the draft. Cleared when another topic opens.
  const [question, setQuestion] = useState<string | null>(null)
  useEffect(() => setQuestion(null), [topic.id])
  // Move focus to the new view's heading, as opening a thread changes the whole column.
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [topic.id])

  // There is no moved-from banner any more, and nothing to rescue. A draft whose key
  // names a place the member has left is never surfaced: draftFor() only ever builds a
  // key from the composition being rendered, so it resolves to an empty draft and the
  // stored one sits where it is. Nothing to explain, because nothing is offered.
  // 🔴 isHttpUrl: these agenda links are first-party but SCRAPED, and React renders a
  // `javascript:` href without complaint. A meeting whose URL fails is not a source.
  const sources = topic.usesMeetingSources ? (meetings ?? []).filter((m) => isHttpUrl(m.url)).slice(0, 3) : []
  const hasDraft = draft.updatedAt > 0

  return (
    <article aria-labelledby={`${id}-title`} className={`${CARD} @container`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200/60 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={() => ctx.openTopic(null)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${FOCUS}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Explore
        </button>
        <span className="ml-auto"><ProvenanceTag topic={topic} /></span>
      </div>

      <div className="p-4 @lg:p-5 flex flex-col gap-5">
        {/* 1. The topic: what it is, in two lines. Everything else is one tap away. */}
        <div className="flex flex-col gap-1.5">
          <CategoryLabel>{topic.category}</CategoryLabel>
          <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="text-xl font-extrabold leading-snug tracking-tight text-gray-900 dark:text-gray-100 focus:outline-none">
            {topic.title}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{topic.summary}</p>

          {/* Background, folded away so the page leads with the question. Nothing is
              removed — why it matters, the sources and the conversations note are all
              here — they just stop competing with the one thing to do. */}
          <details className="group mt-1">
            <summary className={`inline-flex cursor-pointer list-none items-center gap-1 rounded text-sm font-semibold text-brand dark:text-brand-light hover:underline [&::-webkit-details-marker]:hidden ${FOCUS}`}>
              About this topic
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 motion-safe:transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="mt-2 flex flex-col gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-sm">
              {/* whyItMatters is optional since 16-01: an agenda item does not carry a
                  reason it matters, and writing one for it would be inventing civic record. */}
              {topic.whyItMatters && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Why it matters</h3>
                  <p className="mt-0.5 text-gray-700 dark:text-gray-300">{topic.whyItMatters}</p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Sources</h3>
                <SourceNote topic={topic} />
                {topic.usesMeetingSources && (
                  sources.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1">
                      {sources.map((m) => (
                        <li key={m.id}>
                          <a href={m.url!} target="_blank" rel="noopener noreferrer" className={`rounded font-medium text-brand dark:text-brand-light hover:underline ${FOCUS}`}>
                            {m.title} — agenda<span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      {/* 🔴 "here", not "for your area" — D-10. The reader may be looking
                          at a place that is not theirs, and the sentence is just as true. */}
                      No published meeting agendas were found here right now.
                    </p>
                  )
                )}
              </div>
              {/* 🔴 Related conversations: an honest empty state, not a search. A post has
                  no topic — civic_spaces.posts is (slice_id, title, body) — so nothing ties
                  a conversation to this topic, and matching on words would be a guess
                  presented as a link. Data this needs from the API: a topic reference on
                  each post. */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Conversations</h3>
                <p className="mt-0.5 text-gray-700 dark:text-gray-300">
                  Conversations aren’t linked to topics yet, so sharing your thoughts starts a new one.
                </p>
                {ctx.onGoToView && (
                  <button
                    type="button"
                    onClick={() => ctx.onGoToView?.('conversations')}
                    className={`mt-1 inline-flex items-center gap-1.5 rounded font-semibold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
                  >
                    Browse conversations{ctx.placeName ? ` in ${ctx.placeName}` : ''} <ArrowIcon />
                  </button>
                )}
              </div>
            </div>
          </details>
        </div>

        {/*
          🔴 While view-only there is NO form here. Not a disabled one: no <form>, no
          <input>, no <textarea>, no submit, no Discard — affordances #1, #4, #5 and #7
          of research Finding 5. Hidden rather than disabled, matching the feed and the
          thread, because a disabled control still advertises something the database
          will refuse. What replaces it is a signpost to where this topic's conversation
          CAN be started — and ReadOnlyNotice's own control is directly above.
        */}
        {ctx.isViewOnly ? (
          <div className="rounded-xl border-l-4 border-brand-coral bg-brand-muted dark:bg-brand/10 px-3 py-2.5">
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{topic.question}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {/* 🔴 "Switch back above" only when there IS something to switch back
                  from. A signed-out visitor and a member with no slice at this level
                  have no own shard and no control above. */}
              {ctx.noWriteReason === 'sibling-shard' ? (
                destination ? (
                  <>
                    Conversations about this topic start in{' '}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{destination.name}</span>, your own
                    community. Switch back above to begin one.
                  </>
                ) : (
                  'Conversations about this topic start in your own community. Switch back above to begin one.'
                )
              ) : (
                'Conversations about this topic start in the civic spaces of the people who live there — see the note at the top of this page.'
              )}
            </p>
          </div>
        ) : (
        /* 2. The one thing to do: pick a question (optional), write, share. The draft is
           saved on every keystroke, on this device; its title (topic.suggestedTitle)
           travels to the composer, where it can be edited before posting. */
        <form
          className="flex flex-col gap-4 border-t border-gray-200/70 dark:border-white/[0.08] pt-5"
          onSubmit={(e) => {
            e.preventDefault()
            ctx.startConversation(topic.id)
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-body`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {question ?? 'Your thoughts'}
            </label>
            <textarea
              id={`${id}-body`}
              ref={bodyRef}
              rows={5}
              value={draft.body}
              maxLength={10000}
              onChange={(e) => ctx.saveDraft(topic.id, { body: e.target.value })}
              placeholder={question ? 'Write your answer…' : 'Write your thoughts, or pick a question below…'}
              className={`${TEXT_FIELD} resize-y`}
            />
          </div>

          <QuestionPicker
            questions={questions}
            selected={question}
            onSelect={(q) => {
              setQuestion(q)
              focusAtEnd(bodyRef.current)
            }}
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
            <PrimaryButton type="submit" size="card" disabled={isAuthenticated && !destination}>
              {isAuthenticated ? 'Share your thoughts' : 'Sign in to share your thoughts'}
            </PrimaryButton>
            {hasDraft && (
              <button
                type="button"
                onClick={() => ctx.discardDraft(topic.id)}
                className={`rounded text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:underline ${FOCUS}`}
              >
                Discard draft
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isAuthenticated && destination
              ? <>Saved as you type. You’ll check it before it’s posted to <span className="font-semibold text-gray-700 dark:text-gray-300">{destination.name}</span>.</>
              : isAuthenticated
                ? 'Saved as you type. To post, set your address in your Empowered account.'
                : 'Saved as you type, and kept through sign-in.'}
          </p>
        </form>
        )}
      </div>
    </article>
  )
}
