import type { Friendship, RelationshipState } from '../types/database'

/**
 * Returns the canonical { user_low, user_high } key for a friendship row,
 * with the lexicographically smaller ID as user_low.
 */
export function friendshipKey(
  userId: string,
  otherId: string
): { user_low: string; user_high: string } {
  return userId < otherId
    ? { user_low: userId, user_high: otherId }
    : { user_low: otherId, user_high: userId }
}

/**
 * Derives the current user's RelationshipState from a friendship row.
 *
 * REQ_LOW  — user_low sent the request; user_high is the recipient
 * REQ_HIGH — user_high sent the request; user_low is the recipient
 */
export function friendshipStatus(
  row: Friendship,
  currentUserId: string
): RelationshipState {
  if (row.status === 'FRIEND') return 'friends'
  if (row.status === 'REQ_LOW') {
    return row.user_low === currentUserId ? 'pending_sent' : 'pending_received'
  }
  if (row.status === 'REQ_HIGH') {
    return row.user_high === currentUserId ? 'pending_sent' : 'pending_received'
  }
  return 'none'
}
