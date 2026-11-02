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
| 1 | `20261102000000_fork_provenance.sql` | `f7e44a04c20f5cde5a731cd3130264621f0191df1aeed5e623d96c7c61f51dea` |
| 2 | `20261102000100_splittable_slice_types.sql` | `82a5694b8846fe29f4dbcfeb4a010f631e286c79d2e9e1a23bfbb5277d2a9218` |
| 3 | `20261102000200_split_slice.sql` | `dcb11540931f30d6d8a12e779742bed29b5bea384ad3997cab0a868dcfd6a7db` |

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
SELECT has_function_privilege('anon',             'civic_spaces.split_slice(uuid,interval)', 'EXECUTE'),  -- false
       has_function_privilege('authenticated',    'civic_spaces.split_slice(uuid,interval)', 'EXECUTE'),  -- false
       has_function_privilege('civic_spaces_app', 'civic_spaces.split_slice(uuid,interval)', 'EXECUTE');  -- true

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
own geoid — 9999010, 9999020–24, 9999030, 9999040 — so their fixtures cannot collide. Every one
of them ends in `ROLLBACK`; after a full run, `SELECT count(*) FROM civic_spaces.slices` is 0.

---

## Rehearsal results, 2026-11-02

| file | result |
|---|---|
| `19-01-fork-provenance.sql` | **8 PASS**, control FAIL |
| `19-01-split-members.sql` | **11 PASS**, control FAIL |
| `19-01-split-seed.sql` | **10 PASS**, control FAIL |
| `19-01-split-e2e.sql` | **5 PASS**, control FAIL |

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

---

## Still to do before this is callable

1. **19-01 Tasks 4 and 5** — ev-accounts: placement filling the two newest slices, and
   `slice_full` calling `split_slice` instead of creating an empty sibling. Not written.
2. **Scheduling.** The call cannot live inside `POST /api/civic-spaces/assign`: that pool sets
   `statement_timeout = 10s` and the frontend calls it fire-and-forget. Nobody is waiting on a
   split.
3. **The seed window.** `p_seed_window` defaults to `interval '14 days'`, which is a placeholder
   chosen so the parameter has a value — not a product decision. Design §7.1.
4. **Batching.** A 3000-row `UPDATE` holds the parent's row lock for its duration. Measure
   before assuming it is fine; a member must never be observably half-moved.
