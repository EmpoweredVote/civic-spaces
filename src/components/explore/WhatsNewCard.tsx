import { useEffect, useId, useRef, useState } from 'react'
import { PRODUCT_UPDATES, type ProductUpdate } from './exploreContent'
import { ArrowIcon, FOCUS } from './exploreUi'

/**
 * "What's new" — a sidebar-shaped card on Explore (the right column from md up, the
 * bottom of the Explore column below it). Compact previews only: an update with an
 * image shows it with the title over it, one without is a single text row. The summary
 * and the full note live in the detail view, a modal over the page, so closing it
 * leaves the reader exactly where they were and puts focus back on what they clicked.
 *
 * Everything in the card is clamped and `min-w-0`, so a long title wraps or truncates
 * instead of widening the sidebar track.
 *
 * No dates: Civic Spaces has never published release notes, so there is no real date
 * to show, and an invented one would read as a release record.
 */

/** How many previews the card shows; the rest are one click away in "All updates". */
const PREVIEW_COUNT = 3

function Chevron({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${className} flex-shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  )
}

/**
 * One update as a preview. The image is decorative here (alt=""): the button's name is
 * the category and title, which are real text over it. The scrim is darkest where the
 * text sits, so white text clears 4.5:1 even over a white photo.
 */
function UpdatePreview({ update, onOpen }: { update: ProductUpdate; onOpen: () => void }) {
  if (update.image) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`group relative block aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-800 text-left ${FOCUS}`}
      >
        <img
          src={update.image.src}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/95 from-30% via-black/80 via-60% to-black/10" aria-hidden="true" />
        <span className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)]">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-white/90">{update.category}</span>
            <span className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-white [overflow-wrap:anywhere] group-hover:underline">
              {update.title}
            </span>
          </span>
          <span className="pb-0.5 text-white"><Chevron /></span>
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] motion-safe:transition-colors ${FOCUS}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-brand dark:text-brand-light">{update.category}</span>
        <span className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 [overflow-wrap:anywhere] group-hover:underline">
          {update.title}
        </span>
      </span>
      <span className="text-gray-500 dark:text-gray-400"><Chevron /></span>
    </button>
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
  const headingRef = useRef<HTMLHeadingElement>(null)
  // The control that opened the modal, so closing it hands focus straight back.
  const openerRef = useRef<HTMLElement | null>(null)
  // What the modal shows: one update's page, or the list of all of them.
  const [view, setView] = useState<ProductUpdate | 'all' | null>(null)
  // Whether the open update was reached from "All updates", so it can offer the way back.
  const [fromAll, setFromAll] = useState(false)

  // Each view change moves focus to its heading, so a screen reader announces the new
  // page and Tab starts from the top of it rather than from a button that has gone.
  useEffect(() => {
    if (view) headingRef.current?.focus()
  }, [view])

  if (PRODUCT_UPDATES.length === 0) return null

  const open = (next: ProductUpdate | 'all', viaAll = false) => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    }
    setFromAll(viaAll)
    setView(next)
    dialog.scrollTo({ top: 0 })
  }
  const close = () => dialogRef.current?.close()

  const previews = PRODUCT_UPDATES.slice(0, PREVIEW_COUNT)

  return (
    <section
      aria-labelledby={`${id}-h`}
      className={`min-w-0 rounded-xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 p-4 ${className}`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 id={`${id}-h`} className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          What's new
        </h3>
        <button
          type="button"
          onClick={() => open('all')}
          className={`rounded text-xs font-semibold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
        >
          View all<span className="sr-only"> updates</span>
        </button>
      </div>

      <ul className="flex flex-col gap-1">
        {previews.map((u) => (
          <li key={u.id} className={u.image ? 'py-1' : undefined}>
            <UpdatePreview update={u} onOpen={() => open(u)} />
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-d`}
        onClick={(e) => e.target === e.currentTarget && close()}
        onClose={() => {
          setView(null)
          setFromAll(false)
          const opener = openerRef.current
          openerRef.current = null
          if (opener?.isConnected) opener.focus()
        }}
        className="m-auto w-[min(60rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200/60 dark:border-white/[0.08] bg-white dark:bg-[#0b1220] p-0 shadow-2xl backdrop:bg-black/50"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className={`absolute right-4 top-4 sm:right-5 sm:top-5 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 ${FOCUS}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {view === 'all' && (
          <div className="px-6 py-8 sm:px-12 sm:py-12">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-coral-text dark:text-brand-coral">From Empowered.vote</p>
            <h2
              id={`${id}-d`}
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 pr-12 text-3xl sm:text-4xl font-medium tracking-tight text-gray-900 dark:text-gray-100 focus:outline-none"
            >
              All updates
            </h2>
            <ul className="mt-6 divide-y divide-gray-200/70 dark:divide-white/[0.08] border-y border-gray-200/70 dark:border-white/[0.08]">
              {PRODUCT_UPDATES.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => open(u, true)} className={`group w-full text-left flex items-center gap-4 py-4 rounded-lg ${FOCUS}`}>
                    {u.image && (
                      <img src={u.image.src} alt="" loading="lazy" className="hidden sm:block h-16 w-28 flex-shrink-0 rounded-lg object-cover" />
                    )}
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
            <div className="bg-gradient-to-br from-brand-coral/10 via-brand-muted to-white dark:from-brand-coral/15 dark:via-[#111a2c] dark:to-[#0f1a2c] px-6 pt-8 pb-10 sm:px-12 sm:pt-10 sm:pb-14 border-b border-gray-200/70 dark:border-white/[0.08]">
              {fromAll && (
                <button
                  type="button"
                  onClick={() => open('all')}
                  className={`-ml-1 mb-5 inline-flex items-center gap-1 rounded px-1 text-sm font-semibold text-brand dark:text-brand-light hover:underline ${FOCUS}`}
                >
                  <Chevron className="h-4 w-4 rotate-180" /> All updates
                </button>
              )}
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-coral-text dark:text-brand-coral">{view.category}</p>
              <h2
                id={`${id}-d`}
                ref={headingRef}
                tabIndex={-1}
                className="mt-3 pr-12 text-3xl sm:text-5xl font-medium leading-[1.08] tracking-tight text-gray-900 dark:text-gray-100 focus:outline-none"
              >
                {view.title}
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">{view.summary}</p>
            </div>

            {view.image && (
              <div className="px-6 pt-8 sm:px-12 sm:pt-10">
                <img src={view.image.src} alt={view.image.alt} className="w-full max-w-2xl rounded-xl border border-gray-200/70 dark:border-white/[0.08]" />
              </div>
            )}

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
                {!fromAll && (
                  <button
                    type="button"
                    onClick={() => open('all')}
                    className={`inline-flex items-center rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-gray-900 px-5 py-3 text-base font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 ${FOCUS}`}
                  >
                    All updates
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </dialog>
    </section>
  )
}
