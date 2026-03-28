export interface FeedCursor {
  created_at: string
  id: string
}

export interface BoostedFeedCursor {
  boosted_at: string  // ISO timestamp — the synthetic sort key
  id: string          // UUID tiebreaker
}

export function encodeCursor(cursor: FeedCursor): string {
  const json = JSON.stringify(cursor)
  // base64url encode (URL-safe, no padding issues)
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeCursor(encoded: string): FeedCursor {
  // base64url decode
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const json = atob(base64)
  return JSON.parse(json) as FeedCursor
}
