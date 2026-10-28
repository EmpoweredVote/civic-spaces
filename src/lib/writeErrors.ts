/**
 * What to tell a member when a post, reply or edit was NOT saved. One sentence on why,
 * as far as it is known; the caller adds that their text is kept and how to retry.
 *
 * Shapes seen: a fetch that never reached the server (TypeError "Failed to fetch"), a
 * PostgREST error object with a `code`, and our own Error messages from the hooks.
 */
export function writeErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string; status?: number } | null
  const message = e?.message ?? ''
  if (error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message)) {
    return 'We couldn’t reach Civic Spaces — check your connection.'
  }
  // 42501: RLS refused the row. The UI hides write controls where this applies, so this
  // is a session that changed under the page (signed out elsewhere, membership moved).
  if (e?.code === '42501' || e?.status === 401 || e?.status === 403) {
    return 'You don’t have permission to post here right now. Try signing in again.'
  }
  if (/edit window/i.test(message)) return message
  return 'Something went wrong on our side.'
}
