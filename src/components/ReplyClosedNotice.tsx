import { replyClosedCopy, type NoWriteReason } from '../lib/writeAccess'
import { FOCUS } from './explore/exploreUi'

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
      // 🔴 `bg-gray-100`, not `bg-gray-50`: in the feed this box sits on a gray-50
      // page, so gray-50 made it a hollow outline there while reading correctly in
      // the thread. `dark:bg-white/5` recedes against both the gray-950 page and the
      // gray-900 thread card, which a flat `dark:bg-gray-900` did not.
      //
      // 🔴 If a `dark:` class here ever looks like it is not applying, RESTART THE DEV
      // SERVER before theorising about the cascade. This exact box rendered light grey
      // on a near-black page for an hour, and the cause was a dev server started before
      // this file existed: classes new to the whole project were missing from its
      // generated CSS, while `bg-gray-50` — already used elsewhere — applied normally.
      // That asymmetry reads exactly like a specificity bug and is not one. Measured in
      // the built CSS, every `dark:` rule is emitted in a trailing block (offset ~73k+)
      // long after every bare utility (~29k), so a `dark:` variant always wins on order.
      className={`flex flex-col gap-2.5 rounded-xl border border-gray-200 bg-gray-100 px-4 py-3.5 dark:border-white/10 dark:bg-white/5${
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
              ? ` You're reading Slice ${viewingSliceIndex}; yours is Slice ${ownSliceIndex}.`
              : ` Yours is Slice ${ownSliceIndex}.`}
          </>
        )}
      </p>

      {/* 🔴 One row, at most one primary control. `justify-start` and not `w-full`:
          a full-width button reads as the composer it is standing in for, and this
          is deliberately quieter than the thing it replaced. */}
      {(copy?.action || (onReturnToOwnSlice && (reason === 'other-place' || reason === 'sibling-shard'))) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {copy?.action === 'explainer' && (
            <button
              type="button"
              onClick={onExplain}
              className={`inline-flex items-center rounded-full border border-brand px-3.5 py-1.5 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/5 ${FOCUS} dark:border-brand-light dark:text-brand-light dark:hover:border-brand-light dark:hover:bg-brand-light/10`}
            >
              {copy.actionLabel}
            </button>
          )}

          {copy?.action === 'accounts-app' && (
            <a
              href={LOCATION_SETTINGS_URL}
              className={`inline-flex items-center rounded-full border border-brand px-3.5 py-1.5 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/5 ${FOCUS} dark:border-brand-light dark:text-brand-light dark:hover:border-brand-light dark:hover:bg-brand-light/10`}
            >
              {copy.actionLabel}
            </a>
          )}

          {/* 🔴 NOT for a signed-out visitor. "Back to my spaces" names spaces they
              have not got, and AppShell passes `leavePlace` unconditionally on the
              public path — so gating it here is the only place it can be gated.
              ReadOnlyNotice rendered this control inside its 'other-place' and
              'sibling-shard' branches only, and AppShell carries a comment saying so
              deliberately; moving the notice must not quietly undo that. A visitor
              already has "Back to the welcome screen" in the place strip above. */}
          {onReturnToOwnSlice && (reason === 'other-place' || reason === 'sibling-shard') && (
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
