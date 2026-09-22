import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { requestSliceAssignment } from '../lib/sliceAssignment'

export type EnsureSlicesStatus = 'idle' | 'assigning' | 'settled' | 'failed'

/**
 * Self-heal a member who is signed in but belongs to no civic spaces.
 *
 * WHY THIS EXISTS. Assignment used to happen in exactly one place, `useAuth`, and
 * only on two of its three paths: a token arriving in the URL hash after login,
 * and the silent SSO check. The third path — a valid `cs_token` already in
 * localStorage, which is what every returning visit uses — set the auth state and
 * returned without assigning.
 *
 * So the order of two ordinary actions decided whether the app worked at all:
 *
 *   sign up -> set address -> open Civic Spaces      = spaces created
 *   sign up -> open Civic Spaces -> set address      = nothing, forever
 *
 * The second is the normal order. Anyone in it stayed empty until their token
 * expired, because every reload took the path that skips assignment. Observed
 * 2026-09-01: a member whose address resolved correctly to Buncombe County, NC-11
 * and Senate District 49 had zero memberships and a blank screen.
 *
 * Assignment is not a login event. It is a consequence of having a jurisdiction,
 * and a jurisdiction can arrive long after the session did. So the trigger belongs
 * here — where the app can see that a signed-in member has nothing — rather than
 * in the auth handshake.
 *
 * Runs at most once per mount. The server call is idempotent, and a retry that
 * genuinely finds nothing (someone with no address yet) settles to the same empty
 * state, so the worst case is one wasted request rather than a loop.
 */
export function useEnsureSlices({
  userId,
  hasAnySlices,
  isLoading,
}: {
  userId: string | null
  hasAnySlices: boolean
  isLoading: boolean
}): EnsureSlicesStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<EnsureSlicesStatus>('idle')
  const attempted = useRef(false)

  useEffect(() => {
    // Wait for the membership query to settle before concluding anyone is empty,
    // or every first paint would fire an assignment.
    if (!userId || isLoading || hasAnySlices || attempted.current) return

    attempted.current = true
    const token = localStorage.getItem('cs_token')
    if (!token) {
      setStatus('failed')
      return
    }

    let cancelled = false
    setStatus('assigning')

    void requestSliceAssignment(token).then(async (accepted) => {
      if (cancelled) return

      // Re-read memberships even when the service reported failure. Assignment
      // walks the levels one at a time and writes as it goes, so a request that
      // ends badly can still have created real memberships — trusting the status
      // code alone would leave those invisible until the next reload.
      await queryClient.invalidateQueries({ queryKey: ['all-slices', userId] })
      if (!cancelled) setStatus(accepted ? 'settled' : 'failed')
    })

    return () => {
      cancelled = true
    }
  }, [userId, hasAnySlices, isLoading, queryClient])

  return status
}
