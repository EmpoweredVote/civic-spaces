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
# 🔴 Compare the BYTES, not psql's stdout. On Windows psql writes stdout in TEXT mode, so
# every \n inside prosrc comes back as \r\n and a string compare reports all six as DIFFERS,
# each larger than the file by exactly its own line count. That is the measuring tool, not
# the SQL -- the same shape of bug as the CR check in 0a. base64 is transport-safe.
node scripts/prosrc-diff.mjs /tmp/apply/20261030000100_public_read.sql
```

`scripts/prosrc-diff.mjs` extracts the six `$$` bodies from the file, reads each live body as
`encode(convert_to(prosrc,'UTF8'),'base64')`, decodes it and compares with `Buffer.equals`,
prints the first differing byte with context, and separately fails if any live body contains
a CR. **Prove it can fail before you trust a pass**: replace one function with a one-line body
and re-run; it must report `DIFFERS` at the right offset.


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

### Checked 2026-11-01: nothing shared caches it, and the reason is thinner than it looks

**Done.** Probed live against production. The headline is that the risk is structurally absent
today, but not because anything in our control is preventing it.

**There is no Supabase custom domain.** The deployed bundle at
`civicspaces.empowered.vote/assets/index-BY8XYtUE.js` calls
`https://kxsdzaojfaibhuzmclfq.supabase.co` directly. So "an edge cache on the Supabase custom
domain" has nothing to be configured on, and **our own Cloudflare zone is not in the REST path at
all** — `civicspaces.empowered.vote/rest/v1/...` returns the SPA's `index.html` (200, text/html),
which is the catch-all, not a proxy. Nothing of ours to misconfigure, and nothing of ours to fix
either, which is the point below.

**What does front it is Cloudflare — Supabase's, not ours.** `kxsdzaojfaibhuzmclfq.supabase.co`
resolves to 172.64.149.246 / 104.18.38.10 and answers `Server: cloudflare`.

Every probe, GET and POST, 200 and 404:

| Request | Result |
|---|---|
| `GET /rest/v1/rpc/postgis_version`, valid key, ×3 | 200, `CF-Cache-Status: DYNAMIC` every time, never HIT, no `Age` |
| `POST` the same | 200, `DYNAMIC` |
| same URL + method, **different `Authorization`** | 401, never the cached 200 body |
| same URL + method + key, **different `Accept-Profile`** (`public` vs `civic_spaces`, both valid) | 200 vs 404 vs 200 — no collision between two same-URL requests that differ only by a header |

`DYNAMIC` means Cloudflare treated it as uncacheable and went to origin. A repeat never became a
HIT, and no response carried `Age`.

🔴 **CONTROL, because "no cache" is exactly the shape of a vacuous pass.** The same header probe,
pointed at our own zone, reports `Cache-Control: public, max-age=0, s-maxage=300`, `Age: 115`,
`cf-cache-status: HIT` on the JS bundle. The probe can see a cache. It is not seeing one here.

🔴 **The thin part: the origin sends no `Cache-Control` at all, and no `Vary` on a 200.** Not
`no-store`, not `private`, nothing. These responses differ only by the `Authorization` header
(`current_user_id()`, the D-48/D-49 projection) and they say so to nobody. `DYNAMIC` is
Cloudflare's *default* for this path, not a directive we issued — and the Cloudflare in front of
`*.supabase.co` is **Supabase's zone, which we cannot add a rule to**. So the whole protection is
a default on infrastructure we do not control. Our actual control surface is three things: keep
the public reads on **POST**, never put a caching custom domain in front of this project, and
re-run this probe when either changes.

**One gap, stated plainly.** The two `Authorization` headers in the differential were a valid
publishable key and an invalid one, so the second was refused at the gateway. The true hazard —
two *valid* viewers, anon and a member, getting each other's rows — needs a member JWT this
session did not have, and is the same missing credential as section 4's test JWTs. The
`Accept-Profile` row above is the closest available substitute: two valid requests, same URL and
method, differing only by a header, answered differently and never cross-served.

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

## Apply state as of 2026-11-01 — step 0 REHEARSED END TO END, not applied

**The credential blocker is cleared.** A postgres-role URI is at `~/.cs-db-url` (session
pooler, port 5432 — session mode, which `-1` and `SET LOCAL ROLE` both need). It is the line
commented out above the active one in `C:\EV-Accounts\backend\.env`, and it still
authenticates: `select current_user` returns **postgres**.

🔴 **The owner question is answered — `postgres` — and it was worth asking.** All sixteen
existing `civic_spaces` functions are owned by `postgres`, the seven SECURITY DEFINER ones
among them. So the four new RPCs must be created by `postgres`, never through ev-accounts'
active `DATABASE_URL`, which connects as `ev_api`.

**Step 0a re-verified.** The three committed files still hash to the values recorded here, with
0 CR bytes and no BOM:

```
9a71e0d406cd4c8751f6dddc08924bf9ebff9e145a3cdba4468cbfb2c5e3dcec  20261030000000_reconcile_public_views.sql
3ca3013b5d6da6da45845fa049084e30fe013c8012e1d3751e4044988394c95f  20261030000100_public_read.sql
c4aff59dc640357d53fbadcd8d057d10ff4168856a291039c8179d0c6114c938  20261030000200_public_read_grants.sql
```

### The scratch database: build it from a schema dump, NOT by replaying the migrations

🔴 **`supabase/migrations/` does not replay on an empty cluster.** Tried first, as the plan
said to. Eight of the twenty base files fail, and not all of them are fixable: the first is a
missing `supabase_realtime` publication (stubbable), but three are one-off production data
migrations whose own assertions are about production rows — `snapshot_before_taxonomy`
("0 live vs 0 backed up"), `slice_taxonomy` ("expected exactly one federal slice, found 0")
and `seed_geo_memberships` (reads `connect.connected_profiles`, a schema this repo does not
own). A replay would have produced a shape nobody could vouch for, which is the opposite of
what step 0 is for.

What was used instead, and what the next person should use:

```bash
# a throwaway cluster: trust auth, its own port, nothing to do with the local services
initdb -D "$SCRATCH/pgdata" -U postgres --auth=trust -E UTF8 --locale=C
pg_ctl -D "$SCRATCH/pgdata" -l "$SCRATCH/pg.log" -o "-p 5440 -c listen_addresses=localhost" start

# schema only -- NO rows, so no member content ever lands on a dev machine
pg_dump "$(cat ~/.cs-db-url)" --schema-only --no-owner -n civic_spaces -f prod_civic_spaces.sql
pg_dump "$(cat ~/.cs-db-url)" --schema-only --no-owner \
  -t public.action_log -t public.blocks -t public.civic_notifications -t public.connected_profiles \
  -t public.flags -t public.follows -t public.friendships -t public.moderators \
  -t public.posts -t public.replies -t public.slice_members -t public.slices \
  -f prod_public_views.sql
```

Before restoring, the cluster needs what Supabase supplies and a stock Postgres does not:
roles `anon`, `authenticated`, `service_role`, `civic_spaces_app`; then
`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role`
— **omit that and `...000` revokes nothing and passes vacuously**, since it is the whole reason
anon holds all seven; an `auth.jwt()` stub reading `request.jwt.claim`; and
`CREATE SCHEMA extensions; CREATE EXTENSION pg_trgm WITH SCHEMA extensions`, which one index on
`connected_profiles` needs. Do **not** dump all of `public`: it carries another app's tables
plus PostGIS, pg_cron, pg_net and supabase_vault, none of which restore here. `civic_spaces`
itself uses only stock types, which is why it does.

Result: 15 tables, 12 public views, 31 policies, 16 functions — production's shape, no rows.

### What step 0 found, on that scratch

| Step | Result |
|---|---|
| 0b `...000` | Applied clean. The five untracked `CREATE OR REPLACE VIEW`s matched the live column lists exactly — had they not it would have errored, which is the point of writing them that way. anon: 7 privileges on 12 views → **0**. authenticated: still 7 on all 12. `security_invoker=on` on all 12. |
| 0b `...100` | Applied clean. Six functions, all `prosecdef`, all owned by `postgres`. |
| shut door | **6/6 refused with 42501**, each in its own transaction — including the two helpers and `public_author_is_blocked`, which had never been probed before. A CONTROL call as the owner returned no error, proving the probe can tell a refusal from a success. |
| 0c | **All six bodies byte-identical** to the file; no CR in any live body. A deliberate one-line mutation was reported as `DIFFERS` at the right offset, so the pass is not vacuous. |
| predicates | Suspension filter on feed/post/replies, allowlist on slice/post — exactly as this file predicted. `get_public_feed` shows `has_allowlist = f` **and that is correct**: it gates by selecting `FROM civic_spaces.get_public_slice(...)`, so the allowlist is enforced one call down. `get_public_replies` gates through `get_public_post` the same way. |
| 0b `...200` | Applied clean. anon: schema USAGE, EXECUTE on the four, **0 table privileges**. Both helpers executable by neither role. |

**The suite is committed**, at `scripts/rehearsal/18-02-seed.sql` and
`scripts/rehearsal/18-02-behaviour.sql`: run the seed, then the behaviour file as the owner
after `...100`, and its A-series block as anon after `...200`. Its last line is a deliberately
wrong CONTROL that must print FAIL.

**Behavioural rehearsal, on synthetic rows** — a city slice with two shards, a volunteer slice,
a suspended author, one reply; fixture data only, no member content. As `anon`, after `...200`:
the four RPCs return the city slice, feed, post and reply; `author_user_id` is NULL on every row
(D-48/49); a shard-2 post keeps **its own** slice_id rather than being rewritten to shard 1; a
suspended author's post is absent; and the volunteer slice, feed, post and replies **all return
zero rows**. 11/11, with a deliberately-wrong control reading FAIL.

### 🔴 `anon` gains EXECUTE on more than four functions, and it is fine — here is the proof

`...200` grants EXECUTE on four. But schema `USAGE` also un-blocks Postgres's default
`EXECUTE TO PUBLIC` on every pre-existing function that never revoked it: after `...200`, anon
can execute **nine** others — `current_user_id`, `get_feed_filtered`,
`get_boosted_feed_filtered` and six trigger functions. Read "EXECUTE on exactly four RPCs and
nothing else" as being about SECURITY DEFINER functions and about table grants, which is what
`check:anon-read` 3a actually asserts.

Probed as `anon` on the scratch rather than argued:

- `get_feed_filtered`, `get_boosted_feed_filtered` → `42501 permission denied for table posts`.
  SECURITY INVOKER runs as the caller, and anon holds no table privilege here. Fail-closed.
- the six trigger functions → `0A000 trigger functions can only be called as triggers`.
- `current_user_id()` → returns anon's own NULL identity. Nothing to disclose.
- direct reads of `civic_spaces.posts` / `slices` / `connected_profiles` and `public.posts` → all `42501`.

That is exactly the argument written beside the `prosecdef` filter in
`scripts/check-anon-read.mjs`, and it now has a probe behind it. It stops holding the day a
SECURITY INVOKER function here gains a table GRANT.

### 🔴 The guards' catalog half had never run on Windows — fixed in this commit

`check:anon-read` reported `SKIP 3a 3b 3c ... (psql could not connect or the catalog query failed)`
while `check:grants` connected fine **with the same URL**. psql was fine and so was the
credential. `CATALOG_SQL` contains four non-ASCII characters — a 🔴 and em dashes, in its own
comments — and Node encodes argv in the system ANSI codepage on Windows, so `-c` handed psql
CP1252 bytes: `invalid byte sequence for encoding "UTF8": 0x97`. The catch turned that into a
generic skip.

So 3a/3b/3c — **the assertions that prove only four RPCs are anon-executable and that anon holds
no table privilege** — had never once executed on the machine the apply will be run from, and
would have reported NOT RUN on apply day while looking like a missing credential. Both scripts
now pass the SQL on **stdin** (`-f -` plus `input:`), which Node writes as UTF-8.
`check:grants` was ASCII and working; it is patched anyway, because a 🔴 in a comment is house
style here and this is a question of when, not whether.

Verified after the fix. Against the post-apply scratch, 3a/3b/3c run and **all seven pass**
(38-44). Against production, the catalog half runs and reports the documented pre-apply state —
3a "missing from the anon set" naming the four, both helpers "not defined" — while 41-44 pass.
`check:grants` against production is unchanged at **5 PASS, 1 FAIL**, that FAIL being
assertion 2 naming the twelve views: precisely the baseline this file predicts.

### Still to do before a production apply

1. ~~The cache check.~~ **Done 2026-11-01** — see "Checked 2026-11-01" above.
   Nothing shared caches `/rest/v1/rpc/*`; the protection is Cloudflare's default on Supabase's
   own zone, not a directive of ours, so it is a standing re-check rather than a closed box.
   Re-run it if a custom domain appears or the reads ever move off POST.
2. **Section 4's test JWTs.** D-49's per-author projection over HTTP is still UNPROVEN; the SQL
   rehearsal is not the same thing and the guard says so itself.
3. **The open question in `18-02-PLAN.md`** — whether a member of one shard counts as a member
   for a sibling shard's authors — is still open, and 18-03 must not settle it by accident.
4. The apply itself, and the `supabase_migrations.schema_migrations` rows immediately after it.
