import { formatDistanceToNow } from 'date-fns'
import { useProfileById } from '../hooks/useProfileById'
import type { Notification } from '../types/database'

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, 37) + '...'
}

function getNotificationCopy(
  notification: Notification,
  actorName: string,
): string {
  const { event_type, event_count, actor_ids, reference_excerpt } = notification

  if (event_type === 'reply') {
    if (event_count === 1) {
      return `${actorName} replied to your post`
    }
    const excerpt = reference_excerpt ? `'${truncate(reference_excerpt, 40)}'` : 'your post'
    return `${event_count} replies on your post ${excerpt}`
  }

  if (event_type === 'friend_request') {
    if (actor_ids.length === 1) {
      return `${actorName} sent you a friend request`
    }
    return `${actor_ids.length} people sent you a friend request`
  }

  if (event_type === 'friend_accepted') {
    return `${actorName} accepted your friend request`
  }

  return `${actorName} did something`
}

interface NotificationItemProps {
  notification: Notification
  onTap: (n: Notification) => void
}

export default function NotificationItem({ notification, onTap }: NotificationItemProps) {
  const { profile } = useProfileById(notification.actor_id)

  const actorName = profile?.display_name ?? 'Someone'
  const avatarUrl = profile?.avatar_url ?? null
  const copy = getNotificationCopy(notification, actorName)
  const isUnread = !notification.is_read

  const relativeTime = formatDistanceToNow(new Date(notification.updated_at), {
    addSuffix: true,
  })

  return (
    <button
      type="button"
      onClick={() => onTap(notification)}
      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors focus:outline-none focus-visible:bg-gray-100"
    >
      {/* Unread indicator */}
      <div className="flex-shrink-0 flex items-center justify-center w-4 pt-1">
        {isUnread && (
          <span className="w-2 h-2 rounded-full bg-blue-500" aria-label="Unread" />
        )}
      </div>

      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={actorName}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-[10px] text-gray-500 font-medium">
              {actorName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'}`}>
          {copy}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{relativeTime}</p>
      </div>
    </button>
  )
}
