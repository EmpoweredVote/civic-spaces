import type { ReactNode } from 'react'
import { SECONDARY } from '../FeedTabs'

/**
 * Explore's building blocks. Everything reuses the forum's vocabulary — the feed card
 * shell, FeedTabs' pill controls, PostButton's yellow — so Explore reads as part of the
 * same column rather than a pasted-in page. Scoped here; nothing global changes.
 */

export const CARD =
  'rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-gray-900 shadow-sm'

/** Visible keyboard focus for every Explore control. */
export const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:focus-visible:ring-brand-light/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900'

/** EV yellow, PostButton's look without its plus icon. The ring gives it an edge on white (1.46:1). */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
  size = 'md',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  /** lg: the featured topic's call to action — bigger, with a pressed-key shadow. */
  size?: 'md' | 'lg' | 'card'
}) {
  const sizing = {
    lg: 'rounded-xl px-5 py-3 text-base font-bold shadow-[0_4px_0_rgb(0_0_0_/_0.12)] dark:shadow-[0_4px_0_rgb(0_0_0_/_0.45)]',
    // Same pressed-key shadow, at the size of the outlined button beside it.
    card: 'rounded-xl px-4 py-2.5 text-sm font-bold shadow-[0_3px_0_rgb(0_0_0_/_0.12)] dark:shadow-[0_3px_0_rgb(0_0_0_/_0.45)]',
    md: 'rounded-full px-4 py-2 text-sm font-semibold shadow-sm',
  }[size]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 ${sizing} bg-brand-yellow text-gray-900 ring-1 ring-gray-900/25 dark:ring-0 hover:bg-brand-yellow-hover disabled:opacity-50 disabled:cursor-not-allowed motion-safe:transition-colors ${FOCUS}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed motion-safe:transition-colors ${FOCUS}`}
    >
      {children}
    </button>
  )
}

/** Small coral category label. Coral-text on white is 4.68:1; plain coral on gray-900 is 5.65:1. */
export function CategoryLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-brand-coral-text dark:text-brand-coral">
      {children}
    </p>
  )
}

/** The honesty label every piece of illustrative content carries. */
export function StarterTag({ children = 'Conversation starter' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/10 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3-3h11a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14z" />
      </svg>
      {children}
    </span>
  )
}

export function ArrowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
