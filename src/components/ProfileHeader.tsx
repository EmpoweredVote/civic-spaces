import { format } from 'date-fns'
import EmpoweredBadge from './EmpoweredBadge'
import { useRelationship, useSendFriendRequest, useAcceptFriendRequest } from '../hooks/useFriendship'
import { useFollowStatus, useToggleFollow } from '../hooks/useFollow'
import type { ConnectedProfile } from '../types/database'

interface ProfileHeaderProps {
  displayName: string
  tier: ConnectedProfile['tier']
  joinDate: string
  isSelf: boolean
  userId: string
}

function TierBadge({ tier }: { tier: ConnectedProfile['tier'] }) {
  if (tier === 'empowered') {
    return <EmpoweredBadge />
  }
  if (tier === 'connected') {
    return (
      <span className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium">
        Connected
      </span>
    )
  }
  // 'inform'
  return (
    <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs font-medium">
      Inform
    </span>
  )
}

function FriendRequestButton({ userId }: { userId: string }) {
  const { state, isLoading } = useRelationship(userId)
  const sendRequest = useSendFriendRequest()
  const acceptRequest = useAcceptFriendRequest()

  if (isLoading) return null

  if (state === 'friends') {
    return (
      <span className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
        Friends
      </span>
    )
  }

  if (state === 'pending_sent') {
    return (
      <span className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
        Pending
      </span>
    )
  }

  if (state === 'pending_received') {
    return (
      <button
        onClick={() => acceptRequest.mutate(userId)}
        disabled={acceptRequest.isPending}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        Accept
      </button>
    )
  }

  // 'none'
  return (
    <button
      onClick={() => sendRequest.mutate(userId)}
      disabled={sendRequest.isPending}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      Add Friend
    </button>
  )
}

function FollowButton({ userId, tier }: { userId: string; tier: ConnectedProfile['tier'] }) {
  const { isFollowing, isLoading } = useFollowStatus(userId)
  const toggleFollow = useToggleFollow()

  // Follow button only shown for empowered tier subjects
  if (tier !== 'empowered') return null
  if (isLoading) return null

  return (
    <button
      onClick={() => toggleFollow.mutate({ targetId: userId, currentlyFollowing: isFollowing })}
      disabled={toggleFollow.isPending}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        isFollowing
          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          : 'bg-gray-800 text-white hover:bg-gray-700'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}

export default function ProfileHeader({ displayName, tier, joinDate, isSelf, userId }: ProfileHeaderProps) {
  const formattedJoin = format(new Date(joinDate), 'MMMM yyyy')

  return (
    <div className="flex flex-col gap-1 pt-4 pb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
        <TierBadge tier={tier} />
      </div>
      <p className="text-sm text-gray-500">Joined {formattedJoin}</p>
      {!isSelf && (
        <div className="flex gap-2 mt-2 flex-wrap">
          <FriendRequestButton userId={userId} />
          <FollowButton userId={userId} tier={tier} />
        </div>
      )}
    </div>
  )
}
