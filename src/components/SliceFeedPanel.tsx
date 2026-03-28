import { useRef, useEffect, useState } from 'react'
import { useFeed } from '../hooks/useFeed'
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { useDeletePost } from '../hooks/useDeletePost'
import PostCard from './PostCard'
import FeedSkeleton from './FeedSkeleton'
import FAB from './FAB'
import PostComposer from './PostComposer'
import type { PostWithAuthor } from '../types/database'

interface SliceFeedPanelProps {
  sliceId: string
}

export default function SliceFeedPanel({ sliceId }: SliceFeedPanelProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useFeed(sliceId)

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
    <div className="flex flex-col h-full overflow-y-auto">
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
              onClick={(postId) => console.log('Open post', postId)}
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
      {informPromptOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={() => setInformPromptOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Create a Connected account to post
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              You're currently in read-only mode. Upgrade to a Connected account to participate in conversations with your civic community.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://accounts.empowered.vote"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white text-center hover:bg-blue-700 transition-colors"
              >
                Create Connected Account
              </a>
              <button
                onClick={() => setInformPromptOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
