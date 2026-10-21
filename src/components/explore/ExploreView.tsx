import { useCallback, useEffect, useId, useRef } from 'react'
import { Emoji } from '../Emoji'
import { WalkingScene } from './NeighborhoodScene'
import { WhatsNewCard } from './WhatsNewCard'
import { AdventureActivity, ImagineActivity, PostcardActivity } from './ExploreActivities'
import {
  FEATURED_TOPIC,
  IMAGINE_OPTIONS,
  QUESTION_TOPICS,
  TOPICS,
  type TopicId,
} from './exploreContent'
import {
  readResume,
  useExploreDrafts,
  useExploreUiState,
  writeDraft,
  writeResume,
  type ExploreDraft,
} from './exploreStorage'
import { ArrowIcon, CARD, CategoryLabel, FOCUS, PrimaryButton, SecondaryButton, SectionHeading, StarterTag } from './exploreUi'
import type { UpcomingMeeting } from '../../hooks/useUpcomingMeetings'
import type { TabKey } from '../../types/database'
import { creditParts } from '../../lib/banners'

/** A licensed place photo for the featured card. The credit is a licence condition — always shown. */
export interface FeaturedPhoto {
  url: string
  alt: string
  credit: string
}

function PhotoCredit({ credit }: { credit: string }) {
  const parts = creditParts(credit)
  return (
    <p className="absolute bottom-0 inset-x-0 px-3 py-1.5 text-[10px] text-white/90 bg-gradient-to-t from-black/60 to-transparent truncate">
      {parts ? (
        <>
          Photo: {parts.author} ·{' '}
          {parts.licenseUrl ? (
            <a href={parts.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{parts.license}</a>
          ) : parts.license}
        </>
      ) : credit}
    </p>
  )
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
  /** null when signed out, or when the member has no local community. */
  destination: ExploreDestination | null
  isAuthenticated: boolean
  /** Real scheduled meetings for the destination city; undefined when there is no source. */
  meetings?: UpcomingMeeting[]
  /** Open the composer for this topic's draft (AppShell signs a visitor in first). */
  onStartConversation: (topicId: TopicId) => void
  /** Brings the column back to its top when the view inside it changes. */
  onScrollTop?: () => void
  /** True when the right sidebar shows What's new (md+), so the column keeps it only below md. */
  whatsNewInSidebar?: boolean
  /** The member's own place photo; null/undefined falls back to the drawn street. */
  featuredPhoto?: FeaturedPhoto | null
}

const TEXT_FIELD = `w-full rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-brand dark:focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand/30`

export function ExploreView({ destination, isAuthenticated, meetings, onStartConversation, onScrollTop, whatsNewInSidebar, featuredPhoto }: ExploreViewProps) {
  const drafts = useExploreDrafts()
  const [ui, setUi] = useExploreUiState()

  const draftFor = useCallback(
    (topicId: TopicId): ExploreDraft =>
      drafts[topicId] ?? {
        title: TOPICS[topicId].suggestedTitle,
        body: '',
        sliceId: null,
        tab: null,
        communityName: null,
        updatedAt: 0,
      },
    [drafts],
  )

  /** Saves a draft, binding it to the destination the first time it is saved signed in. */
  const saveDraft = useCallback(
    (topicId: TopicId, patch: Partial<Pick<ExploreDraft, 'title' | 'body'>>) => {
      const current = draftFor(topicId)
      const bind = !current.sliceId && destination
      writeDraft(topicId, {
        ...current,
        ...patch,
        ...(bind ? { sliceId: destination.sliceId, tab: destination.tab, communityName: destination.name } : {}),
        updatedAt: Date.now(),
      })
    },
    [draftFor, destination],
  )

  const startConversation = useCallback(
    (topicId: TopicId) => {
      // Persist first: the draft is what the composer opens with, and what survives sign-in.
      saveDraft(topicId, {})
      onStartConversation(topicId)
    },
    [saveDraft, onStartConversation],
  )

  const openTopic = useCallback(
    (topicId: TopicId | null) => {
      setUi({ openTopic: topicId })
      onScrollTop?.()
    },
    [setUi, onScrollTop],
  )

  /**
   * The other half of a signed-out "Join": the visitor went to sign in, came back to a
   * fresh page, and the resume marker says which draft they meant to post. Bind it to
   * this member's community (the composer names it before anything posts), then hand it
   * to AppShell exactly as if they had pressed the button now.
   */
  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current || !isAuthenticated || !destination) return
    const topicId = readResume()
    if (!topicId || !TOPICS[topicId]) return
    resumedRef.current = true
    writeResume(null)
    startConversation(topicId)
  }, [isAuthenticated, destination, startConversation])

  if (ui.openTopic && TOPICS[ui.openTopic]) {
    return (
      <TopicDetail
        topicId={ui.openTopic}
        draft={draftFor(ui.openTopic)}
        destination={destination}
        isAuthenticated={isAuthenticated}
        meetings={meetings}
        onBack={() => openTopic(null)}
        onChange={(patch) => saveDraft(ui.openTopic!, patch)}
        onRebind={() =>
          destination &&
          writeDraft(ui.openTopic!, {
            ...draftFor(ui.openTopic!),
            sliceId: destination.sliceId,
            tab: destination.tab,
            communityName: destination.name,
            updatedAt: Date.now(),
          })
        }
        onDiscard={() => writeDraft(ui.openTopic!, null)}
        onJoin={() => startConversation(ui.openTopic!)}
      />
    )
  }

  const imagineTopic = IMAGINE_OPTIONS.find((o) => o.key === ui.imagine)?.topic ?? null
  const featured = TOPICS[FEATURED_TOPIC]
  const nextMeeting = meetings?.[0] ?? null

  return (
    <div className="@container flex flex-col gap-4">
      {/* A. Introduction */}
      <div className="px-1 pt-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">
          Welcome to your Civic Space
        </p>
        <h2 className="mt-1.5 text-[1.75rem] @lg:text-[2.5rem] font-medium leading-[1.1] tracking-tight text-gray-900 dark:text-gray-100">
          Discover what's happening in your community.
        </h2>
        <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
          Explore local topics, find something to do, and share your perspective.
        </p>
      </div>

      {/* B. Featured topic — the member's own place photo (credited), else the drawn street. */}
      <article
        aria-labelledby="explore-featured-title"
        className={`${CARD} overflow-hidden grid @lg:grid-cols-2`}
      >
        <div className="relative aspect-[16/10] @lg:aspect-auto @lg:min-h-[19rem] bg-brand-muted dark:bg-gray-800">
          {featuredPhoto ? (
            <img
              src={featuredPhoto.url}
              alt={featuredPhoto.alt}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0"><WalkingScene /></div>
          )}
          <span className="absolute top-3 left-3 rounded-md border border-yellow-300 bg-yellow-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-800 shadow-sm">
            Sample topic
          </span>
          {featuredPhoto && <PhotoCredit credit={featuredPhoto.credit} />}
        </div>
        <div className="p-5 @lg:p-8 flex flex-col justify-center gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand dark:text-brand-light">{featured.category}</p>
          <h3 id="explore-featured-title" className="text-2xl @2xl:text-[2rem] font-medium leading-[1.15] tracking-tight text-gray-900 dark:text-gray-100">
            {featured.title}
          </h3>
          <p className="text-base leading-relaxed text-gray-600 dark:text-gray-400">{featured.summary}</p>
          <div className="mt-2">
            <PrimaryButton size="lg" onClick={() => openTopic(featured.id)}>
              Explore this topic <ArrowIcon />
            </PrimaryButton>
          </div>
        </div>
      </article>

      {/* C. Questions for your community */}
      <section aria-label="Questions for your community" className="flex flex-col gap-2">
        <SectionHeading>Questions for your community</SectionHeading>
        <div className="grid gap-3 @lg:grid-cols-2">
          {QUESTION_TOPICS.map((topicId, i) => {
            const topic = TOPICS[topicId]
            return (
              <button
                key={topicId}
                type="button"
                onClick={() => openTopic(topicId)}
                className={`${CARD} group text-left p-4 flex gap-3 items-start hover:border-brand/40 dark:hover:border-brand-light/30 motion-safe:transition-colors ${FOCUS}`}
              >
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-muted dark:bg-brand/15 flex items-center justify-center">
                  <Emoji symbol={i === 0 ? '🌳' : '📄'} className="text-lg" />
                </span>
                <span className="min-w-0 flex flex-col gap-1">
                  <CategoryLabel>{topic.category}</CategoryLabel>
                  <span className="text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">{topic.title}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand dark:text-brand-light group-hover:underline">
                    See the topic <ArrowIcon />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Activities */}
      <section aria-label="Activities" className="flex flex-col gap-2">
        <SectionHeading hint="Imaginative conversation starters — not official proposals or votes.">
          Try a quick activity
        </SectionHeading>
        <ImagineActivity
          choice={ui.imagine}
          onChoose={(imagine) => setUi({ imagine })}
          ideaText={imagineTopic ? draftFor(imagineTopic).body : ''}
          onIdeaChange={(body) => imagineTopic && saveDraft(imagineTopic, { body })}
          onExploreTopic={openTopic}
          onShareIdea={startConversation}
          isAuthenticated={isAuthenticated}
        />
        <div className="grid gap-3 @2xl:grid-cols-2 items-start">
          <AdventureActivity
            choice={ui.adventure}
            onChoose={(adventure) => setUi({ adventure })}
            meeting={nextMeeting}
            onExploreTopic={openTopic}
          />
          <PostcardActivity placeName={destination?.name ?? null} onExploreTopic={openTopic} />
        </div>
      </section>

      <WhatsNewCard className={whatsNewInSidebar ? 'md:hidden' : ''} />
    </div>
  )
}

// ── Topic detail ──────────────────────────────────────────────────────────────────────

function TopicDetail({
  topicId,
  draft,
  destination,
  isAuthenticated,
  meetings,
  onBack,
  onChange,
  onRebind,
  onDiscard,
  onJoin,
}: {
  topicId: TopicId
  draft: ExploreDraft
  destination: ExploreDestination | null
  isAuthenticated: boolean
  meetings?: UpcomingMeeting[]
  onBack: () => void
  onChange: (patch: Partial<Pick<ExploreDraft, 'title' | 'body'>>) => void
  onRebind: () => void
  onDiscard: () => void
  onJoin: () => void
}) {
  const id = useId()
  const topic = TOPICS[topicId]
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Move focus to the new view's heading, as opening a thread changes the whole column.
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), [topicId])

  // A draft bound to a community the member is no longer in must not post to the new one silently.
  const movedFrom =
    isAuthenticated && destination && draft.sliceId && draft.sliceId !== destination.sliceId ? draft.communityName : null
  const sources = topic.usesMeetingSources ? (meetings ?? []).filter((m) => m.url).slice(0, 3) : []
  const hasDraft = draft.updatedAt > 0

  return (
    <article aria-labelledby={`${id}-title`} className={`${CARD} @container`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200/60 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${FOCUS}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Explore
        </button>
        <span className="ml-auto"><StarterTag>Conversation starter · not an official proposal</StarterTag></span>
      </div>

      <div className="p-4 @lg:p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <CategoryLabel>{topic.category}</CategoryLabel>
          <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="text-xl font-extrabold leading-snug tracking-tight text-gray-900 dark:text-gray-100 focus:outline-none">
            {topic.title}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{topic.summary}</p>
        </div>

        <div className="grid gap-3 @lg:grid-cols-2">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1">Why it matters</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">{topic.whyItMatters}</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1">Sources</h3>
            {sources.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {sources.map((m) => (
                  <li key={m.id}>
                    <a href={m.url!} target="_blank" rel="noopener noreferrer" className={`rounded text-sm font-medium text-brand dark:text-brand-light hover:underline ${FOCUS}`}>
                      {m.title} — agenda<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {topic.usesMeetingSources
                  ? 'No published meeting agendas were found for your area right now.'
                  : 'No sources are linked to this topic. It is a prompt for discussion, not a report.'}
              </p>
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
            onJoin()
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Suggested title</span>
            <input
              type="text"
              value={draft.title}
              maxLength={200}
              onChange={(e) => onChange({ title: e.target.value })}
              className={TEXT_FIELD}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your thoughts</span>
            <textarea
              rows={3}
              value={draft.body}
              maxLength={10000}
              onChange={(e) => onChange({ body: e.target.value })}
              placeholder={topic.question}
              className={`${TEXT_FIELD} resize-y`}
            />
          </label>

          {movedFrom ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200" role="status">
              This draft was started for {movedFrom}, which isn't one of your communities now. It won't be posted anywhere until you move it.{' '}
              {destination && (
                <button type="button" onClick={onRebind} className={`rounded font-semibold underline hover:no-underline ${FOCUS}`}>
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
              <SecondaryButton onClick={onDiscard}>Discard draft</SecondaryButton>
            )}
          </div>
        </form>
      </div>
    </article>
  )
}
