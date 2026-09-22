import { useState, useRef, useEffect, useCallback, useMemo, createRef } from 'react'
import type React from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAllSlices } from '../hooks/useAllSlices'
import { useNotificationRouting } from '../hooks/useNotificationRouting'
import { useIsModerator } from '../hooks/useModQueue'
import { useJurisdictionName } from '../hooks/useJurisdictionName'
import { useSiblingSlices } from '../hooks/useSiblingSlices'
import { useCompassData } from '../hooks/useCompassData'
import { useRepresentatives } from '../hooks/useRepresentatives'
import { useTheme } from '../hooks/useTheme'
import NavSidebar from './NavSidebar'
import SliceTabBar from './SliceTabBar'
import SliceFeedPanel from './SliceFeedPanel'
import { SliceSelector } from './SliceSelector'
import { HeroBanner } from './HeroBanner'
import { LEVEL_LABELS } from '../lib/bannerImages'
import FriendsList from './FriendsList'
import MemberDirectory from './MemberDirectory'
import NotificationBell from './NotificationBell'
import ModeratorQueue from './ModeratorQueue'
import { Sidebar } from './Sidebar'
import { SidebarMobile } from './SidebarMobile'
import { ThemeToggle } from './ThemeToggle'
import { ProfileMenu } from './ProfileMenu'
import { SignInPrompt } from './widgets/SignInPrompt'
import { NewsWidget } from './widgets/NewsWidget'
import { AddressAskForm } from './AddressAskForm'
import { AuthGateProvider } from '../contexts/AuthGateContext'
import type { ResolvedGeography } from '../lib/censusGeocoder'
import type { TabKey, SliceType, SliceInfo } from '../types/database'

const GEOID_OVERRIDE_KEYS: Partial<Record<SliceType, keyof ResolvedGeography>> = {
  neighborhood: 'placeGeoid',
  local: 'countyGeoid',
  state: 'stateGeoid',
  federal: 'federalGeoid',
}

/**
 * Resolves a slice's human-readable jurisdiction name.
 *
 * Local/County prefer the name resolved directly from the address geocoder
 * (previewGeo) — reliable, since it comes from the same call that already
 * resolved the geoid — over useJurisdictionName's fetched fallback, which
 * depends on a separate, less reliable Census data API.
 */
function useResolvedSliceName(slice: SliceInfo, fallbackName: string, previewGeo?: ResolvedGeography | null): string {
  const fetchedName = useJurisdictionName(slice, fallbackName)
  if (slice.sliceType === 'neighborhood') return previewGeo?.placeName ?? fetchedName
  if (slice.sliceType === 'local') return previewGeo?.countyName ?? fetchedName
  return fetchedName
}

/**
 * Small wrapper that calls useResolvedSliceName for the active slice.
 * Extracted as its own component so the hook is called unconditionally
 * (React rules of hooks forbid calling hooks inside callbacks or IIFEs).
 */
function ActiveHeroBanner({
  slice,
  fallbackName,
  previewGeo,
}: {
  slice: SliceInfo
  fallbackName: string
  previewGeo?: ResolvedGeography | null
}) {
  const displayName = useResolvedSliceName(slice, fallbackName, previewGeo)
  return (
    <HeroBanner
      sliceType={slice.sliceType}
      sliceName={displayName}
      memberCount={slice.memberCount}
      siblingIndex={slice.siblingIndex}
      photoUrl={slice.photoUrl}
    />
  )
}

/**
 * News widget for the active slice — not shown for the Volunteer slice,
 * which isn't a geographic space and has no meaningful "local news".
 */
function ActiveNewsSection({
  slice,
  fallbackName,
  previewGeo,
}: {
  slice: SliceInfo
  fallbackName: string
  previewGeo?: ResolvedGeography | null
}) {
  const displayName = useResolvedSliceName(slice, fallbackName, previewGeo)
  if (slice.sliceType === 'volunteer') return null
  return <NewsWidget level={slice.sliceType} locationName={displayName} />
}

/**
 * One mounted feed tab — wires up the slice selector (browsing "sibling"
 * slices at the same location, e.g. Asheville Slice 2, read-only) and
 * resolves whether the currently-displayed slice is the user's own or one
 * they're just viewing. Never writes slice_members — `viewingSliceId` is
 * purely local UI state, so switching here can never reassign the user to a
 * different slice.
 */
function FeedTabPanel({
  tabKey,
  slice,
  isActive,
  viewingSliceId,
  onSelectSlice,
  previewGeo,
  searchQuery,
  onSearchChange,
  activePostId,
  onNavigateToThread,
  scrollToLatest,
  scrollRef,
}: {
  tabKey: TabKey
  slice: SliceInfo
  isActive: boolean
  viewingSliceId: string | undefined
  onSelectSlice: (tabKey: TabKey, sliceId: string) => void
  previewGeo?: ResolvedGeography | null
  searchQuery: string
  onSearchChange: (query: string) => void
  activePostId: string | null
  onNavigateToThread: (postId: string | null) => void
  scrollToLatest?: boolean
  scrollRef?: React.RefObject<HTMLDivElement | null>
}) {
  const displayName = useResolvedSliceName(slice, LEVEL_LABELS[tabKey], previewGeo)
  const { siblings, isLoading, isError } = useSiblingSlices(
    slice.sliceType,
    slice.geoid,
    slice.id,
    slice.siblingIndex,
    slice.memberCount,
  )

  const effectiveSliceId = viewingSliceId ?? slice.id
  const isViewOnly = effectiveSliceId !== slice.id
  const viewingSiblingIndex = siblings.find((s) => s.id === effectiveSliceId)?.siblingIndex

  return (
    <div className={isActive ? 'flex flex-col flex-1 overflow-hidden min-h-0' : 'hidden'}>
      <SliceFeedPanel
        sliceId={effectiveSliceId}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        activePostId={activePostId}
        onNavigateToThread={onNavigateToThread}
        scrollToLatest={scrollToLatest}
        scrollRef={scrollRef}
        isViewOnly={isViewOnly}
        ownSliceIndex={slice.siblingIndex}
        viewingSliceIndex={viewingSiblingIndex}
        onReturnToOwnSlice={() => onSelectSlice(tabKey, slice.id)}
        sliceSelector={
          <SliceSelector
            locationName={displayName}
            ownSliceId={slice.id}
            ownSiblingIndex={slice.siblingIndex}
            viewingSliceId={effectiveSliceId}
            siblings={siblings}
            isLoading={isLoading}
            isError={isError}
            onSelect={(id) => onSelectSlice(tabKey, id)}
          />
        }
      />
    </div>
  )
}

type ActivePanel = 'friends' | 'directory' | null

const FEED_TABS = ['neighborhood', 'local', 'state', 'federal', 'unified'] as const

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

  // A real anonymous visitor can enter their address to see a feed for
  // their actual neighborhood/county/state/federal district — resolved for
  // real via the free Census Geocoder API (see censusGeocoder.ts), never
  // automatic. Persisted so it survives a reload.
  const [previewGeo, setPreviewGeo] = useState<ResolvedGeography | null>(() => {
    const stored = localStorage.getItem('cs_address_geo')
    return stored ? (JSON.parse(stored) as ResolvedGeography) : null
  })
  const isPreviewingLocal = !isAuthenticated && !!previewGeo
  const handleResolveAddress = useCallback((geo: ResolvedGeography) => {
    localStorage.setItem('cs_address_geo', JSON.stringify(geo))
    setPreviewGeo(geo)
  }, [])
  const handleClearAddress = useCallback(() => {
    localStorage.removeItem('cs_address_geo')
    setPreviewGeo(null)
  }, [])

  // Anonymous visitors can browse the feed (Reddit-style) only after
  // entering their address above — local dev behaves identically to
  // production here (no auto-mock shortcut), so the address flow is
  // actually testable on the same URL you'd use for everything else. Never
  // used for anything but populating what's on screen (profile/moderator/
  // theme stay tied to the real userId so the account UI reflects real auth).
  const feedUserId = userId ?? (isPreviewingLocal ? 'preview-guest' : null)
  const { slices: rawSlices, hasJurisdiction, isLoading } = useAllSlices(feedUserId)

  // Overlay the real resolved geoids onto the fixture slices so hero
  // banners and jurisdiction names reflect the visitor's real address —
  // only the posts/reps underneath stay fixture content (id/content is
  // still keyed to the fixture slice id, geoid is just a display detail).
  const slices = useMemo(() => {
    if (!isPreviewingLocal || !previewGeo) return rawSlices
    const merged: Partial<Record<SliceType, SliceInfo>> = { ...rawSlices }
    for (const [type, geoKey] of Object.entries(GEOID_OVERRIDE_KEYS) as [SliceType, keyof ResolvedGeography][]) {
      const base = rawSlices[type]
      const geoid = previewGeo[geoKey]
      if (base && geoid) {
        merged[type] = { ...base, geoid }
      }
    }
    return merged
  }, [rawSlices, isPreviewingLocal, previewGeo])
  const { data: isModerator } = useIsModerator(userId)
  const compassData = useCompassData(userId)
  const repsData = useRepresentatives(feedUserId, isPreviewingLocal ? previewGeo : null)
  const { theme, toggleTheme } = useTheme(userId)

  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('cs_active_tab')
    return (ALL_TAB_KEYS.includes(saved as TabKey) ? saved : 'federal') as TabKey
  })
  const [activePostIds, setActivePostIds] = useState<Record<TabKey, string | null>>(INITIAL_POST_IDS)
  // Per-tab "which slice am I viewing" — purely local UI state, defaults to
  // the user's own slice (undefined). Never written back to slice_members,
  // so switching here can never reassign the user to a different slice.
  const [viewingSliceIds, setViewingSliceIds] = useState<Partial<Record<TabKey, string>>>({})
  const handleSelectSlice = useCallback((tabKey: TabKey, sliceId: string) => {
    setViewingSliceIds((prev) => ({ ...prev, [tabKey]: sliceId }))
  }, [])
  const [scrollToLatestMap, setScrollToLatestMap] = useState<Record<TabKey, boolean>>(INITIAL_SCROLL_MAP)
  const [modQueueOpen, setModQueueOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Per-tab scroll position preservation (HUB-08)
  const scrollPositions = useRef<Record<string, number>>({})
  const scrollRefs = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>(
    Object.fromEntries(ALL_TAB_KEYS.map((tab) => [tab, createRef<HTMLDivElement>()]))
  )

  const showVolunteerTab = !!slices['volunteer']
  const activeSlice = slices[activeTab as SliceType]

  const handleTabChange = useCallback((newTab: TabKey) => {
    // Save current tab's scroll position before switching
    const currentRef = scrollRefs.current[activeTab]
    if (currentRef?.current) {
      scrollPositions.current[activeTab] = currentRef.current.scrollTop
    }
    localStorage.setItem('cs_active_tab', newTab)
    setActiveTab(newTab)
  }, [activeTab])

  const handleTogglePanel = useCallback((panel: 'friends' | 'directory') => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }, [])

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

  // No forced login/address gate — anyone lands directly on the feed.
  // If there's simply no slice data yet (no session, or no jurisdiction
  // resolved), an inline empty state shows instead of a blocking screen.
  const showFeed = !isLoading && (hasJurisdiction || !!slices['unified'])

  return (
    <AuthGateProvider isAuthenticated={isAuthenticated} loginUrl={loginUrl}>
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-5 md:px-8 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-4">
          {/* Menu button — opens the nav/Resources drawer on mobile and tablet; desktop keeps the rail pinned */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="lg:hidden -ml-1 w-9 h-9 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <a href="https://empowered.vote" className="flex-shrink-0 flex items-center">
            <img
              src={theme === 'dark' ? '/images/ev-logo-dark-bg.png' : '/images/ev-logo.png'}
              alt="Empowered Vote"
              className="h-9 w-auto"
            />
          </a>
          <div className="w-px h-7 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
          <h1 className="text-lg font-extrabold tracking-tight">
            <span className="text-brand dark:text-brand-light">Civic</span>{' '}
            <span className="text-[#FF5740]">Spaces</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {/* Mobile-only shortcuts — desktop users have these in the left nav rail */}
          {isAuthenticated && (
            <div className="flex items-center gap-3 md:hidden">
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

              <NotificationBell
                onNavigateToSliceThread={handleNotificationNavigate}
              />

              <button
                onClick={() => handleTogglePanel('friends')}
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

              <button
                onClick={() => handleTogglePanel('directory')}
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
            </div>
          )}

          {/* Notification bell stays global chrome on desktop too */}
          {isAuthenticated && (
            <div className="hidden md:block">
              <NotificationBell onNavigateToSliceThread={handleNotificationNavigate} />
            </div>
          )}

          {/* Theme toggle — always visible, matches Empowered Essentials header */}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />

          {/* Profile menu — always visible; shows login link when unauthenticated */}
          <ProfileMenu isAuthenticated={isAuthenticated} loginUrl={loginUrl} />
        </div>
      </header>

      {/* Content — persistent three-column layout: nav rail / feed / contextual cards */}
      <main className="flex flex-col flex-1 overflow-hidden min-h-0 bg-gray-50 dark:bg-gray-950">
        {authLoading && (
          <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
            Loading&hellip;
          </div>
        )}

        {!authLoading && (
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
              previewGeo={previewGeo}
            />

            {/* Everything right of the nav rail: banner on its own row, feed + sidebar
                columns below it. Nested in its own grid (rather than spanning rows/columns
                of the outer nav+content grid) so the nav rail's height can never inflate
                the banner row — a real CSS Grid track-sizing trap: a tall row-spanning
                item can force an "auto" row to grow to fit it, even with overflow-y-auto,
                producing a page taller than the viewport with dead space at the bottom. */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] grid-rows-[auto_minmax(0,1fr)] gap-3 md:gap-4 min-h-0 overflow-hidden">
              {/* Banner — spans the feed + sidebar columns, above both */}
              {showFeed && activeSlice && (
                <div className="md:col-span-2 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
                  <ActiveHeroBanner
                    slice={activeSlice}
                    fallbackName={LEVEL_LABELS[activeTab]}
                    previewGeo={previewGeo}
                  />
                </div>
              )}

              {/* Center column — the civic discussion feed */}
            <div className="flex flex-col overflow-hidden min-h-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              {isLoading && (
                <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
                  Loading&hellip;
                </div>
              )}

              {!isLoading && !showFeed && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-6">
                  {!isAuthenticated ? (
                    <AddressAskForm onResolve={handleResolveAddress} />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Nothing in your feed yet
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                          Add your address to join your neighborhood, county, state, and federal discussions.
                        </p>
                      </div>
                      <a
                        href="https://accounts.empowered.vote/profile"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-5 py-2 bg-brand-btn text-white text-sm font-semibold rounded-full hover:bg-brand-hover transition-colors"
                      >
                        Update your profile
                      </a>
                    </div>
                  )}
                </div>
              )}

              {showFeed && (
                <>
                  <div className="md:hidden">
                    <SliceTabBar
                      activeTab={activeTab}
                      onTabChange={handleTabChange}
                      slices={slices}
                      showVolunteerTab={showVolunteerTab}
                    />
                  </div>

                  <SidebarMobile compassData={compassData} repsData={repsData} activeTab={activeTab} />

                  {/* Feed tab panels — flex-1 fills remaining space. */}
                  <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                    {/* All FEED_TABS feeds mounted simultaneously — CSS hidden preserves scroll and React Query cache */}
                    {FEED_TABS.map((tabKey) => {
                      const slice = slices[tabKey]
                      if (!slice) return null
                      return (
                        <FeedTabPanel
                          key={tabKey}
                          tabKey={tabKey}
                          slice={slice}
                          isActive={activeTab === tabKey}
                          viewingSliceId={viewingSliceIds[tabKey]}
                          onSelectSlice={handleSelectSlice}
                          previewGeo={previewGeo}
                          searchQuery={searchQuery}
                          onSearchChange={setSearchQuery}
                          activePostId={activePostIds[tabKey]}
                          onNavigateToThread={(postId) => {
                            setScrollToLatestMap(prev => ({ ...prev, [tabKey]: false }))
                            setActivePostIds(prev => ({ ...prev, [tabKey]: postId }))
                          }}
                          scrollToLatest={scrollToLatestMap[tabKey]}
                          scrollRef={scrollRefs.current[tabKey]}
                        />
                      )
                    })}

                    {/* Volunteer feed — conditionally rendered for users with volunteer slice */}
                    {showVolunteerTab && slices['volunteer'] && (
                      <FeedTabPanel
                        tabKey="volunteer"
                        slice={slices['volunteer']}
                        isActive={activeTab === 'volunteer'}
                        viewingSliceId={viewingSliceIds['volunteer']}
                        onSelectSlice={handleSelectSlice}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        activePostId={activePostIds['volunteer']}
                        onNavigateToThread={(postId) => {
                          setScrollToLatestMap(prev => ({ ...prev, volunteer: false }))
                          setActivePostIds(prev => ({ ...prev, volunteer: postId }))
                        }}
                        scrollToLatest={scrollToLatestMap['volunteer']}
                        scrollRef={scrollRefs.current['volunteer']}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right column — account + contextual civic-information cards */}
            <div className="hidden md:flex flex-col gap-3 overflow-y-auto contain-paint">
              <SignInPrompt isAuthenticated={isAuthenticated} loginUrl={loginUrl} />
              {isPreviewingLocal && (
                <button
                  type="button"
                  onClick={handleClearAddress}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:underline self-start px-1"
                >
                  Not my address? Change it
                </button>
              )}
              {showFeed && activeSlice && (
                <ActiveNewsSection
                  slice={activeSlice}
                  fallbackName={LEVEL_LABELS[activeTab]}
                  previewGeo={previewGeo}
                />
              )}
              {isAuthenticated && <Sidebar compassData={compassData} repsData={repsData} activeTab={activeTab} />}
            </div>
            </div>
          </div>
        )}
      </main>

      {/* Nav/Resources drawer — mobile and tablet only; desktop keeps the rail pinned in the grid */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-gray-900 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
              <span className="font-semibold text-gray-900 dark:text-white">Menu</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <NavSidebar
                variant="drawer"
                activeTab={activeTab}
                onTabChange={(tab) => {
                  handleTabChange(tab)
                  setMobileNavOpen(false)
                }}
                slices={slices}
                showVolunteerTab={showVolunteerTab}
                isModerator={!!isModerator}
                activePanel={activePanel}
                onTogglePanel={(panel) => {
                  handleTogglePanel(panel)
                  setMobileNavOpen(false)
                }}
                onOpenModQueue={() => {
                  setModQueueOpen(true)
                  setMobileNavOpen(false)
                }}
                theme={theme}
                previewGeo={previewGeo}
              />
            </div>
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
    </AuthGateProvider>
  )
}
