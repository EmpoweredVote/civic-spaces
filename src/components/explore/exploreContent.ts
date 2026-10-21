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
  /** One line under the title on a question card. */
  blurb?: string
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
    category: 'Public spaces',
    title: 'What would make your neighborhood park more useful?',
    blurb: 'Think shade, seating, play space, accessibility, or something we have not considered.',
    summary:
      'Parks serve toddlers, dog walkers, teenagers, older neighbors and people on a lunch break — rarely all equally well.',
    whyItMatters:
      'Hearing who uses a park, and who does not, helps a community see what is missing before anyone decides what to change.',
    question: 'Who is your nearest park working well for, and who is it missing?',
    suggestedTitle: 'Making our neighborhood park more useful',
  },
  'local-proposal': {
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
    sceneText: 'Trees now line the sidewalk, casting shade.',
    topic: 'trees-shade',
  },
  {
    key: 'crossings',
    label: 'Safer crossings',
    emoji: '🚸',
    response: 'A comfortable crossing can help neighbors feel connected.',
    followUp: 'Which crossing would you improve first?',
    sceneText: 'A bright crosswalk now connects both sides of the street.',
    topic: 'safer-crossings',
  },
  {
    key: 'spaces',
    label: 'Welcoming public spaces',
    emoji: '🪑',
    response: 'A place to sit is often all it takes for neighbors to stop and talk.',
    followUp: 'Where would a bench or gathering spot make people stay longer?',
    sceneText: 'Benches and a shared table now invite neighbors to stay.',
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
    sceneText: 'The block is unchanged — describe your idea alongside.',
    topic: 'your-idea',
  },
]

// ── Tiny local adventure ──────────────────────────────────────────────────────────────

export type AdventureDuration = '15m' | '1h' | 'evening'

export const ADVENTURE_OPTIONS: {
  key: AdventureDuration
  label: string
  /** Shown under the label in the time picker, so each choice says what it leads to. */
  hint: string
  emoji: string
  title: string
  description: string
  linkLabel: string
  /** Detail panel: how long, where, and how to try it. Generic on purpose — never a real event. */
  durationChip: string
  placeChip: string
  about: string
  steps: string[]
  topic: TopicId
}[] = [
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
  whereToTry: string
  /** The detail page's button: back to Explore, or over to Conversations. */
  cta: { label: string; goTo: 'explore' | 'conversations' }
}

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: 'explore',
    category: 'Civic Spaces improvement',
    title: 'A better way to discover your community',
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
]
