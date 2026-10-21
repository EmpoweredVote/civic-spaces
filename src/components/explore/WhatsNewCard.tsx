import { useId, useRef, useState } from 'react'
import { CivicSpacesMark } from '../CivicSpacesMark'
import { PRODUCT_UPDATES, type ProductUpdate } from './exploreContent'
import { ArrowIcon, FOCUS } from './exploreUi'

/**
 * "What's new" — a sidebar-shaped card on Explore (the right column from md up, the
 * bottom of the Explore column below it). One featured update, up to two more as rows,
 * and "View all updates", which opens every note in a dialog.
 *
 * No dates: Civic Spaces has never published release notes, so there is no real date
 * to show, and an invented one would read as a release record.
 */

function Chevron({ open, direction = 'right' }: { open: boolean; direction?: 'right' | 'down' }) {
  const base = direction === 'right' ? (open ? 'rotate-90' : '') : open ? 'rotate-180' : ''
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 motion-safe:transition-transform ${base}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'right' ? 'M9 6l6 6-6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}

/** What changed / why / for you — the three things every note has to answer. */
function UpdateDetails({ update }: { update: ProductUpdate }) {
  return (
    <dl className="flex flex-col gap-1.5 text-xs">
      <div><dt className="font-semibold text-brand dark:text-brand-light">What changed</dt><dd className="text-gray-600 dark:text-gray-400">{update.whatChanged}</dd></div>
      <div><dt className="font-semibold text-brand dark:text-brand-light">Why</dt><dd className="text-gray-600 dark:text-gray-400">{update.why}</dd></div>
      <div><dt className="font-semibold text-brand dark:text-brand-light">What it means for you</dt><dd className="text-gray-600 dark:text-gray-400">{update.forYou}</dd></div>
    </dl>
  )
}

export function WhatsNewCard({ className = '' }: { className?: string }) {
  const id = useId()
  const [open, setOpen] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [featured, ...rest] = PRODUCT_UPDATES
  if (!featured) return null
  const toggle = (key: string) => setOpen((prev) => (prev === key ? null : key))

  return (
    <section
      aria-labelledby={`${id}-h`}
      className={`rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 p-5 ${className}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-coral-text dark:text-brand-coral">From Empowered.vote</p>
      <h3 id={`${id}-h`} className="mt-1 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">What's new</h3>

      {/* Featured update */}
      <div className="mt-4 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/[0.04]">
        <button
          type="button"
          onClick={() => toggle(featured.id)}
          aria-expanded={open === featured.id}
          aria-controls={`${id}-${featured.id}`}
          className={`w-full text-left flex items-center gap-3 p-4 rounded-xl ${FOCUS}`}
        >
          <span className="flex-shrink-0 w-14 h-14 rounded-xl bg-brand-muted dark:bg-brand/25 flex items-center justify-center" aria-hidden="true">
            <CivicSpacesMark className="h-9 w-9" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-brand dark:text-brand-light">{featured.category}</span>
            <span className="mt-0.5 block text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">{featured.title}</span>
            <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">{featured.summary}</span>
          </span>
          <span className="text-brand dark:text-brand-light"><Chevron open={open === featured.id} direction="down" /></span>
        </button>
        {open === featured.id && (
          <div id={`${id}-${featured.id}`} className="px-4 pb-4 -mt-1">
            <UpdateDetails update={featured} />
          </div>
        )}
      </div>

      {/* Up to two more, as rows */}
      <ul className="mt-2 divide-y divide-gray-200/70 dark:divide-white/[0.06]">
        {rest.slice(0, 2).map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => toggle(u.id)}
              aria-expanded={open === u.id}
              aria-controls={`${id}-${u.id}`}
              className={`w-full text-left flex items-center gap-3 py-3 px-1 rounded-lg ${FOCUS}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{u.category}</span>
                <span className="mt-0.5 block text-sm font-semibold text-gray-900 dark:text-gray-100">{u.title}</span>
              </span>
              <span className="text-gray-500 dark:text-gray-400"><Chevron open={open === u.id} /></span>
            </button>
            {open === u.id && (
              <div id={`${id}-${u.id}`} className="px-1 pb-3">
                <UpdateDetails update={u} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={`mt-3 inline-flex items-center gap-1.5 rounded text-sm font-bold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
      >
        View all updates <ArrowIcon />
      </button>

      {/* Every update, in full. A native modal dialog: focus is trapped and Esc closes it. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-all`}
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[80vh] rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white dark:bg-gray-900 p-0 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200/60 dark:border-white/[0.06]">
          <h2 id={`${id}-all`} className="text-base font-bold text-gray-900 dark:text-gray-100">All Civic Spaces updates</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className={`w-8 h-8 flex items-center justify-center rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${FOCUS}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col divide-y divide-gray-200/70 dark:divide-white/[0.06] px-5">
          {PRODUCT_UPDATES.map((u) => (
            <li key={u.id} className="py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand dark:text-brand-light">{u.category}</p>
              <h3 className="mt-0.5 mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">{u.title}</h3>
              <UpdateDetails update={u} />
            </li>
          ))}
        </ul>
      </dialog>
    </section>
  )
}
