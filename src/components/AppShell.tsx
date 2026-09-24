import { useState, useRef, useEffect, useCallback, createRef } from 'react'
import { useRoute, useLocation } from 'wouter'
import { toast } from 'sonner'
import type React from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAllSlices } from '../hooks/useAllSlices'
import { useEnsureSlices } from '../hooks/useEnsureSlices'
import { useNotificationRouting } from '../hooks/useNotificationRouting'
import { useIsModerator } from '../hooks/useModQueue'
import { useHeroBanner } from '../hooks/useHeroBanner'
import { useJurisdictionName } from '../hooks/useJurisdictionName'
import { useSiblingSlices, type SiblingSlice } from '../hooks/useSiblingSlices'
import { useRepresentatives } from '../hooks/useRepresentatives'
import { useNextElection, useUpcomingElections, electionAreaFor, type NextElection } from '../hooks/useNextElection'
import { useUpcomingMeetings } from '../hooks/useUpcomingMeetings'
import { UpcomingEventsWidget } from './widgets/UpcomingEventsWidget'
import { forecastUrlFor } from '../lib/forecastLink'
import { stateAbbrevFromGeoid } from '../lib/stateAbbrev'
import { geoidToDisplayName } from '../lib/geoidToWiki'
import { usePopulation } from '../hooks/usePopulation'
import { useCurrentWeather } from '../hooks/useCurrentWeather'
import { useTheme } from '../hooks/useTheme'
import SliceTabBar from './SliceTabBar'
import LocationPrompt from './LocationPrompt'
import SliceFeedPanel, { type FeedPanelHandle } from './SliceFeedPanel'
import { FeedTabs, FeedSearch, PostButton, type SortMode } from './FeedTabs'
import { AboutWidget, type AboutFact } from './widgets/AboutWidget'
import { HeroBanner } from './HeroBanner'
import FriendsList from './FriendsList'
import MemberDirectory from './MemberDirectory'
import NotificationBell from './NotificationBell'
import ModeratorQueue from './ModeratorQueue'
import { Sidebar, LocationCard } from './Sidebar'
import { SidebarMobile } from './SidebarMobile'
import NavSidebar from './NavSidebar'
import { ThemeToggle } from './ThemeToggle'
import { ProfileMenu } from './ProfileMenu'
import { SliceSelector } from './SliceSelector'
import type { TabKey, SliceType, SliceInfo } from '../types/database'

/**
 * The location banner for the active slice: hero image, name, member counts, and the
 * civic facts row. The slice switcher is not here — it sits in the feed header
 * (ActiveSliceSelector); both read the same cached useSiblingSlices query.
 *
 * 🔴 Rendered ONLY for the active tab. All six feed panels are mounted at once, so
 * useSiblingSlices inside a panel would fire six times on load — the landmine in
 * CLAUDE.md.
 */
function ActiveHeroBanner({
  slice,
  fallbackName,
  viewingSliceId,
  nextElection,
}: {
  slice: SliceInfo
  fallbackName: string
  /** The shard on screen — the member's own, or a sibling they are browsing read-only. */
  viewingSliceId: string
  nextElection: NextElection | null | undefined
}) {
  const hero = useHeroBanner(slice)
  const displayName = useJurisdictionName(slice, fallbackName)
  const population = usePopulation(slice.sliceType, slice.geoid)
  const weather = useCurrentWeather(slice.sliceType, slice.geoid)
  const { siblings, isLoading, isError } = useSiblingSlices(
    slice.sliceType,
    slice.geoid,
    slice.id,
    slice.siblingIndex,
    slice.memberCount,
  )

  // A DB photo_url is an explicit per-slice override and wins outright. Its
  // provenance is unknown, so it carries no credit — whoever sets one owns the
  // licensing for it. Everything else comes from the hook with a credit attached.
  //
  // The `undefined` case must survive: it means "still resolving", and HeroBanner
  // uses it to hold the gradient rather than flash a fallback photo it will replace.
  const photoUrl = slice.photoUrl ?? (hero === undefined ? undefined : (hero?.url ?? null))
  const credit = slice.photoUrl ? null : (hero?.credit ?? null)

  // Counts come straight from slices.current_member_count (trigger-maintained). The
  // location total is only shown once the siblings query has answered with more than
  // one shard; with one, it would just repeat the slice count.
  const viewing = siblings.find((s) => s.id === viewingSliceId)
  const memberCount = viewing?.memberCount ?? slice.memberCount
  const locationMemberCount = !isLoading && !isError && siblings.length > 1
    ? siblings.reduce((sum, s) => sum + s.memberCount, 0)
    : undefined

  // useJurisdictionName hands back the tab label when it cannot resolve a real name.
  const resolvedName = displayName !== fallbackName ? displayName : null

  return (
    <HeroBanner
      sliceType={slice.sliceType}
      geoid={slice.geoid}
      sliceName={displayName}
      levelLabel={fallbackName}
      memberCount={memberCount}
      locationMemberCount={locationMemberCount}
      population={population}
      weather={weather}
      nextElection={nextElection}
      forecastUrl={forecastUrlFor(slice.sliceType, slice.geoid, resolvedName)}
      photoUrl={photoUrl}
      credit={credit}
    />
  )
}

/**
 * The sibling-slice switcher for one slice, in the feed header.
 *
 * 🔴 Rendered ONLY for the active tab. All six feed panels are mounted at once,
 * so putting useSiblingSlices inside the panel itself would fire it six times on
 * load — the landmine in CLAUDE.md. Gating on isActive keeps it to one, and it
 * shares its cached query with ActiveHeroBanner's.
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

/** The feed search, placeholder "Search Asheville…". Rendered in the header (md+) and the tab bar (phones). */
function ActiveFeedSearch({
  slice,
  fallbackName,
  value,
  onChange,
  className,
}: {
  slice: SliceInfo
  fallbackName: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const name = useJurisdictionName(slice, fallbackName)
  return <FeedSearch value={value} onChange={onChange} placeholder={`Search loaded posts in ${name}…`} className={className} />
}

/**
 * "Showing content for Asheville, NC". The member's most local slice, not the active
 * tab: it names where their spaces come from, which is what "Change" changes.
 */
function ActiveLocationCard({ slice, fallbackName }: { slice: SliceInfo; fallbackName: string }) {
  const name = useJurisdictionName(slice, fallbackName)
  const stateName = geoidToDisplayName('state', slice.geoid.slice(0, 2))
  const abbrev = stateAbbrevFromGeoid(slice.geoid)
  const resolved = name !== fallbackName
  const label = slice.sliceType === 'state' || !resolved
    ? (stateName ?? name)
    : abbrev ? `${name}, ${abbrev}` : name
  return <LocationCard label={label} />
}

/**
 * Upcoming events for the active tab: that area's elections, plus — on a city tab —
 * the city's scheduled public meetings. Both queries are shared with (or as cheap as)
 * the banner's, and this renders once, for the active tab only.
 */
function ActiveEventsWidget({
  slice,
  fallbackName,
  stateSlice,
  userId,
}: {
  slice: SliceInfo
  fallbackName: string
  stateSlice: SliceInfo | undefined
  userId: string | null
}) {
  const name = useJurisdictionName(slice, fallbackName)
  const { elections, isLoading: electionsLoading } = useUpcomingElections(electionAreaFor(slice, stateSlice), userId)
  // The meetings API is keyed by city name + state, so only a city whose name resolved.
  const city = slice.sliceType === 'city' && name !== fallbackName ? name : null
  const { meetings, isLoading: meetingsLoading } = useUpcomingMeetings(city, city ? stateAbbrevFromGeoid(slice.geoid) : null)
  if (slice.sliceType === 'volunteer') return null
  return (
    <UpcomingEventsWidget
      placeName={name}
      elections={elections}
      meetings={meetings}
      isLoading={electionsLoading || meetingsLoading}
    />
  )
}

/**
 * "About {place}" — only facts with a real source: 2020 Census population, and the
 * member's own county and state slices for the parent jurisdictions. No founding year
 * or elevation: nothing in the platform carries them.
 */
function ActiveAboutWidget({
  slice,
  fallbackName,
  countySlice,
}: {
  slice: SliceInfo
  fallbackName: string
  countySlice: SliceInfo | undefined
}) {
  const name = useJurisdictionName(slice, fallbackName)
  const population = usePopulation(slice.sliceType, slice.geoid)
  // Called unconditionally (rules of hooks); only used on a city tab.
  const countyName = useJurisdictionName(countySlice ?? slice, 'County')
  if (slice.sliceType === 'unified' || slice.sliceType === 'volunteer') return null

  const facts: AboutFact[] = []
  if (population !== undefined) facts.push({ label: 'Population', value: population.toLocaleString() })
  if (slice.sliceType === 'city' && countySlice && countyName !== 'County') {
    facts.push({ label: 'County', value: countyName.replace(/ County$/, '') })
  }
  if (slice.sliceType === 'city' || slice.sliceType === 'county') {
    const stateName = geoidToDisplayName('state', slice.geoid.slice(0, 2))
    if (stateName) facts.push({ label: 'State', value: stateName })
  }
  return <AboutWidget placeName={name} facts={facts} />
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

/** A /post link followed while signed out, replayed once the session exists. */
const PENDING_POST_KEY = 'cs_pending_post'

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

const INITIAL_FEED_MODES: Record<TabKey, SortMode> = {
  city: 'new',
  county: 'new',
  state: 'new',
  federal: 'new',
  unified: 'new',
  volunteer: 'new',
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
  const { theme, toggleTheme } = useTheme()

  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('cs_active_tab')
    return (ALL_TAB_KEYS.includes(saved as TabKey) ? saved : 'federal') as TabKey
  })
  const [activePostIds, setActivePostIds] = useState<Record<TabKey, string | null>>(INITIAL_POST_IDS)
  const [scrollToLatestMap, setScrollToLatestMap] = useState<Record<TabKey, boolean>>(INITIAL_SCROLL_MAP)
  const [viewingSlices, setViewingSlices] = useState<Record<TabKey, SiblingSlice | null>>(INITIAL_VIEWING)
  // The tab bar (New/Top) and search live above the panels now, so their state does
  // too: one sort per tab, one search box for whichever tab is showing.
  const [feedModes, setFeedModes] = useState<Record<TabKey, SortMode>>(INITIAL_FEED_MODES)
  const [searchQuery, setSearchQuery] = useState('')
  // Hoisted like repsData, and for the active tab only: the banner is the one consumer.
  const nextElection = useNextElection(electionAreaFor(slices[activeTab], slices['state']), userId)
  const [modQueueOpen, setModQueueOpen] = useState(false)
  // The nav rail is pinned from lg up; below that it lives in this drawer.
  const [navDrawerOpen, setNavDrawerOpen] = useState(false)

  const [, navigate] = useLocation()
  // The post id the route effect has already acted on, so a URL this component
  // pushed itself does not bounce back through openPost.
  const handledRoutePostRef = useRef<string | null>(null)
  const [, postRouteParams] = useRoute('/post/:postId')
  const routePostId = postRouteParams?.postId ?? null

  // Per-tab scroll position preservation (HUB-08).
  //
  // 🔴 THE PAGE SCROLLS, NOT THE PANELS. Each panel used to own an overflow-y-auto box
  // whose scrollTop survived being CSS-hidden. With whole-page scrolling there is one
  // window.scrollY shared by every tab, so it is saved per tab on the way out and put
  // back on the way in — and separately around opening a thread, since the feed it
  // came from is hidden (not unmounted) while the thread shows.
  const scrollPositions = useRef<Record<string, number>>({})
  const feedScrollBeforeThread = useRef<Record<string, number>>({})
  // Zero-height marker just above the sticky tab bar: where "the top of the content" is.
  // The bar itself cannot be measured for this — once stuck, it reports the header's edge.
  const contentTopRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<Record<string, React.RefObject<FeedPanelHandle | null>>>(
    Object.fromEntries(ALL_TAB_KEYS.map((tab) => [tab, createRef<FeedPanelHandle>()]))
  )

  /** Brings the tab bar up under the header if the page is scrolled past it; never scrolls down. */
  const scrollToContentTop = useCallback(() => {
    requestAnimationFrame(() => {
      const marker = contentTopRef.current
      if (!marker) return
      const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      const top = marker.getBoundingClientRect().top + window.scrollY - headerHeight
      if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top) })
    })
  }, [])

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
    scrollToContentTop()
  }, [scrollToContentTop])

  const handleTogglePanel = useCallback((panel: 'friends' | 'directory') => {
    setActivePanel((prev) => (prev === panel ? null : panel))
    setNavDrawerOpen(false)
  }, [])

  const handleTabChange = useCallback((newTab: TabKey) => {
    // Save current tab's scroll position before switching
    scrollPositions.current[activeTab] = window.scrollY
    setSearchQuery('')
    localStorage.setItem('cs_active_tab', newTab)
    setActiveTab(newTab)
    setNavDrawerOpen(false)
  }, [activeTab])

  // One resolver behind both notification clicks and /post/:postId links, so a
  // shared link and a notification land in the same place by the same route.
  const { locatePost } = useNotificationRouting(slices)

  const openPost = useCallback(async (postId: string, scrollToLatest: boolean) => {
    const found = await locatePost(postId)

    if (found.kind === 'unavailable') {
      // One message for not-found, deleted and not-yours alike: saying which
      // it was would tell someone whether a post they cannot read exists.
      toast.error("That conversation isn't in one of your civic spaces")
      navigate('/', { replace: true })
      return
    }

    handleTabChange(found.tab)
    // A sibling shard is readable but not writable, so open the tab pointed at
    // that shard — the feed and thread both go view-only off this.
    setViewingSlices((prev) => ({
      ...prev,
      [found.tab]: found.kind === 'sibling' ? found.sibling : null,
    }))
    setActivePostIds((prev) => ({ ...prev, [found.tab]: postId }))
    setScrollToLatestMap((prev) => ({ ...prev, [found.tab]: scrollToLatest }))
  }, [locatePost, handleTabChange, navigate])

  const handleNotificationNavigate = useCallback(
    (postId: string) => openPost(postId, true),
    [openPost],
  )

  /**
   * Opening or closing a thread moves the URL with it, so a thread can be
   * shared, bookmarked, and closed with the browser's back button.
   */
  const handleNavigateToThread = useCallback((tab: TabKey, postId: string | null) => {
    setScrollToLatestMap((prev) => ({ ...prev, [tab]: false }))
    if (postId) {
      // Opening: remember where the feed was, then show the thread from its top.
      feedScrollBeforeThread.current[tab] = window.scrollY
      scrollToContentTop()
    } else {
      // Closing: the feed comes back exactly where it was left.
      const saved = feedScrollBeforeThread.current[tab] ?? 0
      requestAnimationFrame(() => window.scrollTo({ top: saved }))
    }
    setActivePostIds((prev) => ({ ...prev, [tab]: postId }))
    // Record it as already handled: the route effect below would otherwise see
    // the URL we just pushed and re-resolve a thread that is already open.
    handledRoutePostRef.current = postId
    navigate(postId ? `/post/${postId}` : '/')
  }, [navigate, scrollToContentTop])

  /**
   * A /post/:postId link. Held until the member's slices have loaded, because
   * resolving a post means matching its slice against theirs.
   */
  useEffect(() => {
    if (!routePostId) {
      handledRoutePostRef.current = null
      return
    }
    if (handledRoutePostRef.current === routePostId) return
    if (!isAuthenticated || isLoading || !hasAnySlices) return
    handledRoutePostRef.current = routePostId
    void openPost(routePostId, false)
  }, [routePostId, isAuthenticated, isLoading, hasAnySlices, openPost])

  /**
   * A signed-out visitor following a link: remember the post across login.
   *
   * The accounts hub is sent a fixed `redirect` back to this app's origin, so
   * the path does not survive the round trip. Stashing it here keeps the link
   * working without changing LOGIN_URL — whether that hub accepts an arbitrary
   * path is its policy, and a rejected redirect would break login itself.
   */
  useEffect(() => {
    if (authLoading || isAuthenticated || !routePostId) return
    try {
      localStorage.setItem(PENDING_POST_KEY, routePostId)
    } catch {
      // Storage blocked — the link simply will not survive login.
    }
  }, [authLoading, isAuthenticated, routePostId])

  useEffect(() => {
    if (!isAuthenticated || isLoading || !hasAnySlices || routePostId) return
    let pending: string | null = null
    try {
      pending = localStorage.getItem(PENDING_POST_KEY)
      if (pending) localStorage.removeItem(PENDING_POST_KEY)
    } catch {
      return
    }
    if (pending) {
      handledRoutePostRef.current = pending
      void openPost(pending, false)
      navigate(`/post/${pending}`, { replace: true })
    }
  }, [isAuthenticated, isLoading, hasAnySlices, routePostId, openPost, navigate])

  // Restore scroll position after the new tab becomes visible
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositions.current[activeTab] ?? 0 })
    })
  }, [activeTab])

  const activeSlice = slices[activeTab]
  const activeViewing = viewingSlices[activeTab]
  const activeIsViewOnly = !!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id
  const activeMode = feedModes[activeTab]
  const showFeed = isAuthenticated && !isLoading && !isAssigning && (hasJurisdiction || !!slices['unified'])
  // "Showing content for …" names the member's most local space.
  const homeSlice = slices['city'] ?? slices['county'] ?? slices['state']

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header — sticky, with fixed heights (h-16 / md:h-20) that the tab bar's and
          rail's sticky offsets below are measured against. Change them together. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 h-16 md:h-20 px-4 md:px-8 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
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
          <a href="https://empowered.vote" className="hidden sm:flex flex-shrink-0 items-center">
            <img
              src={theme === 'dark' ? '/images/ev-logo-dark-bg.png' : '/images/ev-logo.png'}
              alt="Empowered Vote"
              className="h-9 w-auto"
            />
          </a>
          <div className="hidden sm:block w-px h-7 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
          <h1 className="text-lg font-extrabold tracking-tight whitespace-nowrap">
            <span className="text-brand dark:text-brand-light">Civic</span>{' '}
            <span className="text-brand-coral-text dark:text-brand-coral">Spaces</span>
          </h1>
        </div>

        {/* Feed search, centred (md+). Phones get the same field in the tab bar. */}
        {showFeed && activeSlice && (
          <ActiveFeedSearch
            slice={activeSlice}
            fallbackName={TAB_LABELS[activeTab]}
            value={searchQuery}
            onChange={setSearchQuery}
            className="hidden md:block flex-1 max-w-md"
          />
        )}

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

            {/* Friends icon — below lg only; the pinned rail carries it from lg up */}
            <button
              onClick={() => setActivePanel(activePanel === 'friends' ? null : 'friends')}
              aria-label="Friends"
              className={`lg:hidden w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                activePanel === 'friends'
                  ? 'bg-brand-muted text-brand'
                  : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
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

            {/* Directory icon — below lg only, like Friends */}
            <button
              onClick={() => setActivePanel(activePanel === 'directory' ? null : 'directory')}
              aria-label="Member Directory"
              className={`lg:hidden w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                activePanel === 'directory'
                  ? 'bg-brand-muted text-brand'
                  : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
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
      <main className="flex flex-col flex-1 bg-gray-50 dark:bg-gray-950">
        {authLoading && (
          <div className="flex flex-1 items-center justify-center text-gray-500 text-sm">
            Loading&hellip;
          </div>
        )}

        {!authLoading && !isAuthenticated && (
          <div className="flex flex-col flex-1 items-center justify-center gap-4">
            <p className="text-gray-600 text-sm">Log in to view your civic community.</p>
            <a
              href={loginUrl}
              className="px-5 py-2 bg-brand-btn text-white text-sm font-medium rounded-full hover:bg-brand-hover transition-colors"
            >
              Log in with Empowered Vote
            </a>
          </div>
        )}

        {isAuthenticated && isLoading && (
          <div className="flex flex-1 items-center justify-center text-gray-500 text-sm">
            Loading your slices&hellip;
          </div>
        )}

        {isAuthenticated && !isLoading && isAssigning && (
          <div className="flex flex-1 items-center justify-center text-gray-500 dark:text-gray-500 text-sm">
            Setting up your civic spaces&hellip;
          </div>
        )}

        {isAuthenticated && !isLoading && !isAssigning && !hasJurisdiction && !slices['unified'] && (
          <LocationPrompt />
        )}

        {showFeed && (
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

            {/* Nav rail + content. The whole page scrolls; the rail is pinned from lg up. */}
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3 md:gap-4 p-3 md:p-4 items-start">
              {/* Sticky under the header (5rem + the 1rem page padding), scrolling on its
                  own when it is taller than the window. */}
              <div className="hidden lg:block sticky top-24 h-[calc(100vh-7rem)]">
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
              </div>

              <div className="min-w-0 flex flex-col gap-3 md:gap-4">
                {/* Banner — scrolls away with the page */}
                {activeSlice && (
                  <div className="rounded-2xl border border-gray-200/60 dark:border-white/[0.06] shadow-sm">
                    <ActiveHeroBanner
                      slice={activeSlice}
                      fallbackName={TAB_LABELS[activeTab]}
                      viewingSliceId={activeViewing?.id ?? activeSlice.id}
                      nextElection={nextElection}
                    />
                  </div>
                )}

                {/* The negative margin cancels the column gap: the marker is only a position. */}
                <div ref={contentTopRef} className="-mt-3 md:-mt-4" aria-hidden="true" />

                {/* Tab bar — sticks under the header. Slice pill, feed views, Post. */}
                <div className="sticky top-16 md:top-20 z-30 -my-1 py-2 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm">
                  {/* Phones: pill + swipeable tabs on one row, search below, so the stuck bar
                      stays two rows tall. Only the tabs scroll sideways — the pill stays
                      outside the scroller, which would otherwise clip its dropdown menu. */}
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
                    {activeSlice && FEED_TABS.includes(activeTab as (typeof FEED_TABS)[number]) && (
                      <ActiveSliceSelector
                        slice={activeSlice}
                        fallbackName={TAB_LABELS[activeTab]}
                        viewingSliceId={activeViewing?.id ?? activeSlice.id}
                        onSelect={(sib) => handleViewSlice(activeTab, sib, activeSlice.id)}
                      />
                    )}
                    <div className="flex-1 min-w-0 overflow-x-auto md:overflow-visible">
                    <FeedTabs
                      mode={activeMode}
                      onChange={(mode) => {
                        setFeedModes((prev) => ({ ...prev, [activeTab]: mode }))
                        scrollToContentTop()
                      }}
                    />
                    </div>
                    {/* Hidden, not disabled, while view-only: RLS rejects an insert into a
                        slice the member is not in (CLAUDE.md). Phones keep the FAB. */}
                    {!activeIsViewOnly && (
                      <div className="ml-auto hidden md:block">
                        <PostButton onClick={() => panelRefs.current[activeTab]?.current?.compose()} />
                      </div>
                    )}
                    {activeSlice && (
                      <ActiveFeedSearch
                        slice={activeSlice}
                        fallbackName={TAB_LABELS[activeTab]}
                        value={searchQuery}
                        onChange={setSearchQuery}
                        className="md:hidden w-full"
                      />
                    )}
                  </div>
                </div>

                <div className={`grid ${contentGridCols} gap-3 md:gap-4 items-start`}>
                  {/* Feed column */}
                  <div className="relative min-w-0 flex flex-col gap-3">
                    <SidebarMobile
                      repsData={repsData}
                      activeTab={activeTab}
                      location={homeSlice && (
                        <ActiveLocationCard slice={homeSlice} fallbackName={TAB_LABELS[homeSlice.sliceType]} />
                      )}
                      events={activeSlice && (
                        <ActiveEventsWidget slice={activeSlice} fallbackName={TAB_LABELS[activeTab]} stateSlice={slices['state']} userId={userId} />
                      )}
                      about={activeSlice && (
                        <ActiveAboutWidget slice={activeSlice} fallbackName={TAB_LABELS[activeTab]} countySlice={slices['county']} />
                      )}
                    />

                    {/* All FEED_TABS feeds mounted simultaneously — CSS hidden preserves the
                        React Query cache; AppShell restores each tab's scroll position. */}
                    {FEED_TABS.map((tabKey) => {
                      const slice = slices[tabKey]
                      if (!slice) return null
                      const isShown = activeTab === tabKey
                      const viewing = viewingSlices[tabKey]
                      const isViewOnly = !!viewing && viewing.id !== slice.id
                      const mode = feedModes[tabKey]
                      return (
                        <div key={tabKey} className={isShown ? 'flex flex-col' : 'hidden'}>
                          <SliceFeedPanel
                            sliceId={viewing?.id ?? slice.id}
                            isViewOnly={isViewOnly}
                            viewingSliceIndex={viewing?.siblingIndex}
                            ownSliceIndex={slice.siblingIndex}
                            onReturnToOwnSlice={() =>
                              handleViewSlice(tabKey, { id: slice.id, siblingIndex: slice.siblingIndex, memberCount: slice.memberCount }, slice.id)
                            }
                            activePostId={activePostIds[tabKey]}
                            onNavigateToThread={(postId) => handleNavigateToThread(tabKey, postId)}
                            scrollToLatest={scrollToLatestMap[tabKey]}
                            sort={mode}
                            searchQuery={activeTab === tabKey ? searchQuery : ''}
                            panelRef={panelRefs.current[tabKey]}
                          />
                        </div>
                      )
                    })}

                    {/* Volunteer feed — conditionally rendered for users with volunteer slice */}
                    {showVolunteerTab && slices['volunteer'] && (
                      <div className={activeTab === 'volunteer' ? 'flex flex-col' : 'hidden'}>
                        <SliceFeedPanel
                          sliceId={slices['volunteer'].id}
                          activePostId={activePostIds['volunteer']}
                          onNavigateToThread={(postId) => handleNavigateToThread('volunteer', postId)}
                          scrollToLatest={scrollToLatestMap['volunteer']}
                          sort={feedModes['volunteer']}
                          searchQuery={activeTab === 'volunteer' ? searchQuery : ''}
                          panelRef={panelRefs.current['volunteer']}
                        />
                      </div>
                    )}
                  </div>

                  {/* Sidebar column — hidden below md, and on Volunteer entirely. It scrolls
                      with the page. `relative` makes it the containing block for absolute
                      descendants, so nothing inside can resolve against the viewport. */}
                  <div className={`${activeTab === 'volunteer' ? 'hidden' : 'hidden md:flex'} relative min-w-0 flex-col`}>
                    <Sidebar
                      repsData={repsData}
                      activeTab={activeTab}
                      location={homeSlice && (
                        <ActiveLocationCard slice={homeSlice} fallbackName={TAB_LABELS[homeSlice.sliceType]} />
                      )}
                      events={activeSlice && (
                        <ActiveEventsWidget slice={activeSlice} fallbackName={TAB_LABELS[activeTab]} stateSlice={slices['state']} userId={userId} />
                      )}
                      about={activeSlice && (
                        <ActiveAboutWidget slice={activeSlice} fallbackName={TAB_LABELS[activeTab]} countySlice={slices['county']} />
                      )}
                    />
                  </div>
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
