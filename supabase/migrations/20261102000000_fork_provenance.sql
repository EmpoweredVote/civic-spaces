-- Phase 19-01 Task 1: fork provenance.
--
-- When a slice reaches its cap it splits, and the new slice opens seeded with a
-- COPY of a recent window of the parent's threads (design §4.5). These two
-- columns are what makes a copy knowable as one.
--
-- They are load-bearing for permissions, not just for display. A seeded copy
-- keeps its original author's `user_id` — bylines are kept on purpose, they are
-- genuinely that person's words — so without a marker, "did this viewer write in
-- this thread?" answers TRUE for the author of every fork. That would hand them
-- standing in a slice they were never assigned to, for every seeded thread, at
-- every split, which is the opposite of what the design says:
--
--     archival — the conversation continues without them.
--
-- 19-02's `has_written_in_thread` therefore carries `forked_from IS NULL` on
-- both of its arms, and `posts_update_own` gains the same, so an author cannot
-- silently rewrite a fork in a slice they have no standing in — least of all
-- after people there have replied to it.
--
-- 🔴 ON DELETE NO ACTION — not CASCADE, and NOT SET NULL EITHER. Both of the
-- obvious choices are wrong here, for opposite reasons, and the second one is
-- the trap: this column is read as a PERMISSION, so what happens to it on a
-- delete decides who may write where.
--
-- CASCADE would mean a future hard delete of an original silently destroys a
-- conversation the new slice has been having underneath it — rows nobody asked
-- to remove, belonging to people who never saw the original.
--
-- SET NULL is worse, and it was the first answer here. NULL is not "unknown
-- origin" in this schema; it is the positive claim *this was written in place*,
-- because that is precisely what the predicates above test. So deleting one
-- original would turn every copy of it into an original: its author would
-- silently regain standing in, and edit rights over, a slice they were never
-- assigned to, in threads other people had been replying to for months. A
-- delete is not a grant of authorship, and nothing about this would be visible.
--
-- NO ACTION refuses the delete instead, while forks exist. The product has no
-- hard delete today, so nothing is blocked; a future one has to deal with the
-- forks explicitly, which is the point. Failing loudly on a path nobody uses
-- beats conferring authorship on a path nobody is watching.

ALTER TABLE civic_spaces.posts
  ADD COLUMN forked_from uuid
  REFERENCES civic_spaces.posts(id) ON DELETE NO ACTION;

ALTER TABLE civic_spaces.replies
  ADD COLUMN forked_from uuid
  REFERENCES civic_spaces.replies(id) ON DELETE NO ACTION;

-- Partial: the overwhelming majority of rows are not forks, and the queries that
-- care ("what was copied from this?", "is this row a copy?") only ever look at
-- the ones that are.
CREATE INDEX idx_posts_forked_from
  ON civic_spaces.posts (forked_from) WHERE forked_from IS NOT NULL;

CREATE INDEX idx_replies_forked_from
  ON civic_spaces.replies (forked_from) WHERE forked_from IS NOT NULL;

COMMENT ON COLUMN civic_spaces.posts.forked_from IS
  'Non-null when this post is a COPY made to seed a new slice at a split. Points at the original, which lives in the parent slice. The copy keeps its original author''s user_id (bylines are kept) but confers NO standing on them here and is not theirs to edit — see has_written_in_thread and posts_update_own. NULL means WRITTEN IN PLACE, which is a claim, not an absence: the FK is ON DELETE NO ACTION so that deleting an original can never silently promote its copies to originals.';

COMMENT ON COLUMN civic_spaces.replies.forked_from IS
  'Non-null when this reply is a COPY made to seed a new slice at a split. Points at the original. Same rule as posts.forked_from: the byline is kept, the standing is not, and NULL is the positive claim "written in place" — hence ON DELETE NO ACTION.';

NOTIFY pgrst, 'reload schema';
