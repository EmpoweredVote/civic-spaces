# Slice splitting: keeping a slice small while the platform grows

**Status:** design, approved for planning. Nothing here is built.
**Date:** 2026-11-01
**Applies to:** `civic-spaces` (this repo) and `ev-accounts` (`backend/src/civic_spaces/`)

---

## 1. Intent

A Civic Spaces slice should feel like a small town. Not a feed, not a city — a room where you
recognise names over time, where a post is likely to be answered by someone you have spoken to
before, and where the population is bounded whether you live in Asheville or in Los Angeles.

The platform has to scale. A slice must not. Those two things only coexist if a slice that gets
too big **divides**, and the halves go on being small towns.

That is the whole of this design: what happens when a slice fills, who moves, what the new slice
opens with, and who is allowed to speak where afterwards.

### Why now

The 6000 cap already exists and already fires. What happens afterwards today is *overflow*, not
splitting: a new sibling slice is created empty, nobody moves, and new members are routed into
the **oldest** slice that still has room. Three consequences:

- A slice that opens is empty, and stays thin for as long as it takes the older slices to fill.
  New arrivals meet nobody.
- Nobody ever moves, so the oldest slice is permanently the most crowded and the most
  established, and arrival order silently determines quality of experience.
- "Small town" is enforced as a headcount ceiling but never as a lived property — a slice at 5999
  members is not a small town, it is a crowd that has not yet been told to stop.

This design replaces overflow with splitting.

---

## 2. Goals, non-goals, anti-goals

### Goals

1. A slice's membership never exceeds 6000 through self-serve placement. The admin override
   (§4.8) is the single audited exception, and has its own smaller ceiling.
2. A newly opened slice opens **populated and talking**, never empty.
3. The platform's total capacity is unbounded — any jurisdiction can hold any number of members
   by holding more slices.
4. Being split away from people does not sever the relationships you chose. Friends stay
   reachable across a slice boundary.
5. A conversation you were part of is not taken away from you by an event you did not cause.

### Non-goals

- **Redistribution.** Chris's model includes trading half of one slice with another every couple
  of years to stop slices going stale. That is deliberately **a later chapter** and is not
  designed here. See §9 — it is load-bearing, not polish.
- **Changing the cap.** 6000 stays. It is expected to be revisited after a few years of real use,
  once there is data on whether it achieves the small-town goal.
- **Volunteer slices.** Splitting applies to `city`, `county`, `state`, `federal` and `unified`
  only.
- **Moving a member after their slice has closed.** Within this design, once you are placed, you
  stay placed. (Redistribution is what changes that, later.)
- **Building Empowered accounts.** They do not exist in the code yet. This design specifies the
  write exception they will get and ships it closed — see §4.6, Exception 2.

### Anti-goals — things that would make this a failure even if it worked

- **A slice that opens empty.** The "empty room problem" is the thing this design exists to
  avoid. A split that produces a silent slice has failed even if the member counts are correct.
- **Offering a control that cannot work.** A reply box on a post you have no standing to answer;
  a notification pulling you into a slice you cannot speak in. The repo already has a hard-won
  rule about this (`CLAUDE.md`, "Gate the feed AND the thread") and splitting multiplies the
  surfaces it applies to.
- **Losing people you chose.** If a split silently drops a friend out of your life, the cap has
  been bought with the thing the product is for.
- **A visitor landing somewhere dead.** A signed-out visitor reading a jurisdiction must not be
  shown a slice that has not been spoken in for a year.

---

## 3. What exists today

Grounded by reading, 2026-11-01. A builder should re-verify rather than trust this table.

| Thing | Where | State |
|---|---|---|
| 6000 cap, enforced | `civic_spaces.enforce_slice_cap()`, `20260327000003_triggers.sql` | Built. `BEFORE INSERT` on `slice_members`, takes `FOR UPDATE` on the slice row, raises `slice_full` / P0001 at >= 6000, increments `current_member_count`. |
| 6000 cap, as a constraint | `slices_count_max_check`, `20260327000001_schema.sql` | Built. `CHECK (current_member_count <= 6000)` **on the table**. Two gates, not one — see §6.6. |
| Count maintenance on leave | `decrement_slice_count()`, same file | Built. `AFTER DELETE`, `GREATEST(count - 1, 0)`. |
| Sibling identity | `slices.sibling_index`, unique on `(geoid, slice_type, sibling_index)` | Built. Column comment currently reads "Overflow index: 1 = first 6k, 2 = second 6k" — **that comment becomes wrong under this design** and must be updated. |
| Join recency | `slice_members.joined_at` | Built. This is the ordering key the split uses. |
| Read any sibling | `posts_select_sibling_slice`, `replies_select_sibling_slice`, `20260917000000_sibling_slice_read_access.sql` | Built. Permissive SELECT on any slice sharing `(slice_type, geoid)`. Nothing crosses a jurisdiction. |
| Write only your own | `posts_insert_slice_member`, `replies_insert_slice_member`, `20260327000002_rls.sql` | Built. `WITH CHECK` requires `slice_id IN (your memberships)`. |
| No client-writable membership | `slice_members` | Built. **No INSERT/UPDATE/DELETE policy at all.** Only a privileged path can move anyone. |
| Assignment, incl. the full-slice path | `ev-accounts` `backend/src/civic_spaces/services/sliceAssigner.ts` | Built — and this is the half that changes. On `slice_full` it retries up to 3 times, finding or creating a sibling at `max(sibling_index) + 1`, and the finder orders `sibling_index ASC` — i.e. **oldest non-full slice wins**. |
| Sibling switcher UI | `src/components/SliceSelector.tsx` | Built. Renders `Slice {siblingIndex}` with member counts. |
| View-only gating in the UI | `isViewOnly` through `SliceFeedPanel` and `ThreadView` | Built. Both halves. Extending it is §6.2. |
| Mutual friendship | `civic_spaces.friendships`, `status = 'FRIEND'`, `20260328000000_phase3_social_graph.sql` | Built. Symmetric, stored as `(user_low, user_high)` with `user_low < user_high`. |

---

## 4. The model

### 4.1 Vocabulary

Member-facing, these are **slices**, numbered: "Slice 1", "Slice 2", as `SliceSelector` already
renders them. "Shard" and "room" were conversational shorthand while this was being designed and
must not reach the UI or the schema.

### 4.2 Which slice types split

`city`, `county`, `state`, `federal`, `unified`. Not `volunteer`.

Volunteer is excluded for a structural reason rather than a product one: it is not a place. It is
role-gated through `assignVolunteerIfEligible`, membership is **revocable** when the role goes
away, and its population is bounded by who holds the role. There is no small town there to
protect.

> **Note for the builder, deliberate:** those five are *also* exactly `PUBLIC_SLICE_TYPES` in
> `src/lib/writeAccess.ts` today. **Keep them as two separate lists.** They coincide by accident,
> not by rule — a future private slice type could want splitting without public read, or the
> reverse. Collapsing them into one constant would silently couple the public read gate (D-28, an
> allowlist by design) to a capacity decision.

### 4.3 Exactly two slices are open

For any `(slice_type, geoid)`, **at most two slices accept new members**: the newest and the
second-newest. Every older slice is **closed** — it keeps its members, keeps its conversation,
and takes no new arrivals except through the admin override (§4.8).

New members are placed into the **second-newest** open slice first, until it reaches 6000. Only
then does the newest start filling.

This inverts today's `sibling_index ASC` behaviour, which fills the oldest slice with room.

### 4.4 The split, and why 6000 does two different things

When a slice reaches 6000:

- **If it is the newest slice**, it **splits**.
- **If a newer slice already exists**, it simply **closes**.

That asymmetry is not arbitrary. A split's purpose is to *open the next slice*. If a newer slice
already exists and is still filling, there is nothing to open, so a full slice just stops taking
people.

Only one slice is ever the frontier. Only the frontier splits.

**A split:**

1. Creates a new slice at `max(sibling_index) + 1` for that `(slice_type, geoid)`.
2. Moves the **3000 most recently joined** members of the full slice into it, ordered by
   `slice_members.joined_at`. Strictly by join date — see §8 for an alternative that was
   considered and declined.
3. Seeds the new slice with a copy of a recent window of the parent's content (§4.5).
4. Leaves the parent at 3000.

**`joined_at` is carried, not reset.** A moved member keeps their original
`slice_members.joined_at`. Stamping `now()` on 3000 rows would falsify the only tenure record
the platform holds, irreversibly, and it is precisely the key redistribution will need to sort
on later. The cost is a semantic shift: `joined_at` stops meaning "when you joined this slice"
and starts meaning "when you joined this jurisdiction's conversation". Update the column comment
to say so. If "joined *this* slice" is ever genuinely needed, add a second column rather than
overwriting this one.

Splits are **automatic**. No human triggers one.

**A slice's whole life**, as a consequence:

> Born at 3000 (half of its parent) → grows to 6000 as the newest slice → **splits**, falling back
> to 3000 → grows to 6000 again as the second-newest → **closes**, for good.

The single exception is Slice 1 of a brand-new jurisdiction, which is born at 0.

### 4.5 The seed, and the fork

A new slice opens with a **copy of a recent window** of its parent's threads. Not the whole
history — a window recent enough that it reads as live conversation and not as an archive.

The copy is a **fork**. At the instant of the split the two copies become separate threads with
shared ancestry: separate ids, separate replies, separate reply counts, separate state. They are
not two views of one conversation and they never reconverge.

Seeded content is **archival with respect to its authors**:

- **The byline is kept.** They are genuinely that person's words. Stripping the attribution would
  be a worse lie than carrying it.
- **The post is marked as carried over**, so nobody mistakes the fork for the original.
- **The original author gets no standing in the new slice** and no notifications from it. If
  someone in the new slice replies to a seeded post, its author hears nothing. They can read the
  thread if they go looking — read access across siblings already exists — but they are never
  pulled into a slice they cannot answer in.
- **The new slice's members can reply to seeded threads from day one.** That is the entire point
  of seeding: the slice opens with something to answer, not something to admire.

In Chris's words: *archival — the conversation continues without them.*

**Replies are copied with their posts, and every copy keeps its original timestamp.** A thread
seeded as a bare post with its replies stripped is an archive, not a conversation — the exact
failure this is meant to avoid. And stamping the forks `now()` would open the new slice with a
wall of simultaneous posts in arbitrary order, on top of being a lie about when the words were
said. Original timestamps also let the seed interleave in correct chronological order, which
makes the window duration (§7.1) the thing that decides what sits above the fold.

**The original author cannot edit a fork.** 🔴 `posts_update_own` is
`user_id = current_user_id()` with **no slice term at all**, so without a new policy an author
could silently revise a fork — including after people in the new slice have replied to it — in a
slice they have no standing in. Archival means the words are fixed where they landed. The fork
is not theirs to rewrite.

**Deletion and moderation do propagate.** If an author soft-deletes the original, or a moderator
removes it, the fork goes with it. The asymmetry is deliberate: editing is an attempt to change
a conversation you are not in, whereas deletion is the withdrawal of consent to publish those
words at all — and that consent was never slice-scoped. Moderation follows the same logic, the
same content under the same judgement.

### 4.6 Who may write where

The existing rule stands: **read any sibling slice, write only in a slice you belong to.** Two
exceptions.

**Exception 1 — standing in a thread you wrote in.**

One rule generates it: **standing attaches to the thread you actually wrote in, never to a copy
of it.**

- *Backward.* You were moved to the new slice, but a thread you had written in stayed behind in
  the parent. You may still reply there. This is the split's debt to you: it took a conversation
  away from you mid-sentence and owes you the rest of it.
- *Forward.* You stayed in the parent and your words were carried into the new slice's seed. You
  get nothing. That fork is a new thread and you never wrote in it.

When a member posts into a thread in a slice they do not belong to, **the UI must say so** — they
are writing into a different slice, and should know it.

**Exception 2 — empowered accounts**, scoped to a jurisdiction they belong to.

An empowered account may write in **any sibling slice of a jurisdiction they are a member of** —
every slice of their own city, their own county, their own state. Not platform-wide. A civic
leader needs to reach all of their city's slices; nobody needs to post into a city they have no
standing in, and a single misused platform-wide account would be able to.

🔴 **This exception cannot be built yet, and must ship closed.** Empowered accounts do not exist
in the code. They will be their own profile, alongside `connected_profiles` — for civic leaders
and people making an impact through Empowered features, who propose solutions and speak
publicly, and who trade privacy for transparency. Deliberately not most people.

So the permission model names the predicate and the predicate reads **false for everyone** until
that profile exists. That matters for two reasons:

- It keeps `src/lib/writeAccess.ts`'s standing refusal intact — *"There is no `tier` term and
  there must never be one"*. The exception must **never** be implemented by reading
  `connected_profiles.tier`. The platform has two disagreeing definitions of tier
  (see `AccountsExplainer.tsx`), and resolving that disagreement inside an RLS policy would
  settle the platform's identity model by accident, in the worst possible place.
- A door built closed opens later without reopening this design. When the Empowered profile
  lands, Exception 2 becomes a join against it and nothing else moves.

> **Flag for whoever builds Empowered profiles, not a decision here:** an account that trades
> privacy for transparency sits oddly with the D-48/D-49 author projection, which withholds
> `author_user_id` from viewers without membership or friendship. Whether an empowered author is
> visible by default is a real question, and it belongs to that work rather than to this.

**Everything else is read-only**, and must *look* read-only. No composer, no reply affordance, no
disabled-but-present button.

### 4.7 The social graph crosses slice walls

A split must not cost you the people you chose.

- **Mutual friendship** (`friendships.status = 'FRIEND'`) carries a friend's posts into your slice
  feed when they are in a **sibling** slice — one sharing `(slice_type, geoid)` with yours. It is
  also what reveals an author's identity under D-49.
- **A one-way follow does not.** Follows surface someone's posts on your **profile feed** only,
  and unlock nothing. Someone can follow a prolific poster without that poster's content leaking
  into a slice they do not belong to.

The only thing that can enlarge your slice feed is a relationship both people agreed to. That is
what keeps the cap honest.

🔴 **Siblings only. Nothing crosses a jurisdiction, and nothing needs to.** This is both the
narrower build and the right behaviour, and the two happen to coincide:

> Your friend moves to another state. You still see their **federal** posts — your federal
> membership and theirs share `(federal, <national geoid>)`, so they are siblings. You do **not**
> see their new state, county or city posts, because those have a different `geoid` and are not
> siblings of anything of yours.

That is Chris's rule stated exactly, and it is *already* what
`posts_select_sibling_slice` computes — the policy joins on `slice_type AND geoid`. So the read
grant needs no change at all. The work is in the feed query: `get_boosted_feed` is today hard
scoped to `WHERE p.slice_id = p_slice_id` and has to widen to "my slice, plus sibling slices
where the author is a mutual friend." The realtime subscription in `useBoostedFeed`
(`filter: slice_id=eq.${sliceId}`) has to widen with it or cross-slice rows arrive only on
refetch.

A split can never separate people across a jurisdiction, so sibling reach covers every case
splitting creates. Goal 4 is satisfied without the jurisdiction wall ever being touched.

**In the feed, a friend's cross-slice post appears inline, tagged with its slice, and plainly
read-only** — Chris picked this over "reply takes you there" and over a separate band. "Plainly
read-only" is the *default* state, not the only one: the rule is *no standing means read-only*,
not *different slice means read-only*. So a feed row has three states:

| State | Appearance |
|---|---|
| Post in your own slice | Normal. Full reply affordance. |
| Post in another slice, you have standing (Exception 1 or 2) | Slice tag, reply live, composer says you are posting into a different slice. |
| Post in another slice, no standing | Slice tag, no reply affordance at all. |

This implies a **third per-row permission predicate** alongside the existing
`public_author_is_visible` and `public_author_is_blocked`: *may this viewer write here.*

### 4.8 Admin override

An admin may place a member into a **specific closed slice** — the motivating case is joining a
spouse, a family member or a colleague who was placed elsewhere.

This is the only path into a closed slice, and the only path that may exceed 6000. See §6.6 for
what stands in its way.

**Not the `moderators` table.** `civic_spaces.moderators` / `is_moderator()`
(`20260328200000_phase5_moderation.sql`) is a *content* role — removing posts, acting on
reports. Placing a person into a community is a different power and must not be quietly folded
into it. Platform roles live in ev-accounts, and `checkVolunteerRole` (`getCachedUserRoles` +
`checkRole`) is the existing pattern; the override should follow it rather than growing a second
role system in this repo.

**Headroom, not an open ceiling.** `slices_count_max_check` rises from 6000 to **6100**, and the
override path itself refuses above that. The trigger goes on enforcing 6000 for every self-serve
placement, so the normal path is untouched. 6100 is deliberately arbitrary and deliberately
small: large enough for the spouse case many times over, small enough that a bug in the override
surfaces as a refusal rather than as an unbounded slice. If a jurisdiction genuinely needs more
exceptions than that, the response is to find out why, not to raise the number quietly.

### 4.9 What a signed-out visitor sees

A visitor with no account, reading a public jurisdiction, lands on **the slice that is currently
taking new members** — genuinely the one they would be placed into if they signed up today.

Under §4.3 that is the **second-newest** slice while it still has room, and the newest once the
second-newest has filled. In a jurisdiction with only one slice, it is that slice.

Stating it as a rule: *among the open slices, the lowest `sibling_index` with
`current_member_count < 6000`; failing that, the highest `sibling_index`.*

This replaces the current `get_public_slice` implementation, which does
`ORDER BY s.sibling_index LIMIT 1` (lowest wins) with a COMMENT citing D-46.

> 🔴 **Sequencing hazard.** It touches
> `supabase/migrations/20261030000100_public_read.sql`, which is **written but not applied**, and
> whose committed bytes have already been hashed and rehearsed as part of the Phase 18 apply
> runbook (`.planning/phases/18-the-public-square/18-02-APPLY.md`, step 0a). Changing it
> **invalidates those recorded hashes**, and this is several lines rather than the one word an
> earlier draft of this document assumed. **Prefer applying Phase 18 as rehearsed and shipping
> this as its own migration afterwards** — re-running step 0 to accommodate a change that belongs
> to a later phase spends the rehearsal for nothing. Do not edit it silently either way.

> ⚠️ **Drift risk, and it deserves a guard.** This rule and the placement rule in §4.3 are *the
> same rule*, and they will live in two repos — placement in ev-accounts' `sliceAssigner.ts`, the
> visitor's landing slice in SQL here. If they drift, the promise breaks silently: a visitor is
> shown one slice and placed into another, and nothing fails. This repo already has the pattern
> for that problem — `check:write-access` pins two allowlists against each other — and this wants
> the same treatment.

---

## 5. Where the work lands

| Half | Repo | Why |
|---|---|---|
| Placement, cap handling, and *triggering* a split | **ev-accounts**, `backend/src/civic_spaces/` | Slice assignment is canonical there by ev-cto decision 0018. `sliceAssigner.ts` already owns the `slice_full` path; its "find a sibling" logic inverts. |
| The split transaction itself, and the seed copy | **civic-spaces**, as a `SECURITY DEFINER` function in `civic_spaces` | **Not ev-accounts.** See §5.1 — that module is deliberately walled off from post content and cannot do this. |
| Write-permission rules (standing, empowered, admin) | **civic-spaces**, RLS + `src/lib/writeAccess.ts` | The gate is RLS; the UI must agree with it. |
| Cross-slice friend rows in the feed, the three row states | **civic-spaces**, `get_boosted_feed` + `useBoostedFeed` + `PostCard` / `ThreadView` | The RLS read grant already covers siblings; the feed query and the realtime filter do not. See §4.7. |
| Slice vocabulary and the switcher | **civic-spaces**, `SliceSelector.tsx` | Already says "Slice N". Likely needs open/closed and seeded-content affordances. |
| The visitor's landing slice | **civic-spaces**, `get_public_slice` | See the sequencing hazard in §4.9. |

### 5.1 🔴 The ev-accounts module cannot touch posts, and that wall stays up

The `civic_spaces` module in ev-accounts connects as **`civic_spaces_app`**, a role holding DML
on only `civic_spaces.slices`, `slice_members` and `connected_profiles`. See `ev-accounts`
`backend/migrations/CA_0112_civic_spaces_scoped_role.sql` and the commentary in
`config/database.ts`, where it is recorded as a deliberate privacy property. **It cannot read or
write a post or a reply.**

So the seed copy cannot be written there. There are two ways out and only one is acceptable:

- ✅ **A `SECURITY DEFINER` function in `civic_spaces`** that performs the whole split — create
  the sibling, move the members, copy the window — invoked by the ev-accounts module. The wall
  stays up, the privileged work is owned and reviewed in the repo that owns the content, and
  `civic_spaces_app` needs `EXECUTE` on one function and nothing else.
- ❌ **Widening `civic_spaces_app`'s grants** to reach `posts` and `replies`. This crosses a
  stated privacy boundary for implementation convenience, needs another team's sign-off, and
  permanently enlarges what a compromised accounts service can read. Do not.

**It also cannot run inside the assign request.** `POST /api/civic-spaces/assign` is called
fire-and-forget by the frontend and its pool sets `statement_timeout = 10s`. A 3000-row
membership move plus a content copy does not belong in a request a user is waiting on — and
nobody is waiting on this one. *Triggering* a split and *performing* it are separate concerns;
how the second half is scheduled is §10.

---

## 6. Constraints the builder must not break

1. **`slice_members` has no client-writable policy, and must not gain one.** Splits and admin
   placements run through a privileged path only. This is the thing standing between the schema
   and a member assigning themselves anywhere they like.
2. **Gate the feed AND the thread.** `CLAUDE.md` records this as a bug that already shipped once:
   `isViewOnly` must reach both `SliceFeedPanel` and `ThreadView`, and `ReplyCard` gets
   `canWrite={canWrite && !isViewOnly}` with no `onReply`. Per-thread standing makes this *per
   row*, not per panel, which is strictly harder. Do not ship half of it.
3. **RLS is the gate; the UI is a courtesy.** Every rule in §4.6 must hold in RLS whether or not
   the UI agrees. A control the UI forgets to hide must still fail at the database.
4. **`civic_spaces.current_user_id()` resolves `external_id` first, then `sub`.** Any new policy
   must use it, never `auth.jwt() ->> 'sub'`. See `CLAUDE.md`.
5. **Never copy real members' posts into fixtures.** Forum content is members-only. Any test or
   demo data for splitting is synthetic — `scripts/rehearsal/18-02-seed.sql` is the house pattern.
6. **The 6000 ceiling has two gates.** `enforce_slice_cap()` *and* the table constraint
   `slices_count_max_check CHECK (current_member_count <= 6000)`. The admin override must get past
   both, and the honest way is to raise the constraint's ceiling for the override case rather than
   drop it — a slice with no ceiling at all is one bug away from unbounded.
7. **The guards are the test suite.** This repo has no test framework; it has ten `check:*`
   scripts. Splitting touches `check:write-access` (the two allowlists are pinned against each
   other) and probably wants a new one. Run them by hand; `npm run build` has never been enough.
8. **The `civic_spaces_app` privacy wall stays up.** The ev-accounts module's grants are not to
   be widened to reach post content, however convenient it would be. See §5.1.

---

## 7. Calls made in writing this up, not by Chris

Flagged so they can be checked or overruled.

1. **The seed window is a size, not a count, and it is the builder's to pick.** Chris's wording was
   "a recent window, enough to not echo". Choose a duration (days of parent activity) over a post
   count, because a duration degrades sensibly in a quiet jurisdiction and a count does not. The
   failure to avoid is a window so long that the new slice reads as an archive of somebody else's
   town.
2. **Per-thread standing does not expire.** Threads die on their own; an explicit expiry adds a
   rule and a date to explain, to solve a problem that time already solves.
3. **No notifications from a seeded fork to its original author.** Derived from the anti-goal about
   controls that cannot work. Stated in §4.5.
4. **Volunteer keeps today's overflow behaviour as a dormant fallback.** The cap trigger is
   table-wide, and carving an exception into correct code to handle a case that will almost
   certainly never fire is worse than leaving it. If a volunteer slice ever hits 6000, a sibling
   gets created exactly as it does today.
5. **The split allowlist and the public-read allowlist stay separate** (§4.2).
6. **The split runs as a `SECURITY DEFINER` function in `civic_spaces`, invoked by ev-accounts**,
   rather than by widening that module's grants (§5.1). This is the call that most changes where
   the work lands, and it was made to keep an existing privacy boundary intact.
7. **`joined_at` is carried through a move, not reset** (§4.4).
8. **Replies are seeded alongside their posts, and all copies keep their original timestamps**
   (§4.5).
9. **Forks are not editable by their original author; deletion and moderation propagate to them**
   (§4.5). The edit/delete asymmetry is reasoned there and is the call most worth overruling if
   it reads wrong.
10. **The admin override uses an ev-accounts platform role, not `civic_spaces.moderators`, and
    raises the ceiling to 6100 rather than removing it** (§4.8). 6100 is an arbitrary number.
11. **Telemetry is a rollup table, not a new dependency** (§9.3).
12. **Exception 2 ships closed** — the predicate exists and is false for everyone until the
    Empowered profile exists (§4.6). Chris confirmed Empowered accounts are not built yet; that
    they ship *as a closed door rather than as a TODO* is my call, and it is what keeps the
    `tier` refusal intact.
13. **The visitor's landing rule wants a cross-repo guard** (§4.9), on the pattern of
    `check:write-access`. Whether it is a guard script or something else is open.

---

## 8. Considered and declined

- **Letting mutual friends travel together across the split boundary.** The cut at exactly 3000 is
  arbitrary at the edges — whether member #2999 or #3001 moves is a coin flip — so friendship could
  settle the fuzzy boundary at near-zero conceptual cost, blunting the tenure-sorting effect in
  §9.1. **Chris declined it for now:** keep the cut strictly by join date. Revisit alongside
  redistribution.

---

## 9. Known weaknesses, stated on purpose

A builder should know these are seen, not missed.

1. **Splitting by recency sorts people by tenure.** The moving half is composed entirely of
   newcomers — everyone who arrived in the same window — while the parent keeps all its old-timers.
   That is the one thing a small town is not, and it concentrates loneliness: the members with the
   thinnest social graph are all moved into the same slice at the same moment. The seed window
   partly answers this (the parent's voices are on the wall from day one) but only archivally — the
   newcomers can read the town's conversation and cannot talk back to it. Accepted for now; §8
   holds the declined mitigation.
2. **A closed slice has no inflow, ever.** It only loses members from then on — churn, inactivity,
   people leaving. Three years on, a slice could be 6000 on paper and a few hundred in the room,
   and every slice except the newest two is on a one-way decay curve. **Redistribution is the
   answer and it is not in this design.** That makes the later chapter load-bearing, and this is a
   deadline rather than a backlog item.
3. **6000 is a headcount, not a conversation.** If 10% of a slice posts daily that is 600 posts a
   day, which is not a small town; if 1% do, the slice is quiet. Membership is a weak proxy for the
   property being protected. Ship the headcount cap — it is simple, honest and already built — but
   **instrument posts-per-day-per-slice from day one**, because that is the number that will say
   whether 6000 was right when the cap is revisited. **Where it goes:** a rollup table in
   `civic_spaces`, written by a scheduled query (pg_cron is already installed in `public`) — not
   an analytics SDK. There is no telemetry anywhere in this repo today, so this is *choosing* a
   pipeline rather than extending one, and the cheapest honest choice is one table and one
   scheduled job: no new dependency, no member data leaving the database, nothing to sanction.
4. **Splitting is a bulk membership move.** Three thousand rows change slice, through triggers that
   fire per row and take `FOR UPDATE` on the slice. A member must never be observably half-moved,
   and a member who is mid-reply when their slice splits under them must not lose the reply or have
   it land somewhere they are no longer a member of. Both are the builder's to solve; neither is a
   design question.

---

## 10. Left to the builder

- The seed window's duration (§7.1).
- How the split transaction is structured so 3000 members move atomically without holding a slice
  lock for an unacceptable time (§9.4).
- How the split is *scheduled* once ev-accounts has triggered it. It cannot run inside the assign
  request (§5.1), and nobody is waiting on it.
- The thread-standing lookup behind the third permission predicate has no supporting index today
  — `replies` is indexed on `(post_id, created_at)`, not on `user_id` — and it runs per row over
  a paginated feed.
- What a client does when its slice splits underneath it mid-session.
- The exact shape of the third permission predicate (§4.7) and whether it is an RPC, a column on
  the feed projection, or a policy-side function.
- Whether "marked as carried over" is a column on `posts`, a separate seed table, or a nullable
  `forked_from` reference — and whether reply forks need the same marker.
- How an admin override is actually invoked and audited.
