import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  readDrafts,
  readResume,
  useExploreDrafts,
  useExploreUiState,
  writeDraft,
  writeResume,
  type ExploreDraft,
} from './exploreStorage'
import { CARD, CategoryLabel, FOCUS, PrimaryButton, SecondaryButton } from './exploreUi'
import { ProvenanceTag, SourceNote } from './provenance'
import { MODULE_REGISTRY, ReservedRoom } from './registry'
import type { ExploreCtx } from './ExploreContext'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'
import type { UpcomingElection } from '../../hooks/useNextElection'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useExploreComposition } from '../../lib/exploreData'
import { isHttpUrl } from '../../lib/exploreComposition'
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
  /** Real scheduled meetings for the destination city; undefined when there is no source. */
  meetings?: UpcomingMeeting[]
  /** Real upcoming elections for the member's area, soonest first. */
  elections?: UpcomingElection[]
  /** Open the composer for this topic's draft (AppShell signs a visitor in first). */
  onStartConversation: (topicId: TopicId, draft: ExploreDraft) => void
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

  const draftFor = useCallback(
    (topicId: TopicId): ExploreDraft =>
      drafts[topicId] ?? {
        title: topicsById.get(topicId)?.suggestedTitle ?? '',
        body: '',
        sliceId: null,
        tab: null,
        communityName: null,
        updatedAt: 0,
      },
    [drafts, topicsById],
  )

  /** Saves a draft, binding it to the destination the first time it is saved signed in. */
  /** Returns what it wrote, so a caller never has to read storage back to find out. */
  const saveDraft = useCallback(
    (topicId: TopicId, patch: Partial<Pick<ExploreDraft, 'title' | 'body'>>): ExploreDraft => {
      const current = draftFor(topicId)
      const bind = !current.sliceId && destination
      const next: ExploreDraft = {
        ...current,
        ...patch,
        ...(bind ? { sliceId: destination.sliceId, tab: destination.tab, communityName: destination.name } : {}),
        updatedAt: Date.now(),
      }
      writeDraft(topicId, next)
      return next
    },
    [draftFor, destination],
  )

  const discardDraft = useCallback((topicId: TopicId) => writeDraft(topicId, null), [])

  /** Moves a draft started for a community the member has left onto their current one. */
  const rebindDraft = useCallback(
    (topicId: TopicId) => {
      if (!destination) return
      writeDraft(topicId, {
        ...draftFor(topicId),
        sliceId: destination.sliceId,
        tab: destination.tab,
        communityName: destination.name,
        updatedAt: Date.now(),
      })
    },
    [draftFor, destination],
  )

  const startConversation = useCallback(
    (topicId: TopicId) => {
      // Persist first: the draft is what survives sign-in. Hand the same object over
      // rather than making AppShell read it back — storage may have refused the write.
      onStartConversation(topicId, saveDraft(topicId, {}))
    },
    [saveDraft, onStartConversation],
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
   * The other half of a signed-out "Join": the visitor went to sign in, came back to a
   * fresh page, and the resume marker says which draft they meant to post. Bind it to
   * this member's community (the composer names it before anything posts), then hand it
   * to AppShell exactly as if they had pressed the button now.
   */
  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current || !isAuthenticated) return
    const topicId = readResume()
    if (!topicId || !topicsById.has(topicId)) return
    // Age it out. Signing in takes a minute; a marker older than that was left behind by
    // someone who signed in without an address, so ExploreView never mounted to consume
    // it. Without this the composer opens unprompted weeks later with a stale draft.
    const draft = readDrafts()[topicId]
    if (!draft || Date.now() - draft.updatedAt > RESUME_MAX_AGE_MS) {
      resumedRef.current = true
      writeResume(null)
      return
    }
    // Clearing a stale marker does not need a destination; resuming does.
    if (!destination) return
    resumedRef.current = true
    writeResume(null)
    startConversation(topicId)
  }, [isAuthenticated, destination, startConversation, topicsById])

  if (isLoading) return <ExploreSkeleton />
  // Volunteer has no Explore and never has — levelFor() returns null and so does this.
  if (!composition) return null

  const ctx: ExploreCtx = {
    composition,
    topicsById,
    destination,
    isAuthenticated,
    // Always false until 16-05 computes it; threaded now so the gate lands in one place.
    isViewOnly: false,
    featuredPhoto: featuredPhoto ?? null,
    meetings,
    elections,
    ui,
    setUi,
    draftFor,
    saveDraft,
    discardDraft,
    rebindDraft,
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
    if (topic) return <TopicDetail topic={topic} ctx={ctx} />
  }

  return (
    <div className="@container flex flex-col gap-6 @lg:gap-8 pb-2">
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

  // A draft bound to a community the member is no longer in must not post to the new one silently.
  const movedFrom =
    isAuthenticated && destination && draft.sliceId && draft.sliceId !== destination.sliceId ? draft.communityName : null
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

          {movedFrom ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200" role="status">
              This draft was started for {movedFrom}, which isn't one of your communities now. It won't be posted anywhere until you move it.{' '}
              {destination && (
                <button type="button" onClick={() => ctx.rebindDraft(topic.id)} className={`rounded font-semibold underline hover:no-underline ${FOCUS}`}>
                  Post it in {destination.name} instead
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isAuthenticated && destination
                ? <>Saved on this device. Joining opens a new post in <span className="font-semibold text-gray-700 dark:text-gray-300">{draft.communityName ?? destination.name}</span> — nothing is published until you press Post.</>
                : isAuthenticated
                  ? 'Saved on this device. You need a local community to post — set your address in your Empowered account.'
                  : 'Saved on this device and kept through sign-in. Nothing is published until you press Post.'}
            </p>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            No conversation is linked to this topic yet, so joining starts one with your draft.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton type="submit" disabled={!!movedFrom || (isAuthenticated && !destination)}>
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
