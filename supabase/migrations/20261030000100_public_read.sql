-- Phase 18-02: the public read path.
--
-- Four SECURITY DEFINER RPCs open City / County / State / Federal / Unified
-- conversations to readers with no account. This file is built in four sections:
--
--   1. public_author_is_visible  -- the one author-visibility rule        (this section)
--   2. (reserved)
--   3. (reserved)
--   4. (reserved)
--
-- Sections 2-4 are appended by later tasks. Do not reorder.


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
