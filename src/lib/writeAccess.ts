/**
 * May this viewer write here, and if not, why not — as pure functions over plain
 * data, in one place, failing closed.
 *
 * 🔴 This module has no runtime imports, deliberately. Every import below is
 * `import type`, which is erased, so `node --experimental-strip-types` can load
 * this file and run the SHIPPED functions rather than a transcription of them.
 * `scripts/check-write-access.mjs` does exactly that. A copy-test passes while
 * the shipped code is wrong, so do not add a value import here without moving
 * the check to something that can still reach the real thing. That is also why
 * ViewedSlice.sliceType is a bare `string` rather than the SliceType union — a
 * type-only import of it would be fine, but nothing here needs to narrow, and a
 * plain string keeps the module's dependency list at zero.
 *
 * Nothing here touches React, React Query, Supabase, `localStorage` or the
 * network. The caller owns all of that and passes the answers in.
 *
 * It replaces this, at AppShell.tsx:840:
 *
 *     const activeIsViewOnly =
 *       !!activeSlice && !!activeViewing && activeViewing.id !== activeSlice.id
 *
 * which FAILS OPEN: with no activeSlice the whole expression is `false` — "not
 * gated" — so the composer, the FAB and the reply box are offered to someone RLS
 * can only refuse. It was written when the only non-writable state was a sibling
 * of a slice you hold, where absence of a slice meant "no tab", not "a tab you
 * cannot write in". Phase 17 adds a third state — another place entirely — and
 * absence of a slice becomes the common case there.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A slice as it appears ON SCREEN. `id` is null for a place with no slice row. */
export interface ViewedSlice {
  /**
   * The `slices.id` when a row exists for this place and level, else null.
   *
   * 🔴 Null is the honest value and it is the COMMON one. Slice rows are created
   * on demand by POST /api/civic-spaces/assign, which only ever runs for a
   * signed-in Connected member, so a (city, <geoid>) row exists only where a
   * member already lives — 15 rows in the entire product (research Q3.3). Most
   * places a visitor names have no row at all. A type that insisted on a string
   * would force a synthetic id somewhere, and a synthetic id in an ownedSliceIds
   * lookup is a coin toss; null fails closed for free.
   */
  id: string | null
  sliceType: string
  /** null only for a placeless type whose geoid the shell does not carry. */
  geoid: string | null
}

export type NoWriteReason = 'signed-out' | 'no-slice' | 'other-place' | 'sibling-shard'

export interface WriteContext {
  /** The slice on screen, or null when nothing is. */
  viewed: ViewedSlice | null
  /** Every slices.id the viewer is a member of. Empty for a guest AND for an Inform account. */
  ownedSliceIds: ReadonlySet<string>
  /** placeKey() for every slice the viewer holds. Lets a sibling shard be told from another place. */
  ownedPlaceKeys: ReadonlySet<string>
  /** False for a visitor with no session at all. */
  isAuthenticated: boolean
}

// ── Keys ─────────────────────────────────────────────────────────────────────

/**
 * `(slice_type, geoid)` — the key a jurisdiction's shards all share, and the key
 * `posts_select_sibling_slice` joins on (20260917000000_sibling_slice_read_access.sql).
 *
 * 🔴 NOT compositionKey() from exploreComposition.ts, which looks almost identical
 * and must not be reused here. That one collapses federal / unified / volunteer to
 * the slice type ALONE, which is correct for choosing Explore content and wrong for
 * this: a place comparison is the last thing that should inherit a deliberate
 * normalisation that erases geoids. Two keys, two jobs, no shared function.
 */
export function placeKey(sliceType: string, geoid: string | null): string {
  return `${sliceType}|${geoid ?? ''}`
}

/**
 * Is the viewer's own row at this level the SAME JURISDICTION as the one a
 * visited place presents there?
 *
 * 🔴 This is the test that decides whether a visited place shows the viewer's
 * REAL row or a `place:` sentinel, and getting it wrong is what made a member
 * looking at their own county read "You're exploring Slice — read-only".
 *
 * Both halves are compared. `sliceType` alone is not enough — every member holds
 * SOME county — and `geoid` alone is not either, because geoids are only unique
 * within a level.
 *
 * 🔴 It is deliberately NOT `placeKey`-based, even though that looks equivalent.
 * `ownedPlaceKeys` answers "does the viewer hold this jurisdiction at all",
 * which is the SIBLING-SHARD question and is true for a different shard of the
 * same place. This asks something narrower: is THIS row the one to render. The
 * two differ precisely where the bug lived, so they stay separate functions.
 *
 * 🔴 Placeless levels are real matches, not special cases. In production a
 * member's federal row is `('federal', 'US')` and every visited place's federal
 * level is `('federal', 'US')` too — so the national space is the viewer's own
 * on every visit, which is true: there is one of it. `devMockData.ts` gives the
 * dev id `federal.geoid = '3711'` ON PURPOSE, to keep `compositionKey`'s
 * normalisation honest, so this match is the one case the browser checks CANNOT
 * reach. That is why it is a pure function with its own assertions.
 */
export function isSameJurisdiction(
  own: { sliceType: string; geoid: string } | null | undefined,
  sliceType: string,
  geoid: string,
): boolean {
  if (!own) return false
  return own.sliceType === sliceType && own.geoid === geoid
}

/** Does the viewer hold any slice of this LEVEL, anywhere? */
function holdsLevel(ownedPlaceKeys: ReadonlySet<string>, sliceType: string): boolean {
  const prefix = `${sliceType}|`
  for (const key of ownedPlaceKeys) {
    if (key.startsWith(prefix)) return true
  }
  return false
}

// ── The primitive ────────────────────────────────────────────────────────────

/**
 * Why this viewer may NOT write in the slice on screen — or null, meaning they may.
 *
 * One body, four reasons, ordered so the reason is useful and not merely correct:
 * 'signed-out' first because it is the only one whose remedy is "sign in".
 *
 * 🔴 FAILS CLOSED, and the ordering is how. Absence of a slice reaches a `return`
 * with a reason in it BEFORE any membership test runs, so the fail-open shape of
 * the expression this replaces cannot come back by accident. Move the no-slice
 * branch below the membership test and check-write-access.mjs goes red on 4, 5
 * and 9 — the fail-open shape itself.
 *
 * 🔴 There is no `tier` term and there must never be one. D-04 says an Inform
 * account receives exactly what an anonymous visitor receives. An Inform account
 * holds no slice_members rows, so its ownedSliceIds and ownedPlaceKeys are both
 * empty and it lands in the no-slice / other-place branch BY CONSTRUCTION — D-04
 * is satisfied by the data rather than by a rule someone has to remember to write,
 * and therefore by a rule nobody can later delete. Adding `if (tier === 'inform')`
 * here turns nothing in the check green or red, which is the demonstration.
 *
 * 🔴 This body is D-21's seam. An Empowered account's cross-slice reach — their
 * posts reveal their identity and can reach many slices at once — belongs HERE and
 * nowhere else: one body changes and every consumer inherits it. Write it inline at
 * a call site as `|| isEmpowered` and the next person has to find every call site
 * again, and no check can reach the rule.
 */
export function whyNoWrite(ctx: WriteContext): NoWriteReason | null {
  // 1. No session at all — including an Inform account's, which holds no slices
  //    and so would fail below anyway. First because the remedy differs.
  if (!ctx.isAuthenticated) return 'signed-out'

  const viewed = ctx.viewed

  // 2. Nothing on screen, or a place with no slice row to be a member of. Which
  //    reason depends on whether the viewer holds this LEVEL elsewhere: if they
  //    do, this is somebody else's city; if they do not — the unincorporated
  //    member with no city at all — there is simply no slice here.
  //    A null `viewed` has no level to ask about, so it takes the stricter answer.
  if (!viewed) return 'other-place'
  if (!viewed.id) {
    return holdsLevel(ctx.ownedPlaceKeys, viewed.sliceType) ? 'other-place' : 'no-slice'
  }

  // 3. Their own shard.
  if (ctx.ownedSliceIds.has(viewed.id)) return null

  // 4. Same jurisdiction, different shard — readable since Phase 16, never writable.
  if (ctx.ownedPlaceKeys.has(placeKey(viewed.sliceType, viewed.geoid))) return 'sibling-shard'

  // 5. A different place entirely.
  return 'other-place'
}

// ── Derived ──────────────────────────────────────────────────────────────────

/**
 * May this viewer write in the slice on screen?
 *
 * Derived from whyNoWrite, never parallel to it. Two functions that each decide
 * the same thing is the shape the current_user_id() incident already punished
 * this codebase for: when the two disagree the failure looks like missing data,
 * not like a bug in either.
 */
export function canWriteIn(ctx: WriteContext): boolean {
  return whyNoWrite(ctx) === null
}

/**
 * May this viewer READ the conversations in the slice on screen?
 *
 * 🔴 NOT the same question as canWriteIn. A sibling shard is readable and not
 * writable — posts_select_sibling_slice joins on (slice_type, geoid), so every
 * shard of a jurisdiction the viewer belongs to is readable today. Key this on
 * viewed.id instead of placeKey and that Phase 16 behaviour regresses silently;
 * check-write-access.mjs assertion 13 is the one that catches it.
 *
 * 🔴 PHASE 18 CHANGES THIS FUNCTION'S BODY AND NOTHING ELSE. Once civic_spaces
 * grants anon schema USAGE and posts_select_public lands, every caller may read
 * every slice and this returns true unconditionally (minus whatever that phase
 * decides about deleted posts and suspended authors). Until then it is false for
 * another place and for a visitor, and the UI must say so rather than render an
 * empty feed — an empty feed returned by RLS reads as "nobody said anything here",
 * which is a lie told silently.
 */
export function canReadConversationsIn(ctx: WriteContext): boolean {
  if (!ctx.isAuthenticated) return false
  const viewed = ctx.viewed
  if (!viewed) return false
  return ctx.ownedPlaceKeys.has(placeKey(viewed.sliceType, viewed.geoid))
}
