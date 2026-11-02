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

-- 🔴 p_min_members IS A SAFETY CATCH, NOT A TUNING KNOB. Dividing is
-- IRREVERSIBLE — there is no inverse function, and even with one, the replies
-- written in the new slice afterwards have nowhere to go. Without this the only
-- preconditions were "exists", "is splittable" and "is the frontier", and the
-- function's OWN OUTPUT satisfies all three: the slice it just created is
-- splittable and is the new frontier. So a caller in a loop would halve a
-- jurisdiction over and over, re-seeding another copy of the window each time,
-- and a slice of ten members, or one, or zero (ceil(0/2) = 0, an empty sibling)
-- would divide just as willingly as a full one.
--
-- The only thing standing between that and production was caller discipline in
-- civic_spaces_app — precisely the role this whole design treats as untrusted
-- enough to wall off from post content. Defaulting to the cap means the engine's
-- one-argument call is guarded without knowing it, while an operator who really
-- does mean to split a half-empty slice has to say so.
--
-- 6000 MUST equal civic_spaces.enforce_slice_cap()'s threshold and
-- SLICE_CAPACITY in ev-accounts' sliceAssigner.ts. Three places, one number.
CREATE OR REPLACE FUNCTION civic_spaces.split_slice(
  p_slice_id    uuid,
  p_seed_window interval DEFAULT interval '14 days',
  p_min_members integer  DEFAULT 6000
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

  -- 🔴 count(*), NOT the cap and NOT current_member_count. Members leave, and
  -- the count is trigger-maintained and can drift from reality. "The most recent
  -- half" means half of what is actually there — and it is also what the
  -- fullness guard below has to be measured against, for the same reason.
  SELECT count(*) INTO v_total
  FROM   civic_spaces.slice_members
  WHERE  slice_id = p_slice_id;

  -- 🔴 COUNTED AND REFUSED BEFORE ANYTHING IS CREATED. A split that should not
  -- have happened cannot be undone, so the refusal has to come before the
  -- INSERT, not after it — otherwise a rejected call still leaves a new slice
  -- row behind, which is itself the new frontier.
  IF v_total < p_min_members THEN
    RAISE EXCEPTION 'split_slice: slice % has % members, below the % required to divide; splitting is irreversible',
      p_slice_id, v_total, p_min_members USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO civic_spaces.slices (slice_type, geoid, sibling_index)
  VALUES (v_parent.slice_type, v_parent.geoid, v_max + 1)
  RETURNING id INTO v_new_id;

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

  -- ── the seed ───────────────────────────────────────────────────────────
  -- The new slice must open TALKING. An empty slice is the failure this whole
  -- design exists to avoid, so it is handed a forked copy of a recent window of
  -- the parent's conversation (design 4.5).
  --
  -- 🔴 The copies keep the ORIGINAL author, title, body and created_at. The
  -- feed is ORDER BY created_at DESC: stamping now() would open the new slice
  -- with a wall of simultaneous posts in arbitrary order, and would lie about
  -- when the words were said. Original created_at also lets the seed interleave
  -- correctly, which makes p_seed_window the thing that decides what sits above
  -- the fold.
  --
  -- 🔴 updated_at IS NOT PRESERVED, and saying otherwise would be a lie this
  -- file told for a while. The INSERTs below do carry it, but two existing
  -- triggers overwrite it afterwards and neither can be avoided from in here:
  -- trg_reply_count UPDATEs posts.reply_count for every copied reply, and the
  -- parent_reply_id remap at the bottom UPDATEs the copied replies — each firing
  -- set_updated_at(), which assigns now() unconditionally. The only way to stop
  -- it is to make that shared trigger honour an explicitly supplied value, which
  -- would hand every authenticated client control of updated_at on their own
  -- rows through PostgREST. Not worth it: created_at is the ordering key and the
  -- "edited" marker reads edit_history, not this column. Asserted as-is in
  -- 19-01-split-seed.sql (S6b) so the behaviour is pinned rather than accidental.
  --
  -- The copy is ARCHIVAL with respect to its author: the byline is kept because
  -- they are genuinely that person's words, but forked_from denies them standing
  -- here and denies them the edit (19-02). The conversation continues without
  -- them.
  --
  -- Excluded, each by one clause: out of window; soft-deleted; author suspended.
  -- Resurrecting any of those in the new slice would publish, to a fresh
  -- audience, something the parent's own feed has stopped showing.
  WITH src AS (
    SELECT p.id, p.user_id, p.title, p.body, p.created_at, p.updated_at
    FROM   civic_spaces.posts p
    JOIN   civic_spaces.connected_profiles cp ON cp.user_id = p.user_id
    WHERE  p.slice_id   = p_slice_id
      AND  p.is_deleted = false
      AND  cp.account_standing <> 'suspended'
      AND  p.created_at >= now() - p_seed_window
  ), ins AS (
    INSERT INTO civic_spaces.posts
      (slice_id, user_id, title, body, created_at, updated_at, forked_from)
    SELECT v_new_id, s.user_id, s.title, s.body, s.created_at, s.updated_at, s.id
    FROM   src s
    RETURNING id, forked_from
  )
  -- Replies ride along with their posts, under the same exclusions. A thread
  -- seeded as a bare post with its replies stripped is an archive, not a
  -- conversation — the exact failure this is meant to avoid.
  --
  -- parent_reply_id is deliberately NULL here and remapped below: the copy it
  -- must point at does not exist until this statement has finished.
  --
  -- 🔴 A REPLY WHOSE PARENT IS EXCLUDED IS EXCLUDED TOO. Without the last
  -- clause, a child of a soft-deleted or suspended-author reply was still copied
  -- when its own author was fine — and the remap then found no parent to point
  -- at, so it stayed NULL and rendered as a direct reply to the post. The words
  -- survive, stripped of what they were answering, in front of an audience who
  -- never saw the question. In the parent slice that reply still nests correctly
  -- under a hidden parent; the fork is where it gets promoted.
  --
  -- One level deep, which is all the schema allows today. If nesting ever goes
  -- deeper this needs to be recursive, or a grandchild of an excluded reply
  -- comes back the same way.
  INSERT INTO civic_spaces.replies
    (post_id, parent_reply_id, user_id, body, created_at, updated_at, forked_from)
  SELECT ins.id, NULL, r.user_id, r.body, r.created_at, r.updated_at, r.id
  FROM   civic_spaces.replies r
  JOIN   ins ON ins.forked_from = r.post_id
  JOIN   civic_spaces.connected_profiles cp ON cp.user_id = r.user_id
  WHERE  r.is_deleted = false
    AND  cp.account_standing <> 'suspended'
    AND  (r.parent_reply_id IS NULL OR EXISTS (
            SELECT 1
            FROM   civic_spaces.replies              pr
            JOIN   civic_spaces.connected_profiles  pcp ON pcp.user_id = pr.user_id
            WHERE  pr.id          = r.parent_reply_id
              AND  pr.is_deleted  = false
              AND  pcp.account_standing <> 'suspended'));

  -- 🔴 THE REMAP. Copying parent_reply_id verbatim would point a reply in the
  -- NEW slice at a reply in the PARENT — silently stitching together two threads
  -- that are supposed to have forked apart, so that a nested reply in one slice
  -- hangs off a conversation in another. Done as a second pass because the
  -- target ids are only knowable once the copies exist. Matching through
  -- forked_from handles any nesting depth, not just the one level the schema
  -- allows today.
  UPDATE civic_spaces.replies child
  SET    parent_reply_id = parent_copy.id
  FROM   civic_spaces.replies original
  JOIN   civic_spaces.replies parent_copy
         ON parent_copy.forked_from = original.parent_reply_id
  JOIN   civic_spaces.posts  pc ON pc.id = parent_copy.post_id
  WHERE  child.forked_from = original.id
    AND  original.parent_reply_id IS NOT NULL
    AND  pc.slice_id = v_new_id
    AND  child.post_id IN (SELECT id FROM civic_spaces.posts WHERE slice_id = v_new_id);

  RETURN v_new_id;
END;
$$;

-- 🔴 Owner-only, plus the engine. A SECURITY DEFINER function left at Postgres's
-- default EXECUTE-to-PUBLIC is callable by anyone who can resolve the schema —
-- and since Phase 18, `anon` can. This one MOVES MEMBERS; world-callable it
-- would be a way to reshuffle a jurisdiction from the open internet.
REVOKE ALL ON FUNCTION civic_spaces.split_slice(uuid, interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION civic_spaces.split_slice(uuid, interval, integer) TO civic_spaces_app;

COMMENT ON FUNCTION civic_spaces.split_slice(uuid, interval, integer) IS
  'Design 4.4: divides a FRONTIER slice, moving the most recently joined half (ceil) to a new sibling and seeding it with a window of the parent''s recent threads. Refuses a non-frontier slice (it closes instead), any non-splittable type, and any slice below p_min_members (default 6000) -- splitting is irreversible and the function''s own output satisfies every other guard. joined_at is carried, never restamped; updated_at on a copy is the copy time, because two existing triggers restamp it. Called by the ev-accounts engine, which cannot touch post content itself.';

-- 🔴 Two column comments the design asks for (§3, §4.4), because this migration
-- is what makes the old ones wrong.
COMMENT ON COLUMN civic_spaces.slices.sibling_index IS
  'Position in this (slice_type, geoid)''s sequence of slices, from 1. It is also the ONLY record of which slices are open: the two highest values accept new members and every lower one is closed. "Closed" is therefore derived, never stored -- there is no is_closed column and must not be, or it could disagree with this. See split_slice() and ev-accounts chooseOpenSlice().';

COMMENT ON COLUMN civic_spaces.slice_members.joined_at IS
  'When this member joined the JURISDICTION''s conversation, not this particular slice. A split carries it across unchanged (design 4.4) -- restamping it would destroy the only tenure record the platform holds, irreversibly, and it is the key a split sorts on to decide who moves.';

NOTIFY pgrst, 'reload schema';
