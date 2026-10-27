// Stands in for: GET /api/civic-spaces/explore?sliceType=&geoid= — not yet served by the API
// Stands in for: GET /api/civic-spaces/explore/topics — not yet served by the API
// Stands in for: GET /api/civic-spaces/explore/suggestions — not yet served by the API
// Stands in for: GET /api/civic-spaces/updates — not yet served by the API
//
// Explore's editorial content: conversation-starter topics, "Explore nearby" suggestions and
// "What's new" notes. Each export is shaped like the response its route would return, and is
// read only through src/lib/exploreData.ts — replacing one with a real fetch is a change there.
// Listed in the PR under "Data this needs from the API".
//
// Data this needs from the API, as of Phase 16:
//   - the composition for one (sliceType, geoid): its ordered modules and its topics
//   - each topic's provenance (who put it here) and the level it belongs to
//   - the geoid a bespoke topic is scoped to, so a question written for one place cannot
//     surface in another
//
// 🔴 Written for this screen, not drawn from any source: no real people, places, dates, counts
// or quotes. Every record here is provenance 'staff' — a conversation starter — and the UI says
// so. Never add a fact here. A topic derived from a real agenda or roll call carries
// 'derived-from-agenda' / 'derived-from-vote' and its own verbatim title and source link; it is
// built from the published record in 16-06, never written by hand in this file.
//
// 🔴 Every compassTopicId below is a real id read from GET /api/compass/topics (60 topics, read
// 2026-10-24). An invented id matches nothing, so rankByCompass and topicsForLevel both become
// silent no-ops and nothing fails to tell you. Re-read the catalog before adding one.
import type { ExploreLevel, ExploreTopic, TopicId } from '../types/explore'
import type { AdventureSuggestion, ProductUpdate } from '../components/explore/exploreContent'

// ── Topics a module owns ──────────────────────────────────────────────────────────────
//
// These are NOT in GENERIC_TOPICS, and the committed check asserts the three id sets are
// pairwise disjoint. The Imagine and Nearby modules contribute their own topics through
// ExploreModule.topics() so a card can always open what it offers; a topic that was also in
// the generic pool would render twice on one page, and selectForModules cannot see that
// because a module's own topics() never passes through it.

/** The five topics IMAGINE_OPTIONS[].topic names. Owned by the Imagine module (City/County). */
export const IMAGINE_TOPICS: ExploreTopic[] = [
  {
    id: 'trees-shade',
    category: 'Trees & shade',
    title: 'Where would more shade make the biggest difference?',
    summary:
      'Shade changes who can comfortably wait for a bus, walk to school, or sit outside on a hot afternoon.',
    whyItMatters:
      'The hottest blocks are not always the ones people think of first. Local knowledge helps point attention to the right streets.',
    question: 'Where would more shade make the biggest difference?',
    suggestedTitle: 'Where more shade would help',
    level: 'city',
    geoid: null,
    provenance: 'staff',
  },
  {
    id: 'safer-crossings',
    category: 'Streets & safety',
    title: 'Which crossing would you make safer first?',
    summary:
      'A crossing that feels fine in a car can feel very different with a stroller, a cane, or a group of kids.',
    whyItMatters:
      'Specific intersections, described by people who use them on foot, are far easier to discuss than "traffic" in general.',
    question: 'Which crossing would you make safer first, and why that one?',
    suggestedTitle: 'A crossing that could be safer',
    level: 'city',
    geoid: null,
    provenance: 'staff',
  },
  {
    id: 'public-spaces',
    category: 'Parks & public space',
    title: 'What makes a public space feel welcoming?',
    summary:
      'Somewhere to sit, a bit of shade, something to do — small details decide whether people linger or pass through.',
    whyItMatters:
      'Places where neighbors run into each other are how a lot of community actually happens.',
    question: 'Where would a bench or a small gathering spot make people stay a little longer?',
    suggestedTitle: 'Making a public space more welcoming',
    level: 'city',
    geoid: null,
    provenance: 'staff',
  },
  {
    id: 'clean-streets',
    category: 'Streets & upkeep',
    title: 'Which streets could use more care?',
    summary:
      'Litter tends to collect in the same places — near certain stops, lots or corners — for reasons neighbors often already know.',
    whyItMatters:
      'Talking about where and why helps separate a one-off mess from a spot that needs a real fix, like a missing bin.',
    question: 'Is there a spot where litter keeps coming back, and what do you think causes it?',
    suggestedTitle: 'A street that could use more care',
    level: 'city',
    geoid: null,
    provenance: 'staff',
  },
  {
    id: 'your-idea',
    category: 'Your idea',
    title: 'What would make your neighborhood feel better?',
    summary: 'Sometimes the most useful idea is the one nobody has put on a list yet.',
    whyItMatters:
      'A specific suggestion, described in your own words, gives neighbors something concrete to respond to.',
    question: 'What is one small change that would make your neighborhood feel better?',
    suggestedTitle: 'An idea for our neighborhood',
    level: 'city',
    geoid: null,
    provenance: 'staff',
  },
]

/** The three topics ADVENTURE_OPTIONS[].topic names. Owned by the Nearby module (City/County). */
export const ADVENTURE_TOPICS: ExploreTopic[] = [
  {
    id: 'safer-walking',
    category: 'Neighborhood life',
    title: 'Where could walking around your neighborhood feel safer?',
    summary: 'Name the everyday crossings, sidewalks, and routes that deserve a closer look.',
    whyItMatters:
      'Neighbors walking the same streets every day notice details that a map does not show. Naming specific places turns a general worry into something people can talk through together.',
    question: 'Which spot on your regular walk feels least comfortable, and what would change that?',
    suggestedTitle: 'A spot where walking could feel safer',
    level: 'city',
    geoid: null,
    provenance: 'staff',
  },
  {
    id: 'park-usefulness',
    category: 'Public spaces',
    title: 'What would make your neighborhood park more useful?',
    blurb: 'Think shade, seating, play space, accessibility, or something we have not considered.',
    summary:
      'Parks serve toddlers, dog walkers, teenagers, older neighbors and people on a lunch break — rarely all equally well.',
    whyItMatters:
      'Hearing who uses a park, and who does not, helps a community see what is missing before anyone decides what to change.',
    question: 'Who is your nearest park working well for, and who is it missing?',
    suggestedTitle: 'Making our neighborhood park more useful',
    level: 'city',
    geoid: null,
    provenance: 'staff',
  },
  {
    id: 'local-proposal',
    category: 'Learn together',
    title: 'What would you like to understand about a local proposal?',
    blurb: 'Name the part that feels unclear, and neighbors can help talk it through.',
    summary:
      'Agendas and proposals can be hard to read cold. Asking what one actually changes is often the most useful first question.',
    whyItMatters:
      'People can only weigh in on decisions they understand. Shared questions help everyone read the same proposal more clearly.',
    question: 'Is there a local proposal or agenda item you would like explained in plain language?',
    suggestedTitle: 'Question about a local proposal',
    usesMeetingSources: true,
    level: 'city',
    geoid: null,
    provenance: 'staff',
  },
]

// ── Generic topics, by level ──────────────────────────────────────────────────────────
//
// "Applies anywhere at this level" — geoid is null on every one. A topic that names a place
// is bespoke content and belongs with that place's geoid, not here. The one deliberate
// exception is the federal set naming the United States: the federal level IS that
// jurisdiction, so it cannot be mis-scoped within the level.
//
// City topics prefer the six local-only Compass topics where the subject matches, because
// those are the ones that prove the level filter works: they must never appear on Federal.
// No topic in the federal set carries a local-only id — walking into your own level filter
// is an easy own goal.

const CITY_TOPICS: ExploreTopic[] = [
  {
    id: 'city-getting-around',
    category: 'Getting around',
    title: 'How do you get around your city, and what gets in the way?',
    blurb: 'Buses, bikes, sidewalks, parking — whatever you actually use.',
    summary:
      'The same trip can be easy in a car and hard on foot, by bike or by bus, and the people who make it each way notice different things.',
    whyItMatters:
      'Choices about streets and transit are made once and live for decades. How people actually move around a city is the part a map cannot show.',
    question: 'What is one trip you make often, and what would make it easier?',
    suggestedTitle: 'A trip around town that could be easier',
    level: 'city',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'ba59337e-30e2-4aba-a39a-426b3366eb27',
  },
  {
    id: 'city-housing-and-zoning',
    category: 'Housing & growth',
    title: 'What should get built in your city, and where?',
    blurb: 'Homes, apartments, shops, or nothing at all — it is a choice either way.',
    summary:
      'Rules about what can be built on a given lot shape rent, commutes, and who can afford to stay.',
    whyItMatters:
      'Zoning is settled block by block and rarely discussed until something is proposed next door. Talking about it earlier gives neighbors more of a say.',
    question: 'Where in your city should more homes be built, and where should things stay as they are?',
    suggestedTitle: 'Where new homes should go',
    level: 'city',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'd4f18138-a2e0-4110-b925-7387d9d0d16d',
  },
  {
    id: 'city-public-safety',
    category: 'Safety',
    title: 'What does feeling safe look like where you live?',
    summary:
      'Safety means different things on different blocks, and different things to different people on the same block.',
    whyItMatters:
      'A conversation that starts from what people actually experience is harder to reduce to a slogan than one that starts from a budget line.',
    question: 'What would make your part of the city feel safer, day or night?',
    suggestedTitle: 'What would make my neighborhood feel safer',
    level: 'city',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'e9ebefcd-c496-45e8-b816-a79f8442ba85',
  },
  {
    id: 'city-upkeep',
    category: 'Upkeep',
    title: 'Which parts of your city could use more care?',
    blurb: 'Litter, lighting, sidewalks, overgrown lots — the small things that add up.',
    summary:
      'Upkeep is one of the most visible things a city does, and the easiest to notice when it slips.',
    whyItMatters:
      'Neighbors can usually name the exact corner. A specific place is something a city can act on; a general complaint is not.',
    question: 'Which spot in your city keeps getting missed, and what does it need?',
    suggestedTitle: 'A spot in town that keeps getting missed',
    level: 'city',
    geoid: null,
    provenance: 'staff',
    compassTopicId: '7687de4f-4d0b-462a-b803-bdfb23b16b42',
  },
  {
    id: 'city-growth-and-green',
    category: 'Growth & green space',
    title: 'How should your city weigh new building against open space?',
    summary:
      'Requests to build and the wish to keep land open compete for the same ground, and the trade is rarely presented as one.',
    whyItMatters:
      'Open space is hard to get back once it is built on, and new building pays for services people want. Neither side of that is obviously right.',
    question: 'Where should your city hold the line on open space, and where should it welcome building?',
    suggestedTitle: 'Growth and green space in our city',
    level: 'city',
    geoid: null,
    provenance: 'staff',
    compassTopicId: '1935979c-b290-42e4-baa5-8cb0138b4ffa',
  },
]

const COUNTY_TOPICS: ExploreTopic[] = [
  {
    id: 'county-budget-priorities',
    category: 'County budget',
    title: 'Where should your county spend first?',
    summary:
      'A county budget covers a lot of things most residents never see until they need one of them.',
    whyItMatters:
      'County decisions tend to draw less attention than city ones, and they reach everyone inside the county line.',
    question: 'If your county had a little more to spend, where should it go?',
    suggestedTitle: 'Where our county should spend first',
    level: 'county',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'f7e5678d-dadd-4556-a2fc-446e24642ceb',
  },
  {
    id: 'county-shared-services',
    category: 'Shared services',
    title: 'Which services should your county run, and which should each town run itself?',
    blurb: 'Dispatch, jails, health, records, roads — some are shared and some are not.',
    summary:
      'Sharing a service across a county can make it cheaper and more consistent, or more distant. Which one depends on the service.',
    whyItMatters:
      'Where a service sits decides who answers for it, and that is easier to discuss before a merger than after.',
    question: 'Which service would work better run across your whole county, and which should stay local?',
    suggestedTitle: 'What our county should run together',
    level: 'county',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'c267e137-0ff9-4e7d-9d13-e3cea1756cd0',
  },
  {
    id: 'county-outside-the-city',
    category: 'Town & country',
    title: 'What is different about living outside the city limits here?',
    summary:
      'Unincorporated areas often share a county with a city and share very little else.',
    whyItMatters:
      'County decisions land differently on a subdivision, a farm and a downtown block, and the people in each rarely hear from the others.',
    question: 'What does your county get right, or miss, about the part of it you live in?',
    suggestedTitle: 'Life outside the city limits',
    level: 'county',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'fb25c1ac-91cc-49bf-8afc-c7fa22ef45e4',
  },
  {
    id: 'county-getting-across',
    category: 'Roads & transit',
    title: 'How well does your county connect the places you need to go?',
    summary:
      'A county is usually the scale at which a commute, a hospital trip or a school run crosses more than one town.',
    whyItMatters:
      'Nobody plans a trip by jurisdiction, but roads and transit are funded that way.',
    question: 'Which trip across your county is harder than it should be?',
    suggestedTitle: 'A trip across the county that is harder than it should be',
    level: 'county',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'ba59337e-30e2-4aba-a39a-426b3366eb27',
  },
]

const STATE_TOPICS: ExploreTopic[] = [
  {
    id: 'state-housing-costs',
    category: 'Housing',
    title: 'What should your state do about the cost of housing?',
    summary:
      'Housing costs are felt locally and shaped by state law — building rules, tenant protections, and money for new homes.',
    whyItMatters:
      'The levers at the state level are different from the city ones, and they are argued over in a building most residents never visit.',
    question: 'What should your state do about housing costs, and what should it leave to cities?',
    suggestedTitle: 'What our state should do about housing',
    level: 'state',
    geoid: null,
    provenance: 'staff',
    compassTopicId: '669cac97-66a6-4087-b036-936fbe62efb3',
  },
  {
    id: 'state-school-funding',
    category: 'Schools',
    title: 'How should your state pay for its schools?',
    blurb: 'How the money is split between districts, and how much follows a student.',
    summary:
      'States divide school money between districts, and choose how much of it follows a student to a school their family picks.',
    whyItMatters:
      'School funding formulas are technical, rarely explained, and decide a great deal about what a classroom looks like.',
    question: 'How should your state split school funding, and what should follow a student?',
    suggestedTitle: 'How our state should fund schools',
    level: 'state',
    geoid: null,
    provenance: 'staff',
    compassTopicId: '00b95a6a-75db-4521-b523-3326bba938de',
  },
  {
    id: 'state-healthcare-access',
    category: 'Health',
    title: 'What would make healthcare easier to get in your state?',
    summary:
      'Coverage, clinics, ambulance times and specialist waits can look very different in two parts of the same state.',
    whyItMatters:
      'Much of what decides whether care is reachable is set at the state level rather than the federal one.',
    question: 'What makes getting care hard where you live, and what would change it?',
    suggestedTitle: 'Getting healthcare in our state',
    level: 'state',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'e8dad4a8-eb93-4931-91f5-d8fb5d7dd529',
  },
  {
    id: 'state-energy-mix',
    category: 'Energy',
    title: 'Where should the electricity in your state come from?',
    summary:
      'States decide a great deal about what gets built to generate power, and about who pays for it.',
    whyItMatters:
      'Power plants and the lines that serve them last for decades, so a choice made now is one a state lives with for a long time.',
    question: 'Where should the power in your state come from, and which trade-offs are worth it?',
    suggestedTitle: 'Where our power should come from',
    level: 'state',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'f1e44d66-5d27-4b51-b54f-b7ace86f6a3c',
  },
]

const FEDERAL_TOPICS: ExploreTopic[] = [
  {
    id: 'federal-role-abroad',
    category: 'Foreign policy',
    title: 'Where should the United States be involved abroad, and where not?',
    summary:
      'Alliances, aid and military commitments are settled federally and argued about everywhere.',
    whyItMatters:
      'These are among the few decisions no state or city can make, which is what makes a federal space the place to talk them through.',
    question: 'Where should the United States be doing more abroad, and where less?',
    suggestedTitle: 'Where the United States should be involved abroad',
    level: 'federal',
    geoid: null,
    provenance: 'staff',
    compassTopicId: '24e9212c-b011-422a-865c-093e35050901',
  },
  {
    id: 'federal-social-security',
    category: 'Retirement',
    title: 'What should Social Security look like for the next generation?',
    summary:
      'Social Security is funded by one generation for another, and the balance between them is a federal choice.',
    whyItMatters:
      'Changes here take effect slowly and reach almost every household, which makes them easy to postpone and hard to undo.',
    question: 'What would you change about Social Security, and what should stay exactly as it is?',
    suggestedTitle: 'Social Security for the next generation',
    level: 'federal',
    geoid: null,
    provenance: 'staff',
    compassTopicId: '87d20824-a6e9-407b-983c-65440084a0ab',
  },
  {
    id: 'federal-trade',
    category: 'Trade',
    title: 'How should the United States trade with the rest of the world?',
    blurb: 'Tariffs change what things cost and which jobs exist, often in opposite directions.',
    summary:
      'Trade rules are set in one place and felt unevenly, so the people they help and the people they cost rarely meet.',
    whyItMatters:
      'Almost every household meets trade policy through a price, long before it meets the argument behind it.',
    question: 'What should the United States protect, and what should it trade freely?',
    suggestedTitle: 'How the United States should trade',
    level: 'federal',
    geoid: null,
    provenance: 'staff',
    compassTopicId: '683c8084-2281-4920-a07c-18439b2dd413',
  },
  {
    id: 'federal-elections',
    category: 'Elections',
    title: 'What would make federal elections work better?',
    summary:
      'Registration, getting to a ballot, district lines and campaign money are all part of how a federal election runs.',
    whyItMatters:
      'Rules about voting are the rules that decide every other rule, and they are set in several places at once.',
    question: 'What one change would make you trust a federal election more?',
    suggestedTitle: 'Making federal elections work better',
    level: 'federal',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'd1792200-1d3b-4955-a0b7-0e6980d7a7b2',
  },
]

const UNIFIED_TOPICS: ExploreTopic[] = [
  {
    id: 'unified-news-from-here',
    category: 'World view',
    title: 'What is happening where you live that the rest of the world is missing?',
    summary:
      'A place is often known abroad through a handful of stories, and the people who live there can usually name what is left out.',
    whyItMatters:
      'This is the one space on Civic Spaces where the person answering may be on the other side of the world from you.',
    question: 'What would you want someone in another country to understand about where you live?',
    suggestedTitle: 'What the world misses about where I live',
    level: 'unified',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'ddd65d64-9dc7-4208-a30f-59f4b9c0653d',
  },
  {
    id: 'unified-ai-everyday',
    category: 'Technology',
    title: 'How is AI changing everyday life where you are?',
    summary: 'The same tools arrive in very different places, and they land differently in each.',
    whyItMatters:
      'Rules for this are being written country by country, and comparing experiences is the fastest way to see what is actually happening.',
    question: 'Where has AI already changed something in your daily life, for better or worse?',
    suggestedTitle: 'How AI is changing daily life here',
    level: 'unified',
    geoid: null,
    provenance: 'staff',
    compassTopicId: '666bf03d-81fc-4138-ab15-69ae734c9023',
  },
  {
    id: 'unified-getting-around',
    category: 'Cities worldwide',
    title: 'What does getting around look like where you live?',
    blurb: 'Walking, cycling, driving and public transport are mixed differently everywhere.',
    summary:
      'Every country arrives at its own mix, and most people only know one of them well.',
    whyItMatters:
      'Comparing notes across places is how a city learns something it could not work out on its own.',
    question: 'How do most people get around where you live, and what would you change about it?',
    suggestedTitle: 'Getting around where I live',
    level: 'unified',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'ba59337e-30e2-4aba-a39a-426b3366eb27',
  },
  {
    id: 'unified-energy-future',
    category: 'Energy & climate',
    title: 'Where should the world get its energy?',
    summary:
      'Every country is making this choice on its own timetable, from a very different starting point.',
    whyItMatters:
      'The decision is national and the consequences are not, which is the reason to talk about it across borders.',
    question: 'What should energy where you live look like a generation from now?',
    suggestedTitle: 'Where the world should get its energy',
    level: 'unified',
    geoid: null,
    provenance: 'staff',
    compassTopicId: 'f1e44d66-5d27-4b51-b54f-b7ace86f6a3c',
  },
]

/** The by-level pool a composition falls back to when a place has no bespoke topics. */
export const GENERIC_TOPICS: Record<ExploreLevel, ExploreTopic[]> = {
  city: CITY_TOPICS,
  county: COUNTY_TOPICS,
  state: STATE_TOPICS,
  federal: FEDERAL_TOPICS,
  unified: UNIFIED_TOPICS,
}

// ── The pre-Phase-16 single composition ───────────────────────────────────────────────
//
// What ExploreView rendered on every tab before 16-03 switched it over to a resolved
// per-slice composition. NOTHING RENDERS THIS ANY MORE — getExploreTopics() is gone.
// It stays as the shape GET /api/civic-spaces/explore is expected to return (see the
// handoff ask in 16-09), beside the live GENERIC_TOPICS it was replaced by.

export interface ExploreTopicsResponse {
  featuredTopicId: TopicId
  questionTopicIds: TopicId[]
  topics: ExploreTopic[]
}

export const exploreTopicsResponse: ExploreTopicsResponse = {
  featuredTopicId: 'safer-walking',
  questionTopicIds: ['park-usefulness', 'local-proposal'],
  topics: [...ADVENTURE_TOPICS, ...IMAGINE_TOPICS],
}

export const adventureSuggestionsResponse: { suggestions: AdventureSuggestion[] } = {
  suggestions: [
    {
      key: '15m',
      label: '15 minutes',
      hint: 'A quick walk',
      emoji: '🚶',
      title: 'Take a noticing walk',
      description: 'Step outside and notice one place that feels especially welcoming—or one small detail you would change.',
      linkLabel: 'Open the walking topic',
      durationChip: 'About 15 minutes',
      placeChip: 'Your own block',
      about: 'A short, unhurried walk close to home, paying attention to how the street feels rather than getting anywhere.',
      steps: ['Walk a block or two from your front door.', 'Notice one place that feels welcoming, and what makes it so.', 'Notice one small detail you would change.'],
      topic: 'safer-walking',
    },
    {
      key: '1h',
      label: 'About an hour',
      hint: 'A shared space',
      emoji: '🌳',
      title: 'Explore a shared space',
      linkLabel: 'Open the park topic',
      durationChip: 'About an hour',
      placeChip: 'A park or public space near you',
      about: 'Time in one shared place, watching how it works for the different people who use it.',
      steps: ['Pick a nearby park, plaza, or library.', 'Watch who is using it — and who is not.', 'Notice what is missing: shade, seating, play space, or easy access.'],
      description: 'Spend some time in a local park or public space and watch how it serves different people.',
      topic: 'park-usefulness',
    },
    {
      key: 'evening',
      label: 'An evening',
      hint: 'A local decision',
      emoji: '🌙',
      // Used only when no real meeting is available — never an invented event.
      title: 'Read up on one local decision',
      linkLabel: 'Open the local proposal topic',
      durationChip: 'An evening',
      placeChip: 'From home',
      about: 'A quiet evening with one decision your city is working on, so the next conversation about it starts from what it actually says.',
      steps: ['Find your city\x27s next public meeting agenda.', 'Pick one item and read its summary.', 'Write down one question you would want answered.'],
      description: 'Pick one item your city is deciding and read about it, so you can ask a sharper question.',
      topic: 'local-proposal',
    },
  ],
}

export const productUpdatesResponse: { updates: ProductUpdate[] } = {
  updates: [
    {
      id: 'explore',
      category: 'Civic Spaces improvement',
      /**
       * 🔴 "any community", not "your community", and it is on the FIXED side
       * of the boundary deferred item 3 drew rather than the deferred side.
       *
       * The line that boundary settled on is: *a STATEMENT the page makes about
       * the place is fixed; a QUESTION put to the reader is deferred* — because
       * the second person is what makes a conversation starter an invitation,
       * and changing that is a decision about the product's voice. This is a
       * statement, and `WhatsNewCard` renders it as the featured update inside
       * the Explore panel, so a visitor to Asheville was being told Explore is
       * "a better way to discover YOUR community" about a place they have never
       * been. It was deferred only because it lives in the same FILE as the
       * questions, and the file boundary is the one deferred item 3 records
       * itself correcting.
       *
       * It is also simply truer of what shipped: anyone may look anywhere.
       */
      title: 'A better way to discover any community',
      summary: 'Explore gives every Civic Space useful context—even before its first conversation.',
      whatChanged: 'Civic Spaces now opens on Explore: topics, short activities and updates, with Conversations one tab away.',
      why: 'A useful community should not depend on a busy feed. Starting from a question to react to is easier than a blank box.',
      forYou: 'You can understand a topic before joining its discussion, and try something local without posting at all. Your draft waits for you.',
      whereToTry: 'Close this update and choose any topic in Explore.',
      cta: { label: 'Try Explore', goTo: 'explore' },
    },
    {
      id: 'share-links',
      category: 'Conversations',
      title: 'Shareable conversation links',
      summary: 'Send a neighbor a link and it opens on that exact conversation.',
      whatChanged: 'Every conversation has its own link, and it survives signing in.',
      why: 'Links used to drop you on the home feed.',
      forYou: 'Send a neighbor a link and it opens on that exact conversation.',
      whereToTry: 'Open any post in Conversations and use Share to copy its link.',
      cta: { label: 'Go to Conversations', goTo: 'conversations' },
    },
    {
      id: 'browse-shards',
      category: 'Communities',
      title: 'Browse other communities nearby',
      summary: 'Read more of your area. Posting stays in your own community.',
      whatChanged: 'You can read other communities in your own area, read-only.',
      why: 'Large places are split into several communities, and good conversations happen in each.',
      forYou: 'Read more of your area. Posting stays in your own community.',
      whereToTry: 'In Conversations, use the community switcher at the start of the toolbar.',
      cta: { label: 'Go to Conversations', goTo: 'conversations' },
    },
  ],
}
