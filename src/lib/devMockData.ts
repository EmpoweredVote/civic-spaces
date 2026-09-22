import type { SliceType, SliceInfo, PostWithAuthor, BoostedPostWithAuthor, ConnectedProfile, ReplyWithAuthor } from '../types/database'
import type { PoliticianFlatRecord } from '../types/representatives'

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
 * - 'dev-guest'    — the opt-in (?dev=1) local dev session
 * - 'preview-guest'— a real anonymous visitor who entered their address to
 *                    see a feed across all levels (works in a production
 *                    build too — the id itself is the safety boundary, not
 *                    an environment check, since a real Supabase user id
 *                    can never collide with these strings)
 */
const SYNTHETIC_USER_IDS = new Set(['dev-guest', 'preview-guest'])

export function isSyntheticUserId(id: string | null | undefined): boolean {
  return !!id && SYNTHETIC_USER_IDS.has(id)
}

export const MOCK_SLICES: Record<SliceType, SliceInfo> = {
  neighborhood: {
    id: `${MOCK_ID_PREFIX}neighborhood`,
    sliceType: 'neighborhood',
    geoid: '3702140',
    memberCount: 42,
    siblingIndex: 1,
    photoUrl: null,
  },
  local: {
    id: `${MOCK_ID_PREFIX}local`,
    sliceType: 'local',
    geoid: '37021',
    memberCount: 128,
    siblingIndex: 1,
    photoUrl: null,
  },
  state: {
    id: `${MOCK_ID_PREFIX}state`,
    sliceType: 'state',
    geoid: '37',
    memberCount: 890,
    siblingIndex: 1,
    photoUrl: null,
  },
  federal: {
    id: `${MOCK_ID_PREFIX}federal`,
    sliceType: 'federal',
    geoid: '3711',
    memberCount: 6,
    siblingIndex: 1,
    photoUrl: null,
  },
  unified: {
    id: `${MOCK_ID_PREFIX}unified`,
    sliceType: 'unified',
    geoid: '',
    memberCount: 15000,
    siblingIndex: 1,
    photoUrl: null,
  },
  volunteer: {
    id: `${MOCK_ID_PREFIX}volunteer`,
    sliceType: 'volunteer',
    geoid: '',
    memberCount: 12,
    siblingIndex: 1,
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
    id: 'mock-post-1',
    slice_id: MOCK_SLICES.federal.id,
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
    slice_id: MOCK_SLICES.federal.id,
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
    slice_id: MOCK_SLICES.federal.id,
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
    slice_id: MOCK_SLICES.state.id,
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
    slice_id: MOCK_SLICES.state.id,
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
    id: 'mock-local-post-1',
    slice_id: MOCK_SLICES.local.id,
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

const MOCK_NEIGHBORHOOD_POSTS: PostWithAuthor[] = [
  {
    id: 'mock-neighborhood-post-1',
    slice_id: MOCK_SLICES.neighborhood.id,
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

const MOCK_FEEDS: Partial<Record<string, PostWithAuthor[]>> = {
  [MOCK_SLICES.federal.id]: MOCK_FEDERAL_POSTS,
  [MOCK_SLICES.state.id]: MOCK_STATE_POSTS,
  [MOCK_SLICES.local.id]: MOCK_COUNTY_POSTS,
  [MOCK_SLICES.neighborhood.id]: MOCK_NEIGHBORHOOD_POSTS,
}

export function getMockFeedPage(sliceId: string): PostWithAuthor[] {
  return MOCK_FEEDS[sliceId] ?? []
}

/** Looks up a single fixture post by id — used when opening a mock post's thread. */
export function getMockPostById(postId: string): PostWithAuthor | null {
  const all = [...MOCK_FEDERAL_POSTS, ...MOCK_STATE_POSTS, ...MOCK_COUNTY_POSTS, ...MOCK_NEIGHBORHOOD_POSTS]
  return all.find((p) => p.id === postId) ?? null
}

const MOCK_REPLIES: Record<string, ReplyWithAuthor[]> = {
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
