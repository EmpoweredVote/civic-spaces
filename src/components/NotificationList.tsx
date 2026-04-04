import { useLocation } from 'wouter'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useNotifications'
import NotificationItem from './NotificationItem'
import type { Notification } from '../types/database'

interface NotificationListProps {
  onClose: () => void
  onNavigateToThread?: (postId: string) => void
  onNavigateToSliceThread: (postId: string) => void
}

export default function NotificationList({
  onClose,
  onNavigateToThread: _onNavigateToThread,
  onNavigateToSliceThread,
}: NotificationListProps) {
  const [, navigate] = useLocation()
  const { notifications, unreadCount, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  function handleTap(notification: Notification) {
    markRead.mutate(notification.id)

    if (notification.event_type === 'reply') {
      onNavigateToSliceThread(notification.reference_id)
      onClose()
    } else if (
      notification.event_type === 'friend_request' ||
      notification.event_type === 'friend_accepted'
    ) {
      navigate('/profile/' + notification.reference_id)
      onClose()
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            Loading...
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-2">
            {/* Bell icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.25}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-sm font-medium text-gray-500">You're all caught up</p>
            <p className="text-xs text-gray-400">Replies and friend activity will appear here</p>
          </div>
        )}

        {!isLoading && notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onTap={handleTap}
          />
        ))}
      </div>
    </div>
  )
}
