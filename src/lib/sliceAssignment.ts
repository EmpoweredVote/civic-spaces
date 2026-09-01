/**
 * Slice assignment — asking the service to work out which civic spaces a member
 * belongs to, and to create them if nobody has needed them before.
 *
 * The service maps the member's resolved jurisdiction onto slices: congressional
 * district to federal, state senate district to state, county to local, school
 * district to neighborhood. Slices are created on demand, so "no space exists for
 * that address yet" is never the reason someone sees nothing — a missing space is
 * always a missing *assignment*.
 */

const BASE_URL = import.meta.env.VITE_SLICE_ASSIGNMENT_URL ?? ''

export const SLICE_ASSIGNMENT_URL = `${BASE_URL}/assign`

/**
 * Ask for assignment and wait for the answer.
 *
 * Idempotent on the server: it finds or creates each slice and skips memberships
 * that already exist, so calling it again for an already-assigned member is a
 * no-op. That is what makes it safe to retry whenever someone turns out to have
 * no spaces.
 *
 * Resolves true when the service accepted the request. Callers that cannot act on
 * a failure should use `triggerSliceAssignment` instead.
 */
export async function requestSliceAssignment(token: string): Promise<boolean> {
  try {
    const response = await fetch(SLICE_ASSIGNMENT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.ok
  } catch {
    return false
  }
}

/** Fire-and-forget assignment, for call sites with nothing to do about a failure. */
export function triggerSliceAssignment(token: string): void {
  void requestSliceAssignment(token)
}
