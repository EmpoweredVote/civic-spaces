import { useState, useRef, useEffect, useCallback, createRef } from 'react'
import type React from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAllSlices } from '../hooks/useAllSlices'
import { useEnsureSlices } from '../hooks/useEnsureSlices'
import { useNotificationRouting } from '../hooks/useNotificationRouting'
import { useIsModerator } from '../hooks/useModQueue'
import { useWikiHeroImage } from '../hooks/useWikiHeroImage'
import { useJurisdictionName } from '../hooks/useJurisdictionName'
import { useSiblingSlices, type SiblingSlice } from '../hooks/useSiblingSlices'
import { useRepresentatives } from '../hooks/useRepresentatives'
import { useToolCoverage } from '../hooks/useToolCoverage'
import { useCompassData } from '../hooks/useCompassData'
import { useTheme } from '../hooks/useTheme'
import SliceTabBar from './SliceTabBar'
import LocationPrompt from './LocationPrompt'
import SliceFeedPanel from './SliceFeedPanel'
import { HeroBanner } from './HeroBanner'
import FriendsList from './FriendsList'
import MemberDirectory from './MemberDirectory'
import NotificationBell from './NotificationBell'
import ModeratorQueue from './ModeratorQueue'
import { Sidebar } from './Sidebar'
import { SidebarMobile } from './SidebarMobile'
import NavSidebar from './NavSidebar'
import { ThemeToggle } from './ThemeToggle'
import { ProfileMenu } from './ProfileMenu'
import { SliceSelector } from './SliceSelector'
import type { TabKey, SliceType, SliceInfo } from '../types/database'

/**
 * Small wrapper that calls useWikiHeroImage for the active slice.
 * Extracted as its own component so the hook is called unconditionally
 * (React rules of hooks forbid calling hooks inside callbacks or IIFEs).
 */
function ActiveHeroBanner({
  slice,
  fallbackName,
  siblingIndexOverride,
}: {
  slice: SliceInfo
  fallbackName: string
  /** Shard being viewed, when it is not the member's own — the banner should
   *  name the slice on screen, not the one they belong to. */
  siblingIndexOverride?: number
}) {
  const wikiPhotoUrl = useWikiHeroImage(slice)
  const displayName = useJurisdictionName(slice, fallbackName)
  return (
    <HeroBanner
      sliceType={slice.sliceType}
      sliceName={displayName}
      memberCount={slice.memberCount}
      siblingIndex={siblingIndexOverride ?? slice.siblingIndex}
      photoUrl={slice.photoUrl ?? wikiPhotoUrl}
    />
  )
}

/**
 * The sibling-slice switcher for one slice.
 *
 * 🔴 Rendered ONLY for the active tab. All six feed panels are mounted at once,
 * so putting useSiblingSlices inside the panel itself would fire it six times on
 * load — the landmine in CLAUDE.md. Gating on isActive keeps it to one.
 */
function ActiveSliceSelector({
  slice,
  fallbackName,
  viewingSliceId,
  onSelect,
}: {
  slice: SliceInfo
  fallbackName: string
  viewingSliceId: string
  onSelect: (sibling: SiblingSlice) => void
}) {
  const { siblings, isLoading, isError } = useSiblingSlices(
    slice.sliceType,
    slice.geoid,
    slice.id,
    slice.siblingIndex,
    slice.memberCount,
  )
  const locationName = useJurisdictionName(slice, fallbackName)

  return (
    <SliceSelector
      locationName={locationName}
      ownSliceId={slice.id}
      ownSiblingIndex={slice.siblingIndex}
      viewingSliceId={viewingSliceId}
      siblings={siblings}
      isLoading={isLoading}
      isError={isError}
      onSelect={(id) => {
        const picked = siblings.find((sib) => sib.id === id)
        if (picked) onSelect(picked)
      }}
    />
  )
}

type ActivePanel = 'friends' | 'directory' | null

const FEED_TABS = ['city', 'county', 'state', 'federal', 'unified'] as const

const TAB_LABELS: Record<TabKey, string> = {
  city: 'City',
  county: 'County',
  state: 'State',
  federal: 'Federal',
  unified: 'Unified',
  volunteer: 'Volunteer',
}

const ALL_TAB_KEYS: TabKey[] = ['city', 'county', 'state', 'federal', 'unified', 'volunteer']

const INITIAL_POST_IDS: Record<TabKey, string | null> = {
  city: null,
  county: null,
  state: null,
  federal: null,
  unified: null,
  volunteer: null,
}

/** Which sibling each tab is currently showing; null means the member's own. */
const INITIAL_VIEWING: Record<TabKey, SiblingSlice | null> = {
  city: null,
  county: null,
  state: null,
  federal: null,
  unified: null,
  volunteer: null,
}

const INITIAL_SCROLL_MAP: Record<TabKey, boolean> = {
  city: false,
  county: false,
  state: false,
  federal: false,
  unified: false,
  volunteer: false,
}

export default function AppShell() {
  const { userId, isAuthenticated, isLoading: authLoading, loginUrl } = useAuth()
  const { slices, hasJurisdiction, isLoading } = useAllSlices(userId)

  // A signed-in member with no spaces is usually someone who set their address
  // after their session started, not someone without one. Ask the assigner again
  // before concluding they have no jurisdiction. See useEnsureSlices.
  const hasAnySlices = Object.keys(slices).length > 0
  const assignmentStatus = useEnsureSlices({ userId, hasAnySlices, isLoading })
  const isAssigning = assignmentStatus === 'assigning'
  const { data: isModerator } = useIsModerator(userId)
  const repsData = useRepresentatives(userId)
  // Hoisted like repsData: called once here, passed to both sidebars. Never call
  // this inside a feed panel — all six mount at once and it would fire 6x.
  const toolCoverage = useToolCoverage()
  // Hoisted for the same reason as repsData and toolCoverage: both sidebars
  // need it, and a hook inside a feed panel would fire six times.
  const compassData = useCompassData(userId)
  const { theme, toggleTheme } = useTheme()

  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('cs_active_tab')
    return (ALL_TAB_KEYS.includes(saved as TabKey) ? saved : 'federal') as TabKey
  })
  const [activePostIds, setActivePostIds] = useState<Record<TabKey, string | null>>(INITIAL_POST_IDS)
  const [scrollToLatestMap, setScrollToLatestMap] = useState<Record<TabKey, boolean>>(INITIAL_SCROLL_MAP)
  const [viewingSlices, setViewingSlices] = useState<Record<TabKey, SiblingSlice | null>>(INITIAL_VIEWING)
  const [modQueueOpen, setModQueueOpen] = useState(false)
  // The nav rail is pinned from lg up; below that it lives in this drawer.
  const [navDrawerOpen, setNavDrawerOpen] = useState(false)

  // Per-tab scroll position preservation (HUB-08)
  const scrollPositions = useRef<Record<string, number>>({})
  const scrollRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>(
    Object.fromEntries(ALL_TAB_KEYS.map((tab) => [tab, createRef<HTMLDivElement>()]))
  )

  const showVolunteerTab = !!slices['volunteer']

  // The right sidebar is hidden entirely on Volunteer, so the content grid has
  // to collapse to a single column there — otherwise the 320px track survives
  // as dead space to the right of the feed.
  const contentGridCols =
    activeTab === 'volunteer' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[1fr_320px]'

  // Keep the active tab on a slice the member actually has.
  //
  // activeTab is restored from localStorage and otherwise defaults to 'federal',
  // neither of which knows which slices exist. When it names one they do not have,
  // the feed column renders nothing at all: that tab's panel returns null for a
  // missing slice, and every other panel is CSS-hidden because it is not active.
  // The result is a tab bar above an empty page, with nothing to say why.
  useEffect(() => {
    if (isLoading || !hasAnySlices || slices[activeTab]) return
    const firstAvailable = ALL_TAB_KEYS.find((tab) => slices[tab])
    if (firstAvailable) {
      setActiveTab(firstAvailable)
      localStorage.setItem('cs_active_tab', firstAvailable)
    }
  }, [isLoading, hasAnySlices, slices, activeTab])

  const handleViewSlice = useCallback((tab: TabKey, sibling: SiblingSlice, ownSliceId: string) => {
    setViewingSlices((prev) => ({ ...prev, [tab]: sibling.id === ownSliceId ? null : sibling }))
    // The open thread and the saved scroll offset both belong to the slice being
    // left, so neither means anything in the one being opened.
    setActivePostIds((prev) => ({ ...prev, [tab]: null }))
    scrollPositions.current[tab] = 0
    const ref = scrollRefs.current[tab]
    if (ref?.current) ref.current.scrollTop = 0
  }, [])

  const handleTogglePanel = useCallback((panel: 'friends' | 'directory') => {
    setActivePanel((prev) => (prev === panel ? null : panel))
    setNavDrawerOpen(false)
  }, [])

  const handleTabChange = useCallback((newTab: TabKey) => {
    // Save current tab's scroll position before switching
    const currentRef = scrollRefs.current[activeTab]
    if (currentRef?.current) {
      scrollPositions.current[activeTab] = currentRef.current.scrollTop
    }
    localStorage.setItem('cs_active_tab', newTab)
    setActiveTab(newTab)
    setNavDrawerOpen(false)
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
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Opens the nav rail as a drawer below lg, where it is not pinned. */}
          <button
            type="button"
            onClick={() => setNavDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navDrawerOpen}
            className="lg:hidden -ml-1 w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-brand dark:text-brand-light whitespace-nowrap">Civic Spaces</h1>
          <a
            href="https://fc.empowered.vote"
            className="hidden sm:inline text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            Focused Communities
          </a>
        </div>

        {/* Theme and account are always reachable; the social icons need a session. */}
        <div className="flex items-center gap-0.5 sm:gap-2 flex-shrink-0">
          {isAuthenticated && (
            <>
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
              onNavigateToSliceThread={handleNotificationNavigate}
            />

            {/* Friends icon */}
            <button
              onClick={() => setActivePanel(activePanel === 'friends' ? null : 'friends')}
              aria-label="Friends"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                activePanel === 'friends'
                  ? 'bg-brand-muted text-brand'
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
                  ? 'bg-brand-muted text-brand'
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
            </>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <ProfileMenu isAuthenticated={isAuthenticated} loginUrl={loginUrl} />
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-col flex-1 overflow-hidden min-h-0 bg-gray-50 dark:bg-gray-950">
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
              className="px-5 py-2 bg-brand-btn text-white text-sm font-medium rounded-full hover:bg-brand-hover transition-colors"
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

        {isAuthenticated && !isLoading && isAssigning && (
          <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            Setting up your civic spaces&hellip;
          </div>
        )}

        {isAuthenticated && !isLoading && !isAssigning && !hasJurisdiction && !slices['unified'] && (
          <LocationPrompt />
        )}

        {isAuthenticated && !isLoading && !isAssigning && (hasJurisdiction || !!slices['unified']) && (
          <>
            {/* Below lg the nav rail is a drawer, so the tab bar carries navigation. */}
            <div className="lg:hidden">
              <SliceTabBar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                slices={slices}
                showVolunteerTab={showVolunteerTab}
              />
            </div>

            {/* Nav rail + content. The rail is pinned from lg up. */}
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] grid-rows-[minmax(0,1fr)] gap-3 md:gap-4 p-3 md:p-4 flex-1 overflow-hidden min-h-0">
              <NavSidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                slices={slices}
                showVolunteerTab={showVolunteerTab}
                isModerator={!!isModerator}
                activePanel={activePanel}
                onTogglePanel={handleTogglePanel}
                onOpenModQueue={() => setModQueueOpen(true)}
                theme={theme}
              />

              {/* Everything right of the rail: banner on its own row, feed + sidebar
                  below it. Nested in its own grid rather than spanning tracks of the
                  outer one, so the rail's height can never inflate the banner row —
                  a row-spanning item can force an `auto` row to grow to fit it even
                  with overflow-y-auto, leaving dead space below the fold. */}
              <div className={`grid ${contentGridCols} grid-rows-[auto_minmax(0,1fr)] gap-3 md:gap-4 min-h-0 overflow-hidden`}>
                {/* Banner — spans the feed and sidebar columns, above both */}
                {slices[activeTab] && (
                  <div className="col-span-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
                    <ActiveHeroBanner
                      slice={slices[activeTab]!}
                      fallbackName={TAB_LABELS[activeTab]}
                      siblingIndexOverride={viewingSlices[activeTab]?.siblingIndex}
                    />
                  </div>
                )}

              {/* Feed column */}
              <div className="flex flex-col overflow-hidden min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                <SidebarMobile
                  repsData={repsData}
                  activeTab={activeTab}
                  coverage={toolCoverage.data ?? null}
                  activeSlice={slices[activeTab]}
                  compassData={compassData}
                />

                {/* Feed tab panels — flex-1 fills remaining space. Banner lives inside each
                    panel's scroll container so it scrolls up naturally with the posts. */}
                <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                  {/* All FEED_TABS feeds mounted simultaneously — CSS hidden preserves scroll and React Query cache */}
                  {FEED_TABS.map((tabKey) => {
                    const slice = slices[tabKey]
                    if (!slice) return null
                    const isActive = activeTab === tabKey
                    const viewing = viewingSlices[tabKey]
                    const isViewOnly = !!viewing && viewing.id !== slice.id
                    return (
                      <div
                        key={tabKey}
                        className={isActive ? 'flex flex-col flex-1 overflow-hidden min-h-0' : 'hidden'}
                      >
                        <SliceFeedPanel
                          sliceId={viewing?.id ?? slice.id}
                          sliceName={TAB_LABELS[tabKey]}
                          siblingIndex={slice.siblingIndex}
                          isViewOnly={isViewOnly}
                          viewingSliceIndex={viewing?.siblingIndex}
                          ownSliceIndex={slice.siblingIndex}
                          onReturnToOwnSlice={() =>
                            handleViewSlice(tabKey, { id: slice.id, siblingIndex: slice.siblingIndex, memberCount: slice.memberCount }, slice.id)
                          }
                          sliceSelector={isActive ? (
                            <ActiveSliceSelector
                              slice={slice}
                              fallbackName={TAB_LABELS[tabKey]}
                              viewingSliceId={viewing?.id ?? slice.id}
                              onSelect={(sib) => handleViewSlice(tabKey, sib, slice.id)}
                            />
                          ) : undefined}
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

              {/* Sidebar column — hidden below md, and on Volunteer entirely */}
              <div className={`${activeTab === 'volunteer' ? 'hidden' : 'hidden md:flex'} flex-col overflow-y-auto min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm`}>
                <Sidebar
                  repsData={repsData}
                  activeTab={activeTab}
                  coverage={toolCoverage.data ?? null}
                  activeSlice={slices[activeTab]}
                  compassData={compassData}
                />
              </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Nav drawer — the rail below lg, where it is not pinned */}
      {navDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl">
            <NavSidebar
              variant="drawer"
              activeTab={activeTab}
              onTabChange={handleTabChange}
              slices={slices}
              showVolunteerTab={showVolunteerTab}
              isModerator={!!isModerator}
              activePanel={activePanel}
              onTogglePanel={handleTogglePanel}
              onOpenModQueue={() => {
                setModQueueOpen(true)
                setNavDrawerOpen(false)
              }}
              theme={theme}
            />
          </div>
        </div>
      )}

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
