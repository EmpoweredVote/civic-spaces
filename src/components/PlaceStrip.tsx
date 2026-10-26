import { useState } from 'react'
import { PlacePicker } from './PlacePicker'
import { useJurisdictionName } from '../hooks/useJurisdictionName'
import { FOCUS } from './explore/exploreUi'
import type { ResolvedPlace } from '../lib/placeResolve'
import type { SliceInfo } from '../types/database'

/**
 * The shell's place control: *which place* → *which shard of it* → the feed.
 *
 * 🔴 D-19's SECOND entry point, and the SAME component behind both. The welcome
 * screen mounts `PlacePicker size="hero"`; this mounts `size="compact"`. One
 * mechanism, two positions — not two features, and not a second picker whose
 * behaviour can drift from the first.
 *
 * ── Why it lives HERE, and the three places it does not ──────────────────────
 *
 * The hero banner already names the place on screen, so the control that
 * CHANGES that place belongs immediately beneath it. It renders at every
 * breakpoint, on every tab, and is absent on Volunteer — which is correct:
 * Volunteer is not a place.
 *
 * 🔴 NOT inside `HeroBanner`. That is the component PR #92's bug lived in — a
 * credit link under a padded content layer at `z-10`, correct while it was
 * plain text, invisible to every screenshot and to `tsc -b`, and broken only at
 * `md` and up so phones looked fine. It has its own layering and its own
 * four-way checks; put an interactive control inside it and you inherit all of
 * that. A sibling element in `AppShell` costs nothing and risks nothing.
 *
 * 🔴 NOT merged into `SliceSelector`. Research Q3.5: two axes in one menu. That
 * control switches `sibling_index` WITHIN one `(slice_type, geoid)` and its
 * whole copy is about shards; this one switches `geoid` across every tab at
 * once.
 *
 * 🔴 NOT in the header. Three grid tracks, and below 430px the wordmark is
 * already `sr-only` to fit the existing controls. There is no room, and a
 * control that collapses to an icon on a phone is the wrong shape for something
 * whose entire job is to say where you are.
 *
 * 🔴 And NOT `aria-haspopup="listbox"` on the toggle, deliberately.
 * `scripts/check-explore-gate.mjs` reaches the shard switcher with
 * `button[aria-haspopup="listbox"]` and takes `.first()`; a second button
 * carrying that attribute above it in the DOM would silently re-point eleven
 * assertions at this control. `aria-expanded` says the same thing about a
 * disclosure and collides with nothing.
 *
 * ── The name comes from the GEOID (D-13) ─────────────────────────────────────
 *
 * 🔴 Through `useJurisdictionName` — the same hook and the same session cache
 * the banner uses — never from the picker's input and never from an API label.
 * 17-03 made that structural by giving `ResolvedPlace` no name field at all, and
 * this component could not render the typed string if it wanted to.
 *
 * While the name is still resolving, nothing is shown rather than the tab label:
 * `useJurisdictionName` answers "City" until its offline shard lands, and
 * *"Looking at City"* is worse than waiting a frame. That is the same
 * `name !== fallback` idiom `ActiveExplore` and `ActiveLocationCard` already
 * use.
 */

function PinIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.5-7-10.5a7 7 0 1114 0C19 15.5 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.5" />
    </svg>
  )
}

/**
 * "Looking at Asheville", resolved from the geoid.
 *
 * Its own component so the hook runs unconditionally against a real slice — the
 * `ActiveHeroBanner` pattern. The empty string while unresolved is deliberate:
 * see the header.
 */
function VisitingLine({ slice, fallback }: { slice: SliceInfo; fallback: string }) {
  const name = useJurisdictionName(slice, fallback)
  const resolved = name !== fallback ? name : null
  return (
    <span className="min-w-0 flex-1 truncate">
      {/* 🔴 `aria-live` on the NAME, so a screen reader is told the place
          changed. The surrounding words never change, so announcing the whole
          strip would repeat "Looking at" on every hop. */}
      <span aria-live="polite">
        {resolved ? (
          <>
            Looking at <strong className="font-bold">{resolved}</strong>
          </>
        ) : (
          ''
        )}
      </span>
    </span>
  )
}

/** The amber pair, written light and dark together, exactly as `ReadOnlyNotice` writes it. */
const AMBER =
  'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200'

/** ≥44px touch target, visible focus, a real pointer. Both controls, both states. */
const CONTROL = `inline-flex min-h-[2.75rem] cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold motion-safe:transition-colors ${FOCUS}`

export function PlaceStrip({
  /** The place on screen's most local slice, or undefined when the viewer is on their own spaces. */
  visitedSlice,
  /** That slice's tab label, so an unresolved name can be told from a resolved one. */
  visitedFallback,
  isAuthenticated,
  onResolved,
  onLeave,
}: {
  visitedSlice?: SliceInfo
  visitedFallback: string
  isAuthenticated: boolean
  onResolved: (place: ResolvedPlace) => void
  onLeave: () => void
}) {
  const [open, setOpen] = useState(false)

  const handleResolved = (place: ResolvedPlace) => {
    setOpen(false)
    onResolved(place)
  }

  return (
    <div data-place-strip={visitedSlice ? 'visiting' : 'own'} className="flex flex-col gap-2">
      {visitedSlice ? (
        /* 🔴 The visiting state has to be UNMISTAKABLE. A member who forgets they
           are looking at Portland will read Portland's calendar as their own. The
           feed is gated and the notices say why, but this is the thing on screen
           at all times — so it borrows ReadOnlyNotice's amber rather than
           inventing a colour or a shape. */
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-1.5 text-sm ${AMBER}`}>
          {/* 🔴 The name takes a WHOLE ROW below `sm` and shares one above it.
              The plan asked for a single line at 390px with the name truncating
              first; built that way, "Looking at Asheville · Change · Back to the
              welcome screen" leaves the name as "L…" — the one thing the strip
              exists to say, gone, so that a label could stay on one row. The
              binding half of that rule is the 🔴 one — the CONTROLS must never be
              what falls off — and it is kept exactly: they are one `flex-shrink-0`
              group and they wrap together, intact, to a second row. */}
          <span className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
            <PinIcon className="h-4 w-4 flex-shrink-0" />
            <VisitingLine slice={visitedSlice} fallback={visitedFallback} />
          </span>
          <div className="ml-auto flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`${CONTROL} underline hover:no-underline`}
            >
              Change
            </button>
            <button
              type="button"
              onClick={onLeave}
              data-place-strip-leave=""
              className={`${CONTROL} border border-amber-300 hover:bg-amber-100 dark:border-amber-400/40 dark:hover:bg-amber-400/20`}
            >
              {/* 🔴 The label depends on where leaving LANDS you. A signed-out
                  visitor has no spaces to go back to — `showShell` goes false and
                  the welcome screen returns — and telling them otherwise would
                  promise something an account is for. */}
              {isAuthenticated ? 'Back to my spaces' : 'Back to the welcome screen'}
            </button>
          </div>
        </div>
      ) : (
        /* 🔴 Quiet and SECONDARY, deliberately. For a signed-in member on their
           own feed this is navigation they rarely want, and a prominent control
           here would compete with the Post button two rows down. D-18 still
           holds: it is always present, never buried. */
        <div className="flex">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`${CONTROL} -ml-3 text-gray-600 underline hover:text-gray-900 hover:no-underline dark:text-gray-400 dark:hover:text-gray-200`}
          >
            <PinIcon className="h-4 w-4 flex-shrink-0" />
            Look at another place
          </button>
        </div>
      )}

      {/* 🔴 Expanded INLINE, not floated over the page. An absolutely positioned
          popover here would sit between the banner and the sticky tab bar — two
          stacking contexts and a `z-index` guess — which is the exact shape of
          the PR #92 bug this component was kept out of HeroBanner to avoid. The
          page moving down a few rows costs nothing and cannot be unclickable. */}
      {open && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-gray-900">
          <PlacePicker size="compact" autoFocus onResolved={handleResolved} onCancel={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
