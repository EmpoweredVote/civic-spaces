-- Phase 19-01 Task 3: split_slice() — the membership move.
--
-- A slice that reaches its cap divides: the most recently joined half moves to a
-- new sibling, which then opens seeded with a copy of a recent window of the
-- parent's conversation (the seed half is Task 6, below the marker).
--
-- 🔴 WHY THIS LIVES IN civic_spaces AND NOT IN ev-accounts, where the rest of
-- slice assignment lives (ev-cto decision 0018). The engine's pool connects as
-- `civic_spaces_app`, a role holding DML on slices, slice_members and
-- connected_profiles ONLY — a deliberate privacy boundary, see ev-accounts
-- backend/migrations/CA_0112_civic_spaces_scoped_role.sql and the commentary in
-- its config/database.ts. It cannot read a post, let alone copy one. Widening
-- that role to make the seed possible would cross a stated boundary for
-- implementation convenience and permanently enlarge what a compromised accounts
-- service can read. So the engine DECIDES a split should happen and calls this;
-- the privileged work is owned and reviewed in the repo that owns the content,
-- and the engine needs EXECUTE on one function and nothing else.
--
-- SECURITY DEFINER because slice_members has no client-writable RLS policy at
-- all, and must not gain one: that absence is what stands between the schema and
-- a member assigning themselves anywhere they like.
--
-- 🔴 CALL IT ONCE, INTO A VARIABLE. It is VOLATILE and it MUTATES, so putting it
-- in a WHERE clause or a join condition lets the planner evaluate it per row —
-- which splits the slice repeatedly. Caught while writing the rehearsal:
-- `SELECT ... WHERE slice_id = civic_spaces.split_slice($1)` ran it twice, the
-- second call correctly refusing because the first had already created a newer
-- sibling. The refusal masked the double-split; a function without the frontier
-- guard would simply have divided the jurisdiction twice and said nothing.

CREATE OR REPLACE FUNCTION civic_spaces.split_slice(
  p_slice_id    uuid,
  p_seed_window interval DEFAULT interval '14 days'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent   civic_spaces.slices%ROWTYPE;
  v_max      integer;
  v_new_id   uuid;
  v_total    integer;
  v_to_move  integer;
BEGIN
  -- The SAME row lock enforce_slice_cap() takes, so a split and a concurrent
  -- join serialise against each other rather than racing on the count.
  SELECT * INTO v_parent
  FROM   civic_spaces.slices
  WHERE  id = p_slice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'split_slice: no slice %', p_slice_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT civic_spaces.is_splittable_slice_type(v_parent.slice_type) THEN
    RAISE EXCEPTION 'split_slice: % does not split (design 4.2 — it is a role, not a place)',
      v_parent.slice_type USING ERRCODE = 'P0001';
  END IF;

  -- 🔴 ONLY THE FRONTIER SPLITS (design 4.4). Reaching the cap does two
  -- different things depending on position: the newest slice divides, because a
  -- split's purpose is to OPEN THE NEXT ONE; a slice with a newer sibling
  -- already beside it simply closes, because there is nothing left to open.
  -- Without this, every full slice would divide and the jurisdiction would grow
  -- a tail of half-empty rooms nobody is being placed into.
  SELECT max(sibling_index) INTO v_max
  FROM   civic_spaces.slices
  WHERE  slice_type = v_parent.slice_type AND geoid = v_parent.geoid;

  IF v_parent.sibling_index < v_max THEN
    RAISE EXCEPTION 'split_slice: slice % is not the frontier (index % of %); a full non-frontier slice closes, it does not split',
      p_slice_id, v_parent.sibling_index, v_max USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO civic_spaces.slices (slice_type, geoid, sibling_index)
  VALUES (v_parent.slice_type, v_parent.geoid, v_max + 1)
  RETURNING id INTO v_new_id;

  -- 🔴 count(*), NOT the cap and NOT current_member_count. Members leave, and
  -- the count is trigger-maintained and can drift from reality. "The most recent
  -- half" means half of what is actually there.
  SELECT count(*) INTO v_total
  FROM   civic_spaces.slice_members
  WHERE  slice_id = p_slice_id;

  v_to_move := ceil(v_total / 2.0);

  -- 🔴 UPDATE, not DELETE + INSERT. The INSERT trigger would re-check the cap
  -- and the DELETE trigger would decrement the parent — both firing once per
  -- row, each taking FOR UPDATE on a slice row inside a transaction that already
  -- holds one. Neither trigger fires on UPDATE, so the counts are fixed below by
  -- two statements instead of 2n trigger invocations.
  --
  -- 🔴 `user_id DESC` is a TIEBREAKER, not decoration. joined_at ties are
  -- certain at bulk-assignment time, and without a total order the same input
  -- splits two different ways on two runs — which makes a split unreproducible
  -- and a bug in it unfindable.
  WITH movers AS (
    SELECT id
    FROM   civic_spaces.slice_members
    WHERE  slice_id = p_slice_id
    ORDER  BY joined_at DESC, user_id DESC
    LIMIT  v_to_move
  )
  UPDATE civic_spaces.slice_members m
  SET    slice_id = v_new_id
  FROM   movers
  WHERE  m.id = movers.id;

  -- joined_at is deliberately NOT touched above. Stamping now() on the movers
  -- would destroy the only tenure record the platform holds, irreversibly, and
  -- it is the key redistribution will sort on later.

  UPDATE civic_spaces.slices
  SET    current_member_count = v_total - v_to_move
  WHERE  id = p_slice_id;

  UPDATE civic_spaces.slices
  SET    current_member_count = v_to_move
  WHERE  id = v_new_id;

  -- Task 6 adds the seed copy here.

  RETURN v_new_id;
END;
$$;

-- 🔴 Owner-only, plus the engine. A SECURITY DEFINER function left at Postgres's
-- default EXECUTE-to-PUBLIC is callable by anyone who can resolve the schema —
-- and since Phase 18, `anon` can. This one MOVES MEMBERS; world-callable it
-- would be a way to reshuffle a jurisdiction from the open internet.
REVOKE ALL ON FUNCTION civic_spaces.split_slice(uuid, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.split_slice(uuid, interval) TO civic_spaces_app;

COMMENT ON FUNCTION civic_spaces.split_slice(uuid, interval) IS
  'Design 4.4: divides a FRONTIER slice, moving the most recently joined half (ceil) to a new sibling and seeding it with a window of the parent''s recent threads. Refuses a non-frontier slice (it closes instead) and any non-splittable type. joined_at is carried, never restamped. Called by the ev-accounts engine, which cannot touch post content itself.';

NOTIFY pgrst, 'reload schema';
