import { useLocation } from 'wouter'
import { useFriendsList } from '../hooks/useFriends'
import { useAcceptFriendRequest, useRemoveFriend } from '../hooks/useFriendship'
import EmpoweredBadge from './EmpoweredBadge'
import type { FriendProfile } from '../hooks/useFriends'

interface FriendsListProps {
  onClose: () => void
}

function AvatarCell({ profile }: { profile: FriendProfile }) {
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      />
    )
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-medium text-gray-600">
        {profile.display_name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export default function FriendsList({ onClose }: FriendsListProps) {
  const [, navigate] = useLocation()
  const { friends, pendingReceived, isLoading } = useFriendsList()
  const acceptFriendRequest = useAcceptFriendRequest()
  const removeFriend = useRemoveFriend()

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Friends</h2>
        <button
          onClick={onClose}
          aria-label="Close friends list"
          className="p-1 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
        ) : friends.length === 0 && pendingReceived.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-sm text-gray-500">
              No friends yet. Discover people in the Member Directory!
            </p>
          </div>
        ) : (
          <>
            {/* Pending Requests section */}
            {pendingReceived.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Pending Requests ({pendingReceived.length})
                </h3>
                <div className="divide-y divide-gray-100">
                  {pendingReceived.map((p) => (
                    <div key={p.user_id} className="flex items-center gap-3 py-3">
                      <AvatarCell profile={p} />
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {p.display_name}
                        </span>
                        {p.tier === 'empowered' && <EmpoweredBadge />}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => acceptFriendRequest.mutate(p.user_id)}
                          disabled={acceptFriendRequest.isPending}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => removeFriend.mutate(p.user_id)}
                          disabled={removeFriend.isPending}
                          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends section */}
            {friends.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Friends ({friends.length})
                </h3>
                <div className="divide-y divide-gray-100">
                  {friends.map((p) => (
                    <button
                      key={p.user_id}
                      onClick={() => navigate('/profile/' + p.user_id)}
                      className="w-full flex items-center gap-3 py-3 text-left"
                    >
                      <AvatarCell profile={p} />
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {p.display_name}
                        </span>
                        {p.tier === 'empowered' && <EmpoweredBadge />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
