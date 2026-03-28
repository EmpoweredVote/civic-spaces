import { formatDistanceToNow } from 'date-fns'
import type { PostWithAuthor } from '../types/database'

interface PostCardProps {
  post: PostWithAuthor
  onClick: (postId: string) => void
}

export default function PostCard({ post, onClick }: PostCardProps) {
  if (post.is_deleted) {
    return (
      <div className="w-full text-left rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-400 italic">[Post deleted]</p>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
  const wasEdited = post.edit_history.length > 0

  return (
    <button
      className="w-full text-left rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(post.id)}
    >
      {/* Top row: avatar + author info */}
      <div className="flex items-center gap-3">
        {post.author.avatar_url ? (
          <img
            src={post.author.avatar_url}
            alt={post.author.display_name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-gray-600">
              {post.author.display_name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {post.author.display_name}
          </p>
          <p className="text-xs text-gray-500">
            {timeAgo}
            {wasEdited && <span className="text-gray-400"> · edited</span>}
          </p>
        </div>
      </div>

      {/* Body preview */}
      <p className="mt-2 text-sm text-gray-700 line-clamp-4 min-h-[4.5rem]">
        {post.body}
      </p>

      {/* Reply count */}
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span>
          {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
        </span>
      </div>
    </button>
  )
}
