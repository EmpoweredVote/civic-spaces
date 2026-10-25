import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
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
import { CARD, CategoryLabel, FOCUS, PrimaryButton, SecondaryButton } from './exploreUi'
import { ProvenanceTag, SourceNote } from './provenance'
import { MODULE_REGISTRY, ReservedRoom } from './registry'
import { ViewOnlyNotice } from './ViewOnlyNotice'
import type { ExploreCtx } from './ExploreContext'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'
import type { UpcomingElection } from '../../hooks/useNextElection'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useExploreComposition } from '../../lib/exploreData'
import {
  canPostDraft,
  draftKey,
  isHttpUrl,
  migrateSignedOutDrafts,
  type DraftTargetSlice,
} from '../../lib/exploreComposition'
import type { ExploreTopic, TopicId } from '../../types/explore'
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
  /** null when signed out, or when the member has no local community. */
  destination: ExploreDestination | null
  isAuthenticated: boolean
  /**
   * True when the tab is pointed at a SIBLING shard of the member's own
   * jurisdiction: readable by RLS, and every write path closed by it.
   *
   * 🔴 Required, not optional. An optional boolean defaulting to "not gated" is
   * the wrong default for this field — a new call site that forgets it would
   * silently offer writes RLS can only reject. The two call sites that are never
   * on anyone's sibling shard (signed out, no slice for this tab) pass `false`
   * explicitly.
   */
  isViewOnly: boolean
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
   * Open the composer for this draft (AppShell signs a visitor in first).
   *
   * The first argument is the DRAFT KEY, not a topic id: where a draft posts is
   * decided by `(sliceType, geoid, topicId)`, and AppShell re-checks it against
   * the member's slices before anything reaches the composer. `destinationName`
   * is the resolved place name for that key's slice — ExploreView only ever
   * builds a key from the composition it is rendering, so the two always agree.
   */
  onStartConversation: (key: string, draft: ExploreDraft, destinationName: string | null) => void
  /** Brings the column back to its top when the view inside it changes. */
  onScrollTop?: () => void
  /** True when the right sidebar shows What's new (md+), so the column keeps it only below md. */
  whatsNewInSidebar?: boolean
  /** The member's own place photo; null/undefined falls back to the drawn street. */
  featuredPhoto?: FeaturedPhoto | null
  /** Lets an update's button switch the forum view; absent when signed out. */
  onGoToView?: (view: 'explore' | 'conversations') => void
}

const TEXT_FIELD = `w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-brand dark:focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand/30`

/**
 * Explore is now a RENDERER: it resolves the composition for this slice, builds the
 * context every module reads, and walks `composition.modules`. It owns no section
 * markup — the modules in ./modules do, and the registry says which of them this
 * slice has, in what order, and what the page says where one cannot render.
 */
export function ExploreView({
  sliceType,
  geoid,
  destination,
  isAuthenticated,
  isViewOnly,
  viewingSliceIndex,
  ownSliceIndex,
  onReturnToOwnSlice,
  slices,
  meetings,
  elections,
  onStartConversation,
  onScrollTop,
  whatsNewInSidebar,
  featuredPhoto,
  onGoToView,
}: ExploreViewProps) {
  const drafts = useExploreDrafts()
  const [ui, setUi] = useExploreUiState()
  const { composition, isLoading } = useExploreComposition({ sliceType, geoid })

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
      // Persist first: the draft is what survives sign-in. Hand the same object over
      // rather than making AppShell read it back — storage may have refused the write.
      onStartConversation(keyFor(topicId), saveDraft(topicId, {}), destination?.name ?? null)
    },
    [saveDraft, keyFor, destination, onStartConversation],
  )

  // An open topic is stored with the composition it was opened in, so switching tab
  // cannot carry it onto a slice whose Join button points somewhere else.
  const compositionKey = composition?.key ?? null
  const openTopic = useCallback(
    (topicId: TopicId | null) => {
      setUi({ openTopic: topicId && compositionKey ? { key: compositionKey, topicId } : null })
      onScrollTop?.()
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
   * 🔴 This reaches the composer with NO button press, and it fires once per mount
   * (resumedRef). Both facts matter to 16-05's gate; neither is acted on here.
   */
  const resumedRef = useRef(false)
  useEffect(() => {
    // Wait for the slices to arrive. An empty map would read as "you hold nothing",
    // and the marker would be dropped for a member who holds the slice perfectly well.
    if (resumedRef.current || !isAuthenticated || !slices || Object.keys(slices).length === 0) return
    const marker = readResume()
    if (!marker) return
    const drop = () => {
      resumedRef.current = true
      writeResume(null)
    }
    // Age it out. Signing in takes a minute; a marker older than that was left behind by
    // someone who signed in without an address, so ExploreView never mounted to consume
    // it. Without this the composer opens unprompted weeks later with a stale draft.
    if (Date.now() - marker.at > RESUME_MAX_AGE_MS) return drop()
    // A marker written signed out carries no geoid; the member now has one. Resolve it
    // against the slice they hold for that type, which is where the draft now lives.
    const boundGeoid = marker.geoid ?? slices[marker.sliceType]?.geoid ?? null
    const key = draftKey(marker.sliceType, boundGeoid, marker.topicId)
    // They may have moved, or lost that slice, while they were away. Losing a draft
    // written for a place they have left is better than posting it somewhere they did
    // not mean — and it happens silently, because they pressed nothing.
    if (!canPostDraft(key, slices).ok) return drop()
    const draft = readDrafts()[key]
    if (!draft) return drop()
    drop()
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
    onStartConversation(key, draft, key === keyFor(marker.topicId) ? destination?.name ?? null : null)
  }, [isAuthenticated, destination, slices, keyFor, onStartConversation])

  if (isLoading) return <ExploreSkeleton />
  // Volunteer has no Explore and never has — levelFor() returns null and so does this.
  if (!composition) return null

  const ctx: ExploreCtx = {
    composition,
    topicsById,
    destination,
    isAuthenticated,
    isViewOnly,
    viewingSliceIndex,
    ownSliceIndex,
    onReturnToOwnSlice,
    featuredPhoto: featuredPhoto ?? null,
    meetings,
    elections,
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
          <ViewOnlyNotice
            viewingSliceIndex={viewingSliceIndex}
            ownSliceIndex={ownSliceIndex}
            onReturnToOwnSlice={onReturnToOwnSlice}
          />
          {detail}
        </div>
      ) : (
        detail
      )
    }
  }

  return (
    <div className="@container flex flex-col gap-6 @lg:gap-8 pb-2">
      {/* Above the module list AND above TopicDetail (below): the flag can be true
          while the member is deep in a topic page, and that page is where the draft
          form used to be. Rendering it in only one of the two is how half a gate
          ships — see the feed-but-not-the-thread note in CLAUDE.md. */}
      {ctx.isViewOnly && (
        <ViewOnlyNotice
          viewingSliceIndex={viewingSliceIndex}
          ownSliceIndex={ownSliceIndex}
          onReturnToOwnSlice={onReturnToOwnSlice}
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

      <div className="p-4 @lg:p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <CategoryLabel>{topic.category}</CategoryLabel>
          <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="text-xl font-extrabold leading-snug tracking-tight text-gray-900 dark:text-gray-100 focus:outline-none">
            {topic.title}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{topic.summary}</p>
        </div>

        {/* whyItMatters is optional since 16-01: an agenda item does not carry a reason
            it matters, and writing one for it would be inventing civic record. With no
            reason to show, Sources takes the full width instead of half an empty grid. */}
        <div className={`grid gap-3 ${topic.whyItMatters ? '@lg:grid-cols-2' : ''}`}>
          {topic.whyItMatters && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1">Why it matters</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{topic.whyItMatters}</p>
            </div>
          )}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1">Sources</h3>
            <SourceNote topic={topic} />
            {topic.usesMeetingSources && (
              sources.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {sources.map((m) => (
                    <li key={m.id}>
                      <a href={m.url!} target="_blank" rel="noopener noreferrer" className={`rounded text-sm font-medium text-brand dark:text-brand-light hover:underline ${FOCUS}`}>
                        {m.title} — agenda<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                  No published meeting agendas were found for your area right now.
                </p>
              )
            )}
          </div>
        </div>

        <div className="rounded-xl border-l-4 border-brand-coral bg-brand-muted dark:bg-brand/10 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand dark:text-brand-light">Start with this question</p>
          <p className="mt-0.5 text-base font-bold text-gray-900 dark:text-gray-100">{topic.question}</p>
        </div>

        {/* The draft — saved on every keystroke, on this device, and bound to one community. */}
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            ctx.startConversation(topic.id)
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Suggested title</span>
            <input
              type="text"
              value={draft.title}
              maxLength={200}
              onChange={(e) => ctx.saveDraft(topic.id, { title: e.target.value })}
              className={TEXT_FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your thoughts</span>
            <textarea
              rows={3}
              value={draft.body}
              maxLength={10000}
              onChange={(e) => ctx.saveDraft(topic.id, { body: e.target.value })}
              placeholder={topic.question}
              className={`${TEXT_FIELD} resize-y`}
            />
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isAuthenticated && destination
              ? <>Saved on this device. Joining opens a new post in <span className="font-semibold text-gray-700 dark:text-gray-300">{destination.name}</span> — nothing is published until you press Post.</>
              : isAuthenticated
                ? 'Saved on this device. You need a local community to post — set your address in your Empowered account.'
                : 'Saved on this device and kept through sign-in. Nothing is published until you press Post.'}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            No conversation is linked to this topic yet, so joining starts one with your draft.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton type="submit" disabled={isAuthenticated && !destination}>
              {isAuthenticated ? 'Join the conversation' : 'Sign in to join the conversation'}
            </PrimaryButton>
            {hasDraft && (
              <SecondaryButton onClick={() => ctx.discardDraft(topic.id)}>Discard draft</SecondaryButton>
            )}
          </div>
        </form>
      </div>
    </article>
  )
}
