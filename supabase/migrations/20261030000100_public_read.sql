-- Phase 18-02: the public read path.
--
-- Four SECURITY DEFINER RPCs open City / County / State / Federal / Unified
-- conversations to readers with no account. This file is built in four sections:
--
--   1. public_author_is_visible  -- the one author-visibility rule
--   2. get_public_slice          -- the allowlist gate, and the one shard rule
--   3. get_public_feed           -- paginated posts for one public place
--   4. get_public_post, get_public_replies -- one thread, readable with no account
--
-- Do not reorder.
--
-- 🔴 EVERY FUNCTION HERE IS REVOKED FROM PUBLIC IN THIS FILE, right after its own
-- CREATE FUNCTION. Postgres grants EXECUTE on a new function to PUBLIC by default,
-- and `authenticated` already holds USAGE on schema civic_spaces and already reaches
-- /rest/v1/rpc/*. So a SECURITY DEFINER function left at the default is callable by
-- any signed-in member the instant it exists, with an RLS-bypassing answer. This
-- file therefore leaves all six callable by nobody but the owner. The grants that
-- open four of them to anon (and keep authenticated) are 20261030000200, which
-- contains no REVOKE.
--
-- 🔴 Public RPC calls go over POST. PostgREST also serves STABLE functions over GET,
-- and a GET is cacheable by any shared intermediary; these responses are viewer-
-- specific (they differ only by the Authorization header). Cloudflare already fronts
-- this product. Before 18-03 ships, confirm nothing shared caches /rest/v1/rpc/*.


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
--
-- p_viewer = p_author returns FALSE unless the viewer is a member of the slice: no
-- self-friendship row can exist (CHECK (user_low < user_high)). So an author who has
-- left a slice sees NULL on their own post. 18-03 must NOT test ownership through
-- author_user_id; compare against the session's own id instead.

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

-- The internal helper: no one but its owner (the RPCs run as the owner). Revoked HERE,
-- not in the grants file: authenticated can reach an un-revoked SECURITY DEFINER
-- function through PostgREST and would get an RLS-bypassing "are A and B friends?" /
-- "is A a member of slice S?" oracle.
REVOKE ALL ON FUNCTION civic_spaces.public_author_is_visible(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION civic_spaces.public_author_is_visible(text, text, uuid) IS
  'D-48/D-49: true when the viewer is a member of the slice, or an accepted (FRIEND) friend of this author. The only implementation of the rule.';


-- ────────────────────────────────────────────────────────────────────────────
-- public_author_is_blocked: should this row be shown to this viewer AT ALL?
--
-- 🔴 A DIFFERENT QUESTION FROM public_author_is_visible, and they must not be
-- merged. That one answers "may the viewer know WHO wrote this" and nulls the
-- author id when the answer is no. This one answers "should the row exist for
-- this viewer", and the answer is to omit it. Fold the block check into the
-- visibility helper and a blocked person's post appears with a blank byline
-- instead of being gone — which is worse than not filtering at all, because the
-- member asked for it to be gone and we showed it to them anonymised.
--
-- 🔴 Bidirectional, exactly as get_feed_filtered and get_boosted_feed_filtered
-- are (20260328200000_phase5_moderation.sql). Blocking is mutual in this product:
-- the blocker stops seeing the blocked, and the blocked stops seeing the blocker.
-- A one-directional copy here would be a THIRD semantics for blocking in one
-- schema, and the one most likely to surprise is the half nobody tested.
--
-- 🔴 NULL p_viewer short-circuits to FALSE before any table access, so this
-- changes NOTHING for an anonymous reader. That is deliberate and is what makes
-- it safe to add late: anon holds no blocks, the predicate is a no-op on that
-- path, and the four RPCs' anon output is byte-identical to before this helper
-- existed. The behaviour change is confined to a SIGNED-IN member reading a
-- public place they do not belong to — which is the case that had no filter.
--
-- Added 2026-10-31, after the whole-branch review of 18-03 observed that a block
-- held inside the member's own slices and evaporated one tab away: M blocks H in
-- Asheville, opens Buncombe County, and H is there in full. The plan said the
-- public RPCs "do not and must not" block-filter — that sentence was about
-- routing members through the public path FOR THEIR OWN SLICE, where it would
-- bypass the member feed's filtering. It was never an argument for publishing
-- blocked authors in places the member is only visiting. Chris's call, taken
-- while the migration is still unapplied.

CREATE OR REPLACE FUNCTION civic_spaces.public_author_is_blocked(
  p_viewer text,
  p_author text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_viewer IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM civic_spaces.blocks b
      WHERE (b.blocker_id = p_viewer AND b.blocked_id = p_author)
         OR (b.blocker_id = p_author AND b.blocked_id = p_viewer)
    )
  END;
$$;

-- 🔴 Revoked HERE, immediately, for the same reason the helper above is: an
-- un-revoked SECURITY DEFINER function is callable by `authenticated` through
-- PostgREST from the moment it exists, and this one would be a pairwise "has A
-- blocked B?" oracle over a table whose RLS says only the blocker may read their
-- own rows. That is strictly more sensitive than the friendship oracle, because
-- a block is information the blocker specifically does not want known.
REVOKE ALL ON FUNCTION civic_spaces.public_author_is_blocked(text, text)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION civic_spaces.public_author_is_blocked(text, text) IS
  'True when viewer and author have blocked each other in either direction. Always false for an anonymous viewer. The only implementation of the rule on the public path.';


-- ============================================================================
-- SECTION 2 of 4: get_public_slice
-- ============================================================================
--
-- THE PUBLIC ALLOWLIST LIVES IN SQL IN TWO PLACES: THIS ARRAY AND THE IDENTICAL ONE IN get_public_post (section 4); check:write-access keeps both equal to PUBLIC_SLICE_TYPES.
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

REVOKE ALL ON FUNCTION civic_spaces.get_public_slice(text, text) FROM PUBLIC;

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
--
-- reply_count is COMPUTED, not the posts.reply_count column. That column is kept by a
-- trigger on INSERT/DELETE of replies only: it does not move when a reply is
-- soft-deleted or its author is suspended, but get_public_replies withholds both. The
-- raw column would exceed the rendered replies and publish how many were removed. The
-- subquery uses the SAME predicates as get_public_replies (here and in get_public_post);
-- keep them equal.
--
-- 🔴 p_cursor_id NULL with p_cursor_at set: the tie-break comparison is NULL, so rows
-- sharing exactly p_cursor_at are DROPPED. Always pass both or neither.

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
    (
      SELECT count(*)::integer
      FROM civic_spaces.replies rc
      LEFT JOIN civic_spaces.connected_profiles rcp
        ON rcp.user_id = rc.user_id
      WHERE rc.post_id = p.id
        AND rc.is_deleted = false
        AND rcp.is_suspended IS NOT TRUE
        -- 🔴 The count must apply EVERY predicate get_public_replies applies, or
        -- the number and the list disagree on screen and the number is the one
        -- the reader believes. This is the same bug the visible-count fix closed
        -- for soft-deleted replies; the block filter reopens it if left out.
        AND NOT civic_spaces.public_author_is_blocked(
                  civic_spaces.current_user_id(), rc.user_id)
    ) AS reply_count,
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
    -- A no-op for anon (NULL viewer). For a signed-in member it is the same
    -- bidirectional rule their own feed applies — a block that stopped at the
    -- edge of their slices was not a block.
    AND NOT civic_spaces.public_author_is_blocked(
              civic_spaces.current_user_id(), p.user_id)
    AND (
      p_cursor_at IS NULL
      OR p.created_at < p_cursor_at
      OR (p.created_at = p_cursor_at AND p.id < p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

REVOKE ALL ON FUNCTION civic_spaces.get_public_feed(text, text, integer, timestamptz, uuid) FROM PUBLIC;

COMMENT ON FUNCTION civic_spaces.get_public_feed(text, text, integer, timestamptz, uuid) IS
  'One page of a public place''s feed. Author id/avatar are NULL where public_author_is_visible is false (D-48/D-49). Never returns edit_history, is_deleted, account_standing, tier or current_member_count.';


-- ============================================================================
-- SECTION 4 of 4: get_public_post, get_public_replies
-- ============================================================================
--
-- One thread, readable with no account.
--
-- 🔴 get_public_post does NOT call get_public_slice. That function answers D-46,
-- "which shard do I show when someone ARRIVES at a place", and returns the lowest
-- sibling_index for a (slice_type, geoid). A post's shard is already known, and may
-- be shard 2: routing through get_public_slice would drop it, or return it under
-- shard 1's slice_id. So the post joins to ITS OWN slice and is gated on the
-- allowlist directly, returning that slice's real slice_type, geoid and slice_id
-- (18-03 places a deep-linked post from these, with no second query).
--
-- The allowlist literal below is the same five types as get_public_slice, and
-- check:write-access compares every slice-type array in this file against
-- PUBLIC_SLICE_TYPES. Edit all of them together, deliberately.
--
-- A post that is private, deleted, by a suspended author, or nonexistent is simply
-- ABSENT: zero rows, never an error, and never distinguishable from one another.
-- An author with no connected_profiles row still shows, as 'Unknown' (LEFT JOIN,
-- so the suspension filter is `IS NOT TRUE`, as in get_public_feed).
--
-- Author projection is per row through public_author_is_visible (D-48, D-49): NULL
-- author_user_id / author_avatar_url is the narrow projection, never a sentinel.
-- Never SELECT *: edit_history, is_deleted, account_standing, tier and
-- current_member_count stay in the database.

CREATE OR REPLACE FUNCTION civic_spaces.get_public_post(
  p_post_id uuid
)
RETURNS TABLE (
  id                  uuid,
  slice_id            uuid,
  slice_type          text,
  geoid               text,
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
    s.slice_type,
    s.geoid,
    p.title,
    p.body,
    p.created_at,
    p.updated_at,
    (
      SELECT count(*)::integer
      FROM civic_spaces.replies rc
      LEFT JOIN civic_spaces.connected_profiles rcp
        ON rcp.user_id = rc.user_id
      WHERE rc.post_id = p.id
        AND rc.is_deleted = false
        AND rcp.is_suspended IS NOT TRUE
        -- Same predicate set as get_public_replies — see get_public_feed's note.
        AND NOT civic_spaces.public_author_is_blocked(
                  civic_spaces.current_user_id(), rc.user_id)
    ) AS reply_count,
    COALESCE(cp.display_name, 'Unknown'),
    CASE WHEN v.visible THEN p.user_id     END,
    CASE WHEN v.visible THEN cp.avatar_url END
  FROM civic_spaces.posts p
  JOIN civic_spaces.slices s
    ON s.id = p.slice_id
  LEFT JOIN civic_spaces.connected_profiles cp
    ON cp.user_id = p.user_id
  CROSS JOIN LATERAL (
    SELECT civic_spaces.public_author_is_visible(
             civic_spaces.current_user_id(), p.user_id, p.slice_id
           ) AS visible
  ) v
  WHERE p.id = p_post_id
    AND s.slice_type = ANY (ARRAY['city', 'county', 'state', 'federal', 'unified']::text[])
    AND p.is_deleted = false
    AND cp.is_suspended IS NOT TRUE
    -- 🔴 A blocked author's post returns NO ROW, which makes a deep link to it
    -- resolve `unavailable` in locatePost — the same answer as deleted, private
    -- and never-existed. That conflation is the point: a member who blocked
    -- someone should not be able to tell, from a link, whether that person's
    -- post exists. get_public_replies gates through this function, so blocking
    -- the post's author closes the whole thread, not just its byline.
    AND NOT civic_spaces.public_author_is_blocked(
              civic_spaces.current_user_id(), p.user_id);
$$;

REVOKE ALL ON FUNCTION civic_spaces.get_public_post(uuid) FROM PUBLIC;

COMMENT ON FUNCTION civic_spaces.get_public_post(uuid) IS
  'One public post, in its OWN shard (not get_public_slice''s lowest one). Allowlist-gated; absent if private, deleted, suspended-author or unknown. Author id/avatar NULL where public_author_is_visible is false.';


-- get_public_replies: replies of one public post, oldest first (a thread reads
-- downward, the opposite of the feed), (created_at, id) ascending with the
-- composite cursor: pass the created_at and id of the LAST row of the previous page.
--
--   * The post is gated by get_public_post, so a reply under a private, deleted or
--     unknown post is never returned and the allowlist is not repeated.
--   * Soft-deleted replies are excluded, but their CHILDREN ARE KEPT: parent_reply_id
--     is returned as stored and rows are never re-parented or hidden because a
--     parent is gone.
--   * Replies by suspended authors are excluded, as in the feed.
--   * p_limit is clamped to 1..100 (default 50).
--   * 🔴 p_cursor_id NULL with p_cursor_at set drops rows sharing exactly p_cursor_at
--     (the tie-break is NULL). Always pass both or neither.

CREATE OR REPLACE FUNCTION civic_spaces.get_public_replies(
  p_post_id   uuid,
  p_limit     integer     DEFAULT 50,
  p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_id uuid        DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  post_id             uuid,
  parent_reply_id     uuid,
  body                text,
  created_at          timestamptz,
  updated_at          timestamptz,
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
    r.id,
    r.post_id,
    r.parent_reply_id,
    r.body,
    r.created_at,
    r.updated_at,
    COALESCE(cp.display_name, 'Unknown'),
    CASE WHEN v.visible THEN r.user_id     END,
    CASE WHEN v.visible THEN cp.avatar_url END
  FROM civic_spaces.get_public_post(p_post_id) gp
  JOIN civic_spaces.replies r
    ON r.post_id = gp.id
  LEFT JOIN civic_spaces.connected_profiles cp
    ON cp.user_id = r.user_id
  CROSS JOIN LATERAL (
    SELECT civic_spaces.public_author_is_visible(
             civic_spaces.current_user_id(), r.user_id, gp.slice_id
           ) AS visible
  ) v
  WHERE r.is_deleted = false
    AND cp.is_suspended IS NOT TRUE
    -- Per REPLY author, not just the post's: a blocked person replying in a
    -- thread by someone else is the common case, and the post-level gate above
    -- does not reach them.
    AND NOT civic_spaces.public_author_is_blocked(
              civic_spaces.current_user_id(), r.user_id)
    AND (
      p_cursor_at IS NULL
      OR r.created_at > p_cursor_at
      OR (r.created_at = p_cursor_at AND r.id > p_cursor_id)
    )
  ORDER BY r.created_at ASC, r.id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;

COMMENT ON FUNCTION civic_spaces.get_public_replies(uuid, integer, timestamptz, uuid) IS
  'One page of a public post''s replies, oldest first. Soft-deleted replies excluded, their children kept. Author id/avatar NULL where public_author_is_visible is false.';

REVOKE ALL ON FUNCTION civic_spaces.get_public_replies(uuid, integer, timestamptz, uuid) FROM PUBLIC;
