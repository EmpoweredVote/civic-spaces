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
-- 🔴 ON DELETE SET NULL, NOT CASCADE. The design says deletion propagates from
-- an original to its forks (§4.5), but that is an application rule carried out
-- deliberately, by a trigger, on the SOFT delete flag. A referential CASCADE
-- would mean a future hard delete of a parent silently destroys a conversation
-- the new slice has been having underneath it — rows nobody asked to remove,
-- belonging to people who never saw the original. The product has no hard delete
-- today; this is about what a later one must not be able to do by accident.

ALTER TABLE civic_spaces.posts
  ADD COLUMN forked_from uuid
  REFERENCES civic_spaces.posts(id) ON DELETE SET NULL;

ALTER TABLE civic_spaces.replies
  ADD COLUMN forked_from uuid
  REFERENCES civic_spaces.replies(id) ON DELETE SET NULL;

-- Partial: the overwhelming majority of rows are not forks, and the queries that
-- care ("what was copied from this?", "is this row a copy?") only ever look at
-- the ones that are.
CREATE INDEX idx_posts_forked_from
  ON civic_spaces.posts (forked_from) WHERE forked_from IS NOT NULL;

CREATE INDEX idx_replies_forked_from
  ON civic_spaces.replies (forked_from) WHERE forked_from IS NOT NULL;

COMMENT ON COLUMN civic_spaces.posts.forked_from IS
  'Non-null when this post is a COPY made to seed a new slice at a split. Points at the original, which lives in the parent slice. The copy keeps its original author''s user_id (bylines are kept) but confers NO standing on them here and is not theirs to edit — see has_written_in_thread and posts_update_own. NULL for every post written normally.';

COMMENT ON COLUMN civic_spaces.replies.forked_from IS
  'Non-null when this reply is a COPY made to seed a new slice at a split. Points at the original. Same rule as posts.forked_from: the byline is kept, the standing is not. NULL for every reply written normally.';

NOTIFY pgrst, 'reload schema';
