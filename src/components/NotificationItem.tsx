import { useLocation } from 'wouter'
import { formatDistanceToNow } from 'date-fns'
import { useProfileById } from '../hooks/useProfileById'
import type { Notification } from '../types/database'

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, 37) + '...'
}

/**
 * Returns the notification copy split into optional actor-name segment and
 * the rest of the text.  When actor_ids.length > 1 the copy is a single
 * non-interactive string; when there is exactly one actor the name becomes
 * a tappable element separate from the rest of the sentence.
 */
function getNotificationParts(
  notification: Notification,
  actorName: string,
): { actorSegment: string | null; restSegment: string } {
  const { event_type, event_count, actor_ids, reference_excerpt } = notification
  const singleActor = actor_ids.length === 1

  if (event_type === 'reply') {
    if (event_count === 1 && singleActor) {
      return { actorSegment: actorName, restSegment: ' replied to your post' }
    }
    const excerpt = reference_excerpt ? `'${truncate(reference_excerpt, 40)}'` : 'your post'
    return { actorSegment: null, restSegment: `${event_count} replies on your post ${excerpt}` }
  }

  if (event_type === 'friend_request') {
    if (singleActor) {
      return { actorSegment: actorName, restSegment: ' sent you a friend request' }
    }
    return { actorSegment: null, restSegment: `${actor_ids.length} people sent you a friend request` }
  }

  if (event_type === 'friend_accepted') {
    return { actorSegment: actorName, restSegment: ' accepted your friend request' }
  }

  if (event_type === 'warn') {
    return { actorSegment: null, restSegment: 'Your post was reviewed by a moderator' }
  }

  return { actorSegment: singleActor ? actorName : null, restSegment: ' did something' }
}

interface NotificationItemProps {
  notification: Notification
  onTap: (n: Notification) => void
}

export default function NotificationItem({ notification, onTap }: NotificationItemProps) {
  const [, navigate] = useLocation()
  const { profile } = useProfileById(notification.actor_id)

  const actorName = profile?.display_name ?? 'Someone'
  const avatarUrl = profile?.avatar_url ?? null
  const { actorSegment, restSegment } = getNotificationParts(notification, actorName)
  const isUnread = !notification.is_read

  const relativeTime = formatDistanceToNow(new Date(notification.updated_at), {
    addSuffix: true,
  })

  const primaryActorId = notification.actor_ids[0] ?? null

  return (
    <button
      type="button"
      onClick={() => onTap(notification)}
      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors focus:outline-none focus-visible:bg-gray-100"
    >
      {/* Unread indicator */}
      <div className="flex-shrink-0 flex items-center justify-center w-4 pt-1">
        {isUnread && (
          <span className="w-2 h-2 rounded-full bg-brand" aria-label="Unread" />
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
          {actorSegment && primaryActorId ? (
            <>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/profile/' + primaryActorId)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    navigate('/profile/' + primaryActorId)
                  }
                }}
                className="underline underline-offset-2 hover:text-brand transition-colors cursor-pointer"
                aria-label={`View ${actorSegment}'s profile`}
              >
                {actorSegment}
              </span>
              {restSegment}
            </>
          ) : (
            restSegment
          )}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{relativeTime}</p>
      </div>
    </button>
  )
}
