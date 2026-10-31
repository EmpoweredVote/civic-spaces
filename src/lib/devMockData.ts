import type { SliceType, SliceInfo, PostWithAuthor, BoostedPostWithAuthor, ConnectedProfile, ReplyWithAuthor } from '../types/database'
import type { PoliticianFlatRecord } from '../types/representatives'
import type { CompassTopic, CompassAnswer } from '../types/compass'
import type { ElectionRecord } from '../hooks/useNextElection'

/**
 * Local-only fallback data so `npm run dev` renders a populated dashboard
 * without a real accounts.empowered.vote login. Never bundled into behavior
 * that runs against production — every consumer gates this behind
 * `import.meta.env.DEV` and only falls back when the real Supabase/reps
 * query comes back empty, so a real authenticated user's real data always
 * wins.
 */

const MOCK_ID_PREFIX = 'mock-'

export function isMockSliceId(sliceId: string): boolean {
  return sliceId.startsWith(MOCK_ID_PREFIX)
}

/**
 * Reserved, never-real user ids that intentionally resolve to fixture data:
 * - 'dev-guest' — the opt-in (?dev=1) local dev session
 *
 * 🔴 There is exactly one, and an anonymous visitor must never be given one.
 * `isSyntheticUserId()` is the switch behind every fixture fallback in the app:
 * hand an observer a reserved id and `useAllSlices` answers MOCK_SLICES with
 * hasJurisdiction true, `useRepresentatives` answers the fixture city's
 * officials and `fetchElections` falls back to MOCK_ELECTIONS — so someone who
 * typed "Portland" would be shown Asheville's fixtures AS IF they were
 * Portland's. An observer's userId stays null, which is the stronger boundary:
 * every hook that could serve fixtures is already `enabled: !!userId`, so none
 * of them runs at all.
 *
 * 🔴 A second id was reserved here for an anonymous visitor who had typed an
 * address, and deleted in Phase 17 when that visitor was actually built —
 * nothing had ever referenced it. The principle it carried — *the id itself is
 * the safety boundary, not an environment check* — is kept, and it
 * belongs to SLICE ids, not user ids. A visited place's slice id is the
 * `place:<type>:<geoid>` sentinel: a real slices.id is a UUID and can never
 * collide with it, so a leak is loud rather than a silent zero-row answer. Same
 * reasoning, moved from where it would have unlocked fixtures to where it locks
 * a query out.
 */
const SYNTHETIC_USER_IDS = new Set(['dev-guest'])

export function isSyntheticUserId(id: string | null | undefined): boolean {
  return !!id && SYNTHETIC_USER_IDS.has(id)
}

/**
 * Dev-only: which real place the fixture slices point at.
 *
 * Asheville is the default and the historical fixture city. Bloomington, IN is
 * the only city with real council-agenda coverage (Asheville has zero meetings),
 * so it is the proof city for Phase 16 — and it has to be reachable without a
 * production token, because localhost has no login.
 *
 * Arden is the third, and it is the one with NO city. An unincorporated address
 * is a real and common answer, not an error state: ev-accounts says so outright
 * in jurisdictionPayload.ts — "`city` is null for unincorporated addresses. That
 * is an answer, not a failure." A member there gets four tabs, so the write
 * gate's no-slice branch is reachable in dev and the absence of a composer on a
 * tab that could have had one is a statement about something.
 *
 * A fixed table of three, not a free geoid parameter: this patches
 * identity-shaped state, and a named choice is both safer and honest about being
 * a fixture. Verified against public/geo/18.json and public/geo/37.json — every
 * geoid here resolves to a real name offline, so useJurisdictionName needs no
 * network.
 */
const DEV_PLACES = {
  asheville:   { city: '3702140', county: '37021', state: '37' },
  bloomington: { city: '1805860', county: '18105', state: '18' },
  // An unincorporated address: Buncombe County, North Carolina, no incorporated
  // place. Verified live 2026-10-26 — the Census Geocoder returns state 37 and
  // county 37021 for 525 Citrine Ln, Arden NC and no Incorporated Places layer
  // at all. Four tabs, not five, and that is an ANSWER (ev-accounts
  // jurisdictionPayload.ts), not a failure. 37 and 37021 are the same two
  // entries Asheville already reads out of public/geo/37.json.
  arden:       { city: null, county: '37021', state: '37' },
  // A place outside North Carolina with its own state name, so a label that is
  // secretly hardcoded to NC is caught. Both geoids resolve in public/geo/06.json.
  losangeles:  { city: '0644000', county: '06037', state: '06' },
} as const

export type DevPlaceKey = keyof typeof DEV_PLACES

const DEV_PLACE_STORAGE_KEY = 'cs_dev_place'

/**
 * True only under `npm run dev`.
 *
 * Wrapped in try/catch rather than read directly because this module is also
 * loaded by `node --experimental-strip-types` (scripts/check-composition.mjs),
 * where `import.meta.env` is undefined and a bare `.DEV` would throw at import
 * time. Vite still replaces the expression with a literal in a production
 * build, so the branch below — and DEV_PLACES with it — is dropped from the
 * bundle.
 */
function devBuild(): boolean {
  try {
    return import.meta.env.DEV === true
  } catch {
    return false
  }
}

/**
 * Which dev place is in use, resolved once at module load.
 *
 * `?dev=1&place=bloomington` selects it and remembers it in sessionStorage: the
 * query string is lost the moment wouter navigates to /post/:postId or
 * /profile/:userId, and losing the proof city mid-walk is exactly the kind of
 * thing that gets diagnosed as a data bug. Session scope, not local — it should
 * not outlive the window. An unknown name falls back silently to the default.
 *
 * Every `window` / `sessionStorage` access is guarded: this module is imported
 * by code paths that run before the DOM is interesting, and a private window
 * throws on sessionStorage.
 */
function resolveDevPlace(): DevPlaceKey {
  if (!devBuild()) return 'asheville'
  let requested: string | null = null
  try {
    requested = new URLSearchParams(window.location.search).get('place')
  } catch {
    requested = null
  }
  if (requested && requested in DEV_PLACES) {
    try {
      window.sessionStorage.setItem(DEV_PLACE_STORAGE_KEY, requested)
    } catch {
      /* private window — the choice just does not survive navigation */
    }
    return requested as DevPlaceKey
  }
  try {
    const stored = window.sessionStorage.getItem(DEV_PLACE_STORAGE_KEY)
    if (stored && stored in DEV_PLACES) return stored as DevPlaceKey
  } catch {
    /* private window */
  }
  return 'asheville'
}

/** Exported so a dev-only affordance can say which fixture place is on screen. */
export const DEV_PLACE: DevPlaceKey = resolveDevPlace()

/**
 * 🔴 Only the three place geoids come from the table. Every `id`, `memberCount`,
 * `siblingIndex` and `photoUrl` stays exactly as it was: the post, reply and
 * sibling fixtures key on those ids, including the City sibling the Explore
 * view-only gate check relies on.
 *
 * 🔴 federal.geoid ('3711') and unified.geoid ('') are deliberately left wrong
 * relative to production ('US' / 'UNIFIED'). compositionKey() normalises
 * placeless types to the slice type alone precisely so that this does not
 * matter; correcting them here would hide the normalisation rather than test it.
 */
const DEV_PLACE_GEOIDS = DEV_PLACES[DEV_PLACE]

/**
 * The fixture slices' identity — id, member count, shard index — independent of
 * which dev place is loaded.
 *
 * 🔴 Separate from MOCK_SLICES on purpose. The post, sibling and feed fixtures
 * below are keyed on these ids, and a place with no city (arden) has no entry in
 * MOCK_SLICES at all — so a fixture reading MOCK_SLICES.city.id would be reading
 * `SliceInfo | undefined` for a key that is genuinely absent. The ids are what
 * the fixtures need and they never vary; the geoid is the only thing the place
 * table changes.
 */
const MOCK_SLICE_BASE: Record<SliceType, { id: string; memberCount: number; siblingIndex: number }> = {
  city:      { id: `${MOCK_ID_PREFIX}city`,      memberCount: 42,    siblingIndex: 1 },
  county:    { id: `${MOCK_ID_PREFIX}county`,    memberCount: 128,   siblingIndex: 1 },
  state:     { id: `${MOCK_ID_PREFIX}state`,     memberCount: 890,   siblingIndex: 1 },
  federal:   { id: `${MOCK_ID_PREFIX}federal`,   memberCount: 6,     siblingIndex: 1 },
  unified:   { id: `${MOCK_ID_PREFIX}unified`,   memberCount: 15000, siblingIndex: 1 },
  volunteer: { id: `${MOCK_ID_PREFIX}volunteer`, memberCount: 12,    siblingIndex: 1 },
}

/**
 * 🔴 PARTIAL, and the City key is genuinely ABSENT for an unincorporated place —
 * not present-and-null. That is what `useAllSlices` would return for a real
 * member at such an address, it is what makes NavSidebar and SliceTabBar render
 * four tabs instead of five, and it is what makes whyNoWrite's `no-slice` branch
 * reachable in dev at all.
 */
export const MOCK_SLICES: Partial<Record<SliceType, SliceInfo>> = {
  ...(DEV_PLACE_GEOIDS.city !== null
    ? {
        city: {
          ...MOCK_SLICE_BASE.city,
          sliceType: 'city' as const,
          geoid: DEV_PLACE_GEOIDS.city,
          photoUrl: null,
        },
      }
    : {}),
  county: {
    ...MOCK_SLICE_BASE.county,
    sliceType: 'county',
    geoid: DEV_PLACE_GEOIDS.county,
    photoUrl: null,
  },
  state: {
    ...MOCK_SLICE_BASE.state,
    sliceType: 'state',
    geoid: DEV_PLACE_GEOIDS.state,
    photoUrl: null,
  },
  federal: {
    ...MOCK_SLICE_BASE.federal,
    sliceType: 'federal',
    geoid: '3711',
    photoUrl: null,
  },
  unified: {
    ...MOCK_SLICE_BASE.unified,
    sliceType: 'unified',
    geoid: '',
    photoUrl: null,
  },
  volunteer: {
    ...MOCK_SLICE_BASE.volunteer,
    sliceType: 'volunteer',
    geoid: '',
    photoUrl: null,
  },
}

export const MOCK_PROFILE: ConnectedProfile = {
  user_id: 'dev-guest',
  display_name: 'Dev Guest',
  avatar_url: null,
  tier: 'connected',
  account_standing: 'active',
  is_suspended: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const author = (name: string, tier: 'connected' | 'inform' | 'empowered' = 'connected') => ({
  display_name: name,
  avatar_url: null,
  tier,
})

const MOCK_FEDERAL_POSTS: PostWithAuthor[] = [
  {
    // An explicit title, long enough to wrap — exercises the thread's topic header.
    id: 'mock-post-titled',
    slice_id: MOCK_SLICE_BASE.federal.id,
    user_id: 'mock-user-civicparticipant',
    title: 'Should Congress make the expanded Child Tax Credit permanent, and how would it change things for working families in our area?',
    body: 'The expansion lapsed at the end of 2021. Several bills would bring it back in some form. If you received the monthly payments, what did they change for your household? And if you think it is the wrong approach, what would you do instead?',
    reply_count: 5,
    edit_history: [],
    created_at: '2026-04-08T16:00:00.000Z',
    updated_at: '2026-04-08T16:00:00.000Z',
    is_deleted: false,
    author: author('CivicParticipant'),
  },
  {
    id: 'mock-post-1',
    slice_id: MOCK_SLICE_BASE.federal.id,
    user_id: 'mock-user-kades',
    title: null,
    body: 'This is the first post in our Connect hub, Civic Spaces.',
    reply_count: 1,
    edit_history: [],
    created_at: '2026-04-05T14:00:00.000Z',
    updated_at: '2026-04-05T14:00:00.000Z',
    is_deleted: false,
    author: author('Kades'),
  },
  {
    id: 'mock-post-2',
    slice_id: MOCK_SLICE_BASE.federal.id,
    user_id: 'mock-user-monroeneighbor',
    title: null,
    body: "He put out a statement about deficit concerns but voted for the 2017 tax cuts which added $1.9T. Would like to hear from constituents who've talked to his office directly.",
    reply_count: 2,
    edit_history: [],
    created_at: '2026-04-06T09:30:00.000Z',
    updated_at: '2026-04-06T09:30:00.000Z',
    is_deleted: false,
    author: author('MonroeNeighbor'),
  },
  {
    id: 'mock-post-3',
    slice_id: MOCK_SLICE_BASE.federal.id,
    user_id: 'mock-user-civicparticipant',
    title: null,
    body: 'The IRA drug price negotiation provision just survived its first legal challenge. Indiana has a higher-than-average share of Medicare beneficiaries. This is one of the more tangible federal policy wins in a while.',
    reply_count: 0,
    edit_history: [],
    created_at: '2026-04-07T18:15:00.000Z',
    updated_at: '2026-04-07T18:15:00.000Z',
    is_deleted: false,
    author: author('CivicParticipant'),
  },
]

// Generic/illustrative fixture content, also served to an anonymous
// visitor who entered their address — the jurisdiction labels/geoids shown
// alongside these posts are resolved for real (see censusGeocoder.ts), but
// there's no real content backing an arbitrary address, so these stay
// generic rather than implying specific real facts.
const MOCK_STATE_POSTS: PostWithAuthor[] = [
  {
    id: 'mock-state-post-1',
    slice_id: MOCK_SLICE_BASE.state.id,
    user_id: 'mock-user-example1',
    title: null,
    body: 'The state legislature is debating a new education funding formula this session — what would you want to see prioritized?',
    reply_count: 3,
    edit_history: [],
    created_at: '2026-04-10T13:00:00.000Z',
    updated_at: '2026-04-10T13:00:00.000Z',
    is_deleted: false,
    author: author('StateWatcher'),
  },
  {
    id: 'mock-state-post-2',
    slice_id: MOCK_SLICE_BASE.state.id,
    user_id: 'mock-user-example2',
    title: null,
    body: "Does anyone know when the next state budget town hall is scheduled? Would like to weigh in before it's finalized.",
    reply_count: 1,
    edit_history: [],
    created_at: '2026-04-11T10:00:00.000Z',
    updated_at: '2026-04-11T10:00:00.000Z',
    is_deleted: false,
    author: author('CivicSpacesTeam'),
  },
]

const MOCK_COUNTY_POSTS: PostWithAuthor[] = [
  {
    id: 'mock-county-post-1',
    slice_id: MOCK_SLICE_BASE.county.id,
    user_id: 'mock-user-example3',
    title: null,
    body: "County commissioners are reviewing next year's budget — road maintenance and library funding are both on the table at Thursday's meeting.",
    reply_count: 2,
    edit_history: [],
    created_at: '2026-04-12T15:00:00.000Z',
    updated_at: '2026-04-12T15:00:00.000Z',
    is_deleted: false,
    author: author('CountyNeighbor'),
  },
]

const MOCK_CITY_POSTS: PostWithAuthor[] = [
  {
    id: 'mock-city-post-1',
    slice_id: MOCK_SLICE_BASE.city.id,
    user_id: 'mock-user-example4',
    title: null,
    body: "Anyone else notice more sidewalk repairs happening around the block lately? Wondering if it's tied to the city's infrastructure plan.",
    reply_count: 0,
    edit_history: [],
    created_at: '2026-04-13T09:00:00.000Z',
    updated_at: '2026-04-13T09:00:00.000Z',
    is_deleted: false,
    author: author('LocalNeighbor'),
  },
]

/**
 * A second Federal shard, so the sibling-slice switcher is actually exercisable
 * at `?dev=1`. Real siblings only appear once a jurisdiction passes its member
 * cap, which no local fixture would otherwise reach. Its posts differ from
 * Slice 1's so switching visibly changes the feed.
 */
export const MOCK_FEDERAL_SIBLING_ID = `${MOCK_ID_PREFIX}federal-2`

const MOCK_FEDERAL_SIBLING_POSTS: PostWithAuthor[] = [
  {
    id: 'mock-federal-2-post-1',
    slice_id: MOCK_FEDERAL_SIBLING_ID,
    user_id: 'mock-user-sibling1',
    title: null,
    body: "This is Federal Slice 2. If you can read this but cannot post, the sibling-slice read-only path is working.",
    reply_count: 1,
    edit_history: [],
    created_at: '2026-04-06T12:00:00.000Z',
    updated_at: '2026-04-06T12:00:00.000Z',
    is_deleted: false,
    author: author('SecondShardMember'),
  },
]

/**
 * A second CITY shard, for the same reason MOCK_FEDERAL_SIBLING_ID exists: real
 * siblings only appear once a jurisdiction passes its member cap, which no local
 * fixture would otherwise reach.
 *
 * 🔴 City specifically, and it is not redundant with the Federal one. The City
 * composition is the only one carrying the Imagine card, "Share an idea", the
 * Nearby dialog and "Save on this device" — four of the ten write affordances
 * research Finding 5 lists, and four that DEFAULT_MODULES.federal does not
 * render at all. A view-only check driven on Federal alone would report "no
 * textarea found" about a tab that never had one, which is a true statement
 * about nothing. scripts/check-explore-gate.mjs runs on both because of this.
 *
 * 🔴 The id must stay prefixed by MOCK_SLICE_BASE.city.id. useNotificationRouting
 * resolves a fixture sibling with `mockPost.slice_id.startsWith(info.id)`, so
 * the prefix is what makes /post/<id> resolve to { kind: 'sibling', tab: 'city' }
 * instead of `unavailable`.
 */
export const MOCK_CITY_SIBLING_ID = `${MOCK_ID_PREFIX}city-2`

const MOCK_CITY_SIBLING_POSTS: PostWithAuthor[] = [
  {
    id: 'mock-city-2-post-1',
    slice_id: MOCK_CITY_SIBLING_ID,
    user_id: 'mock-user-sibling2',
    title: null,
    body: "This is City Slice 2. Same city, a different shard of it — you can read everything here and write nothing, which is what the database allows and what the page should offer.",
    reply_count: 1,
    edit_history: [],
    created_at: '2026-04-14T10:30:00.000Z',
    updated_at: '2026-04-14T10:30:00.000Z',
    is_deleted: false,
    author: author('SecondCityShardMember'),
  },
  {
    id: 'mock-city-2-post-2',
    slice_id: MOCK_CITY_SIBLING_ID,
    user_id: 'mock-user-sibling3',
    title: null,
    body: "Open Explore while you are on this shard: the notice at the top should say where posting lives, and there should be no form, no textarea and no Join button anywhere on the page.",
    reply_count: 0,
    edit_history: [],
    created_at: '2026-04-14T11:15:00.000Z',
    updated_at: '2026-04-14T11:15:00.000Z',
    is_deleted: false,
    author: author('SecondCityShardMember'),
  },
]

/**
 * Sibling shards per mock slice, shaped like useSiblingSlices' return rows.
 * Federal and City are sharded; every other tab still exercises the single-slice
 * (non-interactive) state. City is here so the view-only gate can be checked
 * where four of the ten write affordances actually render.
 */
const MOCK_SIBLINGS: Partial<Record<string, Array<{ id: string; siblingIndex: number; memberCount: number }>>> = {
  [MOCK_SLICE_BASE.federal.id]: [
    { id: MOCK_SLICE_BASE.federal.id, siblingIndex: 1, memberCount: MOCK_SLICE_BASE.federal.memberCount },
    { id: MOCK_FEDERAL_SIBLING_ID, siblingIndex: 2, memberCount: 17 },
  ],
  [MOCK_SLICE_BASE.city.id]: [
    { id: MOCK_SLICE_BASE.city.id, siblingIndex: 1, memberCount: MOCK_SLICE_BASE.city.memberCount },
    { id: MOCK_CITY_SIBLING_ID, siblingIndex: 2, memberCount: 29 },
  ],
}

/** Siblings for a fixture slice, or just itself when that slice is not sharded. */
export function getMockSiblings(
  sliceId: string,
  ownSiblingIndex: number,
  ownMemberCount: number,
): Array<{ id: string; siblingIndex: number; memberCount: number }> {
  return MOCK_SIBLINGS[sliceId] ?? [{ id: sliceId, siblingIndex: ownSiblingIndex, memberCount: ownMemberCount }]
}

const MOCK_FEEDS: Partial<Record<string, PostWithAuthor[]>> = {
  [MOCK_FEDERAL_SIBLING_ID]: MOCK_FEDERAL_SIBLING_POSTS,
  [MOCK_CITY_SIBLING_ID]: MOCK_CITY_SIBLING_POSTS,
  [MOCK_SLICE_BASE.federal.id]: MOCK_FEDERAL_POSTS,
  [MOCK_SLICE_BASE.state.id]: MOCK_STATE_POSTS,
  [MOCK_SLICE_BASE.county.id]: MOCK_COUNTY_POSTS,
  [MOCK_SLICE_BASE.city.id]: MOCK_CITY_POSTS,
}

export function getMockFeedPage(sliceId: string): PostWithAuthor[] {
  return MOCK_FEEDS[sliceId] ?? []
}

/**
 * Looks up a single fixture post by id — used when opening a mock post's thread.
 *
 * 🔴 THIS LIST IS HAND-MAINTAINED, and leaving a new array out of it is silent.
 * A post registered only in MOCK_FEEDS renders in its feed but is invisible here,
 * so locatePost returns `unavailable`, /post/<id> toasts "That conversation isn't
 * in one of your civic spaces" and navigates to `/` — and any check that then
 * asserts about the page is asserting about the home feed. Register a new array
 * in all THREE places: MOCK_SIBLINGS, MOCK_FEEDS and here.
 */
export function getMockPostById(postId: string): PostWithAuthor | null {
  const all = [
    ...MOCK_FEDERAL_POSTS,
    ...MOCK_FEDERAL_SIBLING_POSTS,
    ...MOCK_STATE_POSTS,
    ...MOCK_COUNTY_POSTS,
    ...MOCK_CITY_POSTS,
    ...MOCK_CITY_SIBLING_POSTS,
  ]
  return all.find((p) => p.id === postId) ?? null
}

const titledReply = (n: number, name: string, parent: number | null, body: string, at: string): ReplyWithAuthor => ({
  id: `mock-reply-titled-${n}`,
  post_id: 'mock-post-titled',
  parent_reply_id: parent === null ? null : `mock-reply-titled-${parent}`,
  user_id: `mock-user-titled-${n}`,
  body,
  created_at: at,
  updated_at: at,
  is_deleted: false,
  author: author(name),
})

const MOCK_REPLIES: Record<string, ReplyWithAuthor[]> = {
  /**
   * 🔴 The two deep-linked SIBLING posts each carry a reply, and they are not
   * decoration. ThreadView gates replying twice — `canWrite={canWrite &&
   * !isViewOnly}` and `onReply={isViewOnly ? undefined : handleReply}` — and
   * ReplyCard renders its Reply button only when BOTH survive. With zero replies
   * on these posts no ReplyCard mounted at all, so reverting either line changed
   * nothing a browser could see and check:explore-gate stayed green: the thread
   * half of the gate had no coverage, which is the exact shape CLAUDE.md records
   * this repo shipping once already. Assertion 14 reads these two bodies.
   */
  'mock-federal-2-post-1': [
    {
      id: 'mock-federal-2-reply-1',
      post_id: 'mock-federal-2-post-1',
      parent_reply_id: null,
      user_id: 'mock-user-sibling4',
      body: 'A reply in Federal Slice 2. Reading it is the point; there should be no Reply control on it from another shard.',
      created_at: '2026-04-06T13:00:00.000Z',
      updated_at: '2026-04-06T13:00:00.000Z',
      is_deleted: false,
      author: author('SecondShardMember'),
    },
  ],
  'mock-city-2-post-1': [
    {
      id: 'mock-city-2-reply-1',
      post_id: 'mock-city-2-post-1',
      parent_reply_id: null,
      user_id: 'mock-user-sibling5',
      body: 'A reply in City Slice 2. Reading it is the point; there should be no Reply control on it from another shard.',
      created_at: '2026-04-14T12:00:00.000Z',
      updated_at: '2026-04-14T12:00:00.000Z',
      is_deleted: false,
      author: author('SecondCityShardMember'),
    },
  ],
  'mock-post-titled': [
    titledReply(1, 'ConcernedVoter', null, 'We got the monthly payments for our two kids. It covered most of our childcare gap over the summer — we kept both jobs instead of one of us cutting hours.', '2026-04-08T17:00:00.000Z'),
    titledReply(2, 'MonroeNeighbor', 1, 'Same here. The monthly schedule mattered more to us than the total.', '2026-04-08T17:40:00.000Z'),
    titledReply(3, 'EarlyMember', null, 'I support it in principle but want to see how it is paid for before saying permanent. The 2021 version was not offset at all.', '2026-04-08T18:10:00.000Z'),
    titledReply(4, 'Kades', null, 'Worth noting the refundability piece is what reached the lowest-income families. Several current proposals keep the size but drop full refundability, which changes who benefits.', '2026-04-08T19:30:00.000Z'),
    titledReply(5, 'CivicParticipant', null, 'Good point on refundability. Does anyone know where our representative stands on the current House version?', '2026-04-08T20:15:00.000Z'),
  ],
  'mock-post-1': [
    {
      id: 'mock-reply-1',
      post_id: 'mock-post-1',
      parent_reply_id: null,
      user_id: 'mock-user-replier1',
      body: 'Glad to be part of this — looking forward to real conversations here.',
      created_at: '2026-04-05T15:00:00.000Z',
      updated_at: '2026-04-05T15:00:00.000Z',
      is_deleted: false,
      author: author('EarlyMember'),
    },
  ],
  'mock-post-2': [
    {
      id: 'mock-reply-2',
      post_id: 'mock-post-2',
      parent_reply_id: null,
      user_id: 'mock-user-replier2',
      body: "I called his office last week — staffer said they track constituent calls but couldn't share numbers.",
      created_at: '2026-04-06T11:00:00.000Z',
      updated_at: '2026-04-06T11:00:00.000Z',
      is_deleted: false,
      author: author('ConcernedVoter'),
    },
    {
      id: 'mock-reply-3',
      post_id: 'mock-post-2',
      parent_reply_id: 'mock-reply-2',
      user_id: 'mock-user-replier3',
      body: 'Same here — worth following up in writing too.',
      created_at: '2026-04-06T12:30:00.000Z',
      updated_at: '2026-04-06T12:30:00.000Z',
      is_deleted: false,
      author: author('MonroeNeighbor'),
    },
  ],
}

export function getMockReplies(postId: string): ReplyWithAuthor[] {
  return MOCK_REPLIES[postId] ?? []
}

// SliceFeedPanel renders via useBoostedFeed (chronological useFeed is currently
// unused/commented out there) — boosted_at just mirrors created_at for fixtures.
export function getMockBoostedFeedPage(sliceId: string): BoostedPostWithAuthor[] {
  return getMockFeedPage(sliceId).map((post) => ({ ...post, boosted_at: post.created_at }))
}

// Only the President and Vice President are included — they're true for
// every US address, unlike a mayor, county commissioner, governor, state
// legislator, senator, or House rep, all of which vary by exact location.
// There is no working public API this app can call to resolve real
// district-specific officials for an arbitrary address (the real
// representatives/me endpoint requires genuine account auth; the only other
// reachable endpoint returns the entire unfiltered ~15MB politician table
// with no address filtering). Rather than show a fabricated name for "your
// mayor" — which would be actively wrong for most addresses, not just an
// approximation — RepresentativesWidget shows an honest "not available"
// state for anything address-specific instead.
// Real Essentials ids/photos (verified live against essentials.empowered.vote
// and the underlying Supabase photo storage) — not fabricated, since these
// two offices are genuinely address-independent.
export const MOCK_REPRESENTATIVES: PoliticianFlatRecord[] = [
  // Local officials, so the City tab exercises the mayor-first sort and the
  // primary-official highlight. Deliberately listed out of order here: the
  // widget is what should put the mayor on top, not the fixture.
  {
    id: 'mock-rep-council-1',
    full_name: 'Dana Whitfield',
    office_title: 'City Council Member, District 2',
    photo_origin_url: '',
    district_type: 'LOCAL',
    government_type: 'local',
    is_vacant: false,
    is_elected: true,
    images: [],
  },
  {
    id: 'mock-rep-mayor',
    full_name: 'Marisol Okafor',
    office_title: 'Mayor',
    photo_origin_url: '',
    district_type: 'LOCAL',
    government_type: 'local',
    is_vacant: false,
    is_elected: true,
    images: [],
  },
  {
    id: 'mock-rep-council-2',
    full_name: 'Terrence Boyd',
    office_title: 'City Council Member, District 5',
    photo_origin_url: '',
    district_type: 'LOCAL',
    government_type: 'local',
    is_vacant: false,
    is_elected: true,
    images: [],
  },
  {
    id: 'mock-rep-county',
    full_name: 'Priya Raghunathan',
    office_title: 'County Commissioner',
    photo_origin_url: '',
    district_type: 'COUNTY',
    government_type: 'county',
    is_vacant: false,
    is_elected: true,
    images: [],
  },

  {
    id: '104102e6-08c1-494f-a9d4-6ef129595bf2',
    full_name: 'Donald J. Trump',
    office_title: 'President',
    photo_origin_url: 'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos/104102e6-08c1-494f-a9d4-6ef129595bf2-headshot.jpg',
    district_type: 'NATIONAL_EXEC',
    government_type: 'federal',
    is_vacant: false,
    is_elected: true,
    images: [
      {
        id: 'a27f1ff0-a1fd-4986-b2a1-1d7fef370f41',
        url: 'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos/104102e6-08c1-494f-a9d4-6ef129595bf2-headshot.jpg',
        type: 'default',
        photo_license: 'press_use',
        focal_point: null,
      },
    ],
  },
  {
    id: 'a809747d-3e53-4e9e-b3a1-6641dac2455c',
    full_name: 'J.D. Vance',
    office_title: 'Vice President',
    photo_origin_url: 'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos/a809747d-3e53-4e9e-b3a1-6641dac2455c-headshot.jpg',
    district_type: 'NATIONAL_EXEC',
    government_type: 'federal',
    is_vacant: false,
    is_elected: true,
    images: [
      {
        id: '7a55de1e-f313-4225-9a96-57579c97197b',
        url: 'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos/a809747d-3e53-4e9e-b3a1-6641dac2455c-headshot.jpg',
        type: 'default',
        photo_license: 'press_use',
        focal_point: null,
      },
    ],
  },
]

/**
 * A real slice of the live Compass topic set (ids, titles, stances and the
 * applies_* / is_live flags copied verbatim from api.empowered.vote, read
 * 2026-10-24) plus fixture answers, so the compass widget renders at ?dev=1.
 * The Compass API sends no CORS headers for localhost, so without this the
 * widget would be permanently empty in local dev.
 *
 * 🔴 Copied, never invented. An id that resolves to nothing in the live catalog
 * makes rankByCompass and topicsForLevel silent no-ops, and nothing fails to
 * tell you. scripts/check-composition.mjs re-checks every id here.
 *
 * The last two — City Sanitation and Cleanliness, Residential Zoning — are
 * LOCAL-ONLY (applies_local alone). They are here because the other eight are
 * each flagged for all three levels, so without them exclusion could never be
 * observed on the dev id and every later observation of the Federal tab would
 * be vacuous.
 */
export const MOCK_COMPASS_TOPICS: CompassTopic[] = [
  {
    "id": "af2fdfd6-02c4-49df-b09c-cf8536f4773f",
    "short_title": "Abortion",
    "title": "Reproductive Rights and Abortion Access",
    "stances": [
      {
        "id": "e60a5950-d326-4862-83e3-76e1713f72ee",
        "value": 1,
        "text": "Keep abortion legal at every stage of pregnancy, with no time limit."
      },
      {
        "id": "5d7f8951-91f3-43bc-94cb-1b280e7fd298",
        "value": 2,
        "text": "Keep abortion legal through the second trimester, and after that only to protect the mother's health."
      },
      {
        "id": "0a88c836-8884-41bc-84dc-fe66963a265f",
        "value": 3,
        "text": "Allow abortion during the first trimester, and after that only to protect the mother's health."
      },
      {
        "id": "9fd4fd44-de75-41ce-a16e-71588af9f141",
        "value": 4,
        "text": "Ban abortion except in cases of rape, incest, or a serious risk to the mother's life."
      },
      {
        "id": "c49a07d8-c3bc-4689-b4ef-ad3d6978ae52",
        "value": 5,
        "text": "Ban abortion in all cases, with no exceptions."
      }
    ],
    "applies_federal": true,
    "applies_state": true,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "683c8084-2281-4920-a07c-18439b2dd413",
    "short_title": "Tariffs",
    "title": "United States Tariff Policy",
    "stances": [
      {
        "id": "ac23505f-4269-418b-9574-d58f7629d6e8",
        "value": 1,
        "text": "Eliminate all tariffs and pursue completely free trade with every country."
      },
      {
        "id": "18307ecb-5dfe-41b9-b9e3-76ed33b7972a",
        "value": 2,
        "text": "Reduce most tariffs, keeping only limited exceptions."
      },
      {
        "id": "ccac5f1a-e4ba-460d-bf26-e44f52d3db65",
        "value": 3,
        "text": "Use tariffs selectively to protect key American industries and jobs."
      },
      {
        "id": "5863b159-1a1a-465b-ac57-e43fa71255f5",
        "value": 4,
        "text": "Increase tariffs on countries that don't trade fairly with America."
      },
      {
        "id": "534ce813-06a9-48f0-adc8-a9efa08ba554",
        "value": 5,
        "text": "Impose high tariffs on all imports to bring manufacturing back to America."
      }
    ],
    "applies_federal": true,
    "applies_state": true,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "c5ab4eab-702f-49b8-9277-8ea53f3835c6",
    "short_title": "Same-Sex Marriage",
    "title": "Same-Sex Marriage",
    "stances": [
      {
        "id": "f5cb3178-40ce-430d-b9bf-2cf31914a884",
        "value": 1,
        "text": "Guarantee same-sex couples full legal equality — equal marriage plus protection from discrimination (such as in jobs and housing)."
      },
      {
        "id": "ba1b3eb2-40c5-4167-8645-cf5051c201c8",
        "value": 2,
        "text": "Guarantee same-sex marriage the same benefits and protections as any other marriage."
      },
      {
        "id": "d391c05d-4ea9-4b8b-8478-d5b6cee495b2",
        "value": 3,
        "text": "Allow same-sex marriage, but protect religious organizations' right to decline to perform or host these marriages."
      },
      {
        "id": "c8b1d01b-5309-4283-9b11-27276475989f",
        "value": 4,
        "text": "Recognize civil unions for same-sex couples, but reserve marriage for opposite-sex couples."
      },
      {
        "id": "65009889-417c-49fe-b280-063a39a78700",
        "value": 5,
        "text": "Make same-sex marriage illegal and define marriage as only between one man and one woman."
      }
    ],
    "applies_federal": true,
    "applies_state": true,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "6b9ba6d9-1001-43f5-b073-4d37130696fd",
    "short_title": "Religious Freedom",
    "title": "Religious Freedom",
    "stances": [
      {
        "id": "7e33354e-01d3-4af7-a938-6d1c8da14a31",
        "value": 1,
        "text": "Prohibit religious exemptions from civil rights and anti-discrimination laws."
      },
      {
        "id": "2b0558af-d115-4b93-8d04-e95276056dee",
        "value": 2,
        "text": "Protect religious freedom while ensuring it doesn't override anti-discrimination protections in employment and housing."
      },
      {
        "id": "66143e45-3bb2-4bc1-bc6f-7db2a374f191",
        "value": 3,
        "text": "Balance protecting religious practices with maintaining equal treatment under the law for all citizens."
      },
      {
        "id": "d47f12c7-36ba-4a19-bacb-0bf99bf13367",
        "value": 4,
        "text": "Protect religious freedom and allow faith-based exemptions from laws that conflict with sincere religious beliefs."
      },
      {
        "id": "a538370a-01c9-4339-948b-a2142f6f0811",
        "value": 5,
        "text": "Strongly protect religious freedom and allow religious organizations complete autonomy in their operations and hiring practices."
      }
    ],
    "applies_federal": true,
    "applies_state": true,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "d1618b9c-0b9e-45af-b986-bb33d270b8e4",
    "short_title": "Trans Athletes",
    "title": "Transgender Athletes",
    "stances": [
      {
        "id": "23e2674a-7544-41ee-b8c6-a26f6115d9b6",
        "value": 1,
        "text": "Allow all transgender athletes to compete on teams matching their gender identity without any restrictions or requirements."
      },
      {
        "id": "7a41d927-4c1f-433e-bd90-703a8ae51bb6",
        "value": 2,
        "text": "Should allow transgender athletes to compete on teams matching their gender identity after completing basic documentation of their transition."
      },
      {
        "id": "cb3a560e-4731-41d8-a8f2-5a285bc52402",
        "value": 3,
        "text": "Decide transgender athletes' eligibility case by case based on individual circumstances and the requirements of each sport."
      },
      {
        "id": "327a45a3-74d0-4ade-a433-e11eb3575f7a",
        "value": 4,
        "text": "Require transgender athletes to compete only on teams matching their biological sex assigned at birth."
      },
      {
        "id": "82485219-8032-476b-8473-8add808ced4e",
        "value": 5,
        "text": "Completely ban all transgender athletes from competing in any organized sports competitions."
      }
    ],
    "applies_federal": true,
    "applies_state": true,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "24e9212c-b011-422a-865c-093e35050901",
    "short_title": "Ukraine Support",
    "title": "Ukraine - Russia Conflict",
    "stances": [
      {
        "id": "3194f8c2-b46c-44dd-848e-7e54b77eb992",
        "value": 1,
        "text": "Significantly increase military and financial aid to Ukraine."
      },
      {
        "id": "87e4bd8a-565a-44be-a1f3-1f6f333dbef1",
        "value": 2,
        "text": "Continue providing current levels of military and economic aid to help Ukraine defend itself."
      },
      {
        "id": "d70cf720-1315-4922-b5af-01cef9f052d6",
        "value": 3,
        "text": "Provide limited humanitarian aid to Ukraine while encouraging diplomatic negotiations to end the war."
      },
      {
        "id": "b0364116-a39f-45da-8b8a-7c4bf154dd29",
        "value": 4,
        "text": "Reduce aid to Ukraine and focus American resources on domestic priorities instead."
      },
      {
        "id": "a2047b9a-77a5-4d69-9ea4-f6bb3a871bd5",
        "value": 5,
        "text": "End all aid to Ukraine immediately and stay completely out of the conflict."
      }
    ],
    "applies_federal": true,
    "applies_state": true,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "cab61e8a-64fe-4bbd-bc08-fe9914d0091b",
    "short_title": "Medicare/aid",
    "title": "Medicare / Medicaid",
    "stances": [
      {
        "id": "0b5bb170-4445-4c55-89cc-949811450bfe",
        "value": 1,
        "text": "Expand Medicare to cover everyone regardless of age"
      },
      {
        "id": "96730cd2-f46d-48a0-8ad5-98afaea33d61",
        "value": 2,
        "text": "Significantly expand Medicare or Medicaid eligibility, stopping short of universal coverage"
      },
      {
        "id": "cb8fa5d0-a288-4342-93b3-06ce1a481d1a",
        "value": 3,
        "text": "Improve current programs while controlling costs"
      },
      {
        "id": "74086d42-a168-4b4a-b355-c78e3d29ece0",
        "value": 4,
        "text": "Scale back both programs, shifting more coverage to private insurance"
      },
      {
        "id": "250a1325-2d3e-417e-9a94-25755447a7bc",
        "value": 5,
        "text": "Phase out both programs and use private insurance only"
      }
    ],
    "applies_federal": true,
    "applies_state": true,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "a22215c3-6693-4bc2-b248-01aebba14570",
    "short_title": "Fossil Fuels",
    "title": "Fossil Fuel Policy",
    "stances": [
      {
        "id": "218ea469-3053-4747-83e1-701be1b231c9",
        "value": 1,
        "text": "Phase out fossil fuel production entirely."
      },
      {
        "id": "0b611122-d397-4f96-8f62-431ef4d16c7b",
        "value": 2,
        "text": "Allow no new drilling and let production decline over time."
      },
      {
        "id": "03593e5c-56f7-48f7-b981-653fbd35f1a1",
        "value": 3,
        "text": "Keep fossil fuel production steady at current levels."
      },
      {
        "id": "65d3cc5c-21bc-408f-bcb4-499e8b51df77",
        "value": 4,
        "text": "Expand fossil fuel production with new drilling and permits."
      },
      {
        "id": "3f054b50-2cc6-4838-ac91-5ad370e311bf",
        "value": 5,
        "text": "Maximize production and open more public land and waters to drilling."
      }
    ],
    "applies_federal": true,
    "applies_state": true,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "7687de4f-4d0b-462a-b803-bdfb23b16b42",
    "short_title": "City Sanitation and Cleanliness",
    "title": "City Sanitation and Cleanliness",
    "stances": [
      {
        "id": "e515d3b8-9539-4fee-a244-c6b026f33ac6",
        "value": 1,
        "text": "Significantly expand public sanitation services, treating cleanliness as the city's responsibility"
      },
      {
        "id": "9bcd2cc1-5da4-4f7b-9b8c-35def440baae",
        "value": 2,
        "text": "Concentrate sanitation resources on the most neglected, worst-served neighborhoods to close long-standing service gaps"
      },
      {
        "id": "eadf8213-34db-4a54-ba9b-2b834e53d5fd",
        "value": 3,
        "text": "Maintain current public sanitation services and target enforcement at the businesses and large property owners who create the most waste"
      },
      {
        "id": "57a27c31-84d1-4683-a0cf-5aa71a01d7cb",
        "value": 4,
        "text": "Rely primarily on enforcement of anti-littering and property maintenance laws; hold residents and businesses responsible"
      },
      {
        "id": "de09c42f-1a74-48fd-b9c8-a858e2a64e43",
        "value": 5,
        "text": "Privatize sanitation services and require residents and businesses to contract for cleanup directly"
      }
    ],
    "applies_federal": false,
    "applies_state": false,
    "applies_local": true,
    "is_live": true
  },
  {
    "id": "d4f18138-a2e0-4110-b925-7387d9d0d16d",
    "short_title": "Residential Zoning",
    "title": "Residential Zoning",
    "stances": [
      {
        "id": "fd50f9bf-5cce-42ed-9b31-0cd58dca6566",
        "value": 1,
        "text": "Protect existing single-family neighborhoods; oppose density increases."
      },
      {
        "id": "ed4d65db-1d19-485e-a4a5-ca8f7d06eb80",
        "value": 2,
        "text": "Allow modest density increases, like duplexes and accessory units, in single-family neighborhoods"
      },
      {
        "id": "b93c6cc6-aea3-42a2-b9f3-1360e77be77f",
        "value": 3,
        "text": "Allow multifamily and mixed-use near commercial corridors while protecting most residential zones"
      },
      {
        "id": "00c13fd0-96dd-4579-b1f5-3e0c0b1158ee",
        "value": 4,
        "text": "Upzone broadly to allow multifamily housing by right in most neighborhoods"
      },
      {
        "id": "dea15caf-d0e4-4561-a949-04d68048e8d6",
        "value": 5,
        "text": "Eliminate single-family-only zoning; allow any housing type on any lot communitywide"
      }
    ],
    "applies_federal": false,
    "applies_state": false,
    "applies_local": true,
    "is_live": true
  }
]

export const MOCK_COMPASS_ANSWERS: CompassAnswer[] = [
  {
    "topic_id": "af2fdfd6-02c4-49df-b09c-cf8536f4773f",
    "value": 4
  },
  {
    "topic_id": "683c8084-2281-4920-a07c-18439b2dd413",
    "value": 2
  },
  {
    "topic_id": "c5ab4eab-702f-49b8-9277-8ea53f3835c6",
    "value": 5
  },
  {
    "topic_id": "6b9ba6d9-1001-43f5-b073-4d37130696fd",
    "value": 3
  },
  {
    "topic_id": "d1618b9c-0b9e-45af-b986-bb33d270b8e4",
    "value": 4
  },
  {
    "topic_id": "24e9212c-b011-422a-865c-093e35050901",
    "value": 1
  },
  {
    "topic_id": "cab61e8a-64fe-4bbd-bc08-fe9914d0091b",
    "value": 3
  },
  {
    "topic_id": "a22215c3-6693-4bc2-b248-01aebba14570",
    "value": 5
  },
  {
    "topic_id": "7687de4f-4d0b-462a-b803-bdfb23b16b42",
    "value": 2
  },
  {
    "topic_id": "d4f18138-a2e0-4110-b925-7387d9d0d16d",
    "value": 4
  }
]

// ---------------------------------------------------------------------------
// Elections (?dev=1 only)
//
// NOT INVENTED: captured from the production endpoint on 2026-09-24 —
// POST api.empowered.vote/api/essentials/browse/elections-by-area with
// { geo_id: '3702140', mtfcc: 'G4110' } (Asheville), races stripped. Needed because
// that API sends no CORS header for localhost. The date is real, so the countdown
// the banner derives from it is real too; it simply will not update if the
// election is rescheduled.
// ---------------------------------------------------------------------------

export const MOCK_ELECTIONS: ElectionRecord[] = [
  {
    election_id: '12e0bce3-d4c3-4e09-ba5d-18e8bc68be5e',
    election_name: 'NC 2026 Statewide General',
    election_date: '2026-11-03',
    election_type: 'general',
  },
]
