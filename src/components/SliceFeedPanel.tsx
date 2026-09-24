import { useRef, useEffect, useState, useImperativeHandle } from 'react'
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
import PostComposer from './PostComposer'
import ThreadView from './ThreadView'
import InformUpgradePrompt from './InformUpgradePrompt'
import type { SortMode } from './FeedTabs'
import type { PostWithAuthor } from '../types/database'

function sortPosts(posts: PostWithAuthor[], sort: SortMode): PostWithAuthor[] {
  // No upvote/score system exists yet — Hot keeps the feed's existing ranking
  // (boosted_at from get_boosted_feed_filtered); New and Top are genuine
  // client-side sorts over the currently loaded posts.
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

/** What AppShell's tab bar can ask of a panel: its Post button opens this composer. */
export interface FeedPanelHandle {
  compose: () => void
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
  /** True when showing a sibling slice the member does not belong to. */
  isViewOnly?: boolean
  /** Sibling index currently displayed, and the member's own, for the notice. */
  viewingSliceIndex?: number
  ownSliceIndex?: number
  onReturnToOwnSlice?: () => void
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
  viewingSliceIndex,
  ownSliceIndex,
  onReturnToOwnSlice,
}: SliceFeedPanelProps) {
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
    if (profile?.is_suspended) return
    if (profile?.tier === 'inform') {
      setInformPromptOpen(true)
      return
    }
    setComposerOpen(true)
  }

  const handleCloseComposer = () => {
    setComposerOpen(false)
    setEditingPost(null)
  }

  // Registered before the early returns below, so it exists while the feed loads.
  useImperativeHandle(panelRef, () => ({ compose: handleFABClick }))

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

  const posts = sortPosts(filterPosts(data?.pages.flatMap((page) => page) ?? [], searchQuery), sort)

  return (
    <div className="relative">
      {/* Feed — hidden (but mounted) while a thread is open. The page scrolls, not
          this panel: AppShell saves and restores window.scrollY around the thread. */}
      <div className={activePostId ? 'hidden' : 'flex flex-col'}>

        {/* Informational, not an error: posting simply is not available here,
            because this is not the slice the member was assigned to. */}
        {isViewOnly && (
          <div className="flex items-start gap-2.5 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="leading-snug">
              You're browsing Slice {viewingSliceIndex ?? '—'} read-only.
              {typeof ownSliceIndex === 'number' && (
                <>
                  {' '}Posting and replying stay in your own community, Slice {ownSliceIndex}.
                  {onReturnToOwnSlice && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={onReturnToOwnSlice}
                        className="font-semibold underline hover:no-underline"
                      >
                        Switch back
                      </button>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
        )}
        {posts.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-center px-6 rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery.trim()
                ? `No posts match "${searchQuery.trim()}".`
                : 'No posts yet. Be the first to start a conversation!'}
            </p>
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
            ownSliceIndex={ownSliceIndex}
          />
        </div>
      )}
    </div>
  )
}
