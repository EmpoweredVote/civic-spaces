/**
 * Recorded debates and candidate forums for the races above.
 *
 * 🔴 EVERY CARD IS A RECORDING, AND SAYS SO ON THE CARD — not in a footnote.
 * All 45 published `debate`/`forum` rows are recordings of events that have
 * already happened, and no upcoming debate is published anywhere in the stack.
 * Any wording that reads as a schedule is a promise the product cannot keep, and
 * a member who clicks expecting a live event has been misled by us rather than
 * by the data. (An actual debate schedule is 16-09's reserved room and a handoff
 * ask.)
 *
 * 🔴 A forum is labelled a forum. One of Bloomington's matches is a League of
 * Women Voters candidate forum, which is not a debate, and the record
 * distinguishes the two.
 *
 * 🔴 A null title is not a hole to fill. Three live rows have no published
 * title; the card then names the recording by its KIND and the race it covers,
 * both of which are record, rather than by a plausible title nobody published.
 *
 * 🔴 A missing link is left missing. Three rows carry neither a source URL nor a
 * playable address — including the CNN California Governor debate and
 * Bloomington's LWV forum. The card still names a recording that exists; it
 * simply does not offer a link that would go nowhere.
 */

import { useId } from 'react'
import type { MemberRace } from '../../../lib/races'
import type { RaceRecording } from '../../../lib/raceMedia'
import type { ExploreCtx } from '../ExploreContext'
import { CARD, FOCUS, SectionHeader } from '../exploreUi'
import { formatElectionDate } from './RacesModule'

/** The record's own `eventKind`, said in full. Never "upcoming", never a date promise. */
function kindLabel(kind: string): string {
  if (kind === 'debate') return 'Recorded debate'
  if (kind === 'forum') return 'Recorded candidate forum'
  return 'Recording'
}

function RecordingRow({ recording, raceName }: { recording: RaceRecording; raceName: string }) {
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand dark:bg-brand/20 dark:text-brand-light">
          {kindLabel(recording.kind)}
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {formatElectionDate(recording.date)}
        </span>
      </span>
      {/* The published title, or the kind and the race — both record. */}
      <span className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
        {recording.title ?? `${kindLabel(recording.kind)} — ${raceName}`}
      </span>
      {recording.watchUrl && (
        <a
          href={recording.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex w-fit items-center gap-1 rounded text-sm font-semibold text-brand hover:underline dark:text-brand-light ${FOCUS}`}
        >
          Watch the recording
          <span className="sr-only"> (opens in a new tab)</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      )}
    </li>
  )
}

/** The races on this tab that actually have a recording, in the races' own order. */
export function racesWithMedia(ctx: ExploreCtx): { race: MemberRace; recordings: RaceRecording[] }[] {
  const races = ctx.races?.[ctx.composition.level] ?? []
  const entries: { race: MemberRace; recordings: RaceRecording[] }[] = []
  for (const race of races) {
    const recordings = ctx.raceMedia?.get(race.raceId) ?? []
    // 🔴 A race with no recording gets NO entry — not an empty card.
    if (recordings.length > 0) entries.push({ race, recordings })
  }
  return entries
}

export function DebatesModule({ ctx }: { ctx: ExploreCtx }) {
  const headingId = useId()
  const entries = racesWithMedia(ctx)
  if (entries.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5 pt-2">
      <SectionHeader id={headingId} eyebrow="Watch back" title="Debates and candidate forums" />
      {/* 🔴 The framing sentence. Said once here and again on every card. */}
      <p className="px-1 -mt-2 text-sm text-gray-600 dark:text-gray-400">
        Recordings of events that have already taken place, for the races above.
      </p>
      <div className="grid gap-4 @xl:grid-cols-2">
        {entries.map(({ race, recordings }) => (
          <article key={race.raceId} className={`${CARD} flex flex-col gap-3 p-5 @xl:p-6`}>
            <h4 className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
              {race.positionName}
            </h4>
            <ul className="divide-y divide-gray-200/70 dark:divide-white/[0.06]">
              {recordings.map((recording) => (
                <RecordingRow key={recording.id} recording={recording} raceName={race.positionName} />
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
