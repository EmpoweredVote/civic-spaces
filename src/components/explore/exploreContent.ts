/**
 * Everything Explore shows that is not live data: conversation-starter topics, the three
 * activities' options, and the "What's new" notes.
 *
 * 🔴 ILLUSTRATIVE, NOT CIVIC RECORD. Nothing here is an official proposal, a vote, or a
 * description of what any one city is doing. The UI labels it as a conversation starter
 * wherever it appears. There is no topics table in civic_spaces and posts carry no topic
 * id, so a topic is NOT linked to existing posts — "Join the conversation" always opens
 * the create-post composer with an editable draft. Do not "find the related post" by
 * matching titles: two posts that share words are not the same conversation.
 *
 * Sources: none of these topics cite one, because none was written from one. The local
 * proposal topic is the exception — it lists the member's real scheduled meeting agendas
 * when the meetings API returns any (see TopicDetail). Never add a source here that the
 * text was not actually drawn from.
 */

export type TopicId =
  | 'safer-walking'
  | 'park-usefulness'
  | 'local-proposal'
  | 'trees-shade'
  | 'safer-crossings'
  | 'public-spaces'
  | 'clean-streets'
  | 'your-idea'

export interface ExploreTopic {
  id: TopicId
  category: string
  title: string
  summary: string
  whyItMatters: string
  /** The focused question the conversation opens with. */
  question: string
  /** Pre-filled, editable post title. Must fit createPostSchema (≤200). */
  suggestedTitle: string
  /** True when TopicDetail should list the member's real upcoming meeting agendas. */
  usesMeetingSources?: boolean
}

export const TOPICS: Record<TopicId, ExploreTopic> = {
  'safer-walking': {
    id: 'safer-walking',
    category: 'Neighborhood life',
    title: 'Where could walking around your neighborhood feel safer?',
    summary: 'Name the everyday crossings, sidewalks, and routes that deserve a closer look.',
    whyItMatters:
      'Neighbors walking the same streets every day notice details that a map does not show. Naming specific places turns a general worry into something people can talk through together.',
    question: 'Which spot on your regular walk feels least comfortable, and what would change that?',
    suggestedTitle: 'A spot where walking could feel safer',
  },
  'park-usefulness': {
    id: 'park-usefulness',
    category: 'Parks & public space',
    title: 'What would make your neighborhood park more useful?',
    summary:
      'Parks serve toddlers, dog walkers, teenagers, older neighbors and people on a lunch break — rarely all equally well.',
    whyItMatters:
      'Hearing who uses a park, and who does not, helps a community see what is missing before anyone decides what to change.',
    question: 'Who is your nearest park working well for, and who is it missing?',
    suggestedTitle: 'Making our neighborhood park more useful',
  },
  'local-proposal': {
    id: 'local-proposal',
    category: 'Local decisions',
    title: 'What would you like to understand about a local proposal?',
    summary:
      'Agendas and proposals can be hard to read cold. Asking what one actually changes is often the most useful first question.',
    whyItMatters:
      'People can only weigh in on decisions they understand. Shared questions help everyone read the same proposal more clearly.',
    question: 'Is there a local proposal or agenda item you would like explained in plain language?',
    suggestedTitle: 'Question about a local proposal',
    usesMeetingSources: true,
  },
  'trees-shade': {
    id: 'trees-shade',
    category: 'Trees & shade',
    title: 'Where would more shade make the biggest difference?',
    summary:
      'Shade changes who can comfortably wait for a bus, walk to school, or sit outside on a hot afternoon.',
    whyItMatters:
      'The hottest blocks are not always the ones people think of first. Local knowledge helps point attention to the right streets.',
    question: 'Where would more shade make the biggest difference?',
    suggestedTitle: 'Where more shade would help',
  },
  'safer-crossings': {
    id: 'safer-crossings',
    category: 'Streets & safety',
    title: 'Which crossing would you make safer first?',
    summary:
      'A crossing that feels fine in a car can feel very different with a stroller, a cane, or a group of kids.',
    whyItMatters:
      'Specific intersections, described by people who use them on foot, are far easier to discuss than "traffic" in general.',
    question: 'Which crossing would you make safer first, and why that one?',
    suggestedTitle: 'A crossing that could be safer',
  },
  'public-spaces': {
    id: 'public-spaces',
    category: 'Parks & public space',
    title: 'What makes a public space feel welcoming?',
    summary:
      'Somewhere to sit, a bit of shade, something to do — small details decide whether people linger or pass through.',
    whyItMatters:
      'Places where neighbors run into each other are how a lot of community actually happens.',
    question: 'Where would a bench or a small gathering spot make people stay a little longer?',
    suggestedTitle: 'Making a public space more welcoming',
  },
  'clean-streets': {
    id: 'clean-streets',
    category: 'Streets & upkeep',
    title: 'Which streets could use more care?',
    summary:
      'Litter tends to collect in the same places — near certain stops, lots or corners — for reasons neighbors often already know.',
    whyItMatters:
      'Talking about where and why helps separate a one-off mess from a spot that needs a real fix, like a missing bin.',
    question: 'Is there a spot where litter keeps coming back, and what do you think causes it?',
    suggestedTitle: 'A street that could use more care',
  },
  'your-idea': {
    id: 'your-idea',
    category: 'Your idea',
    title: 'What would make your neighborhood feel better?',
    summary: 'Sometimes the most useful idea is the one nobody has put on a list yet.',
    whyItMatters:
      'A specific suggestion, described in your own words, gives neighbors something concrete to respond to.',
    question: 'What is one small change that would make your neighborhood feel better?',
    suggestedTitle: 'An idea for our neighborhood',
  },
}

export const FEATURED_TOPIC: TopicId = 'safer-walking'
export const QUESTION_TOPICS: TopicId[] = ['park-usefulness', 'local-proposal']

// ── Imagine a better neighborhood ─────────────────────────────────────────────────────

export type ImagineOption = 'trees' | 'crossings' | 'spaces' | 'clean' | 'other'

export const IMAGINE_OPTIONS: {
  key: ImagineOption
  label: string
  emoji: string
  response: string
  followUp: string
  /** Text equivalent of what the illustration now shows. */
  sceneText: string
  topic: TopicId
}[] = [
  {
    key: 'trees',
    label: 'More trees and shade',
    emoji: '🌳',
    response: 'Shade makes a street somewhere you want to be, not just pass through.',
    followUp: 'Where would more shade make the biggest difference?',
    sceneText: 'Trees now line the sidewalk, shading it.',
    topic: 'trees-shade',
  },
  {
    key: 'crossings',
    label: 'Safer crossings',
    emoji: '🚸',
    response: 'A clearly marked crossing helps everyone, especially kids and older neighbors.',
    followUp: 'Which crossing would you make safer first?',
    sceneText: 'A striped crosswalk now crosses the street.',
    topic: 'safer-crossings',
  },
  {
    key: 'spaces',
    label: 'Welcoming public spaces',
    emoji: '🪑',
    response: 'A place to sit is often all it takes for neighbors to stop and talk.',
    followUp: 'Where would a bench or gathering spot make people stay longer?',
    sceneText: 'Benches and a shared gathering table now sit by the sidewalk.',
    topic: 'public-spaces',
  },
  {
    key: 'clean',
    label: 'Cleaner streets',
    emoji: '🧹',
    response: 'Clean streets signal that a place is cared for — and people notice.',
    followUp: 'Is there a spot where litter keeps coming back?',
    sceneText: 'The litter on the sidewalk is gone.',
    topic: 'clean-streets',
  },
  {
    key: 'other',
    label: 'Something else',
    emoji: '💡',
    response: 'Good ideas do not always fit a list. Describe yours below.',
    followUp: 'What would you change?',
    sceneText: 'The street is unchanged — describe your idea in the field below.',
    topic: 'your-idea',
  },
]

// ── Tiny local adventure ──────────────────────────────────────────────────────────────

export type AdventureDuration = '15m' | '1h' | 'evening'

export const ADVENTURE_OPTIONS: {
  key: AdventureDuration
  label: string
  title: string
  description: string
  topic: TopicId
}[] = [
  {
    key: '15m',
    label: '15 minutes',
    title: 'Take a noticing walk',
    description: 'Walk a block or two and notice one place that feels welcoming — and one detail you would improve.',
    topic: 'safer-walking',
  },
  {
    key: '1h',
    label: 'About an hour',
    title: 'Explore a shared space',
    description: 'Spend some time in a local park or public space and watch how it serves different people.',
    topic: 'park-usefulness',
  },
  {
    key: 'evening',
    label: 'An evening',
    // Used only when no real meeting is available — never an invented event.
    title: 'Read up on one local decision',
    description: 'Pick one item your city is deciding and read about it, so you can ask a sharper question.',
    topic: 'local-proposal',
  },
]

// ── What's new ────────────────────────────────────────────────────────────────────────

/**
 * Civic Spaces has no published release-notes feed, so these describe changes that are
 * actually in this codebase — no dates, because none was ever published. When a real
 * updates source exists, read it here instead; WhatsNewCard's "View all updates" lists this array.
 */
export interface ProductUpdate {
  id: string
  category: string
  title: string
  /** One line for the card; the three fields below are the full note. */
  summary: string
  whatChanged: string
  why: string
  forYou: string
}

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: 'explore',
    category: 'Civic Spaces improvement',
    title: 'A better way to discover your community',
    summary: 'Explore gives every Civic Space topics and activities to start from — even before its first conversation.',
    whatChanged: 'Civic Spaces now opens on Explore: topics and short activities sit beside the forum.',
    why: 'Starting a post from a blank box is hard. A question to react to is easier.',
    forYou: 'Browse ideas first, then join a conversation when one interests you — your draft waits for you.',
  },
  {
    id: 'share-links',
    category: 'Conversations',
    title: 'Shareable conversation links',
    summary: 'Send a neighbor a link and it opens on that exact conversation.',
    whatChanged: 'Every conversation has its own link, and it survives signing in.',
    why: 'Links used to drop you on the home feed.',
    forYou: 'Send a neighbor a link and it opens on that exact conversation.',
  },
  {
    id: 'browse-shards',
    category: 'Communities',
    title: 'Browse other communities nearby',
    summary: 'Read more of your area. Posting stays in your own community.',
    whatChanged: 'You can read other communities in your own area, read-only.',
    why: 'Large places are split into several communities, and good conversations happen in each.',
    forYou: 'Read more of your area. Posting stays in your own community.',
  },
]
