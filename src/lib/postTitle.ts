/**
 * The post-title cap, and the one honest way to meet it.
 *
 * 🔴 This module has NO imports, deliberately. Three callers need it and they
 * cannot all reach the same places: `validators.ts` pulls in zod, while
 * `agendaTopics.ts` and `writingGuidance.ts` are loaded straight into Node by
 * `check:agenda-topics` (`node --experimental-strip-types`), which can follow
 * only a relative import that carries its `.ts` extension and resolves to a
 * file as plain as this one. A leaf with nothing underneath it is the only
 * shape all three can share, which is why the cap lives HERE and `validators`
 * re-exports it rather than the other way round.
 */

/** createPostSchema's cap, and the `maxLength` on the composer's title input. */
export const POST_TITLE_MAX = 200

/** Marks an elided string. One UTF-16 unit, so it costs one of the budget. */
export const ELLIPSIS = '…'

/**
 * Cut `text` to at most `max` characters, on a word boundary, ending in an
 * ellipsis. Text already inside the budget is returned trimmed and untouched.
 *
 * 🔴 The ellipsis is the load-bearing half, not the word boundary. A bare
 * `slice(0, 200)` ends wherever the 200th character falls — "…for the
 * maintenance and operation of the municipal stormwa" — and what it leaves
 * behind still reads like the whole of whatever it came from. Where that
 * source is a civic record, which is every caller here, the result is a
 * citation nobody can look up: our shortening passed off as the council's own
 * words. Ending in "…" says out loud that something was left off, and ending
 * it at a word keeps the part that survives quotable.
 *
 * Text with no space inside the budget — one long hyphenated token — has no
 * boundary to find and is cut hard. It still ends in the ellipsis, which is
 * the part that matters. Text that is nothing but punctuation elides to the
 * ellipsis alone, correctly: there was no word in it to keep, and an
 * empty-looking title the member retypes beats 199 hyphens.
 */
export function elide(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  const head = trimmed.slice(0, max - ELLIPSIS.length)
  const lastSpace = head.lastIndexOf(' ')
  let cut = lastSpace > 0 ? head.slice(0, lastSpace) : head
  // Never leave half a surrogate pair behind — only the no-boundary cut above
  // can land inside one, and half a pair renders as U+FFFD.
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1)
  return cut.replace(/[\s,.;:—–-]+$/u, '') + ELLIPSIS
}
