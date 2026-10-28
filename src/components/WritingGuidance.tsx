import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { FOCUS } from './explore/exploreUi'
import { SECONDARY } from './FeedTabs'
import { WRITING_OUTLINE_TEXT, WRITING_STRUCTURE, appendPrompt, type WritingGuidance as Guidance } from '../lib/writingGuidance'

/**
 * "Need help getting started?" — optional, collapsed until asked for, and shared by the
 * topic page and the post composer so the help reads the same in both.
 *
 * 🔴 Never overwrites. A prompt chosen into an empty field goes straight in; into a
 * field with text, the writer is asked first — add it to the end, replace, or cancel —
 * and "add" is the default, because it is the choice that cannot lose anything.
 *
 * 🔴 Labelled as written prompts, because they are: hand-written per topic, the same for
 * everyone. Nothing here may say or imply they were generated for this reader.
 */
export function WritingGuidance({
  guidance,
  value,
  onChange,
  onApplied,
  maxLength,
}: {
  guidance: Guidance
  /** The text the prompt would go into. */
  value: string
  onChange: (next: string) => void
  /** After a prompt lands — the parent moves focus into the field. */
  onApplied?: () => void
  /** The field's limit, so a prompt can never push the text past it. */
  maxLength?: number
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  // A prompt waiting on "add or replace?" while the field already has text.
  const [pending, setPending] = useState<string | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (pending) confirmRef.current?.focus()
  }, [pending])

  const apply = (next: string) => {
    onChange(maxLength ? next.slice(0, maxLength) : next)
    setPending(null)
    onApplied?.()
  }

  const choose = (prompt: string) => {
    if (value.trim()) setPending(prompt)
    else apply(prompt)
  }

  const chip = `inline-flex max-w-full items-start gap-1.5 rounded-xl px-3 py-2 text-left text-sm font-medium ${SECONDARY} motion-safe:transition-colors ${FOCUS}`

  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-white/[0.08]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/[0.04] ${FOCUS}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-brand dark:text-brand-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
        </svg>
        <span className="flex-1">Need help getting started?</span>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Optional</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div id={`${id}-panel`} className="flex flex-col gap-4 border-t border-gray-200/70 dark:border-white/[0.08] px-3 pb-3 pt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Writing prompts from Empowered.vote, the same for everyone. Pick one to add it to your draft, or ignore them and write freely.
          </p>

          {pending && (
            <div role="group" aria-labelledby={`${id}-confirm`} className="rounded-xl bg-brand-muted dark:bg-brand/10 p-3">
              <p id={`${id}-confirm`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                You’ve already written something. Add this to the end, or replace your text?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => apply(appendPrompt(value, pending))}
                  className={`rounded-full bg-brand-btn px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover ${FOCUS}`}
                >
                  Add to the end
                </button>
                <button
                  type="button"
                  onClick={() => apply(pending)}
                  className={`rounded-full border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-3.5 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
                >
                  Replace my text
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline ${FOCUS}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <Section title="Questions you could answer">
            {guidance.questions.map((q) => (
              <li key={q}>
                <button type="button" onClick={() => choose(q)} className={chip}>
                  <PlusIcon />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{q}</span>
                </button>
              </li>
            ))}
          </Section>

          <Section title="Angles to consider" plain>
            {guidance.angles.map((a) => (
              <li key={a} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span aria-hidden="true" className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
                <span>{a}</span>
              </li>
            ))}
          </Section>

          <Section title="Sentence starters">
            {guidance.starters.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => choose(s)} className={chip}>
                  <PlusIcon />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{s}</span>
                </button>
              </li>
            ))}
          </Section>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">A simple structure</h4>
            <ol className="mt-1.5 flex flex-col gap-1.5">
              {WRITING_STRUCTURE.map((s, i) => (
                <li key={s.step} className="flex gap-2.5 text-sm">
                  <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted dark:bg-brand/15 text-xs font-bold text-brand dark:text-brand-light">
                    {i + 1}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{s.step}.</span> {s.hint}
                  </span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => choose(WRITING_OUTLINE_TEXT)}
              className={`mt-2 rounded text-sm font-semibold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
            >
              Use this outline
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, plain = false, children }: { title: string; plain?: boolean; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">{title}</h4>
      <ul className={`mt-1.5 flex flex-col ${plain ? 'gap-1' : 'gap-1.5'}`}>{children}</ul>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  )
}
