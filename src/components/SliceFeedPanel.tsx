import { useRef, useEffect, useMemo, useState, useImperativeHandle } from 'react'
import { useLocation } from 'wouter'
import type React from 'react'
// import { useFeed } from '../hooks/useFeed' // Fallback: chronological feed
import { useBoostedFeed } from '../hooks/useBoostedFeed'
import { usePublicFeed } from '../hooks/usePublicFeed'
import { usePublicSlice } from '../hooks/usePublicSlice'
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useDeletePost } from '../hooks/useDeletePost'
import PostCard from './PostCard'
import FeedSkeleton from './FeedSkeleton'
import FAB from './FAB'
import { toast } from 'sonner'
import PostComposer, { type ComposeRequest } from './PostComposer'
import ThreadView from './ThreadView'
import InformUpgradePrompt from './InformUpgradePrompt'
import { ReplyClosedNotice } from './ReplyClosedNotice'
import type { SortMode } from './FeedTabs'
import type { PostWithAuthor } from '../types/database'
import type { NoWriteReason } from '../lib/writeAccess'
import { getTopicOptions } from '../lib/exploreData'
import { nameTopic } from '../lib/exploreComposition'
import { PrimaryButton } from './explore/exploreUi'

function sortPosts(posts: PostWithAuthor[], sort: SortMode): PostWithAuthor[] {
  // 🔴 CLIENT-SIDE OVER LOADED PAGES ONLY. The feed is paginated, so this orders the
  // pages fetched so far, not the slice: under Top, a high-reply post from page 3 jumps
  // to the top once page 3 loads, mid-scroll. Only a server-side ORDER BY fixes that.
  if (sort === 'top') {
    return [...posts].sort((a, b) => b.reply_count - a.reply_count)
  }
  return [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

// Client-side match over the currently loaded posts (title/body) — there's
// no full-text search endpoint to call, so this only searches what's
// already been fetched into this feed, not the whole history.
function filterPosts(posts: PostWithAuthor[], query: string): PostWithAuthor[] {
  const q = query.trim().toLowerCase()
  if (!q) return posts
  return posts.filter(
    (post) => post.title?.toLowerCase().includes(q) || post.body.toLowerCase().includes(q)
  )
}

/** What AppShell's tab bar can ask of a panel: its Post button opens this composer. */
export interface FeedPanelHandle {
  /** Opens a new post; a request prefills it (Explore drafts) but never submits it. */
  compose: (request?: ComposeRequest) => void
}

/** A place being read without membership — Phase 18's public path. */
export interface PublicPlace {
  sliceType: string
  geoid: string
}

interface SliceFeedPanelProps {
  sliceId: string
  /**
   * Set when this panel is showing a PUBLIC place the viewer is not a member of.
   *
   * 🔴 The two feeds are not interchangeable and must never both be live. The member
   * feed is block-filtered and carries every author's id; the public one applies the
   * D-48/D-49 per-author projection and no block filter. Routing a member through the
   * public path would silently un-block people they blocked, and routing a visitor
   * through the member path 403s. So exactly one query is enabled, here, by this prop.
   */
  publicPlace?: PublicPlace | null
  /**
   * 🔴 Only used to gate the PUBLIC query. All six panels mount at once, and every
   * level of a visited place is public, so without this one visit fires six RPCs for
   * five feeds nobody is looking at — against a surface that is now open to the whole
   * internet. The member feeds stay eager, as they were: that is what keeps the tab
   * switch instant and the scroll position alive, and it costs a member nothing new.
   */
  isActive?: boolean
  activePostId: string | null
  onNavigateToThread: (postId: string | null) => void
  scrollToLatest?: boolean
  /** Owned by AppShell's tab bar, which spans the feed and sidebar above the panels. */
  sort: SortMode
  searchQuery: string
  panelRef?: React.Ref<FeedPanelHandle>
  /** True when the viewer may not write in the slice on screen, for any reason. */
  isViewOnly?: boolean
  /**
   * WHY they may not — the notice's wording comes from this, and a notice that
   * cannot name a reason is a panel still computing its own boolean.
   */
  noWriteReason?: NoWriteReason | null
  /** Sibling index currently displayed, and the member's own, for the notice. */
  viewingSliceIndex?: number
  ownSliceIndex?: number
  onReturnToOwnSlice?: () => void
  /** Which level this feed is, for the composer's topic picker. */
  sliceType?: string
  /** The place this feed belongs to, named — null while it resolves. Never the tab label. */
  placeName?: string | null
  /** Whether the viewer has spaces to go back to. See `offersReturnToOwnSpaces`. */
  hasOwnSpaces?: boolean
  /**
   * 🔴 There is NO `loginUrl` prop any more, and its absence is the decision.
   *
   * 18-03 added one so the notice could be rendered ONCE here rather than twice —
   * AppShell had been rendering a second copy beside this one to get the sign-in
   * link, and shipped two identical banners stacked. 18-04 then removed the link
   * itself: `ReplyClosedNotice` opens the explainer, never a login form (D-36/D-37),
   * because the sentence names who may speak here and a direct jump to the accounts
   * hub is the thing being replaced. One notice, and no sign-in on this surface.
   */
}

export default function SliceFeedPanel({
  sliceId,
  publicPlace = null,
  isActive = true,
  activePostId,
  onNavigateToThread,
  scrollToLatest,
  sort,
  searchQuery,
  panelRef,
  isViewOnly = false,
  noWriteReason = null,
  viewingSliceIndex,
  ownSliceIndex,
  onReturnToOwnSlice,
  sliceType,
  placeName = null,
  hasOwnSpaces = false,
}: SliceFeedPanelProps) {
  // Static editorial content for this level: a pure lookup, no fetch, so it is safe in a
  // panel that is mounted six times. Named for this panel's place, as Explore names them.
  const topicOptions = useMemo(
    () => (sliceType ? getTopicOptions(sliceType).map((topic) => nameTopic(topic, placeName)) : []),
    [sliceType, placeName],
  )

  // Hoisted above the feed hooks: the public query is cached PER VIEWER (D-49), so
  // the reader's id is part of its key and has to exist before the key is built.
  const { userId } = useAuth()

  // 🔴 Both hooks are called on every render — React's rules of hooks require it —
  // and exactly one of them is ENABLED. `useBoostedFeed(null)` does not run; the
  // public query is off unless this panel is both public and on screen.
  const memberFeed = useBoostedFeed(publicPlace ? null : sliceId)
  const publicFeed = usePublicFeed(
    userId,
    publicPlace?.sliceType ?? null,
    publicPlace?.geoid ?? null,
    !!publicPlace && isActive,
  )

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = publicPlace ? publicFeed : memberFeed

  // 🔴 Only to tell "nobody has posted here" from "this space does not exist yet".
  // Both render as an empty feed and they are opposite facts for a visitor deciding
  // whether an account would get them anything. See usePublicSlice's header.
  const publicSlice = usePublicSlice(
    publicPlace?.sliceType ?? null,
    publicPlace?.geoid ?? null,
    !!publicPlace && isActive,
  )
  // Undefined while it loads — treated as "exists", so the harsher sentence is never
  // shown on the strength of a pending query.
  const publicSliceExists = publicSlice.data !== null

  // A visited place has no slice id to watch, and nothing a visitor can subscribe to:
  // realtime runs over the same table grants the RPCs exist to avoid needing.
  useRealtimeInvalidation(publicPlace ? null : sliceId)

  const { profile } = useProfile(userId)
  const [, navigate] = useLocation()
  // D-37: the door opens the explainer, never a login form.
  const onExplain = () => navigate('/accounts')
  const deletePost = useDeletePost()

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<PostWithAuthor | null>(null)
  const [informPromptOpen, setInformPromptOpen] = useState(false)
  const [composeRequest, setComposeRequest] = useState<ComposeRequest | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const isSearching = searchQuery.trim() !== ''

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isSearching, isLoading])

  const handleCompose = (request?: ComposeRequest) => {
    if (profile?.is_suspended) {
      // The FAB renders disabled, but Explore's "Join the conversation" reaches here after
      // already switching tab and view — silence would strand them with no composer and
      // no reason why.
      toast.error('Your account is suspended, so you cannot post right now.')
      return
    }
    if (profile?.tier === 'inform') {
      setInformPromptOpen(true)
      return
    }
    setEditingPost(null)
    setComposeRequest(request ?? null)
    setComposerOpen(true)
  }

  const handleFABClick = () => handleCompose()

  const handleCloseComposer = () => {
    setComposerOpen(false)
    setEditingPost(null)
    setComposeRequest(null)
  }

  // Registered before the early returns below, so it exists while the feed loads.
  useImperativeHandle(panelRef, () => ({ compose: handleCompose }))

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {/* Same rule as the error branch below: the gate does not wait on the
            fetch, so neither does the sentence explaining it. A slow public RPC
            otherwise leaves a visitor staring at a skeleton with no composer and
            no reason given for the whole fetch. */}
        {isViewOnly && (
          <ReplyClosedNotice
            reason={noWriteReason}
            surface="feed"
            onExplain={onExplain}
            viewingSliceIndex={viewingSliceIndex}
            ownSliceIndex={ownSliceIndex}
            onReturnToOwnSlice={onReturnToOwnSlice}

            hasOwnSpaces={hasOwnSpaces}
          />
        )}
        <FeedSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        {/* 🔴 The notice renders in the ERROR state too, and that is not cosmetic.
            Both early returns used to skip it, so a panel that was gated AND
            failed to load dropped the only explanation of why there is no
            composer — leaving a reader who cannot post, cannot read, and is told
            neither. The gate does not depend on the fetch succeeding, so neither
            should the sentence that explains it. */}
        {isViewOnly && (
          <ReplyClosedNotice
            reason={noWriteReason}
            surface="feed"
            onExplain={onExplain}
            viewingSliceIndex={viewingSliceIndex}
            ownSliceIndex={ownSliceIndex}
            onReturnToOwnSlice={onReturnToOwnSlice}

            hasOwnSpaces={hasOwnSpaces}
          />
        )}
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400">
          <p className="text-sm">Failed to load posts. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-brand hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const loaded = data?.pages.flatMap((page) => page) ?? []
  const loadedCount = loaded.length
  const posts = sortPosts(filterPosts(loaded, searchQuery), sort)

  return (
    <div className="relative">
      {/* Feed — hidden (but mounted) while a thread is open. The page scrolls, not
          this panel: AppShell saves and restores window.scrollY around the thread. */}
      <div className={activePostId ? 'hidden' : 'flex flex-col'}>

        {/* Informational, not an error: writing simply is not available here.
            🔴 Gated on isViewOnly, not on the reason: a panel that knows it is
            gated must always say so, even if the reason did not reach it. The
            notice names nothing in that case, which is the observable. */}
        {isViewOnly && (
          <ReplyClosedNotice
            reason={noWriteReason}
            surface="feed"
            onExplain={onExplain}
            viewingSliceIndex={viewingSliceIndex}
            ownSliceIndex={ownSliceIndex}
            onReturnToOwnSlice={onReturnToOwnSlice}

            hasOwnSpaces={hasOwnSpaces}
          />
        )}
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6 gap-2 rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900">
            {/* 🔴 THREE sentences, and which one is true is a fact this phase can
                finally establish. Phase 17 could not read `slices` and so wrote one
                paragraph true of both empty cases; `usePublicSlice` asks outright.
                "Start the first one" is addressed to someone who CAN post — never
                show it, or its button, to a reader the write path will refuse. */}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery.trim()
                ? `No posts match "${searchQuery.trim()}".`
                : !publicPlace
                  ? `No conversations${placeName ? ` in ${placeName}` : ''} yet.${!isViewOnly && userId ? ' Start the first one.' : ''}`
                  : publicSliceExists
                    ? `No conversations${placeName ? ` in ${placeName}` : ' here'} yet.`
                    : "This space hasn't opened yet."}
            </p>
            {!searchQuery.trim() && !publicPlace && !isViewOnly && userId && (
              <div className="mt-1">
                <PrimaryButton onClick={() => handleCompose()}>Start a conversation</PrimaryButton>
              </div>
            )}
            {!searchQuery.trim() && publicPlace && (
              <p className="max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {publicSliceExists
                  ? 'Anyone can read a civic space. Posting belongs to the people who live under that government.'
                  : 'Civic spaces open as people arrive. A Connected account with an address set opens the ones where you live.'}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={(postId) => onNavigateToThread(postId)}
                isOwnPost={!!userId && post.user_id === userId}
                onEdit={(p) => {
                  setEditingPost(p)
                  setComposerOpen(true)
                }}
                onDelete={(postId) => deletePost.mutate({ postId, sliceId })}
              />
            ))}


            {/* Loading spinner for next page */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div
                  className="w-6 h-6 border-2 border-gray-300 border-t-brand rounded-full animate-spin"
                  aria-label="Loading more posts"
                />
              </div>
            )}
          </div>
        )}

        {/* Pagination. Always mounted (not inside the posts branch, where zero search
            matches used to unmount it). While a search is active it is a button, not an
            observer: filtering is client-side, so a short filtered list would otherwise
            keep the sentinel in view and page through the whole slice history. */}
        {isSearching ? (
          hasNextPage && (
            <div className="flex flex-col items-center gap-2 px-4 pb-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Search only covers the {loadedCount} posts loaded so far.
              </p>
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-brand dark:text-brand-light bg-brand-muted dark:bg-brand/10 hover:bg-brand/15 disabled:opacity-60"
              >
                {isFetchingNextPage ? 'Loading…' : 'Load more posts to search'}
              </button>
            </div>
          )
        ) : (
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />
        )}

        {/* Hidden, not disabled, while view-only: RLS rejects an insert into a
            slice the member is not in, so offering the control at all would only
            produce an error. */}
        {!isViewOnly && (
          <FAB
            onClick={handleFABClick}
            disabled={profile?.is_suspended === true}
          />
        )}

        {/* Post composer sheet */}
        {userId && !isViewOnly && (
          <PostComposer
            isOpen={composerOpen}
            onClose={handleCloseComposer}
            sliceId={sliceId}
            userId={userId}
            editPost={editingPost ?? undefined}
            request={composeRequest}
            topicOptions={topicOptions}
            onCreated={(postId) => onNavigateToThread(postId)}
          />
        )}

        {/* Inform-tier upgrade prompt */}
        <InformUpgradePrompt
          isOpen={informPromptOpen}
          onClose={() => setInformPromptOpen(false)}
        />
      </div>

      {/* Thread view — shown when a post is active */}
      {activePostId && (
        <div className="flex flex-col rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 shadow-sm">
          <ThreadView
            postId={activePostId}
            sliceId={sliceId}
            onBack={() => onNavigateToThread(null)}
            scrollToLatest={scrollToLatest}
            isViewOnly={isViewOnly}
            isPublic={!!publicPlace}
            noWriteReason={noWriteReason}
            ownSliceIndex={ownSliceIndex}
            placeName={placeName}
          />
        </div>
      )}
    </div>
  )
}
