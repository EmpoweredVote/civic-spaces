import { useLocation } from 'wouter'
import { formatDistanceToNow } from 'date-fns'
import type { ReplyWithAuthor } from '../types/database'
import EmpoweredBadge from './EmpoweredBadge'
import FlagButton from './FlagButton'

interface ReplyCardProps {
  reply: ReplyWithAuthor
  depth: 0 | 1
  onReply?: (replyId: string, authorName: string) => void
  canWrite: boolean
  currentUserId?: string
}

export default function ReplyCard({ reply, depth, onReply, canWrite, currentUserId }: ReplyCardProps) {
  const [, navigate] = useLocation()
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
      <button
        type="button"
        onClick={() => navigate('/profile/' + reply.user_id)}
        className="flex items-center gap-2 text-left w-full"
        aria-label={`View ${reply.author.display_name}'s profile`}
      >
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
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {reply.author.display_name}
          </span>
          {reply.author.tier === 'empowered' && <EmpoweredBadge />}
          <span className="text-xs text-gray-500 flex-shrink-0">{timeAgo}</span>
        </div>
      </button>

      {/* Body */}
      <p className="mt-1 text-sm text-gray-700">{reply.body}</p>

      {/* Bottom row: reply button + flag button */}
      <div className="mt-1 flex items-center justify-between">
        {canWrite && depth === 0 && onReply ? (
          <button
            onClick={() => onReply(reply.id, reply.author.display_name)}
            className="text-xs text-brand hover:underline"
          >
            Reply
          </button>
        ) : (
          <span />
        )}
        {currentUserId && currentUserId !== reply.user_id && (
          <FlagButton contentId={reply.id} contentType="reply" userId={currentUserId} />
        )}
      </div>
    </div>
  )
}
