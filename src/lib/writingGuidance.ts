import { TOPIC_MORE_QUESTIONS } from '../mocks/topicQuestions'
import type { ExploreTopic } from '../types/explore'

/** At most this many questions in the picker. */
const MAX_QUESTIONS = 10

/**
 * The questions a writer can pick to start a post about this topic: the topic's own
 * question first, then the hand-written ones (src/mocks/topicQuestions.ts). A topic with
 * none written — an agenda item — gets questions built around its own verbatim title, so
 * they are about IT without a word of local fact added. Nothing here is generated live.
 */
export function questionsFor(topic: Pick<ExploreTopic, 'id' | 'question' | 'title' | 'sourceLabel'>): string[] {
  const more = TOPIC_MORE_QUESTIONS[topic.id] ?? fallbackQuestions(topic.sourceLabel ?? topic.title)
  return unique([topic.question, ...more]).slice(0, MAX_QUESTIONS)
}

function fallbackQuestions(subject: string): string[] {
  return [
    `What would you like to understand better about “${subject}”?`,
    'Who do you think this would affect most?',
    'What would you want decision-makers to weigh?',
    'What questions would you ask before it is decided?',
    'How would it change things for you, if at all?',
  ]
}

function unique(items: string[]): string[] {
  return items.filter((item, i) => items.indexOf(item) === i)
}
