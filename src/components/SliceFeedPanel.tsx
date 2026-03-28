import { useRef, useEffect } from 'react'
import { useFeed } from '../hooks/useFeed'
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation'
import PostCard from './PostCard'
import FeedSkeleton from './FeedSkeleton'

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

  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-center px-6">
        <p className="text-sm text-gray-400">
          No posts yet. Be the first to start a conversation!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col gap-3 p-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onClick={(postId) => console.log('Open post', postId)}
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
    </div>
  )
}
