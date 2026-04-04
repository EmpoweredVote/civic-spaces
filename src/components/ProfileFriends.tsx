import { useLocation } from 'wouter'
import { useFriendsList } from '../hooks/useFriends'
import { useMutualFriends } from '../hooks/useMutualFriends'
import EmpoweredBadge from './EmpoweredBadge'
import type { ConnectedProfile } from '../types/database'

interface ProfileFriendsProps {
  userId: string
  isSelf: boolean
  friendCount: number
}

interface FriendRowProps {
  userId: string
  displayName: string
  tier: ConnectedProfile['tier']
  onClick: () => void
}

function FriendRow({ displayName, tier, onClick }: FriendRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 py-2.5 border-b border-gray-100 text-left last:border-b-0 hover:bg-gray-50 transition-colors -mx-1 px-1 rounded"
    >
      <span className="text-sm text-gray-800 flex-1 truncate">{displayName}</span>
      {tier === 'empowered' && <EmpoweredBadge />}
    </button>
  )
}

function OwnFriendsList() {
  const [, navigate] = useLocation()
  const { friends, isLoading } = useFriendsList()

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading...</p>
  }

  if (friends.length === 0) {
    return <p className="text-sm text-gray-400">You haven&apos;t added any friends yet</p>
  }

  return (
    <div className="flex flex-col">
      {friends.map((friend) => (
        <FriendRow
          key={friend.user_id}
          userId={friend.user_id}
          displayName={friend.display_name}
          tier={friend.tier}
          onClick={() => navigate(`/profile/${friend.user_id}`)}
        />
      ))}
    </div>
  )
}

function MutualFriendsList({ userId, friendCount }: { userId: string; friendCount: number }) {
  const [, navigate] = useLocation()
  const { mutualFriends, isLoading } = useMutualFriends(userId)

  return (
    <>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">
        Mutual Friends ({isLoading ? '…' : mutualFriends.length})
      </h2>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : mutualFriends.length === 0 ? (
        <p className="text-sm text-gray-400">No mutual friends</p>
      ) : (
        <div className="flex flex-col">
          {mutualFriends.map((friend) => (
            <FriendRow
              key={friend.user_id}
              userId={friend.user_id}
              displayName={friend.display_name}
              tier={friend.tier as ConnectedProfile['tier']}
              onClick={() => navigate(`/profile/${friend.user_id}`)}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function ProfileFriends({ userId, isSelf, friendCount }: ProfileFriendsProps) {
  return (
    <div>
      {isSelf ? (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Friends</h2>
          <OwnFriendsList />
        </>
      ) : (
        <MutualFriendsList userId={userId} friendCount={friendCount} />
      )}
    </div>
  )
}
