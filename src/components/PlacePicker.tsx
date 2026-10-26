import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useIsDarkMode } from '../hooks/useIsDarkMode'
import { usePlaceSearch } from '../hooks/usePlaceSearch'
import {
  PLACE_RESOLVE_ENABLED,
  usePlaceResolve,
  type PlaceResolveFailure,
} from '../hooks/usePlaceResolve'
import type { PlaceSearchRow, ResolvedPlace } from '../lib/placeResolve'
import { FOCUS } from './explore/exploreUi'

/**
 * The one place-entry mechanism: a name typed, a real place chosen, the geoids
 * a civic space is keyed on handed back.
 *
 * 🔴 ONE component, TWO sizes — not two components. D-19: *"the place-entry
 * mechanism cannot be built only into the signed-out welcome screen — it is
 * shell-level navigation available to a signed-in member too. Plan it as one
 * mechanism with two entry points, not two features."* `size` changes padding,
 * type scale and whether the label renders visibly. It changes NOTHING else, so
 * the shell's mount (17-05) needs no prop that alters behaviour.
 *
 * 🔴 Deliberately NOT merged into `SliceSelector`, and not placed beside it.
 * That control switches `sibling_index` WITHIN one `(slice_type, geoid)` — its
 * whole copy is about shards ("Slice 3", "the only slice in Asheville so far").
 * This one switches `geoid` across every tab at once. They nest — which place,
 * then which shard of it — and a single menu holding both axes is one where two
 * adjacent items mean different kinds of thing (research Q3.5).
 *
 * ── 🔴 D-13, structurally ────────────────────────────────────────────────────
 *
 * What is typed is never persisted, never logged by us, and never rendered
 * back. The rows below are the API's OWN canonical labels for real places,
 * resolved from geoids — not an echo of the input — and the query is cleared the
 * moment a place resolves, so the string does not survive the interaction it was
 * typed for. `ResolvedPlace` carries no name field at all (`placeResolve.ts`),
 * so a caller cannot render the typed string by accident either.
 *
 * `PlaceResolveError.message` IS its code and nothing more, which is why the
 * copy below is keyed on the code rather than on the error's text: nothing the
 * visitor typed can reach a toast, an error boundary or a console line.
 *
 * ── Animation ────────────────────────────────────────────────────────────────
 *
 * No entrance animation on the list, and that is a decision rather than an
 * omission. `motion` at this version does not DECLARE `useReducedMotion` in its
 * types, so a guarded entrance would not typecheck — `SeedInvitationModule`
 * records the same finding and made the same call. Everything that does move is
 * a colour transition behind Tailwind's `motion-safe:`, which compiles to
 * `@media (prefers-reduced-motion: no-preference)`.
 */

export type PlacePickerSize = 'hero' | 'compact'

/** Enough rows to tell Portland, OR from Portland, ME without a scroll. */
const MAX_VISIBLE = 8

/**
 * 🔴 `usablePlaceRows` (17-03) filters BEFORE this component sees anything, so a
 * `limit=8` query legitimately yields fewer than eight choices — "portland"
 * returns six, because two of its eight rows are school districts at seven
 * digits. That is the filter working, not a truncation bug.
 */

/**
 * What to say when a chosen row could not be turned into a place.
 *
 * 🔴 A DIFFERENT failure from "nothing matched", and it needs its own line:
 * retyping the same name cannot fix it, so the sentence has to point somewhere
 * else. Never a nearby county, never a state-level guess — "never invent a
 * place", with Treasury Tracker's Bloomington as the precedent.
 */
function resolveFailureCopy(code: PlaceResolveFailure): string {
  switch (code) {
    case 'unusable-choice':
      return 'That result is not a civic space we can open. Try a city, town or county.'
    case 'no-centroid':
      return 'We could not locate that place on the map. Try another result, or its county.'
    case 'no-county':
      return 'We could not work out which county that place sits in. Try the county by name.'
    case 'address-not-found':
      return 'No address matched that. Try the name of the city, town or county instead.'
    case 'service-unavailable':
      return 'The place lookup did not answer just now. Try again in a moment.'
    case 'address-path-disabled':
      return 'Address lookup is not available yet. Type the name of a city, town or county.'
  }
}

function SearchIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  )
}

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

/** The one message line, in the one colour pair, so light and dark cannot drift. */
function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p
      data-place-picker-problem=""
      className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
    >
      {children}
    </p>
  )
}

export function PlacePicker({
  size = 'hero',
  onResolved,
  onCancel,
  autoFocus = false,
}: {
  size?: PlacePickerSize
  /** The geoids, once a real place has been chosen and resolved. */
  onResolved: (place: ResolvedPlace) => void
  /** 17-05's compact mount closes its popover with this. Absent on the welcome screen. */
  onCancel?: () => void
  autoFocus?: boolean
}) {
  const hero = size === 'hero'
  const isDark = useIsDarkMode()

  const inputId = useId()
  const listId = useId()
  const helpId = useId()
  const addressId = useId()

  const [query, setQuery] = useState('')
  const [address, setAddress] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  /** The row the resolve leg is working on, kept visible while it runs and if it fails. */
  const [chosenGeoid, setChosenGeoid] = useState<string | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)

  const search = usePlaceSearch(query)
  const resolve = usePlaceResolve()

  const rows: PlaceSearchRow[] = (search.data ?? []).slice(0, MAX_VISIBLE)
  // `enabled` is false below three characters, so a pending query there is not a
  // search in flight — it is a query that was never asked.
  const searching = search.isFetching
  const trimmed = query.trim()
  const asked = trimmed.length >= 3
  const noResults = asked && !searching && search.isSuccess && rows.length === 0
  const searchFailed = asked && !searching && search.isError

  const choose = useCallback(
    (row: PlaceSearchRow) => {
      if (resolve.isPending) return
      setChosenGeoid(row.geo_id ?? null)
      resolve.mutate(
        { kind: 'place', row },
        {
          onSuccess: (place) => {
            // 🔴 D-13: the typed string does not survive the interaction it was
            // typed for. 17-05's browser check asserts it is not on screen.
            setQuery('')
            setAddress('')
            setOpen(false)
            setActiveIndex(-1)
            setChosenGeoid(null)
            onResolved(place)
          },
        },
      )
    },
    [onResolved, resolve],
  )

  const submitAddress = useCallback(() => {
    const value = address.trim()
    if (!value || resolve.isPending) return
    resolve.mutate(
      { kind: 'address', address: value },
      {
        onSuccess: (place) => {
          setQuery('')
          setAddress('')
          setOpen(false)
          onResolved(place)
        },
      },
    )
  }, [address, onResolved, resolve])

  // Outside click closes the list, the way SliceSelector already does it. Escape
  // is handled on the input, so the text survives a close.
  useEffect(() => {
    if (!open) return
    function handleDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [open])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      // 🔴 Closes the list and KEEPS the text. Clearing it here would throw away
      // what someone just typed because they wanted the list out of the way.
      if (open) {
        event.preventDefault()
        setOpen(false)
        setActiveIndex(-1)
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (rows.length === 0) return
      event.preventDefault()
      setOpen(true)
      setActiveIndex((prev) => {
        const next = event.key === 'ArrowDown' ? prev + 1 : prev - 1
        if (next < 0) return rows.length - 1
        if (next >= rows.length) return 0
        return next
      })
      return
    }
    if (event.key === 'Enter') {
      const row = activeIndex >= 0 ? rows[activeIndex] : undefined
      if (row) {
        // 🔴 A key handler, not only a click handler. Mouse-only selection is the
        // failure this repo's own guidance names by hand.
        event.preventDefault()
        choose(row)
      }
    }
  }

  const activeRow = activeIndex >= 0 ? rows[activeIndex] : undefined
  const activeOptionId = activeRow ? `${listId}-opt-${activeIndex}` : undefined

  /**
   * The screen-reader status line. An async list that updates silently is
   * invisible to anyone not looking at it.
   */
  const status = resolve.isPending
    ? 'Opening that place…'
    : searching
      ? 'Searching…'
      : noResults
        ? 'No places matched.'
        : rows.length > 0
          ? `${rows.length} ${rows.length === 1 ? 'place' : 'places'} to choose from.`
          : ''

  const labelText = 'Look up a city, town or county'

  const inputClass = [
    'w-full rounded-full border bg-white text-gray-900 placeholder:text-gray-500',
    'dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400',
    'border-gray-300 dark:border-white/15',
    // 🔴 At least 16px on a phone, or iOS Safari zooms the page on focus and does
    // not zoom back — the first interaction on the screen, broken.
    hero ? 'h-14 pl-12 pr-4 text-base md:text-lg' : 'h-11 pl-10 pr-3 text-base',
    FOCUS,
  ].join(' ')

  return (
    <div ref={wrapRef} data-place-picker={size} className="w-full">
      {/* 🔴 A real <label>, never a placeholder standing in for one: a placeholder
          vanishes on focus and is not an accessible name. In `compact` it is
          visually hidden and still read out. */}
      <label
        htmlFor={inputId}
        className={
          hero
            ? 'block text-sm font-semibold text-gray-700 dark:text-gray-300'
            : 'sr-only'
        }
      >
        {labelText}
      </label>

      <div className={`relative ${hero ? 'mt-2' : ''}`}>
        <SearchIcon
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 ${
            hero ? 'left-4 h-5 w-5' : 'left-3 h-4 w-4'
          }`}
        />
        <input
          id={inputId}
          // `search` gives phones a sensible keyboard and a clear affordance.
          type="search"
          role="combobox"
          aria-expanded={open && rows.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-describedby={helpId}
          // 🔴 The documented exception to "never block autofill": the browser's
          // own suggestion dropdown renders OVER this listbox, and there is no
          // autofill token for a place search, so there is nothing useful to
          // suppress in exchange.
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          placeholder="Asheville, Buncombe County…"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
            setChosenGeoid(null)
            if (resolve.isError) resolve.reset()
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={inputClass}
        />

        {open && (searching || rows.length > 0) && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Places"
            className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-900"
          >
            {searching && rows.length === 0 ? (
              // 🔴 FeedSkeleton's vocabulary, not a third loading style — and the
              // input is never frozen while it runs.
              <li className="px-3 py-2" aria-hidden="true">
                <SkeletonTheme
                  baseColor={isDark ? '#374151' : '#f3f4f6'}
                  highlightColor={isDark ? '#4b5563' : '#e5e7eb'}
                >
                  <Skeleton height={16} />
                  <Skeleton height={16} className="mt-2" width="70%" />
                  <Skeleton height={16} className="mt-2" width="55%" />
                </SkeletonTheme>
              </li>
            ) : (
              rows.map((row, index) => {
                const isActive = index === activeIndex
                const isChosen = !!row.geo_id && row.geo_id === chosenGeoid
                return (
                  <li
                    key={row.geo_id ?? `${row.label ?? 'row'}-${index}`}
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={isActive}
                    // Keeps focus on the input, so the combobox keeps its
                    // accessible name and the list does not close under the click.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(row)}
                    className={[
                      // ≥44px touch target, every row.
                      'flex min-h-[2.75rem] cursor-pointer items-center gap-3 px-3 py-2.5 text-sm motion-safe:transition-colors',
                      isActive
                        ? 'bg-brand-muted text-gray-900 dark:bg-white/10 dark:text-gray-100'
                        : 'text-gray-900 dark:text-gray-100',
                      isChosen && resolve.isPending ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <PinIcon className="h-4 w-4 flex-shrink-0 text-brand dark:text-brand-light" />
                    <span className="min-w-0 flex-1 truncate">{row.label ?? row.geo_id}</span>
                    {/* The area type the API already returns, so "Portland, OR ·
                        City" and "Portland, ME · City" are told apart. */}
                    {row.area_type && (
                      <span className="flex-shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400">
                        {row.area_type}
                      </span>
                    )}
                  </li>
                )
              })
            )}
          </ul>
        )}
      </div>

      <p id={helpId} className={`mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400 ${hero ? '' : 'sr-only'}`}>
        {/* 🔴 With PLACE_RESOLVE_ENABLED false this names ONE accepted input,
            because only one works. No "coming soon", and no disabled field. */}
        {PLACE_RESOLVE_ENABLED
          ? 'Type a city, town or county — or a street address below.'
          : 'Type a city, town or county.'}
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {/* 🔴 An answer with a way forward, never a blank list and never a nearest
          match. CLAUDE.md's rule for volunteers is the rule here: if a request
          fails, say so and stop. */}
      {noResults && <Problem>Nothing matched. Try the place&rsquo;s name, or its county.</Problem>}
      {searchFailed && <Problem>The place search did not answer just now. Try again in a moment.</Problem>}
      {resolve.isError && resolve.error && <Problem>{resolveFailureCopy(resolve.error.code)}</Problem>}

      {/* 🔴 Present only when it can work. PLACE_RESOLVE_ENABLED is false until
          ev-accounts ships POST /api/civic-spaces/resolve, and until then NO
          address field renders at all — not a disabled one, not a "coming soon".
          A control that promises a path that cannot run is the dead-control
          failure check:explore-rooms exists to catch. */}
      {PLACE_RESOLVE_ENABLED && (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            submitAddress()
          }}
        >
          <label htmlFor={addressId} className={hero ? 'block text-sm font-semibold text-gray-700 dark:text-gray-300' : 'sr-only'}>
            Or a street address
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={addressId}
              type="text"
              autoComplete="off"
              value={address}
              placeholder="67 Haywood St, Asheville NC"
              onChange={(event) => {
                setAddress(event.target.value)
                if (resolve.isError) resolve.reset()
              }}
              className={[
                'min-w-0 flex-1 rounded-full border bg-white text-gray-900 placeholder:text-gray-500',
                'dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400',
                'border-gray-300 dark:border-white/15',
                hero ? 'h-12 px-4 text-base' : 'h-11 px-3 text-base',
                FOCUS,
              ].join(' ')}
            />
            <button
              type="submit"
              disabled={resolve.isPending || address.trim() === ''}
              className={`h-12 flex-shrink-0 cursor-pointer rounded-full bg-brand-btn px-5 text-sm font-semibold text-white motion-safe:transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
            >
              Look up
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            A PO box, a rural route or a brand-new build may not be on the map. The place name
            always works.
          </p>
        </form>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={`mt-3 cursor-pointer rounded-full px-3 py-2 text-sm font-semibold text-gray-700 underline hover:no-underline dark:text-gray-300 ${FOCUS}`}
        >
          Cancel
        </button>
      )}
    </div>
  )
}
