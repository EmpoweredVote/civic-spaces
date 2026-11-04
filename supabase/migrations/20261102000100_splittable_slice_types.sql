-- Phase 19-01 Task 2: which slice types divide when they fill (design §4.2).
--
-- 🔴 This list is repeated, as a literal, in src/lib/writeAccess.ts as
-- SPLITTABLE_SLICE_TYPES. Neither side can import the other — one is SQL running
-- inside Postgres, the other a zero-dependency module a Node guard runs under
-- type stripping — so `npm run check:write-access` pins them against each other
-- (assertions 60–63). Change one, change the other, run the guard.
--
-- 🔴 It is NOT the same list as 20261030000100's public-read allowlist, even
-- though the five strings are identical today. That one decides what the whole
-- internet may READ (D-28); this one decides what divides at 6000 members. A
-- future private slice type will want one without the other, and collapsing them
-- would make that impossible to express — see assertion 63, which exists purely
-- to stop someone aliasing them in TypeScript.
--
-- Volunteer is absent on purpose, and not because it is private. It is not a
-- PLACE: role-gated through assignVolunteerIfEligible, membership revocable when
-- the role goes away, population bounded by who holds the role. Splitting it
-- would divide a role rather than a town. If a volunteer slice ever did reach
-- 6000, today's overflow path still applies — a sibling is created and fills —
-- which is a dormant fallback nobody expects to fire.
--
-- IMMUTABLE: the answer depends on nothing but the argument, so the planner may
-- fold it into an index condition or constant-fold it in a WHERE clause.

CREATE OR REPLACE FUNCTION civic_spaces.is_splittable_slice_type(p_slice_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_slice_type = ANY (ARRAY['city', 'county', 'state', 'federal', 'unified']);
$$;

-- 🔴 Revoked beside its CREATE, like every function added since Phase 18. `anon`
-- resolves schema civic_spaces now, and Postgres grants EXECUTE to PUBLIC on a
-- new function by default — so anything not revoked here is world-callable from
-- the moment it exists. This one leaks nothing, but the habit is the point:
-- check:anon-read asserts the anon-executable set is exactly the four public RPCs.
REVOKE ALL ON FUNCTION civic_spaces.is_splittable_slice_type(text) FROM PUBLIC, anon, authenticated;

-- 🔴 ...and granted back to the engine alone. ev-accounts has to know whether a
-- full slice DIVIDES or merely OVERFLOWS, because the two have different outcomes:
-- a splittable type calls split_slice, while `volunteer` falls through to the
-- dormant create-a-sibling path described above. The engine could carry its own
-- copy of the five strings, but that would be a THIRD list with nothing pinning
-- it to these two -- and a drifted copy there would route a split down the wrong
-- branch in silence. Asking the database costs one round trip on a path that
-- fires once per 6000 members, and it leaks nothing: the function reads no table
-- and its answer is a constant.
GRANT EXECUTE ON FUNCTION civic_spaces.is_splittable_slice_type(text) TO civic_spaces_app;

COMMENT ON FUNCTION civic_spaces.is_splittable_slice_type(text) IS
  'Design §4.2: city, county, state, federal, unified divide at the cap; volunteer does not, because it is a role rather than a place. Twin of SPLITTABLE_SLICE_TYPES in src/lib/writeAccess.ts — deliberately NOT the same list as the public-read allowlist, though the contents match today. Pinned by check:write-access 60-63.';

NOTIFY pgrst, 'reload schema';
