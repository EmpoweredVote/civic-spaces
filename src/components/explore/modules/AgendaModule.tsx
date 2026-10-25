/**
 * "What the Common Council is working on" — one place's published agenda,
 * quoted.
 *
 * Everything with a fact in it here came off `GET /api/meetings/:id/agenda-items`
 * and is rendered as it arrived. Our own words are confined to the section
 * heading, the "On the agenda" eyebrow and the templated question on the topic
 * page, none of which assert anything about the place.
 *
 * 🔴 The body is named FROM THE RECORD. Bloomington's is the Common Council,
 * and "Bloomington City Council" is a plausible-sounding name for a body that
 * does not exist under that name — invented civic record in its mildest and
 * most likely form. bodyNameFrom() reads the meeting's own title; where it
 * cannot, the header names no body at all and links the document instead.
 *
 * 🔴 Titles are clamped in CSS, never in the data. An agenda title runs 60-150
 * characters and the full text is on the topic page. A truncated civic title
 * stored as data is a quote nobody said.
 *
 * 🔴 The generated-summary label is on the CARD, not only on the topic page.
 * The title and the reference are the council's; the summary is the pipeline's
 * reading of them, and a reader who only ever sees the card must still be able
 * to tell the two apart. That is SourceNote's job and it is not re-worded here.
 */

import { useId } from 'react'
import type { ReactNode } from 'react'
import { bodyNameFrom } from '../../../lib/agendaTopics'
import { isHttpUrl } from '../../../lib/exploreComposition'
import type { ExploreCtx } from '../ExploreContext'
import { CARD, FOCUS, SectionHeader } from '../exploreUi'
import { SourceNote } from '../provenance'

/** "14 October 2026" at local noon, so a date-only record is never a day early. */
function formatAgendaDate(value: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!parts) return value
  const [, year = '', month = '', day = ''] = parts
  const local = new Date(Number(year), Number(month) - 1, Number(day), 12)
  if (Number.isNaN(local.getTime())) return value
  return local.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

/** A verbatim fragment of the record — a legislation reference, or a stage. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300">
      {children}
    </span>
  )
}

export function AgendaModule({ ctx }: { ctx: ExploreCtx }) {
  const headingId = useId()
  const agenda = ctx.agenda
  // The registry's available() already proves both, but this module must be
  // readable on its own: a module that assumes its own availability is one
  // registry edit away from a crash.
  if (!agenda || agenda.topics.length === 0) return null

  const { meeting, topics } = agenda
  const body = bodyNameFrom(meeting)
  const date = formatAgendaDate(meeting.date)
  const href = meeting.sourceUrl && isHttpUrl(meeting.sourceUrl) ? meeting.sourceUrl : null

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5 pt-2">
      <SectionHeader
        id={headingId}
        eyebrow="In their own words"
        title={body ? `On the ${body}'s agenda` : 'On the published agenda'}
      />

      {/* The provenance for the whole set, as one real sentence about one real
          document. It is what makes everything below it honest, so it sits
          above the cards rather than under them. */}
      <p className="px-1 -mt-2 text-sm text-gray-600 dark:text-gray-400">
        {body ? `From the ${body}'s agenda of ${date}.` : `From the agenda of ${date}.`}{' '}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded font-semibold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
          >
            Read the agenda
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </p>

      <div className="grid gap-4 @xl:grid-cols-2">
        {/*
          🔴 The card is an <article>, NOT a button, and there is no stretched
          overlay link either. SourceNote renders a real <a> to the agenda file,
          and a link inside a button — or under a full-card ::after — is invalid
          HTML that renders perfectly and cannot be clicked. PR #92 shipped
          exactly that bug: a photo credit's licence link buried under a
          z-indexed content layer, invisible to every screenshot and to tsc.
          So the clickable thing is the title, and the link is beside it.
        */}
        {topics.map((topic) => (
          <article
            key={topic.id}
            className={`${CARD} group flex flex-col items-start gap-2.5 p-5 @xl:p-6`}
          >
            {topic.sourceLabel && (
              <span className="flex flex-wrap gap-1.5">
                {topic.sourceLabel.split(' · ').map((part) => (
                  <Chip key={part}>{part}</Chip>
                ))}
              </span>
            )}
            <h4 className="w-full">
              <button
                type="button"
                onClick={() => ctx.openTopic(topic.id)}
                className={`flex w-full flex-col items-start gap-2 rounded-lg text-left ${FOCUS}`}
              >
                {/* line-clamp-3, not a substring. The whole title is in the DOM
                    and on the topic page; only its display is shortened. */}
                <span className="line-clamp-3 text-base font-semibold leading-snug text-gray-900 group-hover:text-brand dark:text-gray-100 dark:group-hover:text-brand-light motion-safe:transition-colors">
                  {topic.title}
                </span>
                <span className="line-clamp-4 text-sm font-normal text-gray-600 dark:text-gray-400">
                  {topic.summary}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand dark:text-brand-light">
                  Talk about this
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 motion-safe:transition-transform group-hover:translate-x-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            </h4>
            {/* 🔴 On the card, not only behind a click. */}
            <SourceNote topic={topic} className="mt-auto border-t border-gray-200/70 pt-2.5 dark:border-white/[0.06]" />
          </article>
        ))}
      </div>
    </section>
  )
}
