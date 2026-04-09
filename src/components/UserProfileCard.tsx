import { useState } from 'react'
import { Sheet } from 'react-modal-sheet'
import { useAuth } from '../hooks/useAuth'
import { useProfileById } from '../hooks/useProfileById'
import { useRelationship, useSendFriendRequest, useAcceptFriendRequest, useRemoveFriend } from '../hooks/useFriendship'
import { useFollowStatus, useToggleFollow } from '../hooks/useFollow'
import { useIsBlockedBy, useBlockedUsers, useBlockUser, useUnblockUser } from '../hooks/useBlock'
import EmpoweredBadge from './EmpoweredBadge'

interface UserProfileCardProps {
  isOpen: boolean
  onClose: () => void
  userId: string | null
}

export default function UserProfileCard({ isOpen, onClose, userId }: UserProfileCardProps) {
  const { userId: currentUserId } = useAuth()
  const { profile, sliceName, isLoading } = useProfileById(userId)
  const { state: relationshipState } = useRelationship(userId)
  const { isFollowing } = useFollowStatus(userId)
  const sendFriendRequest = useSendFriendRequest()
  const acceptFriendRequest = useAcceptFriendRequest()
  const removeFriend = useRemoveFriend()
  const toggleFollow = useToggleFollow()
  const blockUser = useBlockUser()
  const unblockUser = useUnblockUser()
  const [overflowOpen, setOverflowOpen] = useState(false)

  // Block state checks
  const { data: isBlockedByUser } = useIsBlockedBy(
    userId && userId !== currentUserId ? userId : null,
  )
  const { data: blockedData } = useBlockedUsers(currentUserId)
  const isBlocked = blockedData?.blockedSet.has(userId ?? '') ?? false

  if (!userId) return null

  const isEmpowered = profile?.tier === 'empowered'
  const isSelf = currentUserId === userId

  // If the profile owner has blocked the current viewer, show a generic unavailable sheet
  if (isBlockedByUser) {
    return (
      <Sheet isOpen={isOpen} onClose={onClose} snapPoints={[0.3]} initialSnap={0}>
        <Sheet.Container>
          <Sheet.Header />
          <Sheet.Content>
            <div className="px-6 pb-8 flex flex-col items-center justify-center py-8">
              <p className="text-sm text-gray-500">This profile is unavailable.</p>
            </div>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={onClose} />
      </Sheet>
    )
  }

  const containerStyle = isEmpowered ? { backgroundColor: '#FFF0EE' } : undefined

  return (
    <Sheet isOpen={isOpen} onClose={onClose} snapPoints={[0.45]} initialSnap={0}>
      <Sheet.Container style={containerStyle}>
        <Sheet.Header />
        <Sheet.Content>
          <div className="px-6 pb-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                Loading profile...
              </div>
            ) : profile ? (
              <>
                {/* Avatar */}
                <div className="flex items-center gap-4 mb-4">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-semibold text-gray-600">
                        {profile.display_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Display name + badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base font-semibold text-gray-900">
                        {profile.display_name}
                      </span>
                      {isEmpowered && <EmpoweredBadge />}
                    </div>

                    {/* Tier label */}
                    <p className="text-sm text-gray-500 mt-0.5">
                      {isEmpowered ? 'Empowered Civic Leader' : 'Connected'}
                    </p>

                    {/* Slice name */}
                    {sliceName && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{sliceName}</p>
                    )}
                  </div>
                </div>

                {/* Action button */}
                {isSelf ? (
                  <p className="text-sm text-gray-400 text-center py-2">This is you</p>
                ) : isEmpowered ? (
                  /* Follow / Unfollow for Empowered users */
                  <button
                    onClick={() =>
                      toggleFollow.mutate({ targetId: userId, currentlyFollowing: isFollowing })
                    }
                    disabled={toggleFollow.isPending}
                    className={`w-full rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isFollowing
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-brand-btn text-white hover:bg-brand-hover'
                    }`}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                ) : (
                  /* Friend button for Connected users */
                  <div className="relative">
                    {relationshipState === 'none' && (
                      <button
                        onClick={() => sendFriendRequest.mutate(userId)}
                        disabled={sendFriendRequest.isPending}
                        className="w-full rounded-md bg-brand-btn px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add Friend
                      </button>
                    )}

                    {relationshipState === 'pending_sent' && (
                      <button
                        disabled
                        className="w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
                      >
                        Pending
                      </button>
                    )}

                    {relationshipState === 'pending_received' && (
                      <button
                        onClick={() => acceptFriendRequest.mutate(userId)}
                        disabled={acceptFriendRequest.isPending}
                        className="w-full rounded-md bg-brand-btn px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Accept Request
                      </button>
                    )}

                    {relationshipState === 'friends' && (
                      <>
                        <button
                          onClick={() => setOverflowOpen((prev) => !prev)}
                          className="w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          Friends ▾
                        </button>
                        {overflowOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md bg-white shadow-lg border border-gray-200 py-1">
                            <button
                              onClick={() => {
                                setOverflowOpen(false)
                                removeFriend.mutate(userId)
                              }}
                              disabled={removeFriend.isPending}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Remove Friend
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {/* Block / Unblock button — non-self only */}
                {!isSelf && (
                  <button
                    onClick={() => {
                      if (isBlocked) {
                        unblockUser.mutate({ blocker_id: currentUserId!, blocked_id: userId })
                      } else {
                        if (window.confirm("Block this user? They won't be able to see your posts.")) {
                          blockUser.mutate({ blocker_id: currentUserId!, blocked_id: userId })
                        }
                      }
                    }}
                    className={`w-full text-sm mt-3 py-1 ${
                      isBlocked
                        ? 'text-gray-500 hover:text-gray-700'
                        : 'text-red-500 hover:text-red-700'
                    }`}
                  >
                    {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Profile not found.</p>
            )}
          </div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  )
}
