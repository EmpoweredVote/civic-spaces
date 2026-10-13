/**
 * The line a post leads with. A post's title when it has one; otherwise the author's
 * own first sentence (not a summary we write), with the rest as the excerpt. A first
 * sentence too long to be a headline is left whole.
 *
 * Shared by PostCard and ThreadView so the topic a member clicked in the feed is the
 * same topic heading the thread they land on.
 */
export function splitHeadline(title: string | null, body: string): { headline: string; excerpt: string } {
  if (title?.trim()) return { headline: title.trim(), excerpt: body.trim() }
  const text = body.trim()
  const match = text.match(/^(.+?[.!?])(\s+|$)/)
  if (match && match[1]!.length <= 160) {
    return { headline: match[1]!, excerpt: text.slice(match[0].length).trim() }
  }
  return { headline: text, excerpt: '' }
}
