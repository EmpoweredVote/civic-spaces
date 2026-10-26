/**
 * "The races on your ballot" — the member's OWN contests, from the elections
 * response their most local area returns.
 *
 * 🔴 Every fact here is a published civic record carried verbatim: the office as
 * the state names it, the election as the state names it, and the candidates as
 * they filed. Our own words are confined to the section heading and the two
 * labels ("Incumbent", "Write-in"), each of which is a boolean off the record
 * rather than a claim of our own.
 *
 * 🔴 Neither `result` nor `primary_party` is rendered, and neither is in the
 * type. Both are null on every row today, and a blank party chip reads as
 * "independent" — a fact we would be inventing about a real candidate.
 *
 * 🔴 Level-aware from one component. On Federal it renders the federal races, on
 * State the state ones, and the classification behind that is by office NAME
 * (src/lib/races.ts) because `district_type` is unreliable for exactly the
 * statewide offices that matter most.
 */

import { useId } from 'react'
import type { ReactNode } from 'react'
import { isHttpUrl } from '../../../lib/exploreComposition'
import type { MemberCandidate, MemberRace } from '../../../lib/races'
import type { ExploreCtx } from '../ExploreContext'
import { CARD, SectionHeader } from '../exploreUi'

/** "3 November 2026" at local noon, so a date-only record is never a day early. */
export function formatElectionDate(value: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!parts) return value
  const [, year = '', month = '', day = ''] = parts
  const local = new Date(Number(year), Number(month) - 1, Number(day), 12)
  if (Number.isNaN(local.getTime())) return value
  return local.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

/** Up to two initials, for a candidate with no published photo. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300">
      {children}
    </span>
  )
}

/**
 * 🔴 `photo_url` through isHttpUrl, and a drawn fallback for the rest — 4 of
 * Bloomington's 33 candidates have no photo, and an empty <img> box beside a
 * real person's name reads as a failure that is theirs.
 */
function CandidateRow({ candidate }: { candidate: MemberCandidate }) {
  const photo = isHttpUrl(candidate.photoUrl) ? candidate.photoUrl : null
  return (
    <li className="flex items-center gap-3 py-2">
      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-white/10"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-bold text-brand ring-1 ring-gray-200 dark:bg-brand/20 dark:text-brand-light dark:ring-white/10"
        >
          {initialsOf(candidate.name)}
        </span>
      )}
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {candidate.name}
        </span>
        {candidate.isIncumbent && <Tag>Incumbent</Tag>}
        {candidate.isWriteIn && <Tag>Write-in</Tag>}
      </span>
    </li>
  )
}

function RaceCard({ race }: { race: MemberRace }) {
  return (
    <article className={`${CARD} flex flex-col gap-3 p-5 @xl:p-6`}>
      <div className="flex flex-col gap-1">
        <h4 className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">
          {race.positionName}
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {race.electionName} · {formatElectionDate(race.electionDate)}
          {race.seats > 1 && ` · ${race.seats} seats`}
        </p>
      </div>
      <ul className="divide-y divide-gray-200/70 dark:divide-white/[0.06]">
        {race.candidates.map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
      </ul>
    </article>
  )
}

export function RacesModule({ ctx }: { ctx: ExploreCtx }) {
  const headingId = useId()
  const races = ctx.races?.[ctx.composition.level] ?? []
  // The registry's available() already proves this, but a module that assumes
  // its own availability is one registry edit away from a crash.
  if (races.length === 0) return null

  const federal = ctx.composition.level === 'federal'

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5 pt-2">
      <SectionHeader
        id={headingId}
        eyebrow="On your ballot"
        title={federal ? 'Federal races where you live' : 'State races where you live'}
      />
      {/*
        🔴 "where you live", and it is load-bearing. These come from the member's
        most local area, so a member in Bloomington sees US House District 9 —
        the one they vote in — and not Indiana's other eight.
      */}
      <p className="px-1 -mt-2 text-sm text-gray-600 dark:text-gray-400">
        The {federal ? 'federal' : 'state'} contests for your own area, with the candidates as they filed.
      </p>
      <div className="grid gap-4 @xl:grid-cols-2">
        {races.map((race) => (
          <RaceCard key={race.raceId} race={race} />
        ))}
      </div>
    </section>
  )
}
