// 🔴 `.ts` extensions on the three RUNTIME imports, so `node
// --experimental-strip-types` can load this file and run the SHIPPED
// questionsFor — check:agenda-topics 17-19 do. Node resolves a relative TS
// specifier only when it is spelled in full, and each of these three resolves
// to a file with no runtime imports of its own, which is the condition for it
// to keep working. The type import needs none: it is erased before Node looks.
import { TOPIC_MORE_QUESTIONS } from '../mocks/topicQuestions.ts'
import { elide, POST_TITLE_MAX } from './postTitle.ts'
import type { ExploreTopic } from '../types/explore'
import { namePlaceIn } from './exploreComposition.ts'

/** At most this many questions in the picker. */
const MAX_QUESTIONS = 10

/**
 * 🔴 Every question here is offered as a TITLE, not as body copy. QuestionPicker's
 * label in the composer is "Pick a question from Empowered.vote as your title", and
 * picking one calls `setValue('title', …)`. So each one answers to createPostSchema's
 * cap, and each one is elided rather than sliced — a question cut mid-word is still
 * read as the whole question, and the one built around a quoted agenda title would
 * lose its closing quote and its question mark with it.
 *
 * The subject is cut BEFORE the sentence is built rather than after, so the quote
 * closes and the sentence still ends in a "?". The budget follows the wording: change
 * the template and SUBJECT_MAX changes with it.
 */
const ABOUT_SUBJECT = (subject: string) => `What would you like to understand better about “${subject}”?`
const SUBJECT_MAX = POST_TITLE_MAX - ABOUT_SUBJECT('').length

/**
 * The questions a writer can pick to start a post about this topic: the topic's own
 * question first, then the hand-written ones (src/mocks/topicQuestions.ts). A topic with
 * none written — an agenda item — gets questions built around its own verbatim title, so
 * they are about IT without a word of local fact added. Nothing here is generated live.
 */
export function questionsFor(
  topic: Pick<ExploreTopic, 'id' | 'question' | 'title' | 'sourceLabel' | 'level' | 'moreQuestions' | 'namedFor'>,
): string[] {
  // Hand-written first; then a runtime topic's own list (an officials topic, whose id
  // no table can know); then questions built around the topic's own title.
  const more = TOPIC_MORE_QUESTIONS[topic.id] ?? topic.moreQuestions ?? fallbackQuestions(topic.sourceLabel ?? topic.title)
  const questions = unique([topic.question, ...more]).slice(0, MAX_QUESTIONS)
  // The topic card already says "Asheville"; its questions should not fall back to "your city".
  // Naming the place can LENGTHEN a question, so the cap is applied after it, last of all.
  const place = topic.namedFor
  const named = place ? questions.map((q) => namePlaceIn(q, topic.level, place)) : questions
  return named.map((q) => elide(q, POST_TITLE_MAX))
}

function fallbackQuestions(subject: string): string[] {
  return [
    ABOUT_SUBJECT(elide(subject, SUBJECT_MAX)),
    'Who do you think this would affect most?',
    'What would you want decision-makers to weigh?',
    'What questions would you ask before it is decided?',
    'How would it change things for you, if at all?',
  ]
}

function unique(items: string[]): string[] {
  return items.filter((item, i) => items.indexOf(item) === i)
}
