import { useId, useRef, useState } from 'react'
import { PRODUCT_UPDATES, type ProductUpdate } from './exploreContent'
import { ArrowIcon, FOCUS } from './exploreUi'

/**
 * "What's new" — a sidebar-shaped card on Explore (the right column from md up, the
 * bottom of the Explore column below it). One featured update, up to two more as rows,
 * and "View all updates". Every update opens the same detail page in a modal.
 *
 * No dates: Civic Spaces has never published release notes, so there is no real date
 * to show, and an invented one would read as a release record.
 */

function Chevron() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** The featured update's tile: teal, a yellow sun-arc and the stripes of the EV mark. */
function UpdateTile() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 flex-shrink-0" aria-hidden="true">
      <rect width="64" height="64" rx="12" className="fill-[#1BA5A0]" />
      <path d="M40 0h12a12 12 0 0112 12v12A24 24 0 0140 0z" className="fill-brand-yellow" />
      <path d="M44 0a20 20 0 0020 20v-8A12 12 0 0052 0z" className="fill-[#1BA5A0]" />
      <rect x="12" y="26" width="26" height="5" rx="2.5" className="fill-white" />
      <rect x="12" y="35" width="32" height="5" rx="2.5" className="fill-brand-coral" />
      <rect x="12" y="44" width="20" height="5" rx="2.5" className="fill-white" />
    </svg>
  )
}

export function WhatsNewCard({
  className = '',
  onGoTo,
}: {
  className?: string
  /** Where a detail page's button leads. Without it (signed out) the button just closes. */
  onGoTo?: (view: 'explore' | 'conversations') => void
}) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  // What the modal shows: one update's page, or the list of all of them.
  const [view, setView] = useState<ProductUpdate | 'all' | null>(null)
  const [featured, ...rest] = PRODUCT_UPDATES
  if (!featured) return null

  const open = (next: ProductUpdate | 'all') => {
    setView(next)
    if (!dialogRef.current?.open) dialogRef.current?.showModal()
    dialogRef.current?.scrollTo({ top: 0 })
  }
  const close = () => dialogRef.current?.close()

  return (
    <section
      aria-labelledby={`${id}-h`}
      className={`rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 p-5 ${className}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-coral-text dark:text-brand-coral">From Empowered.vote</p>
      <h3 id={`${id}-h`} className="mt-1 text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">What's new</h3>

      {/* Featured update */}
      <button
        type="button"
        onClick={() => open(featured)}
        className={`group mt-4 w-full text-left flex items-center gap-3.5 rounded-2xl bg-gray-50 dark:bg-[#1b2436] p-4 hover:bg-gray-100 dark:hover:bg-[#202a3e] motion-safe:transition-colors ${FOCUS}`}
      >
        <UpdateTile />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-brand dark:text-brand-light">{featured.category}</span>
          <span className="mt-1 block text-base font-bold leading-snug text-gray-900 dark:text-gray-100">{featured.title}</span>
          <span className="mt-1.5 block text-sm text-gray-600 dark:text-gray-400">{featured.summary}</span>
        </span>
        <span className="text-brand-coral-text dark:text-brand-yellow motion-safe:transition-transform group-hover:translate-x-0.5" aria-hidden="true">
          <ArrowIcon />
        </span>
      </button>

      {/* Up to two more, as rows */}
      <ul className="mt-2 divide-y divide-gray-200/70 dark:divide-white/[0.08] border-b border-gray-200/70 dark:border-white/[0.08]">
        {rest.slice(0, 2).map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => open(u)}
              className={`group w-full text-left flex items-center gap-3 py-3.5 px-1 rounded-lg ${FOCUS}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{u.category}</span>
                <span className="mt-0.5 block text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:underline">{u.title}</span>
              </span>
              <span className="text-gray-500 dark:text-gray-300"><Chevron /></span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => open('all')}
        className={`mt-4 inline-flex items-center gap-1.5 rounded text-sm font-bold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
      >
        View all updates <ArrowIcon />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-d`}
        onClick={(e) => e.target === e.currentTarget && close()}
        onClose={() => setView(null)}
        className="m-auto w-[min(60rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white dark:bg-[#0b1220] p-0 shadow-2xl backdrop:bg-black/50"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className={`absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 ${FOCUS}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {view === 'all' && (
          <div className="px-6 py-8 sm:px-12 sm:py-12">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-coral-text dark:text-brand-coral">From Empowered.vote</p>
            <h2 id={`${id}-d`} className="mt-2 text-3xl sm:text-4xl font-medium tracking-tight text-gray-900 dark:text-gray-100">All updates</h2>
            <ul className="mt-6 divide-y divide-gray-200/70 dark:divide-white/[0.08] border-y border-gray-200/70 dark:border-white/[0.08]">
              {PRODUCT_UPDATES.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => open(u)} className={`group w-full text-left flex items-center gap-4 py-4 rounded-lg ${FOCUS}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-brand dark:text-brand-light">{u.category}</span>
                      <span className="mt-1 block text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:underline">{u.title}</span>
                      <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">{u.summary}</span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-300"><Chevron /></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view && view !== 'all' && (
          <>
            {/* Header — a soft coral-to-teal wash, as in the design. */}
            <div className="bg-gradient-to-br from-brand-coral/10 via-brand-muted to-white dark:from-brand-coral/15 dark:via-[#111a2c] dark:to-[#0f1a2c] px-6 py-10 sm:px-12 sm:py-14 border-b border-gray-200/70 dark:border-white/[0.08]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-coral-text dark:text-brand-coral">{view.category}</p>
              <h2 id={`${id}-d`} className="mt-3 pr-12 text-4xl sm:text-5xl font-medium leading-[1.08] tracking-tight text-gray-900 dark:text-gray-100">
                {view.title}
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">{view.summary}</p>
            </div>

            <div className="flex flex-col gap-7 px-6 py-10 sm:px-12">
              {[
                ['What changed', view.whatChanged],
                ['Why we changed it', view.why],
                ['What it means for you', view.forYou],
                ['Where to try it', view.whereToTry],
              ].map(([heading, text]) => (
                <div key={heading} className="max-w-2xl">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{heading}</h3>
                  <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-gray-400">{text}</p>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    close()
                    onGoTo?.(view.cta.goTo)
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl bg-brand-yellow px-5 py-3 text-base font-bold text-gray-900 ring-1 ring-gray-900/25 dark:ring-0 shadow-[0_4px_0_rgb(0_0_0_/_0.12)] hover:bg-brand-yellow-hover motion-safe:transition-colors ${FOCUS}`}
                >
                  {onGoTo ? view.cta.label : 'Close'} <ArrowIcon />
                </button>
                <button
                  type="button"
                  onClick={() => open('all')}
                  className={`inline-flex items-center rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-5 py-3 text-base font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
                >
                  All updates
                </button>
              </div>
            </div>
          </>
        )}
      </dialog>
    </section>
  )
}
