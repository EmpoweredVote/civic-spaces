import { TOPIC_WRITING_PROMPTS } from '../mocks/writingGuidance'
import type { ExploreTopic } from '../types/explore'

/**
 * The optional "Need help getting started?" prompts for one topic.
 *
 * Hand-written prompts where a topic has them (src/mocks/writingGuidance.ts); otherwise
 * prompts built from the topic's own fields — its question, title and source — so an
 * agenda item still gets help that is about IT, without a word of local fact added.
 * Nothing here is generated live, and the UI says so.
 */
export interface WritingGuidance {
  questions: string[]
  angles: string[]
  starters: string[]
}

/** The three-step outline offered with every topic. */
export const WRITING_STRUCTURE = [
  { step: 'Describe what you noticed', hint: 'Where, and what you saw or experienced.' },
  { step: 'Explain why it matters', hint: 'Who it affects, and how.' },
  { step: 'Suggest a change or ask a question', hint: 'What you would like to see, or what you want to understand.' },
] as const

/** The outline as editable text, for "Use this outline". */
export const WRITING_OUTLINE_TEXT = [
  'What I noticed: ',
  '',
  'Why it matters: ',
  '',
  'What I’d suggest or ask: ',
].join('\n')

export function guidanceFor(topic: Pick<ExploreTopic, 'id' | 'question' | 'title' | 'sourceLabel'>): WritingGuidance {
  const authored = TOPIC_WRITING_PROMPTS[topic.id]
  if (authored) {
    return {
      questions: unique([topic.question, ...(authored.questions ?? [])]),
      angles: authored.angles,
      starters: authored.starters,
    }
  }
  // An agenda item or any topic without authored prompts. The item is named by its own
  // verbatim title; the starters stop where the writer's view begins.
  const subject = topic.sourceLabel ?? topic.title
  return {
    questions: [topic.question],
    angles: [
      'Say what you already know about it, and what you would like to understand better.',
      'Think about who it would affect, including people in a different situation from yours.',
    ],
    starters: [
      `I read about “${subject}” and I’d like to understand…`,
      `If “${subject}” goes ahead, I think it would…`,
    ],
  }
}

/**
 * Where a chosen prompt goes. Empty text takes it as is; otherwise it is appended on a
 * new paragraph. Replacing is a separate, explicit choice — see WritingGuidance.tsx.
 */
export function appendPrompt(current: string, prompt: string): string {
  const trimmed = current.replace(/\s+$/, '')
  return trimmed ? `${trimmed}\n\n${prompt}` : prompt
}

function unique(items: string[]): string[] {
  return items.filter((item, i) => items.indexOf(item) === i)
}
