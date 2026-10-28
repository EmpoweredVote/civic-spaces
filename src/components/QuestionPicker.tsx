import { useId, useState } from 'react'
import { FOCUS } from './explore/exploreUi'
import { SECONDARY } from './FeedTabs'
import { selectedQuestion, toggleQuestion } from '../lib/writingGuidance'

/** Questions shown before "More questions". */
const FIRST = 2
/** At most this many more behind "More questions". */
const MORE_MAX = 5

/**
 * "Pick a question" — the one piece of writing help, shared by the topic page and the
 * post composer. Two question chips, and "More questions" for up to five more; tapping
 * one puts it into the text box (where the placeholder was) and shows it as selected.
 *
 * 🔴 Never loses text. The chosen question goes on the first line and everything the
 * writer typed stays below it; picking another swaps only that line; tapping the selected
 * one again removes only that line. Which one is selected is read from the text itself,
 * so editing the question line simply deselects it.
 *
 * 🔴 Hand-written questions, the same for everyone — never presented as generated.
 */
export function QuestionPicker({
  questions,
  value,
  onChange,
  onPicked,
}: {
  questions: string[]
  /** The post text the question starts. */
  value: string
  onChange: (next: string) => void
  /** After a pick — the parent moves focus into the text box. */
  onPicked?: () => void
}) {
  const id = useId()
  const selected = selectedQuestion(value, questions)
  const shownMax = FIRST + MORE_MAX
  const list = questions.slice(0, shownMax)
  // A selected question behind "More" keeps the list open, so the selection is visible.
  const [expanded, setExpanded] = useState(() => !!selected && list.indexOf(selected) >= FIRST)
  const open = expanded || (!!selected && list.indexOf(selected) >= FIRST)
  const shown = open ? list : list.slice(0, FIRST)
  const hasMore = list.length > FIRST

  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-xs text-gray-600 dark:text-gray-400">
        Not sure where to start? Pick a question from Empowered.vote:
      </p>
      <ul aria-labelledby={`${id}-label`} className="flex flex-wrap items-start gap-2">
        {shown.map((q) => {
          const on = q === selected
          return (
            <li key={q} className="max-w-full">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onChange(toggleQuestion(value, questions, q))
                  onPicked?.()
                }}
                className={`inline-flex max-w-full items-start gap-1.5 rounded-xl px-3 py-2 text-left text-sm font-medium motion-safe:transition-colors ${FOCUS} ${
                  on
                    ? 'bg-brand-btn text-white dark:bg-brand-light dark:text-gray-900'
                    : SECONDARY
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={on ? 'M5 13l4 4L19 7' : 'M12 5v14M5 12h14'} />
                </svg>
                <span className="min-w-0 [overflow-wrap:anywhere]">{q}</span>
              </button>
            </li>
          )
        })}
        {hasMore && (
          <li>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpanded(!open)}
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 ${FOCUS}`}
            >
              {open ? 'Fewer questions' : 'More questions'}
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}
