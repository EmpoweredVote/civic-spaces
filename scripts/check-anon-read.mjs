#!/usr/bin/env node
/**
 * check-anon-read.mjs — after the public-read door opens, is it ONLY that door?
 *
 * Run (PowerShell):  $env:SUPABASE_DB_URL = 'postgres://...' ; npm run check:anon-read
 * Run (POSIX sh):    SUPABASE_DB_URL=postgres://... npm run check:anon-read
 * Optional fixtures:  ANON_READ_PUBLIC_PLACE=<type>:<geoid>  (a place with posts; default city:1805860, a guess)
 *                     ANON_READ_VOLUNTEER_GEOID is no longer read: with SUPABASE_DB_URL the volunteer geoid
 *                     and post id come from the catalog. Test JWTs for section 4: see below.
 *
 * Phase 18-02 grants `anon` USAGE on schema civic_spaces plus EXECUTE on exactly four
 * SECURITY DEFINER RPCs (get_public_slice / _feed / _post / _replies). This guard is what
 * stands between that design and a live exposure. Run it right after applying the two
 * migrations, and periodically forever after. Four sections:
 *
 *   1 MUST-FAIL (HTTP)   Thirteen names, each requested on TWO routes: `/rest/v1/<name>`
 *                        (the `public` view — 18-01's territory) and the same with
 *                        `Accept-Profile: civic_spaces` (this plan's territory). They are
 *                        different objects with different grants and only one is in git.
 *                        Pass = a refusal or an empty array. NEVER a row. A 401/403 passes
 *                        only if the body carries SQLSTATE 42501 (a privilege refusal),
 *                        exactly like check:grants — a dead or rotated key also answers 401
 *                        (PGRST301 / Invalid API key) and must not turn the guard green.
 *                        404 and `200 []` pass without a code, but 200 [] prints as REACHABLE BUT
 *                        EMPTY, not REFUSED: it may hide a real SELECT grant (empty table, RLS, limit=1)
 *                        and only section 3b settles it.
 *                        🔴 `public.notifications` is ANOTHER EV APP's table (18-01 found 14
 *                        of those). Ours is `civic_spaces.notifications`, viewed through
 *                        `public.civic_notifications`. The labels say which is which, so a
 *                        failure cannot pin someone else's table on this app.
 *
 *   2 ANON VIEWER (HTTP) The four RPCs via POST /rest/v1/rpc/<name>, anon key,
 *                        `Content-Profile: civic_spaces`. A public place returns rows; a
 *                        volunteer place returns ZERO (D-47: volunteer is the live
 *                        private-type fixture); every row has author_user_id and
 *                        author_avatar_url NULL; no response carries edit_history,
 *                        current_member_count, account_standing or tier as a KEY anywhere.
 *                        Until the migrations are applied these FAIL with "NOT APPLIED YET"
 *                        (PGRST202 function-not-found, or 42501 on EXECUTE) as "not callable by
 *                        anon" — a different message from "applied and broken", which prints what
 *                        came back. PGRST202 can also mean a renamed RPC, a stale cache or a malformed place.
 *                        The leak check is an ALLOWLIST: each row's keys must be a subset of that RPC's
 *                        RETURNS TABLE columns, so a leak under any name fails; the four named keys are a
 *                        second assertion. Both FAIL on zero rows rather than pass vacuously.
 *                        The places are not guessable (slices is not anon-readable and only
 *                        ~15 slice rows exist): override with ANON_READ_PUBLIC_PLACE
 *                        ("city:1805860"). D-47 (volunteer withheld) needs a REAL volunteer geoid and post
 *                        id, which only the catalog can supply (slices is not anon-readable): without
 *                        SUPABASE_DB_URL it is NOT RUN, because the type allowlist makes ANY guessed
 *                        geoid return zero. It runs get_public_post / _replies on a real volunteer post
 *                        id too, and repeats for every configured JWT viewer.
 *
 *   3 CATALOG (psql)     Three standing guards, each first verified by hand once:
 *     a  The anon-executable SECURITY DEFINER set in civic_spaces EQUALS the four RPCs.
 *        Set equality, not four memberships. 🔴 Once schema USAGE is granted, any future
 *        SECURITY DEFINER function added to this schema is anon-callable from the moment
 *        it is created, because Postgres grants EXECUTE to PUBLIC by default. That is the
 *        exact hole found in the plan's Task 5. A second arm asserts the internal helper
 *        public_author_is_visible is executable by NEITHER anon NOR authenticated.
 *     b  anon holds no table privilege anywhere in civic_spaces. Tables are enumerated
 *        from pg_class, NEVER a hand-written list — a hand list is a denylist in disguise
 *        and misses the table added next year (the Task 5 rehearsal probed 7 of 12 and
 *        missed action_log, blocks, flags, follows, moderators). has_table_privilege
 *        counts privileges held via PUBLIC. A CONTROL (authenticated still reads some
 *        table) keeps a blind catalog read from passing vacuously.
 *     c  pg_default_acl has no civic_spaces entry granting anything to anon or PUBLIC.
 *        Verified to have no entry at all, which is why opening this schema is safe. For
 *        contrast `public` carries anon=arwdDxtm as a table default — how 18-01's 15
 *        views and 14 tables got their anon privileges. One ALTER DEFAULT PRIVILEGES IN
 *        SCHEMA civic_spaces and every new table is anon-readable, silently.
 *
 *   4 AUTHENTICATED VIEWERS (optional)  The plan asks for five viewers: anon, Inform,
 *                        Connected non-member, Connected member, Connected friend. Four
 *                        need JWTs that cannot be minted from here (no service-role key, no
 *                        JWT secret). Supply them to run them:
 *                          ANON_READ_JWT_INFORM  ANON_READ_JWT_NONMEMBER
 *                          ANON_READ_JWT_MEMBER  ANON_READ_JWT_FRIEND
 *                          ANON_READ_FRIEND_USER_ID  ANON_READ_FRIEND_DISPLAY_NAME
 *                        Without them it prints a loud SKIP and exits 2. What is then
 *                        UNPROVEN OVER HTTP is D-49: one response in which the friend sees a
 *                        non-NULL author_user_id for their friend and NULL for the other
 *                        author in the same thread — the single most important assertion in
 *                        the plan. It IS covered by the SQL rehearsals of Tasks 3 and 4;
 *                        that is not the same as proving the HTTP path.
 *
 * Needs `psql` on PATH for section 3. No npm dependency, on purpose (no dotenv either).
 * Credentials (publishable key, never a secret): VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY from the environment, else from .env.local.
 *
 * Exit codes: 0 clean and complete; 1 any assertion FAILED (a live exposure never reports
 * as merely incomplete); 2 nothing failed but something did not run.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
let n = 0
const notRun = []

function check(label, ok, detail) {
  n += 1
  if (ok) {
    passed += 1
    console.log(`PASS ${String(n).padStart(2)}  ${label}`)
  } else {
    failed += 1
    console.log(`FAIL ${String(n).padStart(2)}  ${label}${detail ? `\n          ${String(detail).split('\n').join('\n          ')}` : ''}`)
  }
}

function skip(what, why) {
  notRun.push(what)
  console.log(`SKIP     ${what} NOT RUN (${why})`)
}

// ── Credentials ──────────────────────────────────────────────────────────────

function readEnvLocal() {
  const p = join(ROOT, '.env.local')
  if (!existsSync(p)) return {}
  const out = {}
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

let url = process.env.VITE_SUPABASE_URL
let key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  const f = readEnvLocal()
  url = url || f.VITE_SUPABASE_URL
  key = key || f.VITE_SUPABASE_ANON_KEY
}

if (!url || !key) {
  console.log('SKIP — no reachable project; this guard proves nothing')
  console.log('          reason: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found in the environment or .env.local')
  process.exit(2)
}
const BASE = url.replace(/\/$/, '')

async function http(path, { method = 'GET', headers = {}, body, token = key } = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${token}`, ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = undefined }
    return { status: res.status, text, json }
  } catch {
    return { status: 'network error', text: '', json: undefined }
  }
}

// ── 1: the must-fail list ────────────────────────────────────────────────────

/** Pure verdict. Same rule as check-grant-surface.mjs judge(). */
function judge(status, json) {
  if (status === 200) {
    if (Array.isArray(json) && json.length === 0) return { ok: true, kind: 'empty', why: 'REACHABLE BUT EMPTY (200 [])' }
    return { ok: false, why: 'a ROW (or an unreadable body) came back' }
  }
  if (status === 401 || status === 403) {
    return json?.code === '42501'
      ? { ok: true, kind: 'refused', why: 'REFUSED (42501)' }
      : { ok: false, why: `refused, but not as a privilege refusal (code ${json?.code ?? 'none'}) — dead or rotated anon key?` }
  }
  if (status === 404) return { ok: true, kind: 'absent', why: 'NOT EXPOSED (404)' }
  return { ok: false, why: `unexpected status ${status}` }
}

const MUST_FAIL = ['slice_members', 'connected_profiles', 'friendships', 'follows', 'civic_notifications',
  'notifications', 'flags', 'blocks', 'moderators', 'action_log', 'posts', 'replies', 'slices']

console.log('── 1  must-fail list, both routes ─────────────────────────────────────')
const kinds = { refused: 0, empty: 0, absent: 0 }
const emptyOnes = []
for (const name of MUST_FAIL) {
  for (const route of ['public', 'civic_spaces']) {
    const label =
      route === 'public'
        ? name === 'notifications'
          ? "public.notifications — ANOTHER EV APP's table, not ours (ours: civic_spaces.notifications / public.civic_notifications)"
          : `public.${name} (the public view, 18-01)`
        : name === 'civic_notifications'
          ? 'civic_spaces.civic_notifications (does not exist here; our table is civic_spaces.notifications)'
          : `civic_spaces.${name} (this plan)`
    const r = await http(`/rest/v1/${name}?select=*&limit=1`, route === 'civic_spaces' ? { headers: { 'Accept-Profile': 'civic_spaces' } } : {})
    const v = judge(r.status, r.json)
    const foreign = route === 'public' && name === 'notifications'
    if (v.ok) { kinds[v.kind] += 1; if (v.kind === 'empty') emptyOnes.push(label.split(' — ')[0].split(' (')[0]) }
    check(`anon refused, no row: ${label} -> HTTP ${r.status} (${v.why})`, v.ok,
      v.ok ? undefined : foreign
        ? 'This is a FOREIGN table: report to the owning app and 18-01, it is not this plan\'s exposure.'
        : /dead or rotated/.test(v.why)
          ? 'The anon key was refused as a key, not as a privilege: this proves nothing about exposure. Fix the key first.'
          : 'Never a row. A row here is a live exposure; the phase stops.')
  }
}

// ── The catalog is FETCHED first (asserted in section 3) because it is also the only honest
// source of a real volunteer fixture for section 2: slices is not anon-readable, so without it
// the volunteer geoid and post id are guesses, and the allowlist makes a guess return zero.

const EXPECTED_DEFINER = ['get_public_feed', 'get_public_post', 'get_public_replies', 'get_public_slice']

// One query, ONE json document back: no parsing of Postgres array literals out of text.
// has_*_privilege answer for any caller; information_schema.*_privileges goes silently
// blank for a pooler / non-owner role and a blank reads as "anon holds nothing".
const CATALOG_SQL = `
SELECT json_build_object(
  -- 🔴 Why prosecdef, and not every anon-executable function in the schema. A SECURITY INVOKER
  -- function called by anon RUNS AS anon: it hits the same table privileges and the same RLS
  -- policies the caller would have hit directly, so it can return nothing anon could not already
  -- read, and anon holds no table privilege in this schema at all. It fails closed on table
  -- rights, and that is a property of the executor, not of our review. Every function that
  -- pre-dates this phase in civic_spaces is SECURITY INVOKER (current_user_id() among them, whose
  -- only grant is PUBLIC and which 21 RLS policies call). SECURITY DEFINER is the opposite: it
  -- runs as the owner, bypasses RLS, and is anon-callable the moment it is created unless it
  -- revokes PUBLIC itself. So prosecdef is exactly the set where EXECUTE is a disclosure
  -- decision, and the assertion below requires it to EQUAL the four — never merely contain them.
  -- If a SECURITY INVOKER function here ever gains a table GRANT behind it, this filter stops
  -- being sufficient and this comment is the thing that was wrong.
  'definer_anon', (SELECT COALESCE(json_agg(p.proname ORDER BY p.proname), '[]'::json)
                     FROM pg_proc p
                    WHERE p.pronamespace = 'civic_spaces'::regnamespace
                      AND p.prosecdef
                      AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  -- The internal helper must be executable by NOBODY but its owner: not anon, not authenticated (which
  -- already holds schema USAGE and reaches /rest/v1/rpc/*). 'exists' guards against a vacuous false.
  'helper',       (SELECT json_build_object('exists', h.oid IS NOT NULL,
                          'anon',  COALESCE(has_function_privilege('anon', h.oid, 'EXECUTE'), false),
                          'auth',  COALESCE(has_function_privilege('authenticated', h.oid, 'EXECUTE'), false))
                     FROM (SELECT to_regprocedure('civic_spaces.public_author_is_visible(text,text,uuid)') AS oid) h),
  'relations',    (SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.relname), '[]'::json) FROM (
                     SELECT c.relname, c.relkind::text AS relkind,
                            (SELECT COALESCE(array_agg(q ORDER BY q), ARRAY[]::text[])
                               FROM unnest(ARRAY['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']) q
                              WHERE c.relkind <> 'S' AND has_table_privilege('anon', c.oid, q)) AS anon_privs,
                            (c.relkind <> 'S' AND has_any_column_privilege('anon', c.oid, 'SELECT')) AS anon_col_select,
                            (c.relkind = 'S' AND (has_sequence_privilege('anon', c.oid, 'USAGE')
                                               OR has_sequence_privilege('anon', c.oid, 'SELECT')
                                               OR has_sequence_privilege('anon', c.oid, 'UPDATE'))) AS anon_seq,
                            (c.relkind <> 'S' AND has_table_privilege('authenticated', c.oid, 'SELECT')) AS auth_select
                       FROM pg_class c
                      WHERE c.relnamespace = 'civic_spaces'::regnamespace
                        AND c.relkind IN ('r','p','v','m','f','S')) t),
  -- 0 is the GLOBAL default (ALTER DEFAULT PRIVILEGES without IN SCHEMA), which reaches this schema too.
  'default_acl',  (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (
                     SELECT a.defaclobjtype::text AS objtype, pg_get_userbyid(a.defaclrole) AS role, x.privilege_type,
                            a.defaclnamespace = 0 AS is_global,
                            CASE x.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee
                       FROM pg_default_acl a, LATERAL aclexplode(a.defaclacl) x
                      WHERE a.defaclnamespace IN (0, 'civic_spaces'::regnamespace::oid)
                        AND (x.grantee = 0 OR pg_get_userbyid(x.grantee) = 'anon')) d),
  -- A REAL volunteer fixture, from the catalog and never guessed. The post prefers one that has replies.
  'volunteer_geoid', (SELECT s.geoid FROM civic_spaces.slices s WHERE s.slice_type = 'volunteer' ORDER BY s.geoid LIMIT 1),
  'volunteer_post',  (SELECT p.id FROM civic_spaces.posts p JOIN civic_spaces.slices s ON s.id = p.slice_id
                       WHERE s.slice_type = 'volunteer'
                       ORDER BY (p.reply_count > 0) DESC, p.created_at LIMIT 1)
);`

function fetchCatalogText(dbUrl) {
  return execFileSync('psql', [dbUrl, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', CATALOG_SQL], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
  })
}

let catalog = null
let catalogSkip = null
const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) catalogSkip = 'SUPABASE_DB_URL is unset'
else {
  try { catalog = JSON.parse(fetchCatalogText(dbUrl).trim()) } catch (e) {
    // Never echo e.message: psql errors can quote the connection string.
    if (e.code === 'ENOENT') catalogSkip = 'psql is not on PATH'
    else if (e instanceof SyntaxError) catalogSkip = 'psql ran but its output was not the expected JSON'
    else catalogSkip = 'psql could not connect or the catalog query failed'
  }
}

console.log(`   section 1 settled: ${kinds.refused} REFUSED, ${kinds.absent} NOT EXPOSED, ${kinds.empty} REACHABLE BUT EMPTY.`)
if (kinds.empty > 0) {
  console.log(`   !! REACHABLE BUT EMPTY is not the same as refused: ${emptyOnes.join(', ')} answered 200 [] — the request was`)
  console.log('   !! allowed and nothing came back (empty table, RLS filtering every row, or limit=1). That can hide a real anon')
  console.log('   !! SELECT grant. Only the catalog section (3b) settles it for civic_spaces; a foreign public table is for 18-01 to settle.')
}

// ── The catalog is FETCHED ───────────────────────────────────────────────────────

console.log('── 2  anon viewer, the four RPCs ──────────────────────────────────────')

const [PUB_TYPE, PUB_GEOID] = (process.env.ANON_READ_PUBLIC_PLACE || 'city:1805860').split(':')
const FORBIDDEN_KEYS = ['edit_history', 'current_member_count', 'account_standing', 'tier']

// 🔴 The ALLOWLIST. Exactly the RETURNS TABLE column lists of
// supabase/migrations/20261030000100_public_read.sql. A returned key outside its RPC's list is a
// leak under ANY name (user_id, email, member_tier, a column added next year) — which a
// denylist cannot see. FORBIDDEN_KEYS above is a second, more specific assertion, not the one
// that carries the weight.
const PROJECTION = {
  get_public_slice: ['slice_id', 'slice_type', 'geoid', 'sibling_index'],
  get_public_feed: ['id', 'slice_id', 'title', 'body', 'created_at', 'updated_at', 'reply_count',
    'author_display_name', 'author_user_id', 'author_avatar_url'],
  get_public_post: ['id', 'slice_id', 'slice_type', 'geoid', 'title', 'body', 'created_at', 'updated_at',
    'reply_count', 'author_display_name', 'author_user_id', 'author_avatar_url'],
  get_public_replies: ['id', 'post_id', 'parent_reply_id', 'body', 'created_at', 'updated_at',
    'author_display_name', 'author_user_id', 'author_avatar_url'],
}

function rpc(name, args, token) {
  return http(`/rest/v1/rpc/${name}`, { method: 'POST', headers: { 'Content-Profile': 'civic_spaces' }, body: args, token })
}

/** 'ok' | 'uncallable' | 'no-execute' | 'broken'. Uncallable is NOT proof of "not applied": see stateDetail. */
function rpcState(r) {
  if (r.status === 200 && Array.isArray(r.json)) return 'ok'
  if (r.status === 404 && r.json?.code === 'PGRST202') return 'uncallable'
  if ((r.status === 401 || r.status === 403) && r.json?.code === '42501') return 'no-execute'
  return 'broken'
}
function stateDetail(r) {
  const s = rpcState(r)
  if (s === 'uncallable') return 'not callable by anon: PGRST202, the function is not in the schema cache. Usual cause: the migrations are not applied yet (20261030000100_public_read.sql, then NOTIFY pgrst). Also: a renamed RPC, a stale schema cache, a revoked grant, or a malformed ANON_READ_PUBLIC_PLACE (needs <type>:<geoid>).'
  if (s === 'no-execute') return 'not callable by anon: the function exists but anon has no EXECUTE (usual cause: 20261030000200_public_read_grants.sql not applied, or a revoke).'
  return `APPLIED AND BROKEN — HTTP ${r.status}: ${r.text.slice(0, 200)}`
}

function keysIn(v, acc = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => keysIn(x, acc))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { acc.add(k); keysIn(x, acc) }
  return acc
}

/** Every ok response is scanned in one place at the end: { 'viewer rpc place': { rpc, r } }. */
const scanned = {}
function record(who, name, what, r) {
  scanned[`${who} ${name} ${what}`] = { name, r }
}

/** The two leak assertions, over a set of recorded responses. Never vacuous: no rows = FAIL, not pass. */
function leakChecks(who, entries, { allowAuthor }) {
  const okEntries = entries.filter(([, e]) => rpcState(e.r) === 'ok')
  const rows = okEntries.flatMap(([k, e]) => e.r.json.map((row) => ({ k, name: e.name, row })))
  const none = okEntries.length === 0
    ? 'not callable by anon — no RPC answered, so nothing was checked (see the failures above).'
    : 'RPCs answered but returned zero rows, so nothing was checked (see the place assertions above).'
  const vacuous = rows.length === 0

  const outside = []
  for (const { k, name, row } of rows) {
    for (const f of Object.keys(row)) if (!PROJECTION[name].includes(f)) outside.push(`${k}: "${f}"`)
  }
  check(`${who}: every returned row's keys are a subset of the documented projection, per RPC (${rows.length} rows)`,
    !vacuous && outside.length === 0,
    vacuous ? none : `key(s) OUTSIDE the RETURNS TABLE allowlist — a leak under any name:\n${[...new Set(outside)].join('\n')}`)

  const named = []
  for (const [k, e] of okEntries) for (const f of keysIn(e.r.json)) if (FORBIDDEN_KEYS.includes(f)) named.push(`${k}: ${f}`)
  check(`${who}: no response carries ${FORBIDDEN_KEYS.join(' / ')} (D-31, D-34; specific, second to the subset check)`,
    !vacuous && named.length === 0, vacuous ? none : named.join('\n'))

  if (!allowAuthor) {
    const leaks = []
    for (const { k, row } of rows) {
      if (row.author_user_id != null) leaks.push(`${k}: author_user_id=${row.author_user_id}`)
      if (row.author_avatar_url != null) leaks.push(`${k}: author_avatar_url non-NULL`)
    }
    check(`${who}: every returned row has author_user_id and author_avatar_url NULL (${rows.length} rows)`,
      !vacuous && leaks.length === 0, vacuous ? none : leaks.join('\n'))
  }
}

const calls = [
  ['get_public_slice', { p_slice_type: PUB_TYPE, p_geoid: PUB_GEOID }],
  ['get_public_feed', { p_slice_type: PUB_TYPE, p_geoid: PUB_GEOID, p_limit: 50 }],
]
const anonResponses = {}
let postId = null
for (const [name, args] of calls) {
  const r = await rpc(name, args)
  anonResponses[name] = r
  record('anon', name, 'public place', r)
  const ok = rpcState(r) === 'ok' && r.json.length > 0
  check(`anon ${name}, public place ${PUB_TYPE}:${PUB_GEOID}: returns rows`, ok,
    ok ? undefined : rpcState(r) !== 'ok' ? stateDetail(r)
      : `returned 0 rows. Nothing seeded there, or the place is wrong: set ANON_READ_PUBLIC_PLACE=<type>:<geoid>.`)
  if (name === 'get_public_feed' && ok) postId = r.json[0].id
}
{
  const askFor = postId ?? '00000000-0000-0000-0000-000000000000'
  const r1 = await rpc('get_public_post', { p_post_id: askFor })
  const r2 = await rpc('get_public_replies', { p_post_id: askFor, p_limit: 50 })
  record('anon', 'get_public_post', 'public post', r1)
  record('anon', 'get_public_replies', 'public post', r2)
  check(`anon get_public_post, a post from the public feed: returns it${postId ? '' : ' (no feed row to ask for)'}`,
    rpcState(r1) === 'ok' && postId != null && r1.json.length === 1,
    rpcState(r1) !== 'ok' ? stateDetail(r1) : postId == null ? 'no public feed row to ask for' : `returned ${r1.json.length} rows, wanted exactly 1`)
  check('anon get_public_replies: callable and returns an array', rpcState(r2) === 'ok', stateDetail(r2))
}

// D-47: volunteer is the live private type. 🔴 The allowlist makes ANY geoid return zero from
// get_public_slice / get_public_feed, so against a guessed geoid "zero rows" proves the type
// allowlist and nothing about a real volunteer post being withheld. A real fixture comes from the
// catalog or this is NOT RUN. get_public_post / _replies take a post id: the allowlist must hold
// there too, and only a REAL volunteer post id exercises it.
const VOL = { geoid: catalog?.volunteer_geoid ?? null, post: catalog?.volunteer_post ?? null }
const volReason = !catalog ? `no catalog (${catalogSkip}), so the volunteer geoid and post id would be guesses`
  : !VOL.geoid ? 'the catalog has no volunteer slice to use as a fixture' : null

async function volunteerChecks(who, token) {
  if (volReason) {
    skip(`D-47 volunteer withheld, ${who} (real fixture, 4 RPCs)`, volReason)
    return
  }
  const zero = async (name, args, label) => {
    const r = await rpc(name, args, token)
    record(who, name, 'volunteer', r)
    check(`D-47 ${who} ${name}, ${label}: returns ZERO rows`, rpcState(r) === 'ok' && r.json.length === 0,
      rpcState(r) !== 'ok' ? stateDetail(r) : `returned ${r.json.length} row(s) — a volunteer slice or post is publicly readable`)
  }
  await zero('get_public_slice', { p_slice_type: 'volunteer', p_geoid: VOL.geoid }, `REAL volunteer geoid ${VOL.geoid}`)
  await zero('get_public_feed', { p_slice_type: 'volunteer', p_geoid: VOL.geoid, p_limit: 50 }, 'REAL volunteer geoid')
  if (VOL.post) {
    await zero('get_public_post', { p_post_id: VOL.post }, 'REAL volunteer post id')
    await zero('get_public_replies', { p_post_id: VOL.post, p_limit: 50 }, 'REAL volunteer post id')
  } else {
    skip(`D-47 volunteer post withheld, ${who} (get_public_post / get_public_replies)`, 'the catalog has no volunteer post to use as a fixture')
  }
}
await volunteerChecks('anon')

// Leak assertions over everything anon received, including the volunteer responses.
leakChecks('anon', Object.entries(scanned).filter(([k]) => k.startsWith('anon ')), { allowAuthor: false })

// ── 3: the catalog ───────────────────────────────────────────────────────────

console.log('── 3  catalog (psql) ──────────────────────────────────────────────────')

if (catalog) {
  const got = catalog.definer_anon
  const missing = EXPECTED_DEFINER.filter((f) => !got.includes(f))
  const extra = got.filter((f) => !EXPECTED_DEFINER.includes(f))
  const dup = got.length !== new Set(got).size
  check(`3a  the anon-executable SECURITY DEFINER set equals exactly ${EXPECTED_DEFINER.length} RPCs`, !missing.length && !extra.length && !dup,
    [extra.length && `EXTRA anon-callable SECURITY DEFINER function(s): ${extra.join(', ')}\n(Postgres grants EXECUTE to PUBLIC by default; revoke it in the function's own migration.)`,
      missing.length && `missing from the anon set: ${missing.join(', ')} (grants migration not applied?)`,
      dup && 'an overload of a public RPC is also anon-callable'].filter(Boolean).join('\n'))

  // 3a, second arm: the helper is closed to authenticated too. This is what makes the closure of the
  // member-visible friendship/membership oracle permanent rather than a one-time rehearsal.
  const hp = catalog.helper
  check('3a  public_author_is_visible exists and is executable by NEITHER anon NOR authenticated (owner only)',
    hp.exists && !hp.anon && !hp.auth,
    !hp.exists ? 'the helper is not defined (migration 20261030000100 not applied?)'
      : `executable by: ${[hp.anon && 'anon', hp.auth && 'authenticated'].filter(Boolean).join(', ')} — a signed-in member can POST /rest/v1/rpc/public_author_is_visible and read an RLS-bypassing friendship / membership oracle`)

  const rels = catalog.relations
  const exposed = rels.filter((r) => r.anon_privs.length || r.anon_col_select || r.anon_seq)
  check(`3b  anon holds no privilege on any of the ${rels.length} relations in civic_spaces (enumerated from pg_class)`, rels.length > 0 && exposed.length === 0,
    rels.length === 0 ? 'the catalog read saw zero relations — blind read'
      : exposed.map((r) => `${r.relname} (${r.relkind}): anon holds ${[...r.anon_privs, r.anon_col_select && 'column SELECT', r.anon_seq && 'sequence'].filter(Boolean).join(', ')}`).join('\n'))
  check('3b  CONTROL: authenticated still reads at least one civic_spaces relation (a blind catalog read would pass 3b vacuously)', rels.some((r) => r.auth_select),
    'authenticated holds SELECT on nothing: wrong role/pooler, or the app is broken for every member. 3b proves nothing.')

  check('3c  pg_default_acl has no entry (civic_spaces OR global) granting anything to anon or PUBLIC', catalog.default_acl.length === 0,
    `${catalog.default_acl.map((d) => `${d.is_global ? 'GLOBAL' : 'civic_spaces'} default, ${d.role}: ${d.privilege_type} on objtype ${d.objtype} -> ${d.grantee}`).join('\n')}\nEvery new table in this schema would be anon-readable the moment it is created.`)
} else {
  skip('3a 3b 3c (catalog half: DEFINER set, table privileges, default ACL)', catalogSkip)
}

// ── 4: the authenticated viewers ─────────────────────────────────────────────

console.log('── 4  authenticated viewers (optional) ────────────────────────────────')

const JWT = {
  inform: process.env.ANON_READ_JWT_INFORM,
  nonmember: process.env.ANON_READ_JWT_NONMEMBER,
  member: process.env.ANON_READ_JWT_MEMBER,
  friend: process.env.ANON_READ_JWT_FRIEND,
}
const FRIEND_ID = process.env.ANON_READ_FRIEND_USER_ID
const FRIEND_NAME = process.env.ANON_READ_FRIEND_DISPLAY_NAME
const feedArgs = { p_slice_type: PUB_TYPE, p_geoid: PUB_GEOID, p_limit: 50 }
const anonFeed = anonResponses.get_public_feed

async function viewerFeed(who) {
  const r = await rpc('get_public_feed', feedArgs, JWT[who])
  record(who, 'get_public_feed', 'public place', r)
  return r
}

if (JWT.inform) {
  const r = await viewerFeed('inform')
  check('Inform viewer receives a response byte-identical to anon (D-04)', rpcState(r) === 'ok' && r.text === anonFeed?.text,
    rpcState(r) !== 'ok' ? stateDetail(r) : 'bytes differ from the anon response')
} else skip('viewer 2 (Inform, D-04): ANON_READ_JWT_INFORM', 'no test JWT')

if (JWT.nonmember) {
  const r = await viewerFeed('nonmember')
  check('Connected non-member receives the SAME narrow projection as anon (D-48)', rpcState(r) === 'ok' && r.text === anonFeed?.text,
    rpcState(r) !== 'ok' ? stateDetail(r) : 'bytes differ from the anon response')
} else skip('viewer 3 (Connected non-member, D-48): ANON_READ_JWT_NONMEMBER', 'no test JWT')

if (JWT.member) {
  const r = await viewerFeed('member')
  const rows = rpcState(r) === 'ok' ? r.json : []
  // D-48's claim is a non-NULL author_user_id. Avatars are deliberately not asserted: a feed where
  // nobody has one is plausible, and failing on it would teach people to ignore this guard.
  check('Connected member receives a non-NULL author_user_id on every row (D-48)',
    rows.length > 0 && rows.every((x) => x.author_user_id != null),
    rpcState(r) !== 'ok' ? stateDetail(r) : `${rows.length} rows; user ids non-NULL on ${rows.filter((x) => x.author_user_id != null).length}`)
} else skip('viewer 4 (Connected member, D-48): ANON_READ_JWT_MEMBER', 'no test JWT')

if (JWT.friend && FRIEND_ID && FRIEND_NAME) {
  const r = await viewerFeed('friend')
  const rows = rpcState(r) === 'ok' ? r.json : []
  const theirs = rows.filter((x) => x.author_display_name === FRIEND_NAME)
  const others = rows.filter((x) => x.author_display_name !== FRIEND_NAME)
  check("D-49 in ONE response: the friend's rows carry author_user_id, every other author's are NULL",
    theirs.length > 0 && others.length > 0 && theirs.every((x) => x.author_user_id === FRIEND_ID) && others.every((x) => x.author_user_id == null),
    rpcState(r) !== 'ok' ? stateDetail(r) : `friend rows ${theirs.length}, other rows ${others.length} (need at least one of each in the same feed)`)
} else skip('viewer 5 (Connected friend, D-49): ANON_READ_JWT_FRIEND + ANON_READ_FRIEND_USER_ID + ANON_READ_FRIEND_DISPLAY_NAME', 'no test JWT / friend identity')

// D-47 and the leak assertions for every configured viewer. Authenticated viewers may see author
// ids (D-48/D-49), so only the projection-subset and named-key checks apply to them.
for (const who of Object.keys(JWT).filter((w) => JWT[w])) {
  await volunteerChecks(who, JWT[who])
  leakChecks(who, Object.entries(scanned).filter(([k]) => k.startsWith(`${who} `)), { allowAuthor: true })
}
if (!Object.values(JWT).some(Boolean)) skip('D-47 volunteer withheld for the four authenticated viewers', 'no test JWTs')

if (Object.values(JWT).some((t) => !t) || !FRIEND_ID || !FRIEND_NAME) {
  console.log('\n   !! UNPROVEN OVER HTTP: D-49 — the per-author projection in ONE response (a friend sees their')
  console.log("   !! friend's author_user_id and NULL for the other author in the same thread) is the single most")
  console.log('   !! important assertion in this plan, and it is NOT being exercised here. The SQL rehearsals of')
  console.log('   !! Tasks 3 and 4 cover it; that is not the same as proving the HTTP path. Provide the test JWTs')
  console.log('   !! (see header, section 4) to run it.')
}

// ── Result ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} PASS, ${failed} FAIL, ${notRun.length} NOT RUN`)
if (failed > 0) {
  console.log('FAILED — a failure here is a live exposure, or the migrations are not applied yet (read each FAIL line).')
  process.exit(1)
}
if (notRun.length > 0) {
  console.log('INCOMPLETE — this is not a clean result. Not run:')
  for (const w of notRun) console.log(`   - ${w}`)
  console.log('SKIP — part of this guard proves nothing until the above runs')
  process.exit(2)
}
process.exit(0)
