import { formatDistanceToNow } from 'date-fns'
import type { ReplyWithAuthor } from '../types/database'

interface ReplyCardProps {
  reply: ReplyWithAuthor
  depth: 0 | 1
  onReply?: (replyId: string, authorName: string) => void
  canWrite: boolean
}

export default function ReplyCard({ reply, depth, onReply, canWrite }: ReplyCardProps) {
  if (reply.is_deleted) {
    return (
      <div
        className={`py-3 ${depth === 1 ? 'ml-8 border-l-2 border-blue-200 pl-4' : ''}`}
      >
        <p className="text-sm text-gray-400 italic">[Reply deleted]</p>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })
  const initial = reply.author.display_name.charAt(0).toUpperCase()

  return (
    <div className={`py-3 ${depth === 1 ? 'ml-8 border-l-2 border-blue-200 pl-4' : ''}`}>
      {/* Author row */}
      <div className="flex items-center gap-2">
        {reply.author.avatar_url ? (
          <img
            src={reply.author.avatar_url}
            alt={reply.author.display_name}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-gray-600">{initial}</span>
          </div>
        )}
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {reply.author.display_name}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">{timeAgo}</span>
        </div>
      </div>

      {/* Body */}
      <p className="mt-1 text-sm text-gray-700">{reply.body}</p>

      {/* Reply button — only for depth-0 and canWrite */}
      {canWrite && depth === 0 && onReply && (
        <button
          onClick={() => onReply(reply.id, reply.author.display_name)}
          className="mt-1 text-xs text-blue-600 hover:underline"
        >
          Reply
        </button>
      )}
    </div>
  )
}
