import { useRef, useEffect, useState } from 'react'
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
import type { PostWithAuthor } from '../types/database'

interface SliceFeedPanelProps {
  sliceId: string
  onAuthorTap?: (userId: string) => void
}

export default function SliceFeedPanel({ sliceId, onAuthorTap }: SliceFeedPanelProps) {
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
  const [activePostId, setActivePostId] = useState<string | null>(null)

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

  if (isLoading) {
    return <FeedSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
        <p className="text-sm">Failed to load posts. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="text-sm text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  const posts = data?.pages.flatMap((page) => page) ?? []

  return (
    <div className="relative h-full">
      {/* Feed — hidden (but mounted) when thread is open to preserve scroll */}
      <div className={activePostId ? 'hidden' : 'flex flex-col h-full overflow-y-auto'}>
        {posts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16 text-center px-6">
            <p className="text-sm text-gray-400">
              No posts yet. Be the first to start a conversation!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={(postId) => setActivePostId(postId)}
                isOwnPost={!!userId && post.user_id === userId}
                onEdit={(p) => {
                  setEditingPost(p)
                  setComposerOpen(true)
                }}
                onDelete={(postId) => deletePost.mutate({ postId, sliceId })}
                onAuthorTap={onAuthorTap}
              />
            ))}

            {/* Sentinel for IntersectionObserver */}
            <div ref={sentinelRef} className="h-1" aria-hidden="true" />

            {/* Loading spinner for next page */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div
                  className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"
                  aria-label="Loading more posts"
                />
              </div>
            )}
          </div>
        )}

        {/* FAB */}
        <FAB
          onClick={handleFABClick}
          disabled={profile?.is_suspended === true}
        />

        {/* Post composer sheet */}
        {userId && (
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
            onBack={() => setActivePostId(null)}
            onAuthorTap={onAuthorTap}
          />
        </div>
      )}
    </div>
  )
}
