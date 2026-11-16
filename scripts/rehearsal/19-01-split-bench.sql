-- Benchmark harness for split_slice at the 6000 cap.
--
-- Everything here is generated. No production row is copied; only the SCHEMA came
-- from production (schema-only dump, asserted to contain zero COPY/INSERT lines).
--
-- Setup disables the per-row triggers, because loading the fixture is not what we
-- are measuring and 6000 cap-check invocations would dominate the setup. The
-- MEASURED call runs with every trigger enabled, exactly as production would.

CREATE SCHEMA IF NOT EXISTS bench;

CREATE OR REPLACE FUNCTION bench.build(
  p_geoid            text,
  p_members          integer,
  p_posts            integer,
  p_replies_per_post integer
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_slice uuid;
BEGIN
  v_slice := gen_random_uuid();

  INSERT INTO civic_spaces.slices (id, slice_type, geoid, sibling_index, current_member_count)
  VALUES (v_slice, 'city', p_geoid, 1, 0);

  -- Profiles are shared across scenarios; create only what is missing.
  INSERT INTO civic_spaces.connected_profiles (user_id, display_name, tier, account_standing)
  SELECT 'bench-u-' || g, 'Bench Member ' || g, 'connected', 'active'
  FROM generate_series(1, p_members) g
  ON CONFLICT (user_id) DO NOTHING;

  ALTER TABLE civic_spaces.slice_members DISABLE TRIGGER USER;
  -- joined_at spread over two years, so "the most recently joined half" is a real
  -- ordering rather than a tie broken entirely by user_id.
  INSERT INTO civic_spaces.slice_members (user_id, slice_id, joined_at)
  SELECT 'bench-u-' || g, v_slice, now() - (interval '730 days') * (g::numeric / p_members)
  FROM generate_series(1, p_members) g;
  ALTER TABLE civic_spaces.slice_members ENABLE TRIGGER USER;

  UPDATE civic_spaces.slices SET current_member_count = p_members WHERE id = v_slice;

  -- Posts: all inside the default 14-day seed window, so the seed copies all of them.
  ALTER TABLE civic_spaces.posts DISABLE TRIGGER USER;
  INSERT INTO civic_spaces.posts (id, slice_id, user_id, title, body, created_at, updated_at)
  SELECT gen_random_uuid(), v_slice, 'bench-u-' || (1 + (g % p_members)),
         'Bench post ' || g,
         repeat('Civic discussion body text. ', 12),
         now() - (interval '13 days') * (g::numeric / GREATEST(p_posts,1)),
         now() - (interval '13 days') * (g::numeric / GREATEST(p_posts,1))
  FROM generate_series(1, p_posts) g;
  ALTER TABLE civic_spaces.posts ENABLE TRIGGER USER;

  -- Replies: root replies, plus a nested third so the parent_reply_id remap has
  -- real work to do rather than matching nothing.
  ALTER TABLE civic_spaces.replies DISABLE TRIGGER USER;
  INSERT INTO civic_spaces.replies (id, post_id, parent_reply_id, user_id, body, created_at, updated_at)
  SELECT gen_random_uuid(), p.id, NULL, 'bench-u-' || (1 + ((r * 7) % p_members)),
         repeat('A reply in the thread. ', 6), p.created_at + interval '1 hour', p.created_at + interval '1 hour'
  FROM civic_spaces.posts p
  CROSS JOIN generate_series(1, p_replies_per_post) r
  WHERE p.slice_id = v_slice;

  -- ~1 nested child per post, pointing at one of that post's root replies.
  INSERT INTO civic_spaces.replies (id, post_id, parent_reply_id, user_id, body, created_at, updated_at)
  SELECT gen_random_uuid(), x.post_id, x.id, 'bench-u-' || (1 + ((x.rn * 11) % p_members)),
         repeat('A nested answer. ', 5), x.created_at + interval '30 minutes', x.created_at + interval '30 minutes'
  FROM (
    SELECT r.id, r.post_id, r.created_at, row_number() OVER (PARTITION BY r.post_id ORDER BY r.id) AS rn
    FROM civic_spaces.replies r
    JOIN civic_spaces.posts p ON p.id = r.post_id
    WHERE p.slice_id = v_slice AND r.parent_reply_id IS NULL
  ) x
  WHERE x.rn = 1;
  ALTER TABLE civic_spaces.replies ENABLE TRIGGER USER;

  -- Make reply_count honest before we start, as production would be.
  UPDATE civic_spaces.posts p
  SET reply_count = (SELECT count(*) FROM civic_spaces.replies r WHERE r.post_id = p.id)
  WHERE p.slice_id = v_slice;

  RETURN v_slice;
END $$;

-- Times one split and reports the shape of what it produced.
CREATE OR REPLACE FUNCTION bench.run(
  p_label            text,
  p_members          integer,
  p_posts            integer,
  p_replies_per_post integer
) RETURNS TABLE (
  label text, members int, posts int, replies int,
  ms numeric, moved int, copied_posts int, copied_replies int, notifications int
) LANGUAGE plpgsql AS $$
DECLARE
  v_slice uuid;
  v_new   uuid;
  v_geoid text := 'B' || floor(random() * 1000000)::text;
  t0 timestamptz; t1 timestamptz;
  v_notif_before bigint;
BEGIN
  v_slice := bench.build(v_geoid, p_members, p_posts, p_replies_per_post);

  SELECT count(*) INTO v_notif_before FROM civic_spaces.notifications;
  ANALYZE civic_spaces.slice_members;
  ANALYZE civic_spaces.posts;
  ANALYZE civic_spaces.replies;

  t0 := clock_timestamp();
  v_new := civic_spaces.split_slice(v_slice);          -- defaults: 14 days, 6000
  t1 := clock_timestamp();

  RETURN QUERY
  SELECT p_label,
         p_members,
         p_posts,
         (SELECT count(*)::int FROM civic_spaces.replies r JOIN civic_spaces.posts p ON p.id = r.post_id WHERE p.slice_id = v_slice),
         round(extract(epoch FROM (t1 - t0))::numeric * 1000, 1),
         (SELECT count(*)::int FROM civic_spaces.slice_members WHERE slice_id = v_new),
         (SELECT count(*)::int FROM civic_spaces.posts   WHERE slice_id = v_new),
         (SELECT count(*)::int FROM civic_spaces.replies r JOIN civic_spaces.posts p ON p.id = r.post_id WHERE p.slice_id = v_new),
         (SELECT count(*)::int FROM civic_spaces.notifications) - v_notif_before::int;
END $$;

-- ── bench.run_clean ──────────────────────────────────────────────────────────
-- Every scenario starts from an EMPTY database. The first version of this
-- harness appended to the same tables each time, so each measurement sat on a
-- larger table than the one before it and part of the "scaling curve" was just
-- accumulated rows.
--
-- p_disable names triggers on civic_spaces.replies to switch off for the
-- measured call. 🔴 It is applied AFTER bench.build, because build ends with
-- ALTER TABLE ... ENABLE TRIGGER USER and would silently re-enable them.
-- Check the returned notification count, not just the clock: a "disabled" run
-- that still reports notifications did not disable anything.
CREATE OR REPLACE FUNCTION bench.run_clean(
  p_label text, p_members integer, p_posts integer, p_replies_per_post integer,
  p_disable text[] DEFAULT '{}'
) RETURNS TABLE (label text, posts int, replies int, ms numeric, moved int, copied_posts int, copied_replies int, notifications int)
LANGUAGE plpgsql AS $$
DECLARE
  v_slice uuid; v_new uuid; v_geoid text := 'C' || floor(random()*1000000)::text;
  t0 timestamptz; t1 timestamptz; v_nb bigint; trg text;
BEGIN
  TRUNCATE civic_spaces.notifications, civic_spaces.replies, civic_spaces.posts,
           civic_spaces.slice_members, civic_spaces.slices, civic_spaces.connected_profiles CASCADE;

  v_slice := bench.build(v_geoid, p_members, p_posts, p_replies_per_post);

  FOREACH trg IN ARRAY p_disable LOOP
    EXECUTE format('ALTER TABLE civic_spaces.replies DISABLE TRIGGER %I', trg);
  END LOOP;

  ANALYZE civic_spaces.slice_members; ANALYZE civic_spaces.posts; ANALYZE civic_spaces.replies;
  SELECT count(*) INTO v_nb FROM civic_spaces.notifications;

  t0 := clock_timestamp();
  v_new := civic_spaces.split_slice(v_slice);
  t1 := clock_timestamp();

  FOREACH trg IN ARRAY p_disable LOOP
    EXECUTE format('ALTER TABLE civic_spaces.replies ENABLE TRIGGER %I', trg);
  END LOOP;

  RETURN QUERY SELECT p_label, p_posts,
    (SELECT count(*)::int FROM civic_spaces.replies r JOIN civic_spaces.posts p ON p.id=r.post_id WHERE p.slice_id=v_slice),
    round(extract(epoch FROM (t1-t0))::numeric*1000,1),
    (SELECT count(*)::int FROM civic_spaces.slice_members WHERE slice_id=v_new),
    (SELECT count(*)::int FROM civic_spaces.posts WHERE slice_id=v_new),
    (SELECT count(*)::int FROM civic_spaces.replies r JOIN civic_spaces.posts p ON p.id=r.post_id WHERE p.slice_id=v_new),
    (SELECT count(*)::int FROM civic_spaces.notifications) - v_nb::int;
END $$;

-- Results on 2026-11-02 are in 19-01-SPLIT-TIMING.md. To reproduce:
--   SELECT * FROM bench.run_clean('busy', 6000, 2800, 5);
--   SELECT * FROM bench.run_clean('busy, no trigger noise', 6000, 2800, 5,
--                                 ARRAY['reply_notification','trg_reply_count']);
