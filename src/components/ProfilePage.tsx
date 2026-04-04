import { useAuth } from '../hooks/useAuth'
import { useProfileById } from '../hooks/useProfileById'
import { useProfileStats } from '../hooks/useProfileStats'
import { useProfileSlices } from '../hooks/useProfileSlices'
import { useAllSlices } from '../hooks/useAllSlices'
import ProfileHeader from './ProfileHeader'
import ProfileStatsStrip from './ProfileStatsStrip'
import ProfileSlices from './ProfileSlices'
import ProfileFriends from './ProfileFriends'
import ProfileSkeleton from './ProfileSkeleton'

interface ProfilePageProps {
  userId: string
}

export default function ProfilePage({ userId }: ProfilePageProps) {
  const { userId: currentUserId } = useAuth()
  const isSelf = !!currentUserId && currentUserId === userId

  const { profile, isLoading: profileLoading } = useProfileById(userId)
  const { stats, isLoading: statsLoading } = useProfileStats(userId)
  const { slices: subjectSlices, isLoading: slicesLoading } = useProfileSlices(userId)
  const { slices: viewerSlices } = useAllSlices(currentUserId)

  const isLoading = profileLoading || statsLoading || slicesLoading

  function handleBack() {
    window.history.back()
  }

  return (
    <div className="fixed inset-0 bg-white overflow-y-auto z-10">
      <div className="max-w-lg mx-auto px-4 pb-8">
        {/* Back button */}
        <div className="flex items-center pt-3 pb-1">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors -ml-1 px-1 py-1 rounded"
            aria-label="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {isLoading ? (
          <ProfileSkeleton />
        ) : !profile ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-500 text-sm">User not found</p>
          </div>
        ) : (
          <>
            <ProfileHeader
              displayName={profile.display_name}
              tier={profile.tier}
              joinDate={profile.created_at}
              isSelf={isSelf}
              userId={userId}
            />

            <div className="mt-3">
              <ProfileStatsStrip
                postCount={stats?.postCount ?? 0}
                replyCount={stats?.replyCount ?? 0}
                friendCount={stats?.friendCount ?? 0}
                isSelf={isSelf}
              />
            </div>

            <div className="mt-4">
              <ProfileSlices
                subjectSlices={subjectSlices}
                viewerSlices={viewerSlices}
                isSelf={isSelf}
              />
            </div>

            <div className="mt-4">
              <ProfileFriends
                userId={userId}
                isSelf={isSelf}
                friendCount={stats?.friendCount ?? 0}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
