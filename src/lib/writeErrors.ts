/**
 * Thrown by the write hooks BEFORE any request, for the reserved local-dev id.
 *
 * 🔴 `dev-guest` reads fixture slices and posts (`mock-federal`, `mock-post-…`) and
 * holds no real session, so an insert can only fail — with `.env.local` set it went
 * to the real database carrying a fixture slice id and failed as "Something went
 * wrong on our side", which reads as a bug in posting. Refusing up front says the
 * true reason and sends nothing. It is never a simulated success: nothing is saved,
 * and the composer says so.
 */
export class TestAccountWriteError extends Error {
  constructor() {
    super('test-account')
    this.name = 'TestAccountWriteError'
  }
}

/** False when pressing Post again cannot help, so the composer stops suggesting it. */
export function canRetryWrite(error: unknown): boolean {
  return !(error instanceof TestAccountWriteError)
}

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
  if (error instanceof TestAccountWriteError) {
    return 'You’re using the local test account, which can’t save posts or replies — nothing was sent. Sign in with a real Empowered account to post.'
  }
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
