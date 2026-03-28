import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Sheet from 'react-modal-sheet'
import { useNotifications } from '../hooks/useNotifications'
import NotificationList from './NotificationList'

interface NotificationBellProps {
  onOpenProfile: (userId: string) => void
  onNavigateToThread: (postId: string) => void
}

export default function NotificationBell({
  onOpenProfile,
  onNavigateToThread,
}: NotificationBellProps) {
  const { unreadCount } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click-outside close for desktop popover
  useEffect(() => {
    if (!isOpen) return

    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${badgeLabel} unread` : ''}`}
        className="relative w-9 h-9 flex items-center justify-center rounded-full transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      >
        {/* Bell SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-600 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Desktop popover — hidden on mobile via md:block */}
      <div className="hidden md:block">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden"
            >
              <NotificationList
                onClose={() => setIsOpen(false)}
                onOpenProfile={onOpenProfile}
                onNavigateToThread={onNavigateToThread}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile bottom sheet — visible on mobile only (Sheet always renders but stays closed on desktop) */}
      <Sheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        snapPoints={[0.75]}
      >
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content>
            <NotificationList
              onClose={() => setIsOpen(false)}
              onOpenProfile={onOpenProfile}
              onNavigateToThread={onNavigateToThread}
            />
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={() => setIsOpen(false)} />
      </Sheet>
    </div>
  )
}
