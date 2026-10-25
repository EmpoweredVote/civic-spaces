import { useState, useRef, useEffect, useCallback, useMemo, createRef } from 'react'
import { useRoute, useLocation } from 'wouter'
import { toast } from 'sonner'
import type React from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSyntheticUserId } from '../lib/devMockData'
import { useAllSlices } from '../hooks/useAllSlices'
import { useEnsureSlices } from '../hooks/useEnsureSlices'
import { useNotificationRouting } from '../hooks/useNotificationRouting'
import { useIsModerator } from '../hooks/useModQueue'
import { useHeroBanner } from '../hooks/useHeroBanner'
import { useJurisdictionName } from '../hooks/useJurisdictionName'
import { useSiblingSlices, type SiblingSlice } from '../hooks/useSiblingSlices'
import { useRepresentatives } from '../hooks/useRepresentatives'
import { useCompassData } from '../hooks/useCompassData'
import { useNextElection, useUpcomingElections, useRacesForArea, electionAreaFor, type NextElection } from '../hooks/useNextElection'
import { useRaceMedia } from '../hooks/useRaceMedia'
import { joinMediaToRaces } from '../lib/raceMedia'
import { racesForLevel } from '../lib/races'
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
import { FeedTabs, FeedSearch, PostButton, ForumViewTabs, FORUM_VIEW_PANEL_ID, type SortMode, type ForumView } from './FeedTabs'
import { ExploreView } from './explore/ExploreView'
import { WhatsNewCard } from './explore/WhatsNewCard'
import { readDrafts, writeDraft, writeResume, type ExploreDraft } from './explore/exploreStorage'
import { canPostDraft, parseDraftKey, racesAreaFor, type CompassLevelFlags } from '../lib/exploreComposition'
import { AboutWidget, type AboutFact } from './widgets/AboutWidget'
import { HeroBanner } from './HeroBanner'
import FriendsList from './FriendsList'
import MemberDirectory from './MemberDirectory'
import NotificationBell from './NotificationBell'
import ModeratorQueue from './ModeratorQueue'
import { Sidebar, LocationCard } from './Sidebar'
import { SidebarMobile } from './SidebarMobile'
import NavSidebar from './NavSidebar'
import { PanelToggle, usePersistedCollapse } from './PanelToggle'
import { ThemeToggle } from './ThemeToggle'
import { ProfileMenu } from './ProfileMenu'
import { SliceSelector } from './SliceSelector'
import { CivicSpacesMark } from './CivicSpacesMark'
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
  isSampleData,
}: {
  slice: SliceInfo
  fallbackName: string
  /** The shard on screen — the member's own, or a sibling they are browsing read-only. */
  viewingSliceId: string
  nextElection: NextElection | null | undefined
  /** Passed down, not read here: useAuth is not a context, so a second call would be a
      second session poll that can redirect to login. AppShell already holds the id. */
  isSampleData: boolean
}) {
  const hero = useHeroBanner(slice)
  const displayName = useJurisdictionName(slice, fallbackName)
  const population = usePopulation(slice.sliceType, slice.geoid)
  const weather = useCurrentWeather(slice.sliceType, slice.geoid)
  const { siblings } = useSiblingSlices(
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

  // Counts come straight from slices.current_member_count (trigger-maintained). Only
  // the shard on screen: a jurisdiction-wide total read as an unexplained second count
  // ("23 across United States of America") and was dropped from the banner.
  const viewing = siblings.find((s) => s.id === viewingSliceId)
  const memberCount = viewing?.memberCount ?? slice.memberCount

  // useJurisdictionName hands back the tab label when it cannot resolve a real name.
  const resolvedName = displayName !== fallbackName ? displayName : null

  return (
    <HeroBanner
      sliceType={slice.sliceType}
      geoid={slice.geoid}
      sliceName={displayName}
      levelLabel={fallbackName}
      memberCount={memberCount}
      population={population}
      isSampleData={isSampleData}
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

/**
 * Preference order for the photo the featured card borrows. Place slices only — Unified
 * is not a place and has no banner of its own.
 */
const PHOTO_SLICE_ORDER: SliceType[] = ['city', 'county', 'state', 'federal']

/**
 * The featured card borrows a credited place photo, but never the one `HeroBanner` is
 * already showing directly above it — that is always `slices[activeTab]`.
 *
 * Returns null when the member has no other place slice to borrow from, and the card
 * falls back to the drawn street. The first branch is a leftover from when the caller
 * passed the member's HOME slice, which could differ from the tab; now that Explore
 * follows the tab, `currentSlice.sliceType === activeTab` always, so it never fires and
 * the loop does the work — which is the behaviour wanted either way.
 */
function photoSliceFor(
  slices: Partial<Record<SliceType, SliceInfo>>,
  currentSlice: SliceInfo,
  activeTab: TabKey,
): SliceInfo | null {
  if (currentSlice.sliceType !== activeTab) return currentSlice
  for (const key of PHOTO_SLICE_ORDER) {
    const candidate = slices[key]
    if (candidate && candidate.sliceType !== activeTab) return candidate
  }
  return null
}

/**
 * Explore, bound to the ACTIVE TAB — the State tab shows State's Explore, and a topic
 * opened there starts its conversation in the State community. Rendered once (not per
 * panel), so its name and meetings lookups run once and share the sidebar's cache.
 *
 * It used to bind to homeSlice, the member's most local space, which pinned every draft
 * to one community. That pinning was deliberate — a draft must not land in whichever
 * shard happens to be showing — and it is preserved by the draft KEY instead: a draft is
 * `(sliceType, geoid, topicId)` and canPostDraft() re-checks it at post time.
 */
function ActiveExplore({
  activeSlice,
  slices,
  photoSlice,
  stateSlice,
  userId,
  answeredCompassTopicIds,
  compassLevelFlags,
  isViewOnly,
  viewingSliceIndex,
  onReturnToOwnSlice,
  onStartConversation,
  onScrollTop,
  onGoToView,
  whatsNewInSidebar,
}: {
  /** The slice for the tab being shown. Explore follows the tab, not the home slice. */
  activeSlice: SliceInfo
  /** Every slice the member holds — canPostDraft checks a stored draft key against it. */
  slices: Partial<Record<SliceType, SliceInfo>>
  /** Whose banner photo the featured card borrows, or null to use the illustration instead. */
  photoSlice: SliceInfo | null
  stateSlice: SliceInfo | undefined
  userId: string | null
  /**
   * The VIEWING MEMBER's own answered Compass topics, and the catalog's level
   * flags. Both are resolved once in AppShell (useCompassData is hoisted there
   * for the same six-panels reason as useRepresentatives) and passed down.
   *
   * 🔴 Nothing aggregates. Locked decision 7: Compass ranks this member's
   * Explore topics against this member's own answers. No slice-wide view of
   * members' political answers is computed, stored or requested anywhere.
   */
  answeredCompassTopicIds: ReadonlySet<string>
  compassLevelFlags: ReadonlyMap<string, CompassLevelFlags>
  /**
   * 🔴 `activeIsViewOnly`, computed once in AppShell and handed to the feed too.
   * Not recomputed here: the feed and Explore disagreeing about the same shard is
   * how half a gate ships.
   */
  isViewOnly: boolean
  /** The sibling on screen. The member's own index comes off activeSlice. */
  viewingSliceIndex: number | undefined
  onReturnToOwnSlice: () => void
  onStartConversation: (key: string, draft: ExploreDraft, destinationName: string | null) => void
  onScrollTop: () => void
  onGoToView: (view: ForumView) => void
  /** False while the right sidebar is collapsed, so "What's new" shows inline instead. */
  whatsNewInSidebar: boolean
}) {
  const label = TAB_LABELS[activeSlice.sliceType]
  const name = useJurisdictionName(activeSlice, label)
  // Meetings are a city API and nothing else: only a resolved city name is a query it
  // accepts, so every other tab passes null and the agenda module simply has no source.
  const city = activeSlice.sliceType === 'city' && name !== label ? name : null
  const cityState = city ? stateAbbrevFromGeoid(activeSlice.geoid) : null
  const { meetings } = useUpcomingMeetings(city, cityState)
  // Same query (and cache) the events widget uses — the area's real election calendar.
  // 🔴 electionAreaFor, which DOES fall back to the state, and is right for "when is the
  // next election". "Which races are mine" is racesAreaFor and lands in 16-07. Never merge.
  const { elections } = useUpcomingElections(electionAreaFor(activeSlice, stateSlice), userId)
  /**
   * 🔴 racesAreaFor, NOT electionAreaFor — the member's most LOCAL area.
   *
   * The line above is right for "when is the next election" and wrong for
   * "which races are mine": a state-area query returns all nine of Indiana's US
   * House districts where the member has one, AND omits the statewide races
   * (North Carolina's state area has no US Senate race, California's has no
   * Governor). Federal geoid 'US' returns HTTP 500. racesAreaFor answers null
   * for a member with neither a city nor a county slice, and the reserved room
   * shows — which is the honest answer, because nine races a member cannot
   * choose between is worse than none.
   *
   * On City this is the same (geoid, mtfcc) the banner already asked about, so
   * React Query serves it from cache. On Federal and State it is ONE extra
   * request per member, deliberately, and it is the whole correctness fix.
   */
  const { elections: raceElections } = useRacesForArea(racesAreaFor(slices), userId)
  const races = useMemo(
    () => ({
      federal: racesForLevel(raceElections, 'federal'),
      state: racesForLevel(raceElections, 'state'),
    }),
    [raceElections],
  )
  /**
   * One /api/meetings fetch for the whole published list, joined locally. The
   * per-race route would be one request per race. Not requested at all until
   * there is a race to join against.
   */
  const hasRaces = races.federal.length > 0 || races.state.length > 0
  const { media } = useRaceMedia(hasRaces)
  const raceMedia = useMemo(
    () => joinMediaToRaces(media, [...races.federal, ...races.state]),
    [media, races],
  )
  // Same hook and shared-bucket credits as the hero banner. A photo without a credit has
  // unknown provenance (a DB override, or nothing resolved), so it is not reused here.
  // Hooks cannot be conditional, so they always run against a real slice; the result is
  // only used when photoSlice says there is a photo worth borrowing.
  const photoSource = photoSlice ?? activeSlice
  const hero = useHeroBanner(photoSource)
  const photoName = useJurisdictionName(photoSource, TAB_LABELS[photoSource.sliceType])
  const featuredPhoto = photoSlice && hero?.url && hero.credit && !photoSlice.photoUrl
    ? { url: hero.url, credit: hero.credit, alt: `${photoName}` }
    : null
  // Where a topic opened on THIS tab starts its conversation. The draft key carries the
  // same (sliceType, geoid), and AppShell re-checks it with canPostDraft before posting.
  const destination = useMemo(
    () => ({ sliceId: activeSlice.id, tab: activeSlice.sliceType, name }),
    [activeSlice.id, activeSlice.sliceType, name],
  )
  return (
    <ExploreView
      sliceType={activeSlice.sliceType}
      geoid={activeSlice.geoid}
      /* 🔴 The SAME two values the meetings query above uses, not a second
         lookup: the agenda and the calendar must never disagree about which
         city this tab is. Fetch by name — the meetings API accepts nothing else
         — and attach by the geoid beside it, which resolveComposition rechecks. */
      city={city}
      stateAbbrev={cityState}
      destination={destination}
      isAuthenticated
      isViewOnly={isViewOnly}
      viewingSliceIndex={viewingSliceIndex}
      ownSliceIndex={activeSlice.siblingIndex}
      onReturnToOwnSlice={onReturnToOwnSlice}
      slices={slices}
      meetings={meetings}
      elections={elections}
      races={races}
      raceMedia={raceMedia}
      answeredCompassTopicIds={answeredCompassTopicIds}
      compassLevelFlags={compassLevelFlags}
      onStartConversation={onStartConversation}
      onScrollTop={onScrollTop}
      whatsNewInSidebar={whatsNewInSidebar}
      featuredPhoto={featuredPhoto}
      onGoToView={onGoToView}
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
  /**
   * Hoisted for the same reason as repsData: all five feed panels plus
   * Volunteer mount at once, so a hook inside one of them fires 6×.
   *
   * 🔴 Explore is its FIRST consumer. The hook shipped complete and uncalled —
   * its own header already said where it belongs — so "Compass ranks topics"
   * had no running consumer at all until this call. It 401s for the dev id,
   * which is handled inside the hook: a synthetic id short-circuits to the
   * fixtures rather than making either request.
   */
  const compass = useCompassData(userId)
  /**
   * 🔴 Exclusion only, never selection. 45 of the 60 live Compass topics are
   * flagged for all three levels ("Ukraine Support" among them), so these flags
   * cannot pick out "what federal leaders attend to"; what they CAN do is keep
   * a local-only topic off Federal, which is the job levelFilterReason gives
   * them. A topic whose flags are absent is left in the map's hands as a miss,
   * and a miss passes the filter — refusing to show a topic because a side
   * lookup failed is worse than showing it.
   */
  const compassLevelFlags = useMemo(() => {
    const flags = new Map<string, CompassLevelFlags>()
    for (const topic of compass.topics) {
      if (
        typeof topic.applies_federal !== 'boolean' &&
        typeof topic.applies_state !== 'boolean' &&
        typeof topic.applies_local !== 'boolean'
      ) {
        continue
      }
      flags.set(topic.id, {
        federal: !!topic.applies_federal,
        state: !!topic.applies_state,
        local: !!topic.applies_local,
      })
    }
    return flags
  }, [compass.topics])
  const { theme, toggleTheme } = useTheme()

  // Both side panels collapse, each remembered per browser: the nav rail to icons
  // (lg up, where it is pinned), the right sidebar out of the grid (md up).
  const [navCollapsed, toggleNavCollapsed] = usePersistedCollapse('cs_nav_collapsed')
  const [sidebarCollapsed, toggleSidebarCollapsed] = usePersistedCollapse('cs_sidebar_collapsed')

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
  // Explore is the default for a plain visit — deliberately not persisted. A /post link,
  // a notification, or a draft being posted switches to Conversations.
  const [forumView, setForumView] = useState<ForumView>('explore')
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

  // Header + stuck tab bar, as --cs-sticky-offset: where content that sticks inside the
  // feed column (ThreadView's topic header) has to stop. The tab bar wraps to two rows
  // below md, so this is measured rather than hardcoded. A callback ref, because the bar
  // only mounts once the feed does.
  const tabBarRef = useCallback((bar: HTMLDivElement | null) => {
    const header = document.querySelector('header')
    if (!bar || !header) return
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--cs-sticky-offset', `${header.offsetHeight + bar.offsetHeight}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    observer.observe(header)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--cs-sticky-offset')
    }
  }, [])

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

  // The right sidebar is hidden entirely on Volunteer, and when the member collapses
  // it, so the content grid drops to a single column then — otherwise its track
  // survives as dead space to the right of the feed.
  //
  // Otherwise its width follows the space there is rather than the breakpoint: 26% of
  // the content grid, held between 17rem (the narrowest the widgets read well at — the
  // location line still fits on one row) and 20rem. That is the floor on tablets and
  // small laptops and reaches the cap only around 1440px, so the feed gets the rest —
  // and collapsing the nav rail widens both together. The percentage resolves against
  // the grid container, not the viewport.
  const showSidebar = activeTab !== 'volunteer' && !sidebarCollapsed
  const contentGridCols = showSidebar
    ? 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_clamp(17rem,26%,20rem)]'
    : 'grid-cols-1'

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
    setForumView('conversations')
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

  const handleForumViewChange = useCallback((view: ForumView) => {
    setForumView(view)
    scrollToContentTop()
  }, [scrollToContentTop])

  /**
   * The shard on screen for the active tab, and whether it is a SIBLING of the
   * member's own — readable by RLS, every write path closed by it.
   *
   * 🔴 Declared here, above handleStartConversation, rather than beside the other
   * derived render values below: that callback needs it in its dependency array,
   * and a block-scoped const cannot be named before it is declared. The feed reads
   * this same value (see the FEED_TABS map), so the two cannot disagree.
   */
  const activeSlice = slices[activeTab]
  const activeViewing = viewingSlices[activeTab]
  const activeIsViewOnly = !!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id

  /**
   * Explore → Conversations with a topic's draft in the composer.
   *
   * 🔴 The draft KEY names the jurisdiction, and that — not the tab on screen — decides
   * where it posts: a draft started for Bloomington must not land in whichever community
   * happens to be showing, or in a new one after the member moves. The check is
   * `canPostDraft`, the pure guard, and not a comparison written out again here: a copy
   * inside this callback could not be reached by scripts/check-composition.mjs, and
   * "a post must not land in the wrong jurisdiction" is the phase's loudest anti-goal.
   *
   * A signed-out visitor is sent through the real sign-in; ExploreView replays this
   * after they return, from a resume marker carrying the whole key.
   */
  const handleStartConversation = useCallback((key: string, draft: ExploreDraft, destinationName: string | null) => {
    /**
     * 🔴 Defence in depth, at the far end of all three composer paths. Explore must
     * not OFFER this while view-only (16-CONTEXT locked decision 4) and RLS would
     * reject the insert anyway; a stale closure, or a future reordering of the route
     * and resume effects, must not be the one path that gets through.
     *
     * The reset below (setViewingSlices → null) stays as the backstop behind this,
     * and it is what makes the deep-link race harmless today: even if a resume fired
     * while view-only, the composer would open on the member's OWN shard. This
     * refusal is what stops it being asked to in the first place. Never delete one
     * and keep the other — assertion 10 of check:explore-gate watches the pair.
     */
    if (activeIsViewOnly) return
    if (!isAuthenticated) {
      const parsed = parseDraftKey(key)
      if (parsed) writeResume({ ...parsed, at: Date.now() })
      window.location.assign(loginUrl)
      return
    }
    // Explore hands the draft over directly rather than us reading it back: in a private
    // window the write is refused silently, and reading back undefined used to surface as
    // "you're not in that community", which is wrong on both counts and loses the text.
    const verdict = canPostDraft(key, slices)
    if (!verdict.ok) {
      toast.error(verdict.reason === 'moved'
        ? 'That draft was written for a different place.'
        : "That draft belongs to a community you're not in now.")
      return
    }
    const tab = verdict.sliceType as TabKey
    if (tab !== activeTab) handleTabChange(tab)
    // Back to the member's own shard: a sibling is read-only, and the composer is hidden there.
    setViewingSlices((prev) => ({ ...prev, [tab]: null }))
    // The open thread belongs to the shard being left. Leaving it open would render a
    // sibling's post with isViewOnly cleared, offering a reply RLS can only reject.
    if (activePostIds[tab]) {
      setActivePostIds((prev) => ({ ...prev, [tab]: null }))
      // The URL closes with it, so a reload does not reopen the thread either.
      navigate('/')
    }
    setForumView('conversations')
    scrollToContentTop()
    // The name Explore already resolved for this key's slice, so the note says
    // "Bloomington, your City community" rather than just "your City community".
    const place = destinationName && destinationName !== TAB_LABELS[tab] ? destinationName : null
    panelRefs.current[tab]?.current?.compose({
      title: draft.title,
      body: draft.body,
      contextNote: `Posting to ${place ? `${place}, your` : 'your'} ${TAB_LABELS[tab]} community. Edit anything before you post.`,
      onPosted: () => writeDraft(key, null),
      onDraftChange: (values) => {
        const current = readDrafts()[key]
        if (current) writeDraft(key, { ...current, ...values, updatedAt: Date.now() })
      },
    })
  }, [isAuthenticated, loginUrl, slices, activeTab, activePostIds, handleTabChange, scrollToContentTop, navigate, activeIsViewOnly])

  // Restore scroll position after the new tab becomes visible
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositions.current[activeTab] ?? 0 })
    })
  }, [activeTab])

  const activeMode = feedModes[activeTab]
  const showFeed = isAuthenticated && !isLoading && !isAssigning && (hasJurisdiction || !!slices['unified'])
  // "Showing content for …" names the member's most local space.
  const homeSlice = slices['city'] ?? slices['county'] ?? slices['state']
  // Volunteer is its own space, not a place — it keeps the forum alone, no Explore.
  const hasExplore = activeTab !== 'volunteer'
  const effectiveView: ForumView = hasExplore ? forumView : 'conversations'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header — sticky, with fixed heights (h-16 / md:h-20) that the tab bar's and
          rail's sticky offsets below are measured against. Change them together. */}
      {/* Phones: one row, menu + brand left, controls right. md+: a three-column grid —
          Empowered Vote left, Civic Spaces centred, controls right. The two outer tracks
          are equal (1fr each), so the centre is the true centre of the bar, and grid
          tracks cannot overlap, so the brand can never sit on top of a control. */}
      <header className="sticky top-0 z-40 flex md:grid md:grid-cols-[1fr_auto_1fr] items-center justify-between gap-3 md:gap-6 h-16 md:h-20 px-4 md:px-8 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
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
          {/* Divider only while the brand sits beside the EV logo (sm to md). */}
          <div className="hidden sm:block md:hidden w-px h-7 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
        </div>

        {/* This app's mark — the same pin/chat-bubble symbol the nav rail uses for it.
            Below 430px the wordmark cannot fit beside the menu and every control (~424px
            needed), so phones that narrow show the mark alone; the name stays in the
            accessible text, and the logo is never truncated or drawn over the bell. */}
        <h1 className="flex flex-1 md:flex-none items-center gap-2 min-w-0 md:justify-center text-lg md:text-xl font-extrabold tracking-tight whitespace-nowrap">
          <CivicSpacesMark className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0" />
          <span className="sr-only min-[430px]:not-sr-only">
            <span className="text-brand dark:text-brand-light">Civic</span>{' '}
            <span className="text-brand-coral-text dark:text-brand-coral">Spaces</span>
          </span>
        </h1>

        {/* Theme and account are always reachable; the social icons need a session. */}
        <div className="flex items-center justify-end gap-0.5 sm:gap-2 flex-shrink-0">
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
          <div className="flex flex-col flex-1 items-center gap-6 px-3 py-8 md:py-12">
            <div className="flex flex-col items-center gap-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm">Log in to view your civic community.</p>
              <a
                href={loginUrl}
                className="px-5 py-2 bg-brand-btn text-white text-sm font-medium rounded-full hover:bg-brand-hover transition-colors"
              >
                Log in with Empowered Vote
              </a>
            </div>
            {/* Explore works signed out: browsing and drafting need no account. Posting
                goes through the real sign-in above, and the draft survives the trip. */}
            <div className="w-full max-w-3xl">
              {/* A stranger gets the place-scale generic composition, not the stored
                  cs_active_tab: there is no tab UI on this screen, and the city page is
                  the most legible thing to someone who has not signed in (16-CONTEXT,
                  "Settled after research" item 3). geoid null means no bespoke layer and
                  no seed invitation — nobody can seed a place the app cannot name. */}
              <ExploreView
                sliceType="city"
                geoid={null}
                destination={null}
                isAuthenticated={false}
                /* A stranger is on nobody's sibling shard — there is no membership to
                   be a sibling OF. Stated rather than defaulted: see the prop's doc. */
                isViewOnly={false}
                /* A stranger has answered nothing, so rankByCompass keeps source
                   order; the level flags still exclude, which needs no account. */
                answeredCompassTopicIds={compass.answeredTopicIds}
                compassLevelFlags={compassLevelFlags}
                onStartConversation={handleStartConversation}
              />
            </div>
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
            <div
              className={`grid grid-cols-1 ${navCollapsed ? 'lg:grid-cols-[4rem_minmax(0,1fr)]' : 'lg:grid-cols-[240px_minmax(0,1fr)]'} gap-3 md:gap-4 p-3 md:p-4 items-start`}
            >
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
                  collapsed={navCollapsed}
                  onToggleCollapsed={toggleNavCollapsed}
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
                      isSampleData={isSyntheticUserId(userId)}
                    />
                  </div>
                )}

                {/* The negative margin cancels the column gap: the marker is only a position. */}
                <div ref={contentTopRef} className="-mt-3 md:-mt-4" aria-hidden="true" />

                {/* Tab bar — sticks under the header. Explore / Conversations first; the
                    forum's own controls (slice pill, sort, search, Post) only in Conversations. */}
                <div ref={tabBarRef} className="sticky top-16 md:top-20 z-30 -my-1 py-2 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm">
                  {/* Phones: view switch + sort on one row, pill + search below, so the stuck
                      bar stays two rows tall. Only the sort tabs scroll sideways — the pill
                      stays outside the scroller, which would otherwise clip its dropdown menu. */}
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
                    {hasExplore && (
                      <div className="order-1 md:order-none flex-shrink-0">
                        <ForumViewTabs view={forumView} onChange={handleForumViewChange} />
                      </div>
                    )}
                    {effectiveView === 'conversations' && (
                      <>
                        {hasExplore && (
                          <div className="hidden md:block w-px h-5 bg-gray-200 dark:bg-white/10 flex-shrink-0" aria-hidden="true" />
                        )}
                        {activeSlice && FEED_TABS.includes(activeTab as (typeof FEED_TABS)[number]) && (
                          <div className="order-3 md:order-none min-w-0">
                            <ActiveSliceSelector
                              slice={activeSlice}
                              fallbackName={TAB_LABELS[activeTab]}
                              viewingSliceId={activeViewing?.id ?? activeSlice.id}
                              onSelect={(sib) => handleViewSlice(activeTab, sib, activeSlice.id)}
                            />
                          </div>
                        )}
                        <div className="order-2 md:order-none flex-1 md:flex-none min-w-0 overflow-x-auto md:overflow-visible">
                        <FeedTabs
                          mode={activeMode}
                          onChange={(mode) => {
                            setFeedModes((prev) => ({ ...prev, [activeTab]: mode }))
                            scrollToContentTop()
                          }}
                        />
                        </div>
                        {/* Search lives with the feed it filters (it only searches the posts
                            loaded below), not in the global header. Beside the pill on phones;
                            inline before Post from md, sticking with the bar as you scroll. */}
                        {activeSlice && (
                          <ActiveFeedSearch
                            slice={activeSlice}
                            fallbackName={TAB_LABELS[activeTab]}
                            value={searchQuery}
                            onChange={setSearchQuery}
                            className="order-4 md:order-none flex-1 min-w-[9rem] md:min-w-0 md:max-w-xs md:ml-auto"
                          />
                        )}
                        {/* Hidden, not disabled, while view-only: RLS rejects an insert into a
                            slice the member is not in (CLAUDE.md). Phones keep the FAB. */}
                        {!activeIsViewOnly && (
                          <div className="hidden md:block flex-shrink-0">
                            <PostButton onClick={() => panelRefs.current[activeTab]?.current?.compose()} />
                          </div>
                        )}
                      </>
                    )}
                    {/* The right sidebar's toggle sits at the bar's far end, above the
                        column it controls, and stays put whether the column is open or
                        not. md up only: below that SidebarMobile collapses on its own. */}
                    {activeTab !== 'volunteer' && (
                      <div className="hidden md:block md:ml-auto flex-shrink-0">
                        <PanelToggle side="right" collapsed={sidebarCollapsed} onToggle={toggleSidebarCollapsed} label="sidebar" />
                      </div>
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

                    {/* Explore — CSS-hidden rather than unmounted while Conversations is
                        showing, so its open topic and selections survive the round trip.
                        The Volunteer tab does unmount it (hasExplore): that space has no
                        Explore at all, and exploreStorage restores the selections on return. */}
                    {hasExplore && (
                      <div
                        id={FORUM_VIEW_PANEL_ID.explore}
                        role="tabpanel"
                        aria-labelledby={`${FORUM_VIEW_PANEL_ID.explore}-tab`}
                        className={effectiveView === 'explore' ? 'flex flex-col' : 'hidden'}
                      >
                        {activeSlice ? (
                          <ActiveExplore
                            activeSlice={activeSlice}
                            slices={slices}
                            stateSlice={slices['state']}
                            userId={userId}
                            photoSlice={photoSliceFor(slices, activeSlice, activeTab)}
                            answeredCompassTopicIds={compass.answeredTopicIds}
                            compassLevelFlags={compassLevelFlags}
                            isViewOnly={activeIsViewOnly}
                            viewingSliceIndex={activeViewing?.siblingIndex}
                            onReturnToOwnSlice={() =>
                              handleViewSlice(activeTab, { id: activeSlice.id, siblingIndex: activeSlice.siblingIndex, memberCount: activeSlice.memberCount }, activeSlice.id)
                            }
                            onStartConversation={handleStartConversation}
                            onScrollTop={scrollToContentTop}
                            onGoToView={handleForumViewChange}
                            whatsNewInSidebar={!sidebarCollapsed}
                          />
                        ) : (
                          <ExploreView
                            sliceType={activeTab}
                            geoid={null}
                            destination={null}
                            isAuthenticated
                            /* No slice for this tab, so there is no own shard for another
                               to be a sibling of. activeIsViewOnly is false here by
                               construction (it requires activeSlice); said outright so a
                               later refactor cannot make it true without noticing. */
                            isViewOnly={false}
                            slices={slices}
                            answeredCompassTopicIds={compass.answeredTopicIds}
                            compassLevelFlags={compassLevelFlags}
                            onStartConversation={handleStartConversation}
                            onScrollTop={scrollToContentTop}
                            whatsNewInSidebar={!sidebarCollapsed}
                            onGoToView={handleForumViewChange}
                          />
                        )}
                      </div>
                    )}

                    {/* All FEED_TABS feeds mounted simultaneously — CSS hidden preserves the
                        React Query cache; AppShell restores each tab's scroll position. */}
                    <div
                      id={FORUM_VIEW_PANEL_ID.conversations}
                      role={hasExplore ? 'tabpanel' : undefined}
                      aria-labelledby={hasExplore ? `${FORUM_VIEW_PANEL_ID.conversations}-tab` : undefined}
                      className={effectiveView === 'conversations' ? 'flex flex-col gap-3' : 'hidden'}
                    >
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
                  </div>

                  {/* Sidebar column — hidden below md, on Volunteer, and while collapsed. It
                      stays mounted when collapsed so its widgets keep their state. It scrolls
                      with the page. `relative` makes it the containing block for absolute
                      descendants, so nothing inside can resolve against the viewport. */}
                  <div className={`${showSidebar ? 'hidden md:flex' : 'hidden'} relative min-w-0 flex-col`}>
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
                      whatsNew={effectiveView === 'explore' && <WhatsNewCard onGoTo={handleForumViewChange} />}
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
