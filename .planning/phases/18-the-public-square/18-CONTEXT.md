# Phase 18: The Public Square - Context

**Gathered:** 2026-10-30
**Status:** Ready for planning
**Predecessor:** Phase 17 (The Signed-Out Arrival) — this is its irreversible half, split off
deliberately under D-22.

<domain>
## Phase Boundary

Civic Spaces' conversations become readable by anyone, with no account at all.

Today every one of the `civic_spaces` grants is `TO authenticated`, and the schema has no
`GRANT USAGE … TO anon`, so a visitor can read zero forum rows. Phase 17 gave an observer a
welcome screen, a way to name a place, and Explore content for it — everything *except* the
conversations. This phase opens the conversations.

The phase delivers four things:

1. **Public read of five slice types.** City, County, State, Federal and Unified become
   readable by `anon` and by any authenticated account, member or not.
2. **A per-author projection of each thread.** What a reader receives about an author is
   narrow by default and widens only for a member of that slice (D-48) or that author's
   friend (D-49) — so one thread can render one author in full and the rest as bare handles.
   The narrowing happens in the database, not in the component.
3. **An honest closed door where the reply box is.** A reader who cannot reply is told so,
   quietly, in place, with a route to an explainer — never an empty feed and never a nag.
4. **An account-types explainer**, reached from that door, that describes Inform / Connect /
   Empowered and says plainly that taking part needs a Connected account.

**Not in this phase:** anything that lets a reader write, vote, react or join; the Empowered
cross-shard reply (D-40); the per-author sharing store behind D-32 (D-45); search-engine
indexing and link unfurling (D-25, carried forward).

🔴 **This phase is not reversible.** Once the PostgREST endpoint is publicly queryable it is
permanently, scriptably public — content can be deleted, but not un-published. Its failures
are also silent: an over-wide grant publishes the member roster and nothing turns red. Every
decision below should be read as a decision about a door that does not close again.

</domain>

<decisions>
## Implementation Decisions

Phase 17's account model (D-01 … D-04) and reach rules (D-18 … D-21) are the governing frame
and are not re-opened here. Decisions continue the global numbering from D-25.

### What goes public — and what does not

- **D-26 — Five slice types go public: City, County, State, Federal, Unified.** Chris,
  2026-10-30: *"City/County/State/Federal/Unified (Global) can be viewed by anyone."* These
  are governments. A reader does not need standing in a jurisdiction to listen to what is
  said about it.

- **D-27 — Volunteer stays members-only, and so does everything that follows it.** Chris:
  *"the volunteer section will remain members-only … Volunteer and the other categories they
  could be invited to shall be more private, for now."* New invite-only spaces are coming and
  will live in the slot Volunteer occupies today — a parents' group for a school, a local
  Braver Angels or League of Women Voters chapter. Chris on why they are private: *"we only
  want those real people invited."* And on why they are nevertheless civic: *"it is healthier
  for the ecosystem if they are understood to be 'public' places"* — understood as public in
  conduct, not open in readership.

- **D-28 — The rule is an ALLOWLIST of `slice_type`, never a denylist.** 🔴 This is the single
  most important shape in the phase. `slice_type IN ('city','county','state','federal',
  'unified')` is correct; `slice_type <> 'volunteer'` is a trapdoor. D-27 says new private
  space types are landing in that same column. A denylist publishes the next one the day
  someone adds it, silently, and the failure mode of this phase is exactly "nothing turns
  red." An allowlist means a new type is private until a human deliberately opens it, and
  the `slices_slice_type_check` constraint (`20260902000100_slice_taxonomy.sql:180`) is the
  place a planner should look to see what the list currently omits.

- **D-29 — One policy serves `anon` and authenticated non-members alike.** D-18 already says
  observation is the expected default for everyone; at the policy level that means
  `TO anon, authenticated`, not `TO anon`. 🔴 A policy scoped to `anon` only would give a
  signed-out stranger *more* than a signed-in Inform account — the exact inversion of D-04,
  which says an Inform account receives precisely what an anonymous visitor receives. It
  would also silently take the public feed away from a Connected member looking at another
  place, which is the capability Phase 17 and the PR #133 regression fix exist to protect.

### What a reader sees

- **D-30 — Arrival is the conversation, not a gate.** Chris: *"They should see the
  conversation and a sign-in prompt to reply"*, and when asked whether the explainer should
  come first: *"The conversation first, intro screen after they try to reply."* A stranger
  following a link lands on the thread. Nothing is interposed.

- **D-31 — The stranger / Inform projection: username, timestamp, body. Nothing else.**
  Chris: *"Their username only, no avatar, no user_id."* No avatar, no `user_id`, no profile
  link, no friend affordance, no member list, no reaction state. 🔴 The omission of `user_id`
  is load-bearing and is not cosmetic: it is the difference between a page that can be read
  and a corpus that can be joined. It must be enforced **in the database**, not by a
  `select()` list in a hook — a hook is one PR away from `select('*')`, which is exactly what
  `useThread.ts:22` and `:62` do today. See D-44 for the mechanism, which is an RPC's return
  type rather than the column-level grants an earlier draft of this document specified.

- **D-32 — The Connected projection: avatars, linked handles, and whatever the author chose
  to share.** Chris: *"if they are Connected, they can see avatars, username, and the
  information they choose to make available to other Connected Accounts (they may opt into
  sharing their Compass calibration with a friend, as an example; but the default is that it
  isn't shared until they Empower their account.)"* Default is unshared. Sharing is per-author
  and opt-in. **Who counts as "Connected" for this purpose is settled by D-48 and D-49:**
  a member of the slice, or a friend of that author anywhere — not every Connected account.
  The opt-in store itself does not exist and is not built here (D-45), so in this phase the
  wide projection is avatar plus linked handle and nothing more.

- **D-33 — Nothing advertises that an opt-in exists.** A first mockup carried a chip reading
  "Compass calibration shared with friends". Chris: *"we don't need to highlight to strangers
  that someone shares their calibration with friends. The Friends should see it, but that's
  it."* 🔴 A badge announcing that a disclosure exists **is itself a disclosure** — it tells a
  stranger something true about that person's settings. The friend sees the calibration; the
  non-friend sees no trace that there was anything to see.

- **D-34 — Member counts are not part of the public projection.** *(Claude's call — see
  "Claude's Discretion".)* `slices.current_member_count` renders in the nav today and is read
  via `useAllSlices`. Column-level grants make withholding it from the public projection free,
  and a public "Asheville · 3 members" is an own-goal at the product's current size. Counts
  stay for members; the public sees the place, not its population. Revisit when the numbers
  stop being an argument against the page.

- **D-48 — MEMBERSHIP unlocks the wide projection, not tier.** Chris, 2026-10-30: *"For now,
  membership is what unlocks it."* So a Connected account reading a slice it does not belong
  to receives the **same** projection as a stranger — handle, timestamp, body — and loses the
  avatars and profile links it sees at home. 🔴 The rejected alternative matters enough to
  record: had tier unlocked it, a free signup would have been the entire price of pulling
  `user_id` and an avatar for every author in every public slice — the cross-slice corpus join
  D-31 exists to prevent, with a signup form where the wall should be. Membership keeps the
  reach of an account proportional to the standing it actually has, and it means `user_id`
  never crosses the wire to a non-member except under D-49.

- **D-49 — A friendship is the one exception, and it is per-author.** Chris: *"It may be
  possible to be friends with someone who is in or moves to another slice - in those
  instances, I see a compelling reason to let the Connected member 'see' their friend's
  account with more clarity."* A viewer who is an accepted friend of an author gets that
  author in full — avatar, linked handle, and whatever the author shares with friends —
  wherever that author is posting, including a slice the viewer does not belong to. The
  friendship outlives a move, which is the case that earns the rule.

  🔴 **The consequence a planner must design for: the projection is per-author, not
  per-response.** One public thread can legitimately render one author in full and the rest
  as bare handles. So `get_public_thread` cannot choose a single shape and return it; it
  resolves the viewer through `current_user_id()`, joins `civic_spaces.friendships` on
  `(user_low, user_high)` with `status = 'accepted'`, and emits `author_user_id` and
  `avatar_url` as NULL per row where neither D-48 nor D-49 applies. Two things follow:
  the function is `SECURITY DEFINER` and therefore owns this rule entirely — no caller may
  re-derive it — and its result is per-`(slice, viewer)`, so it must not be cached per slice.

  This leaks nothing: the asymmetry is visible only to the viewer, who already knows who their
  friends are. It does **not** relax D-33 — a non-friend still sees no trace that an author
  shares anything with anyone.

### The closed door, and the explainer behind it

- **D-35 — The reply affordance is a quiet outlined button, not a filled CTA.** Chris, on the
  coral-filled version: *"I don't like the bright red color to force someone to log in - it
  should be subtler and less abrasive. Not everyone wants to login, and that's ok. We don't
  need something bright red constantly reminding them to do something they don't want to do as
  much as we want them to understand why they're not able to reply."* The chosen treatment
  (mockup option B) is a teal outline, no fill, sitting where the reply box would be. It is
  clearly a control and clearly not urgent.

- **D-36 — The copy names the rule, not the remedy.** Chris: *"say 'Replying is open to
  Connected accounts'"*, with the slice scoping made clear: *"it's also Connected Accounts
  from that slice. If you're reading a question from another slice, even if you're a connected
  account, you can't respond."* So the sentence describes who may speak here, and the button
  offers the explanation — it does not say "Sign in" and does not open a login form.

- **D-37 — The explainer comes after the attempt, never before.** It describes the three
  account types — Inform, Connect, Empowered — how they differ, and that taking part in Civic
  Spaces needs a Connected account. It is reached by pressing the door, never pushed. First
  visit is not a trigger; *trying to reply* is.

- **D-38 — The control is never disabled and never `cursor-not-allowed`.** Chris floated
  greying it out and then offered a live replacement instead; the live replacement wins,
  because `check:explore-rooms` goal 6 ("no dead ends") forbids disabled controls and
  `cursor-not-allowed` outright across this surface. A door that does not open is still a door
  you can knock on.

- **D-39 — Who may reply, stated once at the right altitude.** Connected: their own slice
  only. Empowered: any sibling shard of a jurisdiction they hold at city / county / state —
  **a future phase, not this one** (D-21, D-40). Another place: closed to everyone. 🔴 This
  rule has exactly one home in the frontend, `whyNoWrite` in `src/lib/writeAccess.ts`, which
  reserves the seam in its own comments. It must not be written inline at a call site.

### Scope, and the corpus

- **D-40 — Phase 18 is read-only.** Chris: *"Keep them separate - Phase 18 is read-only - but
  I do think this is where we are heading. I recognize it's one way."* The Empowered
  cross-shard reply is a **write** change — a new RLS INSERT policy alongside
  `posts_insert_slice_member`, which today requires strict `slice_members` membership — and it
  is a separate phase. This phase must not half-build it: no `isEmpowered` term appears in
  `whyNoWrite`, and no UI offers a control that RLS will refuse.

- **D-41 — The existing corpus goes public as it stands.** Chris: *"I don't think anyone has
  used it for real."* No retroactive-consent problem, therefore no cutover timestamp in the
  schema, no "posts before date X stay members-only" predicate, no two-corpus rendering path.
  The 12 live posts and 8 replies open with everything else. 🔴 This is a fact about *today's*
  corpus, and it is the reason the simple shape is safe. It stops being true the moment the
  square is used for real, so a planner must not generalise it into "consent is never a
  consideration here" — it is the one-time permission that lets this phase skip a mechanism,
  not a standing rule.

- **D-42 — Pseudonymity is the accepted ceiling, with the number in front of him.** Usernames
  are stable across slices, so "who posts in Asheville" stays derivable under handles.
  Chris chose this knowingly: *"username is already public by choice."* This extends D-24,
  whose two riders still stand: **re-run the production aggregate immediately before the
  migration**, and add handle validation in ev-accounts so the next real name cannot arrive
  silently.

### Anti-goals

Chris's own list, verbatim, of what must never become public: **"Member lists, friend
connections, anyone's location, and emails."**

Concretely, and these are the must-fail assertions, not prose:

| Must never be readable by `anon` or a non-member | Where it lives |
|---|---|
| Who belongs to a slice | `slice_members` |
| The member roster | `connected_profiles` under a `USING (true)` policy |
| Friendships and follows | `friendships`, `follows` |
| Notifications | `civic_spaces.notifications`, `public.civic_notifications` |
| Blocks, flags, moderation state, the action log | `blocks`, `flags`, `moderators`, `action_log` |
| Anything keyed to a person | — |
| A post's revision history | `posts.edit_history` |
| A member's stable identifier | `user_id` on any public projection (D-31), except to a slice member (D-48) or the author's friend (D-49) |

A location is never published because this app never stores one (CLAUDE.md, "Talking to the
rest of the platform"); the rule here is that nothing in the public projection reconstructs
one either — which is what D-31's `user_id` omission and D-34's count omission are for.

### The gate is not where the ROADMAP says it is — corrected 2026-10-30

- **D-43 — `public.*` is a SECOND façade over the same data, and the schema gate does not
  cover it.** 🔴 This corrects the premise the ROADMAP's Phase 18 entry and the first draft of
  this document were both written on. Verified by catalog query against the production project
  on 2026-10-30:

  - There are **fifteen** views in `public`, of which **six are not in this repo's
    migrations at all**: `posts`, `replies`, `slices`, `slice_members`, `connected_profiles`,
    and `users_public` (the last one reads a `users` table this repo does not own). The seven
    the migrations do create — `friendships`, `follows`, `civic_notifications`, `flags`,
    `blocks`, `moderators`, `action_log` — are there too. This is schema drift: production
    carries objects no migration in `supabase/migrations/` creates.
  - **`anon` holds `SELECT, INSERT, UPDATE, DELETE` on every one of them.** The migrations
    grant only `TO authenticated`; these came from Supabase's default privileges on the
    `public` schema, which the repo never set and cannot see.
  - `public.posts` selects **`edit_history`** by name. `public.slice_members` selects the
    roster. Those are two rows of the anti-goals table, already behind an `anon`-granted
    object.
  - All fifteen have `security_invoker = on`, which is what holds the door shut **today**:
    RLS and the base-table privileges are evaluated as `anon`, every policy in
    `20260327000002_rls.sql` is `TO authenticated`, and `anon` has no `USAGE` on
    `civic_spaces`. So a public read currently returns nothing, on two independent
    mechanisms. **There is no live exposure.**

  The consequence for this phase: `anon` already has `USAGE` on `public`, so for these six
  views **the gate is RLS and base-table privileges alone — the schema-`USAGE` gate the
  ROADMAP calls "the gate" simply is not in front of them.** The instant a permissive policy
  `TO anon` lands on `civic_spaces.posts`, `GET /rest/v1/posts` is a live public endpoint that
  nobody designed, serving `edit_history` and `user_id`, reachable without the Phase 18 RPC
  ever being called. A planner who grants schema `USAGE` and then reasons only about
  `civic_spaces` will ship that.

  Three things follow, and they are requirements, not observations:
  1. The six undocumented views must be **reconciled into a migration** before the door opens
     — either dropped, or recreated narrow and checked in. Production must stop carrying
     objects the repo cannot see.
  2. `REVOKE` the `anon` privileges that nothing asked for, on every `public.*` view, as its
     own migration that ships **before** the one that opens the door.
  3. `check-anon-read.mjs` runs its must-fail list against **both** paths for every row —
     `/rest/v1/<name>` (the `public` view) and the `civic_spaces` route — because the two are
     different objects with different grants and only one of them is in git.

### Claude's Discretion

Choices made in writing this up, flagged so they can be checked rather than inherited. The
first four are substantial enough to carry decision numbers.

- **D-44 — A `SECURITY DEFINER` RPC is the ONLY anon surface. `anon` gets schema `USAGE` and
  `EXECUTE` on named functions, and no table or view grants whatsoever.** This replaces the
  column-level-grant plan in the ROADMAP and in this document's first draft, which does not
  survive contact with three facts: (a) `SELECT *` under partial column grants **errors**
  rather than narrowing, so `useThread.ts:22`/`:62` would 403 for a public reader instead of
  returning fewer fields; (b) there is no FK from `posts.user_id` to
  `connected_profiles.user_id` — both are bare `text` — so PostgREST cannot embed the author
  and `useThread` joins manually with `.in('user_id', …)`, which means withholding `user_id`
  per D-31 leaves **no** client-side route to a display name and forces it denormalised into
  the RPC anyway; and (c) a permissive SELECT policy on `posts` is visible to Realtime, which
  filters Postgres Changes by the subscriber's own RLS — an anon socket opened directly
  against the project, not through our UI, would receive live rows. An RPC-only surface keeps
  the realtime promise *by construction* rather than by a second mechanism, and makes D-31 a
  property of a return type that `tsc` can see. The functions this phase owes:
  `get_public_feed` and a `get_public_thread` companion the ROADMAP does not name.
- **D-45 — The per-author opt-in sharing of D-32 is a CONSTRAINT, not a deliverable.** Nothing
  resembling it exists: `connected_profiles` is `user_id, display_name, account_standing,
  avatar_url, tier, is_suspended, created_at, updated_at, ui_theme` and no more, there is no
  sharing flag or calibration column, and Compass data reaches this app over the ev-accounts
  API with a Bearer `cs_token`, not through Supabase. Building the opt-in store, the author's
  setting and the friend-scoped disclosure would roughly double the phase and add a second
  hard-to-reverse surface. So: the Connected projection in **this** phase is avatar + linked
  handle, and D-32/D-33 govern what must not be built carelessly later. 🔴 D-33 is therefore
  untestable in this phase, which a plan should say out loud rather than quietly drop.
- **D-46 — A reader with no shard of their own gets the lowest `sibling_index`, and no shard
  selector.** The feed is keyed on `slices.id`, members pick a shard with `SliceSelector`, and
  a stranger has no own-shard to anchor on. Production has 15 slices and no siblings, so this
  cannot be settled from the data; one shard, deterministically chosen, is the answer that
  does not invent a UI for a case that does not exist yet. `SliceSelector` does not render for
  a non-member. The public RPC therefore takes `slice_type` + `geoid`, not `slice_id`, and
  resolves the shard itself — which also means a public URL does not pin to a shard id.
- **D-47 — `check-anon-read.mjs` needs no DDL and no production fixtures.** Use `volunteer` as
  the private-type fixture: it is already in `slices_slice_type_check`, already excluded by
  D-26's allowlist, and already has rows. Assert the allowlist itself separately as a pure
  unit assertion over the constant, so the "a new type stays private until a human adds it"
  demonstration needs no constraint change in any database. The HTTP half runs against
  whatever project `SUPABASE_URL` + the **anon** key name, so it can be pointed at a branch,
  a local stack or production read-only. 🔴 Assert the **refusals**, by name, one per anti-goal
  row, against both the `public.*` and `civic_spaces` routes (D-43). A check that only proves
  the permitted reads succeed misses the only failure this phase cannot take back.

- **D-34 (member counts withheld from the public projection).** Chris named member *lists* as
  an anti-goal, not counts, and counts already render in the nav for members. This is a
  judgement about how a three-member city reads to a stranger, not a privacy ruling, and it is
  cheap to reverse in either direction.
- **Realtime stays authenticated**, and under D-44 it stays that way for free: with no
  table-level SELECT policy for `anon`, there is nothing for a Postgres Changes subscription
  to deliver. Nothing in the conversation asked for a live public page, and a public socket is
  a standing cost and a second exposure surface with its own evaluation path. Public pages
  load; they do not stream.
- **Soft-deleted posts and suspended authors stay hidden from the public projection**, matching
  `is_deleted = false` in every existing SELECT policy and the `is_suspended` generated column.
  A public reader gets the same answer a member gets, which also keeps `locatePost`'s
  deliberate conflation of not-found / deleted / not-yours intact where it still earns its keep.
- **The plan ends at a reviewed `.sql` file and a go/no-go, not at applied DDL.** `main`
  auto-deploys to production in ~3 minutes, the frontend must never be ahead of the grants,
  and D-24's first rider wants the production aggregate re-run immediately before the
  migration. Chris gates outward-facing steps by standing preference. So the last plan in the
  phase produces the migration, the re-run aggregate and the verification evidence, and
  stops; applying it is Chris's call and Chris's hands.
- **The explainer is a page in this app, not a link out to the accounts hub.** D-37 puts it
  after a failed attempt, which means it must render for someone with no session; the hub's
  redirect contract (`useAuth.ts` hardcodes production) is the wrong machinery for a page
  that is purely explanatory.

</decisions>

<canonical_refs>
## Canonical References

### The one-way door — read before writing any SQL

- `.planning/ROADMAP.md` §Phase 18 — the irreversibility warning, the measured exposure
  (11 profiles, 0 real-name shapes, 0 avatars, 12 posts, 8 replies, 7 authors as of
  2026-10-26), and the two riders on D-24.
- `.planning/phases/17-the-signed-out-arrival/17-CONTEXT.md` — D-01 … D-25. D-04 (Inform ≡
  guest), D-18 (observation is the default), D-20/D-21 (reach), D-22 (why this phase is
  split), D-25 (crawlable ≠ indexed).

### What the gate actually is

- `supabase/migrations/20260327000000_current_user_id.sql:14` — `GRANT USAGE ON SCHEMA
  civic_spaces TO authenticated`. There is no `anon` counterpart, so for anything reached by
  its `civic_spaces` route PostgREST cannot resolve the schema before a policy is ever
  consulted: **that** gate is grants, not RLS. 🔴 **But read D-43 before relying on this.** It
  does not hold for the fifteen `public.*` views, six of which are not in this repo, all of
  which `anon` already holds every privilege on, and which are held shut today by RLS alone.
  The repo cannot see the whole grant surface; only the catalog can.
- `supabase/migrations/20260327000001_schema.sql:121-128` — the table grants, all
  `TO authenticated`, all table-level.
- `supabase/migrations/20260327000002_rls.sql` — every policy in the base set. Note
  `connected_profiles_select_authenticated USING (true)`: the shape that must **not** be
  copied for `anon`.
- `supabase/migrations/20260917000000_sibling_slice_read_access.sql` — the precedent for
  adding permissive SELECT policies without touching writes, including the comment explaining
  that Postgres OR's permissive policies together.

### Why the existing feed RPCs cannot be reused

- `get_feed_filtered` welds `AND p.slice_id IN (SELECT slice_id FROM slice_members WHERE
  user_id = current_user_id())` into its body.
- `get_boosted_feed_filtered` is `SECURITY INVOKER` and reads `friendships` / `follows` /
  `blocks` as the caller.

Both fail for a public reader independently of any policy. A narrow `get_public_feed` is
needed, and its column list is where D-31 is enforced.

### The frontend seam

- `src/lib/writeAccess.ts` — `canReadConversationsIn` carries the comment *"PHASE 18 CHANGES
  THIS FUNCTION'S BODY AND NOTHING ELSE"*, and `whyNoWrite` carries D-21's reserved seam and
  the explanation of why there is no `tier` term. Read both comments before editing either
  function.
- `grep -rn "PHASE 18" src/` — finds the three copy paragraphs waiting on this phase, in
  `AppShell.tsx` and `WelcomeScreen.tsx`.
- 🔴 **Do not flip the frontend ahead of the migration.** RLS would return an empty feed, and
  an empty feed reads as "nobody has said anything here" — the codebase's own words for a lie
  told silently.

### Hooks that will meet a public reader

`useThread.ts:22` and `:62` both `select('*')` — which under D-44 means they cannot serve a
public reader at all and the thread needs a second, RPC-backed read path, not a narrowed
`select()` list. `useFeed.ts:37`, `useBoostedFeed.ts:35`,
`useMemberDirectory.ts`, `useMemberSearch.ts`, `useFriends.ts`, `useProfileById.ts` all read
`connected_profiles`; each needs a decision about whether it runs at all for a public reader.

</canonical_refs>

<code_context>
## Existing Code Insights

### What already exists and should be used

- **The write half is already correct and needs no code.** `whyNoWrite` returns
  `'other-place'` for a non-member, and an Inform account reaches that branch *by
  construction* — it holds no `slice_members` rows, so its `ownedSliceIds` and
  `ownedPlaceKeys` are empty. D-04 is satisfied by the data, not by a rule someone has to
  remember to write.
- **`writeAccess.ts` has zero runtime imports, deliberately**, so
  `node --experimental-strip-types` can run the *shipped* functions in
  `scripts/check-write-access.mjs`. Adding a value import there breaks the only real test of
  this logic.
- **Seven manual guard scripts** (`check:place-entry`, `check:explore-gate`,
  `check:explore-rooms`, `check:write-access`, `check:composition`, `check:place-resolve`,
  `check:agenda-topics`). 🔴 **None of them runs in CI** — `npm run build` (`tsc -b && vite
  build`) is the whole automated safety net, and the frontend has no test framework. A guard
  only protects what someone remembers to run.
- `check-explore-rooms.mjs` already carries a `skip(18, …)` reporting 33 unreachable
  (level, room) pairs that this phase makes reachable. Those are the coverage this phase is
  expected to turn back on, and the skip is the list.

### What this phase must add

- **`scripts/check-anon-read.mjs`, with an explicit must-fail list.** The anti-goals table
  above is its contents. 🔴 A check that only asserts the *allowed* reads succeed is the
  failure mode this phase cannot afford — the dangerous outcome is a read that works and
  should not. Assert the refusals by name, one per row of that table, and assert them against
  a real anon key over HTTP rather than in-process, because the schema-`USAGE` gate lives in
  PostgREST and not in Postgres.
- **Five viewers in the projection check, not two.** D-48 and D-49 make the projection branch:
  anon; an Inform account; a Connected account that is **not** a member of the slice; a
  Connected member of the slice; and a Connected non-member who is an accepted friend of one
  author in the thread. 🔴 The fifth is the only one that proves D-49 — and, because it must
  assert that the *same response* carries one author in full and the others stripped, it is
  also the only one that proves the projection is per-author rather than per-response. It is
  the assertion a hurried plan drops.
- **A `slice_type` allowlist assertion.** Per D-47, assert it as a pure unit check over the
  allowlist constant — a type absent from the list must be unreachable — so the demonstration
  D-28 asks for needs no `slices_slice_type_check` change in any database. `volunteer` is the
  live fixture for the same rule over HTTP.

### Operational traps

- **PostgREST schema cache.** After DDL, `NOTIFY pgrst, 'reload schema'` and allow 1–2 minutes
  before deploying a frontend that depends on the change. The sibling-slice migration ends
  with exactly that line.
- **`main` deploys to production automatically on merge, in ~3 minutes.** The migration and
  the frontend land on different clocks; sequence them so the frontend is never ahead.
- **DDL goes through the supabase-local MCP**, which is the only DDL path here.

</code_context>

<specifics>
## Specific Ideas

- **Mockups.** Three were built and reviewed in the brainstorm and are the visual record of
  D-31/D-32 (`viewer-projections.html`) and D-35 (`reply-affordance-v2.html`). They live in
  the session's scratch (`.superpowers/brainstorm/17134-1793420495/content/`) and should be
  re-made as real components rather than ported.
- **The door's placement.** The outlined button sits exactly where the reply composer would
  be, after the last reply, separated by the same rule. The thread's shape does not change
  between projections; only what fills that slot does.
- **Copy, as agreed:** "Replying is open to Connected accounts." The button reads "Connect an
  account to reply." The explainer link is a plain underlined link, not a second button.
- **CLAUDE.md needs a correction in this phase.** It currently states "Forum content is
  members-only by design (every `civic_spaces` grant is `TO authenticated`)". That sentence
  becomes false here, and it is load-bearing for anyone setting up a fresh clone.

</specifics>

<deferred>
## Deferred Ideas

### Explicitly out of scope, carried from Phase 17

- **Search-engine indexing and link unfurling** (D-25). No SSR, no prerender, no `robots.txt`
  work, one static set of `og:` tags. 🔴 Crawlable is not the same as indexed and the copy must
  not overclaim. Worth noting that this is the one part of the one-way door that *is*
  reversible later in either direction, which is an argument for leaving it alone now.

### A later phase, named so it is not drifted into

- **The Empowered cross-shard reply** (D-21, D-40). A new RLS INSERT policy and a term in
  `whyNoWrite`'s body. Chris: *"I do think this is where we are heading. I recognize it's one
  way."*
- **The private invited spaces** that will occupy the Volunteer slot (D-27) — parent groups,
  chapter groups. Their existence is the reason D-28 is an allowlist; building them is not
  this phase.

### Flagged for planning — consequences to handle, not decisions to re-open

- **`locatePost` gains a fourth outcome.** Once posts are public, a signed-out visitor on
  `/post/:postId` can simply be shown the post, which partly dissolves the deferred
  shared-link arrival and the `cs_pending_post` stash. `unavailable`'s deliberate conflation
  of not-found / deleted / not-yours still earns its keep for deleted posts and suspended
  authors, and must survive.
- **Every `connected_profiles` consumer needs a verdict** — see the hooks list above. The
  default for each should be "does not run for a public reader" unless there is a reason.
- **The `public.*` reconciliation is a prerequisite, and it is bigger than it looks**
  (D-43). Six views in production are not in any migration here, and `anon` holds every
  privilege on all fifteen. Dropping or narrowing them may break callers this repo cannot
  see — `users_public` reads a `users` table Civic Spaces does not own, so at least one other
  EV app is in that schema. Treat it as its own plan with its own blast-radius check, ahead of
  the door-opening migration, not as a tidy-up inside it.
- **Re-run the production aggregate immediately before the migration** (D-24's first rider).
  The numbers that made D-42 acceptable are from 2026-10-26.
- **Handle validation in ev-accounts** (D-24's second rider) — not this repo, and not a
  blocker, but the thing that keeps D-42 true going forward.

</deferred>
