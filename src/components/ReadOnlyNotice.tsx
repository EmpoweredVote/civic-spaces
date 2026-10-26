import type { NoWriteReason } from '../lib/writeAccess'

/**
 * The one read-only notice: why the viewer may not write here, and what to do
 * about it.
 *
 * It replaces three near-identical amber notices — the feed's banner,
 * ThreadView's banner and Explore's `ViewOnlyNotice` — whose own header already
 * made the argument: *"Three different read-only notices in one app is three
 * chances for one of them to be wrong in dark mode."* It had to exist anyway
 * because the wording differed per surface. With FOUR reasons × three surfaces
 * the copying stops here: one component, parameterised, so the amber pair is
 * written light-and-dark together exactly once.
 *
 * 🔴 It carries a way out, and that is not decoration. On Explore the shard
 * selector lives in the Conversations toolbar and renders only while
 * `effectiveView === 'conversations'` (`AppShell`), so a member who picks a
 * sibling in Conversations and then presses Explore arrives view-only with
 * NOTHING on screen that can undo it — research Pitfall 8. The same reasoning
 * applies to every other reason: a gate with no explanation and no control
 * strands the person it was built to inform.
 *
 * The markup is lifted from the notices it replaces rather than re-picked: the
 * eye icon, the amber border/background pair, `leading-snug`, the underlined
 * inline control.
 *
 * 🔴 `data-explore-view-only-notice` is PRESERVED VERBATIM on the Explore
 * surface. `scripts/check-explore-gate.mjs` queries that attribute in five
 * places, and renaming it would turn eleven assertions into silent passes. The
 * surface-neutral `data-read-only-notice` carries the reason for the newer
 * assertions and is additive.
 *
 * 🔴 `reason` may be null, and that is a DEGRADED state, not an unused one: a
 * caller that knows it is gated but cannot say why still gets a notice (never
 * strand anyone), and the notice visibly names nothing — which is what the
 * check's per-viewer reason assertion detects. Do not "fix" it with a default
 * reason; a wrong reason reads as true and is worse than an absent one.
 */

/** What is unavailable here, which differs by where the notice is rendered. */
export type ReadOnlySurface = 'feed' | 'thread' | 'explore'

/**
 * Where an address is set or changed — the accounts app, always.
 *
 * 🔴 Never an address field here. CLAUDE.md: "This app never geocodes and never
 * stores a location… the fix is always to send them to the accounts app."
 * Phase 17 narrows that for an anonymous visitor resolving a place to look at;
 * it does not narrow it for a MEMBER, whose location belongs in their profile.
 */
const LOCATION_SETTINGS_URL = 'https://app.empowered.vote/settings/location'

/** "Posting and replying" / "Replying" / "Posting and drafting", sentence-initial. */
function whatIsUnavailable(surface: ReadOnlySurface): string {
  if (surface === 'thread') return 'Replying'
  // Explore hides the draft form too: a draft that can only ever be refused is a
  // trap, so the notice has to say where writing lives instead.
  if (surface === 'explore') return 'Posting and drafting'
  return 'Posting and replying'
}

export function ReadOnlyNotice({
  reason,
  surface,
  viewingSliceIndex,
  ownSliceIndex,
  onReturnToOwnSlice,
  loginUrl,
}: {
  /** Straight from `whyNoWrite()`. Null means "gated, reason not supplied" — see above. */
  reason: NoWriteReason | null
  surface: ReadOnlySurface
  /** The shard on screen. Undefined only while the siblings query has not answered. */
  viewingSliceIndex?: number
  /** The member's own shard — where posting and replying stay. */
  ownSliceIndex?: number
  /** Leaves view-only. Absent on the surfaces that have no way back of their own. */
  onReturnToOwnSlice?: () => void
  /** The real sign-in, for a signed-out visitor. Absent elsewhere. */
  loginUrl?: string
}) {
  const unavailable = whatIsUnavailable(surface)

  return (
    <div
      data-read-only-notice={reason ?? 'unknown'}
      data-read-only-surface={surface}
      {...(surface === 'explore' ? { 'data-explore-view-only-notice': '' } : {})}
      className={`flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200${surface === 'feed' ? ' mb-3' : ''}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>

      <p className="leading-snug">
        {reason === 'sibling-shard' && (
          <>
            {surface === 'thread'
              ? "You're viewing this thread read-only."
              : surface === 'explore'
                ? `You're exploring Slice ${viewingSliceIndex ?? '—'} read-only.`
                : `You're browsing Slice ${viewingSliceIndex ?? '—'} read-only.`}
            {typeof ownSliceIndex === 'number' && (
              <>
                {' '}
                {surface === 'explore'
                  ? `Starting a conversation — and the draft it begins with — stays in your own community, Slice ${ownSliceIndex}.`
                  : `${unavailable} stay${surface === 'thread' ? 's' : ''} in your own community, Slice ${ownSliceIndex}.`}
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
                  {surface === 'explore' ? 'Switch back to your community' : 'Switch back'}
                </button>
              </>
            )}
          </>
        )}

        {reason === 'other-place' && (
          <>
            {/* 🔴 No claim about READING. Conversations in a place the viewer is
                not in are not readable yet — every civic_spaces grant is TO
                authenticated and the sibling policy requires geoid equality —
                and a notice that said reading was open would be a promise this
                phase cannot keep. See 17-SHARED.md § the phase boundary. */}
            You're looking at a place you're not a member of. {unavailable}{' '}
            {surface === 'thread' ? 'belongs' : 'belong'} to the people who live under that government.
            {onReturnToOwnSlice && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={onReturnToOwnSlice}
                  className="font-semibold underline hover:no-underline"
                >
                  Back to my spaces
                </button>
              </>
            )}
          </>
        )}

        {reason === 'no-slice' && (
          <>
            {/* An answer, not an error: ev-accounts' own rule is that `city` is
                null for an unincorporated address. Nothing here apologises. */}
            You have no community at this level. An address outside any incorporated place has no
            city space, for instance — that is an answer, not an error, and {unavailable.toLowerCase()}{' '}
            {surface === 'thread' ? 'stays' : 'stay'} in the spaces you do have.{' '}
            <a
              href={LOCATION_SETTINGS_URL}
              className="font-semibold underline hover:no-underline"
            >
              Check the address on your account
            </a>
          </>
        )}

        {reason === 'signed-out' && (
          <>
            {/* 🔴 BOTH walls, deliberately. "Make an account" is only the first:
                Civic Spaces needs the Connected tier, and Connected means an
                address has been set — so an Inform account passes sign-in and
                lands on the no-jurisdiction state. Copy that stops at "make an
                account" strands exactly the person it was written for.
                🔴 Not "Sign in to join" or "Sign in to share": those literals are
                in check-explore-gate's WRITE_WORDS, and this notice would fail
                the gate it explains. */}
            {unavailable} {surface === 'thread' ? 'belongs' : 'belong'} to the people who live under
            that government. An Empowered Vote account with an address set opens your own civic
            spaces.
            {loginUrl && (
              <>
                {' '}
                <a href={loginUrl} className="font-semibold underline hover:no-underline">
                  Sign in
                </a>
              </>
            )}
          </>
        )}

        {reason === null && `You're viewing this read-only. ${unavailable} ${surface === 'thread' ? 'is' : 'are'} not available here.`}
      </p>
    </div>
  )
}
