/**
 * One row of a public RPC, turned into the shape the cards already render.
 *
 * 🔴 This module has no runtime imports, deliberately — every import below is
 * `import type`, which is erased, so `node --experimental-strip-types` can load this
 * file and run the SHIPPED mappers rather than a transcription of them.
 * `scripts/check-composition.mjs` does exactly that. Same rule as `writeAccess.ts`:
 * do not add a value import here without moving the check to something that can
 * still reach the real function.
 *
 * ── Why a module and not four lines inside each hook ─────────────────────────
 *
 * The narrow projection is a privacy rule, and the rule is "a null author id means
 * this reader does not get to know who wrote this". Written inline, that rule exists
 * three times — feed, post, replies — and the next person to add a public surface
 * writes it a fourth time from memory. One of those four is eventually wrong in the
 * direction that discloses. This is the same argument `writeAccess.ts` makes about
 * the write gate, for the same reason.
 *
 * ── The column lists are load-bearing ────────────────────────────────────────
 *
 * 🔴 These RPCs do not exist in any database yet: 18-02's migrations are written,
 * reviewed and unapplied. Nothing in this repo can call one and see what comes back,
 * so a column renamed on the SQL side would surface as a 400 shown to the first
 * signed-out visitor after apply. The three exported column lists are diffed against
 * the migration's own `RETURNS TABLE` by check:composition assertions 63–65. They are
 * not documentation; deleting them deletes the only link between the two halves.
 */

import type { EditHistoryEntry, PostAuthor, PostWithAuthor, ReplyWithAuthor } from '../types/database'

// ── The wire rows ────────────────────────────────────────────────────────────

/** `civic_spaces.get_public_feed` — one post in a public place's feed. */
export interface PublicFeedRow {
  id: string
  slice_id: string
  title: string | null
  body: string
  created_at: string
  updated_at: string
  reply_count: number
  author_display_name: string
  /** 🔴 null is the narrow projection (D-48/D-49), not a missing value. */
  author_user_id: string | null
  author_avatar_url: string | null
}

/**
 * `civic_spaces.get_public_post` — one post, plus where it lives.
 *
 * It carries `slice_type` and `geoid` because a deep link arrives with neither, and
 * `locatePost` needs them to open the place. The feed row has no use for them: the
 * caller already knows which place it asked about.
 */
export interface PublicPostRow extends PublicFeedRow {
  slice_type: string
  geoid: string
}

/** `civic_spaces.get_public_replies` — one reply in a public thread. */
export interface PublicReplyRow {
  id: string
  post_id: string
  parent_reply_id: string | null
  body: string
  created_at: string
  updated_at: string
  author_display_name: string
  author_user_id: string | null
  author_avatar_url: string | null
}

// ── The column lists, in RETURNS TABLE order ─────────────────────────────────

export const PUBLIC_FEED_COLUMNS: readonly string[] = [
  'id', 'slice_id', 'title', 'body', 'created_at', 'updated_at',
  'reply_count', 'author_display_name', 'author_user_id', 'author_avatar_url',
]

export const PUBLIC_POST_COLUMNS: readonly string[] = [
  'id', 'slice_id', 'slice_type', 'geoid', 'title', 'body', 'created_at', 'updated_at',
  'reply_count', 'author_display_name', 'author_user_id', 'author_avatar_url',
]

export const PUBLIC_REPLY_COLUMNS: readonly string[] = [
  'id', 'post_id', 'parent_reply_id', 'body', 'created_at', 'updated_at',
  'author_display_name', 'author_user_id', 'author_avatar_url',
]

// ── The mappers ──────────────────────────────────────────────────────────────

/**
 * 🔴 One body for the author half, so the three mappers cannot disagree about what a
 * null id means. `avatar_url` is taken from the row rather than nulled here: the SQL
 * already nulls it under the same CASE that nulls the id, and re-deriving it would be
 * a second copy of the rule that could drift the permissive way.
 *
 * `tier` is deliberately absent rather than defaulted. D-34 withholds it, and a
 * default of `'connected'` would put a real claim about a real person on screen.
 */
function author(row: { author_display_name: string; author_avatar_url: string | null }): PostAuthor {
  return { display_name: row.author_display_name, avatar_url: row.author_avatar_url }
}

/**
 * 🔴 `is_deleted: false` is a fact, not a guess: every public RPC filters
 * `is_deleted = false` before returning, so a row that reached here is not deleted.
 * `edit_history` is left UNDEFINED rather than `[]` — see the type's own note.
 */
export function mapPublicPostRow(row: PublicFeedRow | PublicPostRow): PostWithAuthor {
  return {
    id: row.id,
    slice_id: row.slice_id,
    user_id: row.author_user_id,
    title: row.title,
    body: row.body,
    reply_count: row.reply_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_deleted: false,
    author: author(row),
  }
}

export function mapPublicReplyRow(row: PublicReplyRow): ReplyWithAuthor {
  return {
    id: row.id,
    post_id: row.post_id,
    parent_reply_id: row.parent_reply_id,
    user_id: row.author_user_id,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_deleted: false,
    author: author(row),
  }
}

// ── What a card may offer about an author ────────────────────────────────────

/** The three affordances that depend on knowing who wrote something. */
export interface AuthorPresentation {
  /** The author's profile route, or null when this reader may not have it. */
  profileHref: string | null
  /** Avatar, initial bubble and the name as a control — all one decision. */
  linkable: boolean
}

/**
 * 🔴 ONE BODY for "may this reader be offered the author?", because the alternative
 * is `user_id ? link : text` written at five call sites, and the fifth is eventually
 * written the permissive way.
 *
 * It is not a privacy gate — the gate is in SQL, and a null id here means the server
 * already declined to say. This is the rendering consequence, in one place, so that
 * consequence is testable without a browser.
 *
 * 🔴 It exists because TypeScript does NOT catch the alternative. Widening
 * `user_id` to `string | null` turned up three compile errors and none of them were
 * the profile links: `navigate('/profile/' + post.user_id)` is legal string
 * concatenation and happily produces `/profile/null`, and `post.user_id === userId`
 * is a legal comparison that is simply always false. check-composition asserts that
 * these components contain no raw `/profile/` concatenation, because the compiler
 * will not.
 *
 * Member posts always carry an id and always come back linkable, so there is one
 * rule rather than a public one and a member one.
 */
export function authorPresentation(userId: string | null | undefined): AuthorPresentation {
  if (!userId) return { profileHref: null, linkable: false }
  return { profileHref: `/profile/${userId}`, linkable: true }
}

/** Unused at runtime; keeps the type import honest when edit_history is reintroduced. */
export type { EditHistoryEntry }
