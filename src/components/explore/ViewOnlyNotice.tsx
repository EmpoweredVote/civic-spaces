/**
 * Explore's read-only notice, for a member browsing a SIBLING shard of their own
 * jurisdiction: readable by RLS, and every write path closed by it.
 *
 * 🔴 It carries a way out, and that is not decoration. The shard selector lives in
 * the Conversations toolbar and renders only while `effectiveView === 'conversations'`
 * (`AppShell`), so a member who picks a sibling in Conversations and then presses
 * Explore arrives view-only with NOTHING on screen that can undo it — research
 * Pitfall 8. Without this control they are stranded on a page that offers them
 * nothing and will not let them leave.
 *
 * The markup is lifted from `SliceFeedPanel`'s banner on purpose rather than
 * re-picked: the eye icon, the amber border/background pair written light-and-dark
 * together, the leading-snug paragraph, the underlined button. Three different
 * read-only notices in one app is three chances for one of them to be wrong in
 * dark mode.
 *
 * Only the wording changes, because what is unavailable here is different. In the
 * feed it is posting and replying; here it is posting AND drafting — a draft that
 * can only ever be refused is a trap, so Explore hides the form too and the notice
 * has to say where writing lives instead. It is informational, not an error.
 */
export function ViewOnlyNotice({
  viewingSliceIndex,
  ownSliceIndex,
  onReturnToOwnSlice,
}: {
  /** The shard on screen. Undefined only if the siblings query has not answered yet. */
  viewingSliceIndex?: number
  /** The member's own shard — where posting and drafting stay. */
  ownSliceIndex?: number
  onReturnToOwnSlice?: () => void
}) {
  return (
    <div
      data-explore-view-only-notice=""
      className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p className="leading-snug">
        You're exploring Slice {viewingSliceIndex ?? '—'} read-only.
        {typeof ownSliceIndex === 'number' && (
          <>
            {' '}Starting a conversation — and the draft it begins with — stays in your own
            community, Slice {ownSliceIndex}.
          </>
        )}
        {onReturnToOwnSlice && (
          <>
            {' '}
            <button
              type="button"
              onClick={onReturnToOwnSlice}
              className="font-semibold underline hover:no-underline"
            >
              Switch back to your community
            </button>
          </>
        )}
      </p>
    </div>
  )
}
