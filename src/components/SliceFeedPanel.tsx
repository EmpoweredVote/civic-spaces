import { useRef, useEffect, useState } from 'react'
import type React from 'react'
import type { ReactNode } from 'react'
// import { useFeed } from '../hooks/useFeed' // Fallback: chronological feed
import { useBoostedFeed } from '../hooks/useBoostedFeed'
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useDeletePost } from '../hooks/useDeletePost'
import PostCard from './PostCard'
import FeedSkeleton from './FeedSkeleton'
import FAB from './FAB'
import PostComposer from './PostComposer'
import ThreadView from './ThreadView'
import InformUpgradePrompt from './InformUpgradePrompt'
import FeedToolbar, { type SortMode, type ViewMode } from './FeedToolbar'
import { useAuthGate } from '../contexts/AuthGateContext'
import type { PostWithAuthor } from '../types/database'

function sortPosts(posts: PostWithAuthor[], sort: SortMode): PostWithAuthor[] {
  // No upvote/score system exists yet — Best/Hot/Rising keep the feed's
  // existing ranking (boosted_at from get_boosted_feed_filtered); New and
  // Top are genuine client-side sorts over the currently loaded posts.
  if (sort === 'new') {
    return [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  if (sort === 'top') {
    return [...posts].sort((a, b) => b.reply_count - a.reply_count)
  }
  return posts
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

interface SliceFeedPanelProps {
  sliceId: string
  activePostId: string | null
  onNavigateToThread: (postId: string | null) => void
  scrollToLatest?: boolean
  scrollRef?: React.RefObject<HTMLDivElement | null>
  searchQuery?: string
  onSearchChange?: (query: string) => void
  /** The slice selector control, rendered at the left of the toolbar row. */
  sliceSelector?: ReactNode
  /** True when `sliceId` is a sibling slice the user is browsing, not their own. */
  isViewOnly?: boolean
  /** The user's own slice number for this location, e.g. 1 — used in the view-only explanation. */
  ownSliceIndex?: number
  /** The slice number currently being displayed — used in the view-only explanation. */
  viewingSliceIndex?: number
  /** Switches the feed back to the user's own slice, without touching their assignment. */
  onReturnToOwnSlice?: () => void
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export default function SliceFeedPanel({
  sliceId,
  activePostId,
  onNavigateToThread,
  scrollToLatest,
  scrollRef,
  searchQuery = '',
  onSearchChange,
  sliceSelector,
  isViewOnly = false,
  ownSliceIndex,
  viewingSliceIndex,
  onReturnToOwnSlice,
}: SliceFeedPanelProps) {
  const [sort, setSort] = useState<SortMode>('best')
  const [view, setView] = useState<ViewMode>('card')

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
  const { requireAuth } = useAuthGate()

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<PostWithAuthor | null>(null)
  const [informPromptOpen, setInformPromptOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)

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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleFABClick = () => {
    requireAuth(() => {
      if (profile?.is_suspended) return
      if (profile?.tier === 'inform') {
        setInformPromptOpen(true)
        return
      }
      setComposerOpen(true)
    })
  }

  const handleCloseComposer = () => {
    setComposerOpen(false)
    setEditingPost(null)
  }

  if (isLoading) {
    return <FeedSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
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

  const posts = sortPosts(filterPosts(data?.pages.flatMap((page) => page) ?? [], searchQuery), sort)

  return (
    <div className="relative h-full">
      {/* Feed — hidden (but mounted) when thread is open to preserve scroll */}
      <div ref={scrollRef} className={activePostId ? 'hidden' : 'flex flex-col h-full overflow-y-auto contain-paint'}>
        <div className="flex flex-wrap items-center justify-between gap-3 mx-4 mt-4 md:mx-0 md:mt-0 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>{sliceSelector}</div>
          <FeedToolbar sort={sort} onSortChange={setSort} view={view} onViewChange={setView} searchQuery={searchQuery} onSearchChange={onSearchChange} />
        </div>

        {/* View-only explanation — informational, not an error: posting/replying
            just isn't available here because this isn't the user's assigned slice. */}
        {isViewOnly && (
          <div className="flex items-start gap-2.5 mx-4 mt-3 md:mx-4 rounded-lg bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            <EyeIcon />
            <p className="leading-snug">
              You're browsing Slice {viewingSliceIndex ?? '—'} read-only.{' '}
              {typeof ownSliceIndex === 'number' && (
                <>
                  Posting and replying are limited to your assigned community, Slice {ownSliceIndex}.{' '}
                  {onReturnToOwnSlice && (
                    <button type="button" onClick={onReturnToOwnSlice} className="font-semibold underline hover:no-underline">
                      Switch back
                    </button>
                  )}
                </>
              )}
            </p>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16 text-center px-6">
            <p className="text-sm text-gray-400">
              {searchQuery.trim()
                ? `No posts match "${searchQuery.trim()}".`
                : 'No posts yet. Be the first to start a conversation!'}
            </p>
          </div>
        ) : (
          <div className={view === 'compact' ? 'flex flex-col gap-1.5 p-4' : 'flex flex-col gap-3 p-4'}>
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
                compact={view === 'compact'}
              />
            ))}

            {/* Sentinel for IntersectionObserver */}
            <div ref={sentinelRef} className="h-1" aria-hidden="true" />

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
      </div>

      {/* FAB, composer, and upgrade prompt live outside the scroll container —
          FAB is `position: fixed` and needs the viewport (not a `contain-paint`
          scroll box) as its containing block, or it renders in the wrong spot.
          Hidden while a thread is open, matching prior behavior. */}
      {!activePostId && !isViewOnly && (
        <>
          <FAB
            onClick={handleFABClick}
            disabled={profile?.is_suspended === true}
          />

          {userId && (
            <PostComposer
              isOpen={composerOpen}
              onClose={handleCloseComposer}
              sliceId={sliceId}
              userId={userId}
              editPost={editingPost ?? undefined}
            />
          )}

          <InformUpgradePrompt
            isOpen={informPromptOpen}
            onClose={() => setInformPromptOpen(false)}
          />
        </>
      )}

      {/* Thread view — shown when a post is active */}
      {activePostId && (
        <div className="flex flex-col h-full">
          <ThreadView
            postId={activePostId}
            sliceId={sliceId}
            onBack={() => onNavigateToThread(null)}
            scrollToLatest={scrollToLatest}
            isViewOnly={isViewOnly}
            ownSliceIndex={ownSliceIndex}
          />
        </div>
      )}
    </div>
  )
}
