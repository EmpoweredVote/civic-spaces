import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useFederalSlice } from '../hooks/useFederalSlice'
import SliceTabBar from './SliceTabBar'
import NoJurisdictionBanner from './NoJurisdictionBanner'
import SliceFeedPanel from './SliceFeedPanel'
import UserProfileCard from './UserProfileCard'
import FriendsList from './FriendsList'
import MemberDirectory from './MemberDirectory'
import NotificationBell from './NotificationBell'

type ActivePanel = 'friends' | 'directory' | null

export default function AppShell() {
  const { userId, isAuthenticated } = useAuth()
  const { federalSlice, hasJurisdiction, isLoading } = useFederalSlice(userId)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [activePostScrollToLatest, setActivePostScrollToLatest] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-blue-600">Civic Spaces</h1>

        {/* Social nav icons — only when authenticated */}
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <NotificationBell
              onOpenProfile={(uid) => setProfileUserId(uid)}
              onNavigateToThread={(postId) => {
                setActivePostScrollToLatest(true)
                setActivePostId(postId)
              }}
            />

            {/* Friends icon */}
            <button
              onClick={() => setActivePanel(activePanel === 'friends' ? null : 'friends')}
              aria-label="Friends"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                activePanel === 'friends'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            {/* Directory icon */}
            <button
              onClick={() => setActivePanel(activePanel === 'directory' ? null : 'directory')}
              aria-label="Member Directory"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                activePanel === 'directory'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex flex-col flex-1 overflow-hidden">
        {!isAuthenticated && (
          <div className="flex flex-1 items-center justify-center text-gray-500 text-sm">
            Please log in to view your civic community.
          </div>
        )}

        {isAuthenticated && isLoading && (
          <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
            Loading your slices&hellip;
          </div>
        )}

        {isAuthenticated && !isLoading && !hasJurisdiction && <NoJurisdictionBanner />}

        {isAuthenticated && !isLoading && hasJurisdiction && federalSlice && (
          <>
            <SliceTabBar
              activeTab="federal"
              federalMemberCount={federalSlice.memberCount}
            />
            <div className="flex flex-col flex-1 overflow-y-auto">
              <SliceFeedPanel
                sliceId={federalSlice.id}
                onAuthorTap={setProfileUserId}
                activePostId={activePostId}
                onNavigateToThread={(postId) => {
                  setActivePostScrollToLatest(false)
                  setActivePostId(postId)
                }}
                scrollToLatest={activePostScrollToLatest}
              />
            </div>
          </>
        )}
      </main>

      {/* Global UserProfileCard overlay */}
      <UserProfileCard
        isOpen={profileUserId !== null}
        onClose={() => setProfileUserId(null)}
        userId={profileUserId}
      />

      {/* Friends panel overlay */}
      {activePanel === 'friends' && (
        <FriendsList onClose={() => setActivePanel(null)} />
      )}

      {/* Member Directory panel overlay */}
      {activePanel === 'directory' && (
        <MemberDirectory
          sliceId={federalSlice?.id ?? null}
          onClose={() => setActivePanel(null)}
        />
      )}
    </div>
  )
}
