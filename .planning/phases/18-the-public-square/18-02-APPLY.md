# Phase 18-02: Applying the public-read path

**Written:** 2026-10-31
**Applies, in this fixed order:**

1. `supabase/migrations/20261030000000_reconcile_public_views.sql` (18-01, the `public.*` reconcile)
2. `supabase/migrations/20261030000100_public_read.sql` (six functions, every one revoked from PUBLIC)
3. `supabase/migrations/20261030000200_public_read_grants.sql` (the privilege delta)

**Status:** written, rehearsed, **not applied.** Applying is Chris's call and Chris's hands.
See `18-01-APPLY.md` for what step 1 does in detail; this file covers the whole sequence.

## What each file does to what `anon` and `authenticated` can reach

| After | `anon` | `authenticated` |
|---|---|---|
| `...000` | zero privileges on the twelve `public.*` views | unchanged (all seven privileges kept) |
| `...100` | unchanged: no `USAGE` on `civic_spaces`, cannot resolve anything | **cannot execute any of the six functions.** Owner only. |
| `...200` | `USAGE` on `civic_spaces` plus `EXECUTE` on exactly four RPCs | `EXECUTE` on the same four (kept explicitly) |

`...100` contains every `REVOKE`, each right after its own `CREATE FUNCTION`. 🔴 That is on purpose.
`authenticated` already holds `USAGE` on `civic_spaces` and already reaches `/rest/v1/rpc/*`, so a
`SECURITY DEFINER` function left at Postgres's `EXECUTE TO PUBLIC` default is callable by any
signed-in member the moment it exists, bypassing RLS. Both internal helpers are oracles at that
default: `public_author_is_visible` is a roster sweep (`p_viewer` against a slice id) and an
"are A and B friends?" probe, and `public_author_is_blocked` is a pairwise "has A blocked B?"
probe over a table whose RLS says only the blocker may read their own rows.
`...200` has no `REVOKE` in it: `GRANT USAGE`, four `GRANT EXECUTE`, `NOTIFY`.

**Six functions, four of them granted.** The two helpers — `public_author_is_visible` and
`public_author_is_blocked` — are internal and stay executable by nobody but the owner, forever.
`check:anon-read` assertion 3a asserts both by name, with a CONTROL that both were enumerated,
because a helper nobody listed passes a loop over an empty list.

## Step 0: byte-identity. Do this before anything else, and here is why

🔴 **Nobody has ever run these files.** Every rehearsal in both plans executed **comment-stripped
copies** of the SQL, pasted through the MCP. The realistic failure is a file that parses but
differs from what was reviewed:

- a `--` comment swallowing the following line because a newline landed as a literal `\n` (this
  repo has been bitten by exactly that class of bug);
- a CRLF, a smart quote or a BOM inside a `$$` body;
- the dangerous variants: a swallowed `AND cp.is_suspended IS NOT TRUE`, or a swallowed allowlist
  predicate (`AND s.slice_type = ANY (ARRAY[...])`). **Both are syntactically valid, both are
  silent, and both are invisible to a comment-stripped rehearsal**, because stripping the comments
  removes the very thing that would have swallowed them.

⚠️ **Concrete, found while writing this:** on the Windows clone with `core.autocrlf=true`, the
working copy of `...000` is CRLF while the committed bytes are LF (`git ls-files --eol` prints
`i/lf w/crlf`). Hash and apply the **committed** bytes, not whatever is in a working tree. The
two `...100` / `...200` working copies happened to be LF; do not rely on that.

### 0a. Record the hashes of the committed bytes

```bash
for f in 20261030000000_reconcile_public_views 20261030000100_public_read 20261030000200_public_read_grants; do
  git show HEAD:supabase/migrations/$f.sql | sha256sum | sed "s|-|$f.sql|"
done
```

Write the three hashes down. Then export those exact bytes and use only the exported files from
here on:

```bash
mkdir -p /tmp/apply && for f in 20261030000000_reconcile_public_views 20261030000100_public_read 20261030000200_public_read_grants; do
  git show HEAD:supabase/migrations/$f.sql > /tmp/apply/$f.sql
done
sha256sum /tmp/apply/*.sql        # must equal the hashes recorded above
# 🔴 COUNT CR BYTES, do not grep for them. `grep -c $'\r'` reports the number of
# LINES MATCHED, and in Git Bash it matches every line — it reported 135/534/56 CRs
# on 2026-11-01 in files that contain exactly zero. It is a measurement that always
# "fails", so following it would make you reject clean bytes.
for f in /tmp/apply/*.sql; do
  printf "%s cr=%s bom=%s\n" "$(basename $f)" "$(tr -cd '\r' < $f | wc -c)" "$(head -c3 $f | od -An -tx1 | tr -d ' ')"
done
# cr must be 0 for each, and bom must NOT be efbbbf.
```

### 0b. Apply each file to a SCRATCH database with `psql -f`

The file. Not pasted SQL, and not the MCP with inlined text: the MCP path is how the
comment-stripped copies were run and it is the path this step exists to replace. The scratch
database needs the real `civic_spaces` tables and the `anon` / `authenticated` roles (a Supabase
branch, or a local stack built from `supabase/migrations/`).

```bash
psql "$SCRATCH_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f /tmp/apply/20261030000000_reconcile_public_views.sql
psql "$SCRATCH_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f /tmp/apply/20261030000100_public_read.sql
```

🔴 **`-1` is not a tidiness flag here, it is the security property.** Each `CREATE FUNCTION` in
`...100` is followed by its own `REVOKE ALL ... FROM PUBLIC`, and between those two statements the
function exists at Postgres's `EXECUTE TO PUBLIC` default — callable by `authenticated`, which
already holds schema `USAGE` and already reaches `/rest/v1/rpc/*`. Without `-1`, psql autocommits
each statement, so that window is real wall-clock time on a live database: an interrupted or failed
run can leave `public_author_is_visible` created and un-revoked. `-1` makes each `CREATE` atomic
with its own `REVOKE`, so the oracle never exists outside a transaction nobody else can see.
"Nothing half-applied" is the second reason, not the first.

Run the verification in "Between the steps" below on the scratch database, then apply `...200` the
same way and verify again.

### 0c. Read back all six function bodies and diff them against the file

`prosrc` is exactly the text between the `$$` delimiters, so it can be compared byte for byte:

```bash
node -e '
const fs=require("fs"),cp=require("child_process");
const sql=fs.readFileSync("/tmp/apply/20261030000100_public_read.sql","utf8");
const blocks=[...sql.matchAll(/CREATE OR REPLACE FUNCTION civic_spaces\.(\w+)\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)];
if(blocks.length!==6) throw new Error("expected 6 function blocks, found "+blocks.length);
let bad=0;
for(const [,name,body] of blocks){
  const live=cp.execFileSync("psql",[process.env.SCRATCH_DB_URL,"-X","-At","-c",
    `select prosrc from pg_proc where pronamespace = $$civic_spaces$$::regnamespace and proname = $$${name}$$`]).toString();
  // psql -At appends one newline after the value
  const same = live.replace(/\n$/,"") === body;
  console.log((same?"IDENTICAL ":"DIFFERS   ")+name);
  if(!same) bad++;
}
process.exit(bad?1:0)'
```

Also read `pg_get_functiondef` for each and eyeball the two predicates that matter. Both must be
present in the live definition:

```sql
SELECT proname,
       prosrc LIKE '%is_suspended IS NOT TRUE%'                                      AS has_suspension_filter,
       prosrc LIKE '%ANY (ARRAY[''city'', ''county'', ''state'', ''federal'', ''unified'']%' AS has_allowlist
  FROM pg_proc WHERE pronamespace = 'civic_spaces'::regnamespace AND proname LIKE '%public%'
 ORDER BY proname;
-- expect: suspension filter true for feed, post, replies; allowlist true for slice and post.
```

**Only when every function is IDENTICAL and both predicates are present, apply to production**,
from the same exported files, with the hashes re-verified immediately before each apply:

```bash
sha256sum /tmp/apply/*.sql   # compare to the recorded hashes again
```

## Between the steps: the order, and what each wrong order does

### 1. `...000` first

```bash
npm run check:grants
```

**Expect:** 6 PASS, 0 FAIL, exit 0 (see `18-01-APPLY.md`). Wait 1 to 2 minutes for the schema reload
before judging the HTTP half.

### 2. `...100` second. The door is still shut

Verify, as the `postgres` role (a member of `authenticated`), that a member **cannot** call any of
them. 🔴 **Probe all six, not a sample.** The REVOKEs are six independent statements, and the one
that matters most is per-function: a single `REVOKE` lost to a swallowed comment leaves exactly one
door open, and a two-function spot check has a 60% chance of missing it. Each probe needs **its own
transaction** — the `42501` aborts the one it is raised in, so a single `BEGIN` block reports the
first refusal and then fails every later statement with `25P02`, which reads like a pass and is not:

```sql
BEGIN; SET LOCAL ROLE authenticated;
  SELECT civic_spaces.public_author_is_visible('a', 'b', '00000000-0000-0000-0000-000000000000'::uuid);
ROLLBACK;

BEGIN; SET LOCAL ROLE authenticated;
  SELECT civic_spaces.public_author_is_blocked('a', 'b');
ROLLBACK;

BEGIN; SET LOCAL ROLE authenticated;
  SELECT civic_spaces.get_public_slice('city', '3703000');
ROLLBACK;

BEGIN; SET LOCAL ROLE authenticated;
  SELECT civic_spaces.get_public_feed('city', '3703000', 1, NULL::timestamptz, NULL::uuid);
ROLLBACK;

BEGIN; SET LOCAL ROLE authenticated;
  SELECT civic_spaces.get_public_post('00000000-0000-0000-0000-000000000000'::uuid);
ROLLBACK;

BEGIN; SET LOCAL ROLE authenticated;
  SELECT civic_spaces.get_public_replies('00000000-0000-0000-0000-000000000000'::uuid, 1, NULL::timestamptz, NULL::uuid);
ROLLBACK;
```

**Expect all six:** `ERROR: 42501 permission denied for function <name>`. The arguments are
deliberately meaningless — `EXECUTE` is checked before the body runs, so a refusal proves the
privilege regardless of what the arguments would have matched. They only have to resolve to the
right overload, which is why the `NULL`s carry casts. 🔴 **Any other error is a FAIL, including a
successful empty result**: `0 rows` means the function was callable and simply found nothing.

(Rehearsed 2026-10-31 on a transaction aborted with `RAISE EXCEPTION`: `public_author_is_visible`
and `get_public_post` both refused. The other four were not rehearsed and this is their first probe.
🔴 `public_author_is_blocked` is the newest and the most sensitive of the six: un-revoked it is a
pairwise "has A blocked B?" oracle over a table whose RLS says only the blocker may read their own
rows. A block is information the blocker specifically does not want known.)
Then `npm run check:anon-read` must still **exit 1**: 3a reports
the four RPCs "missing from the anon set" and section 2 reports "NOT APPLIED YET". That is the
correct state: nothing is open. The new 3a arm for the helper must **PASS** here (exists, executable
by neither role).

### 3. `...200` third, and last

```bash
# wait 1-2 minutes for NOTIFY pgrst, 'reload schema'
npm run check:anon-read
```

**Expect:** exit 0 only with the four optional JWTs supplied (see the script header), otherwise
exit 2 with a loud SKIP. Never accept exit 1. Public RPC calls are **POST** (see below).

### What happens at each wrong ordering

| Wrong order | Result |
|---|---|
| `...200` before `...100` | The four `GRANT EXECUTE` statements fail (functions do not exist). Run **without** `-1` and `GRANT USAGE ON SCHEMA` has already landed: `anon` resolves the schema and can call nothing, with `D-43`'s stricter posture silently lost. Always `-1`. |
| `...200` before `...000` | `anon` resolves `civic_spaces` while the twelve `public.*` views still carry anon privileges: the exact D-43 state this sequence exists to avoid. Nothing is protected by ordering any more. |
| `...100` before `...000` | Applies cleanly (no dependency on the views), but `check:grants`' baseline expectation ("FAIL 2 naming twelve views") no longer describes the world, and the shut-door checkpoint is skipped. Harmless, but do not. |
| `...100` **without** its REVOKEs (an old copy of the file) | `public_author_is_visible` and all four RPCs are executable by any signed-in member through PostgREST: an RLS-bypassing friendship / membership oracle. This is the window the final review closed; `check:anon-read` 3a (second arm) now fails on it permanently. |
| `...200` alone | Fails: functions missing. Same partial-`USAGE` hazard as above without `-1`. |

## The cache constraint (POST only)

PostgREST serves `STABLE` functions over `GET` as well as `POST`. A `GET` is cacheable by any shared
intermediary, and these responses are **viewer-specific**: they differ only by the `Authorization`
header (`current_user_id()`, the D-48 / D-49 projection). **Public RPC calls go over POST.**
Cloudflare already fronts this product. **Before 18-03 ships, confirm nothing shared caches
`/rest/v1/rpc/*`** (a cache rule, a page rule, an edge cache on the Supabase custom domain), and
confirm with a GET and a POST of the same call carrying two different `Authorization` headers.
Disclosure through a cache is the one part of this phase that cannot be undone.

## Rollback: five statements, verbatim

Privilege-reversible. The PUBLIC defaults stay revoked, so this lands **tighter** than before:

```sql
REVOKE EXECUTE ON FUNCTION civic_spaces.get_public_slice(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION civic_spaces.get_public_feed(text, text, integer, timestamptz, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION civic_spaces.get_public_post(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION civic_spaces.get_public_replies(uuid, integer, timestamptz, uuid) FROM anon, authenticated;
REVOKE USAGE ON SCHEMA civic_spaces FROM anon;
```

Then `NOTIFY pgrst, 'reload schema';` and re-run `npm run check:anon-read` (expect exit 1 and "NOT
APPLIED YET": the door is shut again). Note that `authenticated` keeps schema `USAGE`: it had it
before and every member read depends on it.

What does **not** roll back is disclosure: anything an anonymous reader (or a cache) already
received. That is why the caution sits on what the RPCs project and on the cache check above, not on
the grants file.

## After applying: record the three files as applied

🔴 **A raw `psql -f` does not tell Supabase anything.** The CLI tracks applied migrations in
`supabase_migrations.schema_migrations`, and it is only written by `supabase db push` / `supabase
migration up`. Apply these by hand and that table still says the three files have never run — so the
next person to run `supabase db push`, from any machine, will try to apply them **again**. `...000`
and `...100` are idempotent (`CREATE OR REPLACE`, `REVOKE`), so the second run is survivable; it is
still a surprise re-run of DDL against production that nobody intended, and it re-opens the
`CREATE`-to-`REVOKE` window in `...100` for as long as that push takes.

Immediately after the production apply, in the same session:

```sql
-- Check the column list first: it differs across CLI versions (some have statements/name,
-- older ones only version). Insert only columns that exist.
SELECT column_name, is_nullable FROM information_schema.columns
 WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
 ORDER BY ordinal_position;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20261030000000', 'reconcile_public_views'),
  ('20261030000100', 'public_read'),
  ('20261030000200', 'public_read_grants')
ON CONFLICT (version) DO NOTHING;

SELECT version FROM supabase_migrations.schema_migrations
 WHERE version LIKE '202610300%' ORDER BY version;   -- expect the three, in order
```

`version` is the filename's timestamp prefix and nothing else — no `.sql`, no name. Get it wrong
and the row is cosmetic: the CLI matches on that string, so a typo re-runs the file anyway.

The rollback above does **not** change these rows, and should not: it revokes privileges, it does
not drop the functions or restore the views, so all three files are still genuinely applied. Delete
the `20261030000200` row only if you also `DROP` what that file granted — which the five-statement
rollback deliberately does not.

## After applying

- `check:grants` and `check:anon-read` run by hand, or from `.github/workflows/db-surface.yml`
  (manual dispatch now; uncomment its `schedule:` once `SUPABASE_DB_URL`, `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` exist as secrets).
- Delete the two "until applied" ⚠️ lines named in `18-01-APPLY.md` step 8.
- `check:anon-read`'s assertion 3a watches only **SECURITY DEFINER** functions, and requires that
  set to *equal* the four. The reason it can ignore the rest is written beside the `prosecdef`
  filter in `scripts/check-anon-read.mjs`: a SECURITY INVOKER function called by `anon` runs as
  `anon` and fails closed on table rights, and `anon` holds no table privilege in this schema. That
  stops being true the day a SECURITY INVOKER function here gains a table `GRANT` behind it.
- An open question for Chris is recorded in `18-02-PLAN.md` ("Open question for Chris"): whether a
  member of one shard counts as a member for a sibling shard's authors. 18-03 must not decide it by
  accident.

## Apply state as of 2026-11-01 — step 0a done, blocked on a credential

**Step 0a is complete.** Committed bytes, verified LF-clean (0 CR bytes) and identical
across `phase/18-02-public-read-path`, `…18-03…`, `…18-04…` and #137:

```
9a71e0d406cd4c8751f6dddc08924bf9ebff9e145a3cdba4468cbfb2c5e3dcec  20261030000000_reconcile_public_views.sql
3ca3013b5d6da6da45845fa049084e30fe013c8012e1d3751e4044988394c95f  20261030000100_public_read.sql
c4aff59dc640357d53fbadcd8d057d10ff4168856a291039c8179d0c6114c938  20261030000200_public_read_grants.sql
```

**Blocked on:** `SUPABASE_DB_URL` is unset and not in `.env.local`. `psql` 18 is installed.
The URL is needed less for the apply than for the VERIFICATION — `check:grants` and the
catalog half of `check:anon-read` both shell out to `psql` with it, and they are the two
guards that decide whether the door opened correctly.

🔴 **Do NOT use `ev-accounts`' active `DATABASE_URL`.** It connects as the **`ev_api`**
role (switched 2026-09-09 so local runs match prod; the previous superuser value is
commented out above it in `C:\EV-Accounts\backend\.env`). `SECURITY DEFINER` means *runs
as the owner* — create these four RPCs as `ev_api` and they run with `ev_api`'s rights
instead of the owner's, which either breaks them or silently gives them a different
privilege set than every assertion in `check:anon-read` was written against. The existing
`civic_spaces` functions were created through the MCP, which connects as `postgres`.
**Confirm the actual owner before applying** — one read-only catalog query, no credential
needed.

**Scratch target chosen:** a local PostgreSQL 18 built from `supabase/migrations/`, not a
paid Supabase branch. Not yet built.
