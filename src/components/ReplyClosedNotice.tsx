import { replyClosedCopy, type NoWriteReason } from '../lib/writeAccess'

/** Where an address is changed. The same URL ReadOnlyNotice uses for the explore surface. */
const LOCATION_SETTINGS_URL = 'https://app.empowered.vote/settings/location'

/**
 * The closed door: what sits where the reply box would be, for a reader who may
 * read here and may not write here.
 *
 * ── Why this replaced ReadOnlyNotice on the feed and the thread ──────────────
 *
 * 🔴 It is not an addition beside it. Both components answer "why can you not write
 * here", and two of those in one slot is how 18-03 shipped two stacked banners —
 * caught by looking at a screenshot, which is not a method anyone should rely on
 * twice. `ReadOnlyNotice` is still the component for `surface="explore"`, which has
 * its own copy and its own guard assertions.
 *
 * 🔴 And the old notice is not merely redundant here, it contradicts the decisions
 * this phase implements: its signed-out copy ends in a **"Sign in" link**, and D-36 /
 * D-37 say the control "does not say 'Sign in' and does not open a login form" — the
 * explainer comes after the attempt, reached by pressing the door.
 *
 * ── The treatment is decided, not a preference ───────────────────────────────
 *
 * 🔴 D-35, teal outline, NO FILL, and deliberately not urgent. Chris, on the
 * coral-filled version: *"I don't like the bright red color to force someone to log
 * in — it should be subtler and less abrasive. Not everyone wants to login, and
 * that's ok."* So: no coral, no filled button, no badge, nothing that reads as an
 * alarm. It is clearly a control and clearly in no hurry.
 *
 * 🔴 D-38, NEVER `disabled` and NEVER `cursor-not-allowed`. `check:explore-rooms`
 * goal 6 forbids both outright across this surface, and a door that does not open is
 * still a door you can knock on. When there is nowhere useful to go — a sibling shard
 * — the sentence stands alone and no control renders at all, which is not a dead end
 * because nothing invited a press.
 *
 * 🔴 `data-read-only-notice` is carried over from the component this replaces.
 * `check:explore-gate` and `check:place-entry` both query that attribute to decide
 * whether the write gate is present at all; dropping it would turn their gate
 * assertions green-on-nothing rather than red.
 */
export function ReplyClosedNotice({
  reason,
  surface,
  onExplain,
  viewingSliceIndex,
  ownSliceIndex,
  onReturnToOwnSlice,
}: {
  /**
   * Straight from `whyNoWrite()`. 🔴 Null is a DEGRADED state, not an unused one: a
   * gated surface that could not name its reason still has to say it is gated. It
   * renders the sentence-less shell with no control rather than guessing — a wrong
   * reason reads as true and is worse than an absent one.
   */
  reason: NoWriteReason | null
  surface: 'feed' | 'thread'
  /** Opens the explainer. Never a login form (D-37). */
  onExplain: () => void
  /** The shard on screen, and the viewer's own — the sibling-shard detail. */
  viewingSliceIndex?: number
  ownSliceIndex?: number
  /** The escape hatch out of a sibling shard. Not a remedy, so not an `action`. */
  onReturnToOwnSlice?: () => void
}) {
  const copy = reason ? replyClosedCopy(reason) : null

  return (
    <div
      data-read-only-notice={reason ?? 'unknown'}
      data-read-only-surface={surface}
      data-reply-closed=""
      // 🔴 `dark:bg-gray-900`, NOT `dark:bg-white/5` and NOT `dark:bg-white/[0.03]`.
      // Both of those were written here first and NEITHER applied: a `dark:` variant
      // carries no extra specificity in Tailwind v4 (`:where(.dark, …)` is 0), so when
      // it collides with a base utility on the SAME property the winner is whichever
      // Tailwind emits last — and it emits `bg-white` before `bg-gray-50`. The box
      // rendered light grey on a near-black page with barely legible text, while the
      // sibling `dark:border-white/10` applied fine because `border-white` happens to
      // sort after `border-gray-200`. Pick a dark value from the same scale as the
      // light one, which is what every other card in this app already does.
      className={`flex flex-col gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-white/10 dark:bg-gray-900${
        surface === 'feed' ? ' mb-3' : ''
      }`}
    >
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {copy
          ? copy.sentence
          : 'Replying is not available here.'}
        {/* The slice-scoping detail a member on a sibling shard has today. Dropping
            it would be an information regression for members in a phase about
            visitors — see the ledger's Ruling 2. */}
        {reason === 'sibling-shard' && typeof ownSliceIndex === 'number' && (
          <>
            {typeof viewingSliceIndex === 'number'
              ? ` You're reading Room ${viewingSliceIndex}; yours is Room ${ownSliceIndex}.`
              : ` Yours is Room ${ownSliceIndex}.`}
          </>
        )}
      </p>

      {/* 🔴 One row, at most one primary control. `justify-start` and not `w-full`:
          a full-width button reads as the composer it is standing in for, and this
          is deliberately quieter than the thing it replaced. */}
      {(copy?.action || onReturnToOwnSlice) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {copy?.action === 'explainer' && (
            <button
              type="button"
              onClick={onExplain}
              className="inline-flex items-center rounded-full border border-brand px-3.5 py-1.5 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-brand-light dark:text-brand-light dark:hover:border-brand-light dark:hover:bg-brand-light/10"
            >
              {copy.actionLabel}
            </button>
          )}

          {copy?.action === 'accounts-app' && (
            <a
              href={LOCATION_SETTINGS_URL}
              className="inline-flex items-center rounded-full border border-brand px-3.5 py-1.5 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-brand-light dark:text-brand-light dark:hover:border-brand-light dark:hover:bg-brand-light/10"
            >
              {copy.actionLabel}
            </a>
          )}

          {onReturnToOwnSlice && (
            <button
              type="button"
              onClick={onReturnToOwnSlice}
              className="text-sm font-semibold text-gray-600 underline hover:no-underline dark:text-gray-300"
            >
              Back to my spaces
            </button>
          )}
        </div>
      )}
    </div>
  )
}
