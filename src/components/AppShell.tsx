import { useState, useRef, useEffect, useCallback, createRef } from 'react'
import type React from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAllSlices } from '../hooks/useAllSlices'
import { useNotificationRouting } from '../hooks/useNotificationRouting'
import { useIsModerator } from '../hooks/useModQueue'
import { useWikiHeroImage } from '../hooks/useWikiHeroImage'
import { useJurisdictionName } from '../hooks/useJurisdictionName'
import { useCompassData } from '../hooks/useCompassData'
import { useRepresentatives } from '../hooks/useRepresentatives'
import SliceTabBar from './SliceTabBar'
import NoJurisdictionBanner from './NoJurisdictionBanner'
import SliceFeedPanel from './SliceFeedPanel'
import { HeroBanner } from './HeroBanner'
import FriendsList from './FriendsList'
import MemberDirectory from './MemberDirectory'
import NotificationBell from './NotificationBell'
import ModeratorQueue from './ModeratorQueue'
import { Sidebar } from './Sidebar'
import { SidebarMobile } from './SidebarMobile'
import type { TabKey, SliceType, SliceInfo } from '../types/database'

/**
 * Small wrapper that calls useWikiHeroImage for the active slice.
 * Extracted as its own component so the hook is called unconditionally
 * (React rules of hooks forbid calling hooks inside callbacks or IIFEs).
 */
function ActiveHeroBanner({
  slice,
  fallbackName,
}: {
  slice: SliceInfo
  fallbackName: string
}) {
  const wikiPhotoUrl = useWikiHeroImage(slice)
  const displayName = useJurisdictionName(slice, fallbackName)
  return (
    <HeroBanner
      sliceType={slice.sliceType}
      sliceName={displayName}
      geoid={slice.geoid}
      memberCount={slice.memberCount}
      siblingIndex={slice.siblingIndex}
      photoUrl={slice.photoUrl ?? wikiPhotoUrl}
    />
  )
}

type ActivePanel = 'friends' | 'directory' | null

const FEED_TABS = ['neighborhood', 'local', 'state', 'federal', 'unified'] as const

const TAB_LABELS: Record<TabKey, string> = {
  neighborhood: 'Local',
  local: 'County',
  state: 'State',
  federal: 'Federal',
  unified: 'Unified',
  volunteer: 'Volunteer',
}

const ALL_TAB_KEYS: TabKey[] = ['neighborhood', 'local', 'state', 'federal', 'unified', 'volunteer']

const INITIAL_POST_IDS: Record<TabKey, string | null> = {
  neighborhood: null,
  local: null,
  state: null,
  federal: null,
  unified: null,
  volunteer: null,
}

const INITIAL_SCROLL_MAP: Record<TabKey, boolean> = {
  neighborhood: false,
  local: false,
  state: false,
  federal: false,
  unified: false,
  volunteer: false,
}

export default function AppShell() {
  const { userId, isAuthenticated, isLoading: authLoading, loginUrl } = useAuth()
  const { slices, hasJurisdiction, isLoading } = useAllSlices(userId)
  const { data: isModerator } = useIsModerator(userId)
  const compassData = useCompassData(userId)
  const repsData = useRepresentatives(userId)

  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('federal')
  const [activePostIds, setActivePostIds] = useState<Record<TabKey, string | null>>(INITIAL_POST_IDS)
  const [scrollToLatestMap, setScrollToLatestMap] = useState<Record<TabKey, boolean>>(INITIAL_SCROLL_MAP)
  const [modQueueOpen, setModQueueOpen] = useState(false)

  // Per-tab scroll position preservation (HUB-08)
  const scrollPositions = useRef<Record<string, number>>({})
  const scrollRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>(
    Object.fromEntries(ALL_TAB_KEYS.map((tab) => [tab, createRef<HTMLDivElement>()]))
  )

  const showVolunteerTab = !!slices['volunteer']

  const handleTabChange = useCallback((newTab: TabKey) => {
    // Save current tab's scroll position before switching
    const currentRef = scrollRefs.current[activeTab]
    if (currentRef?.current) {
      scrollPositions.current[activeTab] = currentRef.current.scrollTop
    }
    setActiveTab(newTab)
  }, [activeTab])

  // Notification routing (SLCE-03): resolve reply notifications to the correct slice tab
  const { resolveTabForPost } = useNotificationRouting(slices)

  const handleNotificationNavigate = useCallback(async (postId: string) => {
    const resolvedTab = await resolveTabForPost(postId)
    handleTabChange(resolvedTab)
    setActivePostIds(prev => ({ ...prev, [resolvedTab]: postId }))
    setScrollToLatestMap(prev => ({ ...prev, [resolvedTab]: true }))
  }, [resolveTabForPost, handleTabChange])

  // Restore scroll position after the new tab becomes visible
  useEffect(() => {
    requestAnimationFrame(() => {
      const ref = scrollRefs.current[activeTab]
      if (ref?.current) {
        ref.current.scrollTop = scrollPositions.current[activeTab] ?? 0
      }
    })
  }, [activeTab])

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-blue-600 dark:text-blue-400">Civic Spaces</h1>

        {/* Social nav icons — only when authenticated */}
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            {/* Moderator shield icon — moderators only */}
            {isModerator && (
              <button
                onClick={() => setModQueueOpen(true)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                aria-label="Moderation queue"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </button>
            )}

            {/* Notification bell */}
            <NotificationBell
              onNavigateToThread={(postId) => {
                setScrollToLatestMap(prev => ({ ...prev, [activeTab]: true }))
                setActivePostIds(prev => ({ ...prev, [activeTab]: postId }))
              }}
              onNavigateToSliceThread={handleNotificationNavigate}
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
      <main className="flex flex-col flex-1 overflow-hidden min-h-0">
        {authLoading && (
          <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
            Loading&hellip;
          </div>
        )}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col flex-1 items-center justify-center gap-4">
            <p className="text-gray-500 text-sm">Log in to view your civic community.</p>
            <a
              href={loginUrl}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors"
            >
              Log in with Empowered Vote
            </a>
          </div>
        )}

        {isAuthenticated && isLoading && (
          <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
            Loading your slices&hellip;
          </div>
        )}

        {isAuthenticated && !isLoading && !hasJurisdiction && !slices['unified'] && <NoJurisdictionBanner />}

        {isAuthenticated && !isLoading && (hasJurisdiction || !!slices['unified']) && (
          <>
            <SliceTabBar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              slices={slices}
              showVolunteerTab={showVolunteerTab}
            />

            {/* Two-column grid: feed left (~82%), sidebar right (~18%) on desktop; single column on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-[82%_18%] flex-1 overflow-hidden min-h-0">
              {/* Feed column */}
              <div className="flex flex-col overflow-hidden min-h-0">
                {/* Hero banner — natural height from aspect ratio, swaps with active tab.
                    ActiveHeroBanner is a separate component so useWikiHeroImage can be
                    called unconditionally (React rules of hooks). */}
                {slices[activeTab as SliceType] && (
                  <ActiveHeroBanner
                    slice={slices[activeTab as SliceType]!}
                    fallbackName={TAB_LABELS[activeTab]}
                  />
                )}

                <SidebarMobile compassData={compassData} repsData={repsData} activeTab={activeTab} />

                {/* Feed tab panels — flex-1 fills remaining space below hero banner */}
                <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                  {/* All FEED_TABS feeds mounted simultaneously — CSS hidden preserves scroll and React Query cache */}
                  {FEED_TABS.map((tabKey) => {
                    const slice = slices[tabKey]
                    if (!slice) return null
                    return (
                      <div
                        key={tabKey}
                        className={activeTab === tabKey ? 'flex flex-col flex-1 overflow-hidden min-h-0' : 'hidden'}
                      >
                        <SliceFeedPanel
                          sliceId={slice.id}
                          sliceName={TAB_LABELS[tabKey]}
                          siblingIndex={slice.siblingIndex}
                          activePostId={activePostIds[tabKey]}
                          onNavigateToThread={(postId) => {
                            setScrollToLatestMap(prev => ({ ...prev, [tabKey]: false }))
                            setActivePostIds(prev => ({ ...prev, [tabKey]: postId }))
                          }}
                          scrollToLatest={scrollToLatestMap[tabKey]}
                          scrollRef={scrollRefs.current[tabKey]}
                        />
                      </div>
                    )
                  })}

                  {/* Volunteer feed — conditionally rendered for users with volunteer slice */}
                  {showVolunteerTab && slices['volunteer'] && (
                    <div className={activeTab === 'volunteer' ? 'flex flex-col flex-1 overflow-hidden min-h-0' : 'hidden'}>
                      <SliceFeedPanel
                        sliceId={slices['volunteer'].id}
                        sliceName="Volunteer"
                        siblingIndex={slices['volunteer'].siblingIndex}
                        activePostId={activePostIds['volunteer']}
                        onNavigateToThread={(postId) => {
                          setScrollToLatestMap(prev => ({ ...prev, volunteer: false }))
                          setActivePostIds(prev => ({ ...prev, volunteer: postId }))
                        }}
                        scrollToLatest={scrollToLatestMap['volunteer']}
                        scrollRef={scrollRefs.current['volunteer']}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar column — hidden on mobile, live on desktop */}
              <div className="hidden md:flex flex-col border-l border-gray-200 dark:border-gray-700 overflow-y-auto sticky top-0 max-h-screen">
                <Sidebar compassData={compassData} repsData={repsData} activeTab={activeTab} />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Friends panel overlay */}
      {activePanel === 'friends' && (
        <FriendsList onClose={() => setActivePanel(null)} />
      )}

      {/* Member Directory panel overlay */}
      {activePanel === 'directory' && (
        <MemberDirectory
          sliceId={slices[activeTab as SliceType]?.id ?? null}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* Moderation queue overlay */}
      {modQueueOpen && <ModeratorQueue onClose={() => setModQueueOpen(false)} />}
    </div>
  )
}
