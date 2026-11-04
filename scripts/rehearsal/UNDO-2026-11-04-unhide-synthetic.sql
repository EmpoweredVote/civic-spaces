-- ROLLBACK for the 2026-11-04 soft-delete of seeded demo content.
--
-- All 13 rows below were is_deleted = false before that change, so this restores the
-- exact prior state. Run only if the hide was wrong; the content it brings back is
-- synthetic personas (fake-author-*) posting about a named real member of Congress,
-- served to the anonymous public through get_public_feed / get_public_replies.

BEGIN;

UPDATE civic_spaces.posts SET is_deleted = false WHERE id IN (
  '2aa414bc-161f-45f2-a375-644a1f72eab5',  -- Veterans benefits backlog
  'd29a542f-9578-47b1-ba15-29e7666d3669',  -- Federal broadband funding / BEAD
  '688342f4-e17a-4afd-97e0-dd426d27e8c6',  -- Bucshon town hall
  'e50974ad-bf3e-4284-aab4-37810e4daf2c',  -- Social Security COLA
  '48f99dde-e409-4f4d-a66d-48d5b2733e11',  -- House appropriations
  '9415320f-7d53-435f-b4c7-be41a42b8667',  -- FEMA flood map
  '329f0078-bbb9-410d-801c-8a78de46ed0a',  -- Student loan servicing
  'e73e41ae-1e3c-4a87-878c-80929fe1a320',  -- Medicare negotiation
  '591bfa87-5934-4def-b4bd-150c43cbe688'   -- "Rep. Bucshon voted against the infrastructure bill"
);

UPDATE civic_spaces.replies SET is_deleted = false WHERE id IN (
  '86374258-8db6-4abe-895e-a28dcd4b94ec',
  '65689ac6-987a-4f33-9664-0ffb8a7ca9e3',
  'd9721923-e57f-47db-b7ed-cbe34343cabe',
  'b53ab0b5-bf48-4af8-8892-93f7ace906dc'   -- the one on the REAL launch post
);

COMMIT;
