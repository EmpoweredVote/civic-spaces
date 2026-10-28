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

/**
 * Which question the text currently starts with, if any. The selection is READ FROM THE
 * TEXT rather than kept beside it, so it can never disagree with what will be posted —
 * edit the question line and it simply stops being selected.
 */
export function selectedQuestion(body: string, questions: string[]): string | null {
  return questions.find((q) => body === q || body.startsWith(`${q}\n`)) ?? null
}

/**
 * Select, switch or clear the opening question. Never loses the writer's own words:
 * selecting puts the question on the first line and keeps everything else below it,
 * switching swaps only that line, and clearing removes only that line.
 */
export function toggleQuestion(body: string, questions: string[], question: string): string {
  const current = selectedQuestion(body, questions)
  const rest = current ? body.slice(current.length).replace(/^\n+/, '') : body.replace(/^\s+/, '')
  if (current === question) return rest
  return `${question}\n\n${rest}`
}

function unique(items: string[]): string[] {
  return items.filter((item, i) => items.indexOf(item) === i)
}
