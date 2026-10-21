/**
 * The line a post leads with. A post's title when it has one; otherwise the author's
 * own first sentence (not a summary we write), with the rest as the excerpt. A first
 * sentence too long to be a headline is left whole.
 *
 * Shared by PostCard and ThreadView so the topic a member clicked in the feed is the
 * same topic heading the thread they land on.
 */

/** Past this, an opening sentence is prose, not a headline — lead with the whole thing. */
const MAX_HEADLINE = 160

/**
 * A candidate headline that ends in an abbreviation, not a sentence. Without this,
 * "U.S. Senate race is heating up." leads with "U.S." — and on a civic forum an
 * opening like that is close to routine. Two shapes:
 *   - a run of single letters each followed by a dot ("U.S.", "D.C.")
 *   - a common title or short form that ends in a dot ("Dr.", "Sen.", "etc.")
 * Both are anchored to the end, and must start the string or follow a space, so an
 * ordinary word that merely ends in those letters ("No." in "Casino.") is unaffected.
 */
const ENDS_IN_ABBREVIATION =
  /(?:^|\s)(?:[A-Za-z]\.)+$|(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Sen|Rep|Gov|Lt|Sgt|St|Jr|Sr|vs|etc|e\.g|i\.e|No|Inc|Dept|Ave|Blvd|Approx|Fig)\.$/i

export function splitHeadline(title: string | null, body: string): { headline: string; excerpt: string } {
  if (title?.trim()) return { headline: title.trim(), excerpt: body.trim() }
  const text = body.trim()

  // Walk the sentence terminators rather than taking the first: an abbreviation is
  // skipped and the scan continues to the real end of the sentence. A terminator only
  // counts when whitespace or the end follows it, which is what keeps "$1.5 million"
  // and "www.example.com" from splitting mid-number and mid-URL.
  const terminators = /[.!?](\s+|$)/g
  let match: RegExpExecArray | null
  while ((match = terminators.exec(text)) !== null) {
    const headline = text.slice(0, match.index + 1)
    // Candidates only grow from here, so once one is too long none will fit.
    if (headline.length > MAX_HEADLINE) break
    if (ENDS_IN_ABBREVIATION.test(headline)) continue
    return { headline, excerpt: text.slice(match.index + match[0].length).trim() }
  }

  return { headline: text, excerpt: '' }
}
