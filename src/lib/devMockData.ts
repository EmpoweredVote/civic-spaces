import type { SliceType, SliceInfo, PostWithAuthor, BoostedPostWithAuthor, ConnectedProfile, ReplyWithAuthor } from '../types/database'
import type { PoliticianFlatRecord } from '../types/representatives'
import type { CompassTopic, CompassAnswer } from '../types/compass'

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
  city: {
    id: `${MOCK_ID_PREFIX}city`,
    sliceType: 'city',
    geoid: '3702140',
    memberCount: 42,
    siblingIndex: 1,
    photoUrl: null,
  },
  county: {
    id: `${MOCK_ID_PREFIX}county`,
    sliceType: 'county',
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
    id: 'mock-county-post-1',
    slice_id: MOCK_SLICES.county.id,
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
    slice_id: MOCK_SLICES.city.id,
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
    reply_count: 0,
    edit_history: [],
    created_at: '2026-04-06T12:00:00.000Z',
    updated_at: '2026-04-06T12:00:00.000Z',
    is_deleted: false,
    author: author('SecondShardMember'),
  },
]

/**
 * Sibling shards per mock slice, shaped like useSiblingSlices' return rows.
 * Only Federal is sharded — one example is enough to drive the selector, and
 * every other tab exercises the single-slice (non-interactive) state.
 */
const MOCK_SIBLINGS: Partial<Record<string, Array<{ id: string; siblingIndex: number; memberCount: number }>>> = {
  [MOCK_SLICES.federal.id]: [
    { id: MOCK_SLICES.federal.id, siblingIndex: 1, memberCount: MOCK_SLICES.federal.memberCount },
    { id: MOCK_FEDERAL_SIBLING_ID, siblingIndex: 2, memberCount: 17 },
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
  [MOCK_SLICES.federal.id]: MOCK_FEDERAL_POSTS,
  [MOCK_SLICES.state.id]: MOCK_STATE_POSTS,
  [MOCK_SLICES.county.id]: MOCK_COUNTY_POSTS,
  [MOCK_SLICES.city.id]: MOCK_CITY_POSTS,
}

export function getMockFeedPage(sliceId: string): PostWithAuthor[] {
  return MOCK_FEEDS[sliceId] ?? []
}

/** Looks up a single fixture post by id — used when opening a mock post's thread. */
export function getMockPostById(postId: string): PostWithAuthor | null {
  const all = [...MOCK_FEDERAL_POSTS, ...MOCK_FEDERAL_SIBLING_POSTS, ...MOCK_STATE_POSTS, ...MOCK_COUNTY_POSTS, ...MOCK_CITY_POSTS]
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
 * A real slice of the live Compass topic set (ids, titles and stances copied
 * from api.empowered.vote) plus fixture answers, so the compass widget renders
 * at ?dev=1. The Compass API sends no CORS headers for localhost, so without
 * this the widget would be permanently empty in local dev.
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
  }
]
