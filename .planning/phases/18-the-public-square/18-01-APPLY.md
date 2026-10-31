# Phase 18-01: Applying the `public.*` reconcile migration

**Written:** 2026-10-31
**Applies:** `supabase/migrations/20261030000000_reconcile_public_views.sql`
**Status:** written, rehearsed, **not applied.** Applying it is Chris's call and Chris's hands.

This is the how-to-apply for 18-01. It exists because that knowledge used to live in a
git-ignored scratch file. Everything stated as verified below was checked against production on
2026-10-31.

## What the migration does

Three things, in this order, ending with `NOTIFY pgrst, 'reload schema';`:

1. **Re-declares five views** that exist in production and in no migration (`posts`, `replies`,
   `slices`, `slice_members`, `connected_profiles`), each `WITH (security_invoker = on)`.
2. **Sets `security_invoker = on` explicitly on the seven already-tracked views** (`friendships`,
   `follows`, `civic_notifications`, `flags`, `blocks`, `moderators`, `action_log`). In
   production this is a no-op. The repo did not record it, so a rebuild from migrations would
   otherwise have produced security-DEFINER views.
3. **`REVOKE ALL … FROM anon`** on all twelve.

**Verified:** it was rehearsed inside `BEGIN; … ROLLBACK;` through the `supabase-local` MCP. Every
statement succeeded, `anon` reached zero privileges on all twelve, `authenticated` kept all seven
privileges on all twelve, and production was confirmed unchanged afterwards.

**Verified:** the frontend never touches `public.*`. All 45 `.from(…)` calls in `src/` sit under
`.schema('civic_spaces')`, so this migration cannot change behaviour for a signed-in member.

## Before you start: what `check:grants` can and cannot do

`npm run check:grants` has two halves.

- **The HTTP half** runs today, from `.env.local`.
- **The catalog half** needs `SUPABASE_DB_URL` (a direct Postgres connection string) and `psql` on
  PATH. Without them it exits non-zero with a loud SKIP.

🔴 **The catalog half has never once run against a real `psql` connection.** It has only run
against a stand-in. The first real run is step 2 below, and it is part of this procedure, not a
formality. If it errors for a reason that has nothing to do with grants, that is the guard's bug
to fix before you trust anything it says.

The apply role is `postgres` through the MCP: not a superuser, but a member of `anon`, which is
why it can both see and revoke these grants.

## Procedure

### 1. Merge the branch first, and apply nothing

Merging changes no database state. Deploy is automatic on merge (about 3 minutes), and this
branch touches no file under `src/`, so the frontend is unaffected either way.

### 2. Baseline

PowerShell first, POSIX second.

```powershell
$env:SUPABASE_DB_URL = '<production postgres connection string>'
npm run check:grants
```

```bash
export SUPABASE_DB_URL='<production postgres connection string>'
npm run check:grants
```

**Expect:** `FAIL 2` naming all twelve views, the other assertions PASS, exit 1.

🔴 **If assertion 2 PASSES here, stop.** Either the migration is already applied, or the catalog
read is blind. Assertion 3 (the `authenticated`-SELECT control) is what tells the two apart: if
it is also green and assertion 2 is not, the read works and something has already revoked. If
assertion 3 is red or absent, the read is blind and no later green means anything.

### 3. Optional: close a known blind spot

```sql
SELECT * FROM information_schema.column_privileges
 WHERE table_schema = 'public' AND grantee = 'anon';
```

**Expect:** zero rows. `has_table_privilege` is table-level only, and `REVOKE ALL ON <table>` does
not remove separately granted *column* privileges. A column grant would be invisible to
assertion 2 and unfixed by the migration. Record the zero here when you have it.

### 4. Apply

Through the `supabase-local` MCP, as `postgres`, the **whole file, in order**. The
`CREATE OR REPLACE VIEW`s must precede the `REVOKE`s: on any database where a view is created
fresh, the default privileges fire at creation and the revoke is what takes them back.

### 5. Wait 1 to 2 minutes

Let `NOTIFY pgrst, 'reload schema'` land before judging the HTTP half.

### 6. Verify

```powershell
npm run check:grants
```

**Expect: 6 PASS, 0 FAIL, exit 0.**

- **Assertion 2 still red.** The revoke did not stick. Most likely a grant to `PUBLIC`
  (remedy: `REVOKE ALL ON public.<view> FROM PUBLIC;` for the named views), or an apply role
  that cannot revoke these grants. Re-apply as `postgres`.
- 🔴 **Assertion 3 red: stop and roll back.** `authenticated` lost SELECT and the app is broken
  for every member. Restore with
  `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<view> TO authenticated;` per view, using the
  `grants.authenticated` recorded in `scripts/fixtures/grant-surface.json`.

### 7. Smoke-test as a signed-in member

Load a feed, open a thread, post a reply. Assertion 3 is a privilege check, not a round trip.

### 8. Delete the two "until applied" lines

The branch deliberately left one ⚠️ line behind in each of two files:

- `CLAUDE.md` (the line beginning `⚠️ Until 20261030000000_reconcile_public_views.sql is applied`)
- `.planning/ROADMAP.md` (the same line)

Delete each, and put the paragraphs above them into the past tense. Each line says what to change.

### 9. If you applied by hand

Applied by hand rather than with `supabase db push`, the file is not recorded in
`supabase_migrations.schema_migrations`, and a later push re-runs it. That is harmless, because
the migration is idempotent, but it is worth knowing before it surprises someone.

## Undo

This is a **reversible door**, unlike 18-02. To restore a view's `anon` access:

```sql
GRANT ALL ON public.<view> TO anon;
```

Run it per view. Nothing is published by this migration, so there is nothing to un-publish.
**18-02's grants migration is the irreversible one.** Once the PostgREST endpoint is publicly
queryable it stays that way. This one is not.

## What this does not cover

- **`ALTER DEFAULT PRIVILEGES` on `public` is untouched.** The mechanism that caused the drift is
  still armed. A future `DROP` / `CREATE` of any of these views silently re-grants `anon` all
  seven privileges. A column-list change *requires* that `DROP`/`CREATE`, because
  `CREATE OR REPLACE VIEW` cannot change a column list. `check:grants` would catch it, but
  **`check:grants` is not in CI**, so nothing runs it unless a person does.
- **`public.users_public` is deliberately untouched.** It reads a `users` table Civic Spaces does
  not own, so another EV app shares it. `anon` retains SELECT, INSERT, UPDATE and DELETE there.
