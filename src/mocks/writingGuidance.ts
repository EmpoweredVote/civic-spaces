// Stands in for: GET /api/civic-spaces/explore/topics/:id/writing-guidance — not yet served by the API
//
// "Need help getting started?" — optional writing prompts for each Explore topic.
//
// 🔴 Written by hand for this screen. NOT generated, and nothing here is computed per
// reader: the UI labels them "Writing prompts from Empowered.vote" and must never imply
// they were written live or by AI. No AI suggestion service exists in this platform.
//
// The rules every entry follows, because a prompt is words we put in someone's mouth:
//   - no opinion assumed: a starter opens a sentence, it never finishes the argument
//   - no local fact invented: places are [bracketed] for the reader to fill in
//   - no real people, places, dates, counts or quotes
//
// Topics with no entry here (an agenda item, a new topic) fall back to prompts built from
// the topic's own fields in src/lib/writingGuidance.ts. Data this needs from the API:
// per-topic prompts, once topics are served rather than bundled.
import type { TopicId } from '../types/explore'

export interface TopicWritingPrompts {
  /** Extra questions, after the topic's own `question`, which is always first. */
  questions?: string[]
  /** Different ways into the topic — a vantage point, not a position. */
  angles: string[]
  /** Openings with [blanks] the writer fills in. */
  starters: string[]
}

export const TOPIC_WRITING_PROMPTS: Partial<Record<TopicId, TopicWritingPrompts>> = {
  'trees-shade': {
    questions: ['Which streets or public spaces need more shade?'],
    angles: [
      'Share your experience walking, waiting for public transport, or using a local park on a hot day.',
      'Think about who is out in the heat most — children on the way to school, older neighbors, people working outdoors.',
    ],
    starters: [
      'I’ve noticed that [location] has very little shade, which affects…',
      'On hot afternoons, waiting at [stop or corner] is…',
    ],
  },
  'safer-crossings': {
    questions: ['Is there a crossing you avoid, or plan your route around?'],
    angles: [
      'Describe the crossing as you experience it — on foot, with a stroller, with a cane, or with kids.',
      'Compare a crossing that works well with one that does not.',
    ],
    starters: [
      'Crossing at [intersection] feels…',
      'Every time I cross at [intersection], I notice…',
    ],
  },
  'public-spaces': {
    angles: [
      'Think about a public space you like, and what makes you stay there.',
      'Think about one you pass through without stopping, and why.',
    ],
    starters: [
      'I’d spend more time at [place] if…',
      'What makes [place] work for me is…',
    ],
  },
  'clean-streets': {
    angles: [
      'Describe where litter collects and when you notice it most.',
      'Share what you think causes it — a missing bin, a busy stop, something else.',
    ],
    starters: [
      'Near [spot], litter seems to collect because…',
      'One small fix that might help at [spot] is…',
    ],
  },
  'your-idea': {
    angles: [
      'Start from something you see or do every week.',
      'Think small: one change, in one place, that people would notice.',
    ],
    starters: [
      'One small change I’d like to see near [place] is…',
      'Something that would make my neighborhood feel better is…',
    ],
  },
  'safer-walking': {
    angles: [
      'Walk through your usual route and describe the moment it feels least comfortable.',
      'Consider different times of day — morning, after dark, school pickup.',
    ],
    starters: [
      'On my regular walk, the part that feels least safe is [spot], because…',
      'Walking near [spot] would feel better if…',
    ],
  },
  'park-usefulness': {
    angles: [
      'Describe who you see at your nearest park, and who you do not.',
      'Think about what you would need to use it more often.',
    ],
    starters: [
      'At [park], I usually see…',
      'I would use [park] more if…',
    ],
  },
  'local-proposal': {
    questions: ['Which part of a proposal would you like explained?'],
    angles: [
      'Name the proposal and the part that is unclear to you.',
      'Ask what it would change for people in your situation.',
    ],
    starters: [
      'I read about [proposal] and I’m not sure what it would change for…',
      'Could someone explain what [proposal] means for…',
    ],
  },
  'city-getting-around': {
    angles: [
      'Pick one trip you make often and describe it step by step.',
      'Compare how the same trip works by car, bus, bike, or on foot.',
    ],
    starters: [
      'A trip I make often is from [place] to [place], and the hardest part is…',
      'Getting to [place] without a car means…',
    ],
  },
  'city-housing-and-zoning': {
    angles: [
      'Think about who you know who has moved away, or stayed, because of housing.',
      'Describe a part of the city you would change, and a part you would keep.',
    ],
    starters: [
      'Near [area], I think new homes would…',
      'When I think about housing here, what matters most to me is…',
    ],
  },
  'city-public-safety': {
    angles: [
      'Describe a place where you feel safe, and what makes it feel that way.',
      'Think about day versus night, or different parts of the city.',
    ],
    starters: [
      'I feel safest in [place] because…',
      'Something that would help me feel safer near [place] is…',
    ],
  },
  'city-upkeep': {
    angles: [
      'Name a spot that keeps getting overlooked and what it needs.',
      'Describe how long you have noticed the problem.',
    ],
    starters: [
      'A place in the city that keeps getting missed is [place], where…',
      'For a while now, [place] has needed…',
    ],
  },
  'city-growth-and-green': {
    angles: [
      'Think about an open space you value and why.',
      'Think about where new building might fit well.',
    ],
    starters: [
      'An open space I would want to protect is [place], because…',
      'A place where new building might make sense is [place], because…',
    ],
  },
  'county-budget-priorities': {
    angles: [
      'Start from a county service you use, and how well it works for you.',
      'Think about what you would fund first, and what could wait.',
    ],
    starters: [
      'If the county had a little more to spend, I would start with…',
      'A county service I rely on is [service], and…',
    ],
  },
  'county-shared-services': {
    angles: [
      'Pick one service and ask whether it works better close to home or county-wide.',
      'Describe a time a service crossed a town line, for better or worse.',
    ],
    starters: [
      'I think [service] works better when it’s run…',
      'Living in [town], I’ve noticed that [service]…',
    ],
  },
  'county-outside-the-city': {
    angles: [
      'Describe what daily life looks like outside the city limits.',
      'Think about what the county gets right, or misses, about where you live.',
    ],
    starters: [
      'Living outside the city in [area] means…',
      'Something the county could understand better about [area] is…',
    ],
  },
  'county-getting-across': {
    angles: [
      'Pick one trip across the county and describe what makes it hard or easy.',
      'Think about people who cannot drive.',
    ],
    starters: [
      'Getting from [place] to [place] takes…',
      'Without a car, crossing the county to reach [place] means…',
    ],
  },
  'state-housing-costs': {
    angles: [
      'Describe how housing costs show up in your life or your neighbors’ lives.',
      'Think about what the state should decide, and what should be left to cities.',
    ],
    starters: [
      'Housing costs here affect me because…',
      'I think the state’s role in housing should be…',
    ],
  },
  'state-school-funding': {
    angles: [
      'Start from a school you know — as a student, parent, teacher, or neighbor.',
      'Think about what should follow a student from place to place.',
    ],
    starters: [
      'From what I’ve seen at [school], funding affects…',
      'When it comes to paying for schools, I think what matters most is…',
    ],
  },
  'state-healthcare-access': {
    angles: [
      'Describe a time getting care was harder than it should have been.',
      'Think about distance, cost, waiting times, or finding the right provider.',
    ],
    starters: [
      'Getting care near [place] is hard because…',
      'One change that would make care easier to get is…',
    ],
  },
  'state-energy-mix': {
    angles: [
      'Think about your power bill, reliability, or what you see being built nearby.',
      'Name the trade-offs you would accept, and the ones you would not.',
    ],
    starters: [
      'When I think about where our power comes from, I care most about…',
      'A trade-off I’d be willing to accept is…',
    ],
  },
  'federal-role-abroad': {
    angles: [
      'Pick one kind of involvement — alliances, aid, or military — and say where you stand.',
      'Think about how decisions abroad show up at home.',
    ],
    starters: [
      'I think the United States should do more [or less] abroad when it comes to…',
      'A decision abroad that I’ve felt at home is…',
    ],
  },
  'federal-social-security': {
    angles: [
      'Think about what Social Security means for you, your parents, or your children.',
      'Name what you would change and what you would keep exactly as it is.',
    ],
    starters: [
      'For my family, Social Security means…',
      'One part of Social Security I would keep exactly as it is, is…',
    ],
  },
  'federal-trade': {
    angles: [
      'Think about jobs, prices, or businesses where you live.',
      'Name what you think should be protected, and what should be traded freely.',
    ],
    starters: [
      'Trade shows up where I live in…',
      'I think the United States should protect…',
    ],
  },
  'federal-elections': {
    angles: [
      'Describe your own experience of voting — registering, finding a polling place, or voting by mail.',
      'Name one change that would build your trust, and why.',
    ],
    starters: [
      'The last time I voted, I noticed…',
      'One change that would make me trust a federal election more is…',
    ],
  },
  'unified-news-from-here': {
    angles: [
      'Pick something happening where you live that rarely makes the news elsewhere.',
      'Think about what someone far away would most likely get wrong.',
    ],
    starters: [
      'Something people outside [place] might not know is…',
      'If you visited [place], I’d want you to understand…',
    ],
  },
  'unified-ai-everyday': {
    angles: [
      'Describe one place AI has already changed your day — at work, at school, or at home.',
      'Say whether the change was for better, worse, or both.',
    ],
    starters: [
      'AI has changed how I [task] by…',
      'Something about AI I’m still unsure about is…',
    ],
  },
  'unified-getting-around': {
    angles: [
      'Describe how most people get around where you live.',
      'Name one change you would make, and who it would help.',
    ],
    starters: [
      'Where I live, most people get around by…',
      'If I could change one thing about getting around [place], it would be…',
    ],
  },
  'unified-energy-future': {
    angles: [
      'Think about the energy you use now and what you would want a generation from now.',
      'Name the trade-offs that matter most to you.',
    ],
    starters: [
      'A generation from now, I’d like energy where I live to…',
      'The trade-off that matters most to me is…',
    ],
  },
}
