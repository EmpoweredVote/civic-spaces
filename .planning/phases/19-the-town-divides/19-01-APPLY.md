# 19-01 apply runbook — the split

**Status: NOT APPLIED.** Three migrations, written and rehearsed, nothing run against production.

Same discipline as `18-02-APPLY.md`, which this follows: **hash the committed bytes, never the
working tree.** Working copies here are CRLF (`core.autocrlf=true`) and the committed bytes are
LF, so `git show HEAD:<path>` is what you hash and what you apply.

---

## 🔴 What is and is not reversible

Phase 18's ladder was reversible at every rung until the last. **This one is not**, and the
asymmetry is worth having in front of you before apply day.

| | reversible? | how |
|---|---|---|
| `20261102000000` fork provenance | yes | `DROP COLUMN forked_from` on both tables |
| `20261102000100` splittable types | yes | `DROP FUNCTION is_splittable_slice_type` |
| `20261102000200` `split_slice()` | yes, as a definition | `DROP FUNCTION split_slice` |
| **A split that has actually run** | **NO** | — |

The third row is why `split_slice` takes `p_min_members`, defaulting to 6000. Before the
whole-branch review its only guards were *exists*, *splittable* and *is the frontier* — and the
function's own output satisfies all three, because the slice it creates is splittable and is
the new frontier. A caller in a loop would have halved a jurisdiction over and over, and a
three-member slice would have divided as willingly as a full one. None of it undoable. The
only thing standing in the way was caller discipline in `civic_spaces_app`, which is precisely
the role this design treats as untrusted enough to wall off from post content.

Dropping the function stops future splits. It does not undo one. Once `split_slice` has run,
three thousand `slice_members` rows have a different `slice_id`, a new slice row exists, and the
new slice holds copied posts that people may already have replied to. **Putting that back needs
the inverse of a split, and there is no such function** — and even with one, the replies written
in the new slice since have nowhere to go.

So the irreversible moment here is not applying a migration. It is **the first time ev-accounts
calls the function** (19-01 Task 5, not yet written). Applying these three files by themselves
changes no data at all: they add two nullable columns and two functions nobody calls yet.

That is deliberate, and it means apply and cutover can be separated — apply the SQL whenever,
and let the engine start calling it as its own decision.

---

## The migrations, in order

| # | file | sha256 of the committed bytes |
|---|---|---|
| 1 | `20261102000000_fork_provenance.sql` | `40ed2df3991250b074366027f3c3e0eae49ab92295590fd1fc38966ffd20f784` |
| 2 | `20261102000100_splittable_slice_types.sql` | `82a5694b8846fe29f4dbcfeb4a010f631e286c79d2e9e1a23bfbb5277d2a9218` |
| 3 | `20261102000200_split_slice.sql` | `2c208e4aad4f266c0b5e2bf9734297c3dd6d23b59c95770bcd012adfa646b812` |

Order matters: 3 calls `is_splittable_slice_type` from 2, and writes `forked_from` from 1.

Verify before applying:

```bash
for m in 20261102000000_fork_provenance 20261102000100_splittable_slice_types 20261102000200_split_slice; do
  printf '%s  %s\n' "$(git show HEAD:supabase/migrations/$m.sql | sha256sum | cut -c1-64)" "$m.sql"
done
```

Apply one file at a time, one transaction each:

```bash
psql "$(cat ~/.cs-db-url)" -X -q -1 -v ON_ERROR_STOP=1 -f <the committed copy>
```

Then record them, as Phase 18 did:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20261102000000','fork_provenance'),
  ('20261102000100','splittable_slice_types'),
  ('20261102000200','split_slice')
ON CONFLICT (version) DO NOTHING;
```

### Grants to check afterwards

```sql
-- split_slice: owner + the engine, nobody else.
SELECT has_function_privilege('anon',             'civic_spaces.split_slice(uuid,interval,integer)', 'EXECUTE'),  -- false
       has_function_privilege('authenticated',    'civic_spaces.split_slice(uuid,interval,integer)', 'EXECUTE'),  -- false
       has_function_privilege('civic_spaces_app', 'civic_spaces.split_slice(uuid,interval,integer)', 'EXECUTE');  -- true

-- is_splittable_slice_type: the same two. The engine reads it to decide whether a full
-- slice divides or falls through to the dormant overflow path, so a missing grant here
-- does not fail loudly — placement would route every full slice down one branch.
SELECT has_function_privilege('anon',             'civic_spaces.is_splittable_slice_type(text)', 'EXECUTE'),  -- false
       has_function_privilege('authenticated',    'civic_spaces.is_splittable_slice_type(text)', 'EXECUTE'),  -- false
       has_function_privilege('civic_spaces_app', 'civic_spaces.is_splittable_slice_type(text)', 'EXECUTE');  -- true
```

🔴 **The two grant statements are the one part of these migrations the rehearsals never
exercised** — all four rehearsal files run as the scratch cluster's superuser, where every
`has_function_privilege` is trivially true and no role named `civic_spaces_app` exists. The
queries above are the only check they get, and they must be run after apply, not assumed.

🔴 Then run `npm run check:anon-read` and expect **72 PASS / 0 FAIL**. Since Phase 18, `anon`
resolves schema `civic_spaces`, so every function added from now on is anon-callable the moment
it is created unless its own file revokes `PUBLIC` — both of these do, and that guard is what
proves it.

---

## The scratch database

Exactly `18-02-APPLY.md`'s recipe, which is the only one that works: a throwaway trust-auth
cluster, then a **schema-only** `pg_dump` of production (`-n civic_spaces`), restored into it.
`supabase/migrations/` does not replay on an empty cluster — eight of the twenty base files
fail, three of them being one-off data migrations that assert production rows.

Verified on this run: **zero `COPY`/`INSERT` lines in the dump** (asserted, so no member content
reaches the machine) and **zero restore errors**.

🔴 One cluster for the whole plan, not one per task. Four rehearsals share it, and each owns its
own geoid — 9999010, 9999020–25, 9999030, 9999040 — so their fixtures cannot collide. Every one
of them ends in `ROLLBACK`; after a full run, `SELECT count(*) FROM civic_spaces.slices` is 0.

---

## Rehearsal results, 2026-11-02

| file | result |
|---|---|
| `19-01-fork-provenance.sql` | **9 PASS**, control FAIL |
| `19-01-split-members.sql` | **12 PASS**, control FAIL |
| `19-01-split-seed.sql` | **14 PASS**, control FAIL |
| `19-01-split-e2e.sql` | **5 PASS**, control FAIL |

**40 PASS, four controls FAIL, `SELECT count(*) FROM civic_spaces.slices` = 0 afterwards.**
Re-run in full on 2026-11-02 after the whole-branch review's fixes, on a freshly rebuilt
cluster.

Every file ends in a deliberately-wrong CONTROL that must print FAIL. A suite of
`CASE WHEN … THEN 'PASS'` assertions that has never printed FAIL has not been shown to be able
to, and this repo has shipped exactly that shape before.

### Mutation proofs

Each one confirms the assertion fails **for the right reason**, and that its neighbours do not —
a suite that goes entirely red under any mutation is globally sensitive rather than
discriminating, which is a different thing and a worse one.

| mutation | fails | stays green |
|---|---|---|
| restamp `joined_at` on the movers | M4 | M1, M2, M3 |
| drop the `user_id DESC` tiebreaker | M7 | M3, M7b |
| copy `parent_reply_id` verbatim | S9, S10 | S1, S5, S8 |
| disable the frontier guard | E3, E7, M9 | E1 |
| alias `SPLITTABLE_SLICE_TYPES` to the public list | check 63 | checks 60, 61, 62 |
| `forked_from` back to `ON DELETE SET NULL` | F3, F7, F7b, F8 | F1, F2, F4, F5, F6 |
| drop the `p_min_members` guard | M11 | M1–M10, every seed and e2e assertion |
| copy a reply whose parent was excluded | S10, S11, S12 | S1–S9 |
| never copy replies at all | S9, S10, S11, S12, S6b, S6c | S1–S8 |

🔴 **Two findings from the rehearsal that the plan did not predict**, both recorded here because
they are about method rather than about this feature:

1. **Six of Task 3's ten planned assertions passed before the function existed.** Four were true
   because nothing had happened; two — "is a volunteer slice refused", "is a non-frontier slice
   refused" — passed because *every* call failed, including for the wrong reason. Each now
   carries "the main split actually ran" as a conjunct. Only watching RED surfaces this.
2. **The tie assertion as planned could not catch the bug it was written for.** Comparing two
   identical jurisdictions proves reproducibility, not a total order: an `ORDER BY` with no
   tiebreaker returns the *same* arbitrary answer for both. Measured — movers are `tccc,tddd`
   with the tiebreaker and `tbbb,tddd` without, and the original assertion read both as a pass.
   It now asserts the exact expected set.
3. 🔴 **S6b passed for the wrong reason, and the review is not what caught it — a mutation
   was.** Everything in a rehearsal runs inside one transaction, `now()` is the transaction
   timestamp, and inserting the originals' own replies restamps the **originals** to the same
   `now()` the copies get. So "the copy's `updated_at` was restamped" compared `now()` against
   `now()`. Measured: it stayed green with the entire reply copy mutated away. The fixture now
   backdates the originals behind a disabled trigger. The general shape — *a fixture whose
   setup produces the value the assertion is looking for* — is worth more than the instance.
4. 🔴 **A mutation that produces invalid SQL reports as "nothing failed", not as an error.**
   The first attempt at the reply-copy mutation put `WHERE false` before the `FROM` clause;
   the migration failed to apply, the function did not exist, the rehearsal aborted before
   printing anything, and the grep for FAIL came back empty. Read carelessly that is "the
   assertions are insensitive to this mutation" — the exact opposite of the truth. Every
   mutation run here now asserts the function is present before reading the result.

---

## Still to do before this is callable

1. 🔴 **Scheduling, and it is the one thing on this list that is not optional.** The engine
   now calls `split_slice` from the `slice_full` retry inside `POST /api/civic-spaces/assign`
   — a pool with `statement_timeout = 10s`, called fire-and-forget by the frontend. Design
   §5.1 says plainly that it *cannot* run there, and the plan's own "Left to the builder"
   repeats it; Task 5 then specified exactly that placement, and the contradiction went
   unnoticed until the whole-branch review. Nobody has measured a 6000-member split against
   ten seconds. Until it moves to a queue or a `pg_cron` job, `openNextSliceForGeoid` treats
   any non-`P0001` failure as "degrade, do not wedge": it logs loudly and opens an overflow
   sibling, because an empty room is recoverable and a jurisdiction nobody can join is not.
2. 🔴 **Deploy these migrations BEFORE ev-accounts.** They change no data, so applying them
   early costs nothing. The other order is handled but silently bad: every reference to
   `split_slice` / `is_splittable_slice_type` raises `42883`, the fallback catches it, and
   every full jurisdiction quietly opens an **empty** sibling instead of dividing — and never
   splits afterwards, because that empty slice becomes the frontier.
3. **The seed window.** `p_seed_window` defaults to `interval '14 days'`, a placeholder chosen
   so the parameter has a value, not a product decision. Design §7.1.
4. **Batching.** A 3000-row `UPDATE` holds the parent's row lock for its duration. Measure
   before assuming it is fine; a member must never be observably half-moved. This is the same
   measurement item 1 needs.
5. **Soft-delete propagation from an original to its forks** (§4.5). The fork-provenance
   migration promises a trigger; it is in neither this plan's tasks nor these migrations.
6. **`slices.photo_url` is not inherited by the new slice.** Members moved out of a
   jurisdiction with a custom hero photo see the type default instead. Not in the spec;
   probably wanted.
7. **`p_seed_window` has no server-side ceiling.** The engine passes nothing and gets 14 days,
   but the grant holder may pass `interval '100 years'` and republish a parent's entire
   history into a fresh room.
