-- Phase 18-02: the public read path.
--
-- Four SECURITY DEFINER RPCs open City / County / State / Federal / Unified
-- conversations to readers with no account. This file is built in four sections:
--
--   1. public_author_is_visible  -- the one author-visibility rule
--   2. get_public_slice          -- the allowlist gate, and the one shard rule
--   3. get_public_feed           -- paginated posts for one public place
--   4. (reserved)
--
-- Section 4 is appended by a later task. Do not reorder.


-- ============================================================================
-- SECTION 1 of 4: public_author_is_visible
-- ============================================================================
--
-- How much of an AUTHOR a viewer may see (the wide projection vs the narrow one).
--
--   D-48  MEMBERSHIP unlocks the wide projection, not account tier. A member of
--         the slice sees that slice's authors in full.
--   D-49  FRIENDSHIP is the one exception, and it is PER AUTHOR: a viewer who is
--         not a member but is an accepted friend of one particular author sees
--         that author in full, while other authors in the same response stay
--         narrow.
--
-- THIS IS THE ONLY BODY THAT IMPLEMENTS D-48 AND D-49. The RPCs call it once per
-- row. A caller that re-derives the rule (its own slice_members or friendships
-- join) is a bug: the two copies drift and one of them leaks.
--
-- p_viewer must be civic_spaces.current_user_id() at every call site, NEVER a
-- value taken from the client. current_user_id() is SECURITY INVOKER and reads
-- the request's JWT claims, so it reports the caller even from inside a
-- SECURITY DEFINER body. A client-supplied id would let anyone claim any identity.
--
-- friendships facts this depends on (phase3_social_graph.sql):
--   * the pair is stored ORDERED, CHECK (user_low < user_high), so the predicate
--     matches both orderings;
--   * status is 'REQ_LOW' | 'REQ_HIGH' | 'FRIEND'. 'FRIEND' is the accepted state.
--     The two REQ_* values are pending requests and must NOT unlock D-49.
--
-- SECURITY DEFINER with search_path pinned to '' and every object schema-qualified:
-- an unpinned search_path on a definer function is a privilege-escalation hole.
-- An anon viewer (NULL) is always narrow.

CREATE OR REPLACE FUNCTION civic_spaces.public_author_is_visible(
  p_viewer   text,
  p_author   text,
  p_slice_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_viewer IS NULL THEN false
    ELSE
      EXISTS (
        SELECT 1
        FROM civic_spaces.slice_members sm
        WHERE sm.slice_id = p_slice_id
          AND sm.user_id  = p_viewer
      )
      OR EXISTS (
        SELECT 1
        FROM civic_spaces.friendships f
        WHERE f.status = 'FRIEND'
          AND (
               (f.user_low = p_viewer AND f.user_high = p_author)
            OR (f.user_low = p_author AND f.user_high = p_viewer)
          )
      )
  END;
$$;

COMMENT ON FUNCTION civic_spaces.public_author_is_visible(text, text, uuid) IS
  'D-48/D-49: true when the viewer is a member of the slice, or an accepted (FRIEND) friend of this author. The only implementation of the rule.';


-- ============================================================================
-- SECTION 2 of 4: get_public_slice
-- ============================================================================
--
-- THE PUBLIC ALLOWLIST LIVES HERE, AND ONLY HERE (in SQL).
--
--   D-27  A volunteer slice is never public.
--   D-28  A slice type that is not named below is never public.
--   D-46  A place with several shards resolves to ONE: the lowest sibling_index.
--
-- 🔴 The array below is a LITERAL, on purpose. It is not a lookup against
-- slices_slice_type_check. That constraint says what MAY EXIST in the table; this
-- list says what is PUBLIC. Binding the two would publish every new slice type the
-- moment it was created, before anyone had decided it should be readable by the
-- world. A new type stays private until someone edits this array deliberately.
--
-- 🔴 The same five types are also in src/lib/writeAccess.ts (PUBLIC_SLICE_TYPES).
-- scripts/check-write-access.mjs reads THIS FILE and fails if the two differ, so
-- editing one without the other is a red CI run, not a silent mismatch. Keep the
-- array a single-line literal of quoted strings so that check can find it.
--
-- Returns only the four routing columns. slices.current_member_count is a real
-- column and is deliberately not exposed (D-34).
--
-- get_public_feed resolves its shard by calling this function. get_public_post
-- (section 4) must NOT: a post can live in a shard other than the lowest one.

CREATE OR REPLACE FUNCTION civic_spaces.get_public_slice(
  p_slice_type text,
  p_geoid      text
)
RETURNS TABLE (
  slice_id      uuid,
  slice_type    text,
  geoid         text,
  sibling_index integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.slice_type, s.geoid, s.sibling_index
  FROM civic_spaces.slices s
  WHERE p_slice_type = ANY (ARRAY['city', 'county', 'state', 'federal', 'unified']::text[])
    AND s.slice_type = p_slice_type
    AND s.geoid      = p_geoid
  ORDER BY s.sibling_index
  LIMIT 1;
$$;

COMMENT ON FUNCTION civic_spaces.get_public_slice(text, text) IS
  'D-27/D-28/D-46: the public slice for a place, or no row. Literal allowlist (kept equal to PUBLIC_SLICE_TYPES by check:write-access); lowest sibling_index wins.';


-- ============================================================================
-- SECTION 3 of 4: get_public_feed
-- ============================================================================
--
-- One page of posts for a public place, newest first, readable with no account.
--
--   * The shard comes from get_public_slice, so the allowlist and the shard rule
--     are not repeated here. An unlisted type or an unknown place is an empty
--     result, never an error.
--   * Soft-deleted posts are excluded. So are posts by suspended authors.
--   * Pagination is the (created_at, id) composite cursor useFeed.ts already uses:
--     pass the created_at and id of the LAST row of the previous page. Ties on
--     created_at are broken by id, so no row repeats and none is skipped.
--   * p_limit is clamped to 1..100 (default 20).
--
-- AUTHOR PROJECTION (D-48, D-49). author_display_name is always returned.
-- author_user_id and author_avatar_url are NULL on a row where
-- public_author_is_visible() is false. 🔴 NULL is the whole signal: 18-03 reads it
-- as "narrow projection". It must never become a sentinel string.
--
-- 🔴 The profile join is a LEFT JOIN, so an author with no connected_profiles row
-- still has their post shown, as 'Unknown'. The suspension filter is therefore
-- `IS NOT TRUE`, not `= false`: is_suspended is NULL exactly when the join found
-- no profile, and `= false` would silently drop those posts. (For a row that
-- exists, is_suspended is generated from account_standing, which is NOT NULL.)
--
-- 🔴 Every output column is named. Never SELECT *: posts.edit_history and
-- slices.current_member_count are real columns that must not leave the database
-- (D-31, D-34), and nor may is_deleted, account_standing or tier.
--
-- The viewer is civic_spaces.current_user_id() (NULL for anon), never an argument.

CREATE OR REPLACE FUNCTION civic_spaces.get_public_feed(
  p_slice_type text,
  p_geoid      text,
  p_limit      integer     DEFAULT 20,
  p_cursor_at  timestamptz DEFAULT NULL,
  p_cursor_id  uuid        DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  slice_id            uuid,
  title               text,
  body                text,
  created_at          timestamptz,
  updated_at          timestamptz,
  reply_count         integer,
  author_display_name text,
  author_user_id      text,
  author_avatar_url   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.slice_id,
    p.title,
    p.body,
    p.created_at,
    p.updated_at,
    p.reply_count,
    COALESCE(cp.display_name, 'Unknown'),
    CASE WHEN v.visible THEN p.user_id    END,
    CASE WHEN v.visible THEN cp.avatar_url END
  FROM civic_spaces.get_public_slice(p_slice_type, p_geoid) gs
  JOIN civic_spaces.posts p
    ON p.slice_id = gs.slice_id
  LEFT JOIN civic_spaces.connected_profiles cp
    ON cp.user_id = p.user_id
  CROSS JOIN LATERAL (
    SELECT civic_spaces.public_author_is_visible(
             civic_spaces.current_user_id(), p.user_id, p.slice_id
           ) AS visible
  ) v
  WHERE p.is_deleted = false
    AND cp.is_suspended IS NOT TRUE
    AND (
      p_cursor_at IS NULL
      OR p.created_at < p_cursor_at
      OR (p.created_at = p_cursor_at AND p.id < p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

COMMENT ON FUNCTION civic_spaces.get_public_feed(text, text, integer, timestamptz, uuid) IS
  'One page of a public place''s feed. Author id/avatar are NULL where public_author_is_visible is false (D-48/D-49). Never returns edit_history, is_deleted, account_standing, tier or current_member_count.';
