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
import FeedToolbar, { type SortMode } from './FeedToolbar'
import type { PostWithAuthor } from '../types/database'

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

interface SliceFeedPanelProps {
  sliceId: string
  sliceName?: string
  siblingIndex?: number
  activePostId: string | null
  onNavigateToThread: (postId: string | null) => void
  scrollToLatest?: boolean
  scrollRef?: React.RefObject<HTMLDivElement | null>
  /** The sibling-slice switcher, rendered in the feed's header row. */
  sliceSelector?: ReactNode
  /** True when showing a sibling slice the member does not belong to. */
  isViewOnly?: boolean
  /** Sibling index currently displayed, and the member's own, for the notice. */
  viewingSliceIndex?: number
  ownSliceIndex?: number
  onReturnToOwnSlice?: () => void
}

export default function SliceFeedPanel({
  sliceId,
  sliceName,
  siblingIndex,
  activePostId,
  onNavigateToThread,
  scrollToLatest,
  scrollRef,
  sliceSelector,
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
  const [sort, setSort] = useState<SortMode>('new')
  const [searchQuery, setSearchQuery] = useState('')

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

  if (isLoading) {
    return <FeedSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
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
    <div className="relative h-full">
      {/* Feed — hidden (but mounted) when thread is open to preserve scroll */}
      <div ref={scrollRef} className={activePostId ? 'hidden' : 'flex flex-col h-full overflow-y-auto'}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            {sliceSelector ?? (sliceName && siblingIndex != null && (
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {sliceName} #{siblingIndex}
              </span>
            ))}
          </div>
          <FeedToolbar
            sort={sort}
            onSortChange={setSort}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Informational, not an error: posting simply is not available here,
            because this is not the slice the member was assigned to. */}
        {isViewOnly && (
          <div className="flex items-start gap-2.5 m-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
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
          <div className="flex flex-1 items-center justify-center py-16 text-center px-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery.trim()
                ? `No posts match "${searchQuery.trim()}".`
                : 'No posts yet. Be the first to start a conversation!'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
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
