import { useAuth } from '../hooks/useAuth'
import { useFederalSlice } from '../hooks/useFederalSlice'
import SliceTabBar from './SliceTabBar'
import NoJurisdictionBanner from './NoJurisdictionBanner'
import SliceFeedPanel from './SliceFeedPanel'

export default function AppShell() {
  const { userId, isAuthenticated } = useAuth()
  const { federalSlice, hasJurisdiction, isLoading } = useFederalSlice(userId)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-blue-600">Civic Spaces</h1>
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
              <SliceFeedPanel sliceId={federalSlice.id} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
