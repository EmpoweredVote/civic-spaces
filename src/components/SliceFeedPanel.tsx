import { useRef, useEffect, useMemo, useState, useImperativeHandle } from 'react'
import type React from 'react'
// import { useFeed } from '../hooks/useFeed' // Fallback: chronological feed
import { useBoostedFeed } from '../hooks/useBoostedFeed'
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
import { ReadOnlyNotice } from './ReadOnlyNotice'
import type { SortMode } from './FeedTabs'
import type { PostWithAuthor } from '../types/database'
import type { NoWriteReason } from '../lib/writeAccess'
import { getTopicOptions } from '../lib/exploreData'
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

interface SliceFeedPanelProps {
  sliceId: string
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
  /** The real sign-in, for a signed-out visitor's "Sign in to reply". */
  loginUrl?: string
}

export default function SliceFeedPanel({
  sliceId,
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
  loginUrl,
}: SliceFeedPanelProps) {
  // Static editorial content for this level: a pure lookup, no fetch, so it is safe in a
  // panel that is mounted six times.
  const topicOptions = useMemo(() => (sliceType ? getTopicOptions(sliceType) : []), [sliceType])
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useBoostedFeed(sliceId)

  useRealtimeInvalidation(sliceId)

  const { userId } = useAuth()
  const { profile } = useProfile(userId)
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
    return <FeedSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400">
        <p className="text-sm">Failed to load posts. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="text-sm text-brand hover:underline"
        >
          Try again
        </button>
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
          <ReadOnlyNotice
            reason={noWriteReason}
            surface="feed"
            viewingSliceIndex={viewingSliceIndex}
            ownSliceIndex={ownSliceIndex}
            onReturnToOwnSlice={onReturnToOwnSlice}
          />
        )}
        {posts.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-center px-6 rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900">
            {searchQuery.trim() ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No posts match "{searchQuery.trim()}".</p>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No conversations{placeName ? ` in ${placeName}` : ''} yet.
                  {!isViewOnly && userId ? ' Start the first one.' : ''}
                </p>
                {!isViewOnly && userId && (
                  <PrimaryButton onClick={() => handleCompose()}>Start a conversation</PrimaryButton>
                )}
              </div>
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
                className="rounded-full px-3 py-1.5 text-xs font-medium text-brand dark:text-brand-light bg-brand-muted dark:bg-brand/10 hover:bg-brand/15 disabled:opacity-60"
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
            placeName={placeName}
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
            noWriteReason={noWriteReason}
            ownSliceIndex={ownSliceIndex}
            placeName={placeName}
            loginUrl={loginUrl}
          />
        </div>
      )}
    </div>
  )
}
