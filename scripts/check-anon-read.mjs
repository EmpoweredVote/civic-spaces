#!/usr/bin/env node
/**
 * check-anon-read.mjs — after the public-read door opens, is it ONLY that door?
 *
 * Run (PowerShell):  $env:SUPABASE_DB_URL = 'postgres://...' ; npm run check:anon-read
 * Run (POSIX sh):    SUPABASE_DB_URL=postgres://... npm run check:anon-read
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
 *                        404 and `200 []` pass without a code.
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
 *                        (PGRST202 function-not-found, or 42501 on EXECUTE) — a different
 *                        message from "applied and broken", which prints what came back.
 *                        The places are not guessable (slices is not anon-readable and only
 *                        ~15 slice rows exist): override with ANON_READ_PUBLIC_PLACE
 *                        ("city:1805860") and ANON_READ_VOLUNTEER_GEOID. The volunteer
 *                        assertion is weaker than it looks — the type allowlist makes ANY
 *                        geoid return zero — so it proves the allowlist, not a particular row.
 *
 *   3 CATALOG (psql)     Three standing guards, each first verified by hand once:
 *     a  The anon-executable SECURITY DEFINER set in civic_spaces EQUALS the four RPCs.
 *        Set equality, not four memberships. 🔴 Once schema USAGE is granted, any future
 *        SECURITY DEFINER function added to this schema is anon-callable from the moment
 *        it is created, because Postgres grants EXECUTE to PUBLIC by default. That is the
 *        exact hole found in the plan's Task 5.
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
 *        (Not covered: a GLOBAL default — no IN SCHEMA — which also reaches this schema;
 *        3b would still catch the tables it created.)
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
    if (Array.isArray(json) && json.length === 0) return { ok: true, why: 'empty array' }
    return { ok: false, why: 'a ROW (or an unreadable body) came back' }
  }
  if (status === 401 || status === 403) {
    return json?.code === '42501'
      ? { ok: true, why: 'privilege refusal 42501' }
      : { ok: false, why: `refused, but not as a privilege refusal (code ${json?.code ?? 'none'}) — dead or rotated anon key?` }
  }
  if (status === 404) return { ok: true, why: 'not exposed' }
  return { ok: false, why: `unexpected status ${status}` }
}

const MUST_FAIL = ['slice_members', 'connected_profiles', 'friendships', 'follows', 'civic_notifications',
  'notifications', 'flags', 'blocks', 'moderators', 'action_log', 'posts', 'replies', 'slices']

console.log('── 1  must-fail list, both routes ─────────────────────────────────────')
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
    check(`anon refused, no row: ${label} -> HTTP ${r.status} (${v.why})`, v.ok,
      v.ok ? undefined : foreign
        ? 'This is a FOREIGN table: report to the owning app and 18-01, it is not this plan\'s exposure.'
        : /dead or rotated/.test(v.why)
          ? 'The anon key was refused as a key, not as a privilege: this proves nothing about exposure. Fix the key first.'
          : 'Never a row. A row here is a live exposure; the phase stops.')
  }
}

// ── 2: the anon viewer ───────────────────────────────────────────────────────

console.log('── 2  anon viewer, the four RPCs ──────────────────────────────────────')

const [PUB_TYPE, PUB_GEOID] = (process.env.ANON_READ_PUBLIC_PLACE || 'city:1805860').split(':')
const VOL_GEOID = process.env.ANON_READ_VOLUNTEER_GEOID ?? '1805860'
const FORBIDDEN_KEYS = ['edit_history', 'current_member_count', 'account_standing', 'tier']

function rpc(name, args, token) {
  return http(`/rest/v1/rpc/${name}`, { method: 'POST', headers: { 'Content-Profile': 'civic_spaces' }, body: args, token })
}

/** 'ok' | 'not-applied' | 'no-execute' | 'broken' — so "not applied yet" never reads as "applied and broken". */
function rpcState(r) {
  if (r.status === 200 && Array.isArray(r.json)) return 'ok'
  if (r.status === 404 && r.json?.code === 'PGRST202') return 'not-applied'
  if ((r.status === 401 || r.status === 403) && r.json?.code === '42501') return 'no-execute'
  return 'broken'
}
function stateDetail(r) {
  const s = rpcState(r)
  if (s === 'not-applied') return 'NOT APPLIED YET — PGRST202, the function is not in the schema cache (20261030000100_public_read.sql, then NOTIFY pgrst).'
  if (s === 'no-execute') return 'NOT APPLIED YET — the function exists but anon has no EXECUTE (20261030000200_public_read_grants.sql).'
  return `APPLIED AND BROKEN — HTTP ${r.status}: ${r.text.slice(0, 200)}`
}

function keysIn(v, acc = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => keysIn(x, acc))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { acc.add(k); keysIn(x, acc) }
  return acc
}

const anonResponses = {}
const calls = [
  ['get_public_slice', 'public place', { p_slice_type: PUB_TYPE, p_geoid: PUB_GEOID }, true],
  ['get_public_slice', 'volunteer place (D-47)', { p_slice_type: 'volunteer', p_geoid: VOL_GEOID }, false],
  ['get_public_feed', 'public place', { p_slice_type: PUB_TYPE, p_geoid: PUB_GEOID, p_limit: 50 }, true],
  ['get_public_feed', 'volunteer place (D-47)', { p_slice_type: 'volunteer', p_geoid: VOL_GEOID, p_limit: 50 }, false],
]
let postId = null
for (const [name, what, args, wantRows] of calls) {
  const r = await rpc(name, args)
  anonResponses[`${name}:${what}`] = r
  const ok = rpcState(r) === 'ok' && (wantRows ? r.json.length > 0 : r.json.length === 0)
  const detail = rpcState(r) !== 'ok'
    ? stateDetail(r)
    : wantRows
      ? `returned 0 rows for ${PUB_TYPE}:${PUB_GEOID}. Nothing seeded there, or the place is wrong: set ANON_READ_PUBLIC_PLACE=<type>:<geoid>.`
      : `returned ${r.json.length} row(s) for a volunteer place — a private type is readable (D-47)`
  check(`anon ${name}, ${what}: ${wantRows ? 'returns rows' : 'returns ZERO rows'}`, ok, ok ? undefined : detail)
  if (name === 'get_public_feed' && wantRows && ok) postId = r.json[0].id
}

{
  const askFor = postId ?? '00000000-0000-0000-0000-000000000000'
  const r1 = await rpc('get_public_post', { p_post_id: askFor })
  const r2 = await rpc('get_public_replies', { p_post_id: askFor, p_limit: 50 })
  anonResponses.get_public_post = r1
  anonResponses.get_public_replies = r2
  check(`anon get_public_post, a post from the public feed: returns it${postId ? '' : ' (no feed row to ask for; callable only)'}`,
    rpcState(r1) === 'ok' && (postId ? r1.json.length === 1 : true),
    rpcState(r1) !== 'ok' ? stateDetail(r1) : `returned ${r1.json.length} rows, wanted exactly 1`)
  check('anon get_public_replies: callable and returns an array', rpcState(r2) === 'ok', stateDetail(r2))
}

{
  const leaks = []
  let rowsSeen = 0
  for (const [k, r] of Object.entries(anonResponses)) {
    if (rpcState(r) !== 'ok') continue
    for (const row of r.json) {
      rowsSeen += 1
      if (row.author_user_id != null) leaks.push(`${k}: author_user_id=${row.author_user_id}`)
      if (row.author_avatar_url != null) leaks.push(`${k}: author_avatar_url non-NULL`)
    }
  }
  const applied = Object.values(anonResponses).some((r) => rpcState(r) === 'ok')
  const none = 'NOT APPLIED YET — no RPC answered, so nothing was checked.'
  check(`anon: every returned row has author_user_id and author_avatar_url NULL (${rowsSeen} rows)`,
    applied && rowsSeen > 0 && leaks.length === 0,
    !applied ? none : rowsSeen === 0 ? 'no rows came back, so nothing was checked (see the place assertions above)' : leaks.join('\n'))

  const found = []
  for (const [k, r] of Object.entries(anonResponses)) {
    for (const f of keysIn(r.json)) if (FORBIDDEN_KEYS.includes(f)) found.push(`${k}: ${f}`)
  }
  check(`anon: no response carries ${FORBIDDEN_KEYS.join(' / ')} (D-31, D-34)`, applied && found.length === 0,
    !applied ? none : found.join('\n'))
}

// ── 3: the catalog ───────────────────────────────────────────────────────────

console.log('── 3  catalog (psql) ──────────────────────────────────────────────────')

const EXPECTED_DEFINER = ['get_public_feed', 'get_public_post', 'get_public_replies', 'get_public_slice']

// One query, ONE json document back: no parsing of Postgres array literals out of text.
// has_*_privilege answer for any caller; information_schema.*_privileges goes silently
// blank for a pooler / non-owner role and a blank reads as "anon holds nothing".
const CATALOG_SQL = `
SELECT json_build_object(
  'definer_anon', (SELECT COALESCE(json_agg(p.proname ORDER BY p.proname), '[]'::json)
                     FROM pg_proc p
                    WHERE p.pronamespace = 'civic_spaces'::regnamespace
                      AND p.prosecdef
                      AND has_function_privilege('anon', p.oid, 'EXECUTE')),
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
  'default_acl',  (SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) FROM (
                     SELECT a.defaclobjtype::text AS objtype, pg_get_userbyid(a.defaclrole) AS role, x.privilege_type,
                            CASE x.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee
                       FROM pg_default_acl a, LATERAL aclexplode(a.defaclacl) x
                      WHERE a.defaclnamespace = 'civic_spaces'::regnamespace
                        AND (x.grantee = 0 OR pg_get_userbyid(x.grantee) = 'anon')) d)
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

if (catalog) {
  const got = catalog.definer_anon
  const missing = EXPECTED_DEFINER.filter((f) => !got.includes(f))
  const extra = got.filter((f) => !EXPECTED_DEFINER.includes(f))
  const dup = got.length !== new Set(got).size
  check(`3a  the anon-executable SECURITY DEFINER set equals exactly ${EXPECTED_DEFINER.length} RPCs`, !missing.length && !extra.length && !dup,
    [extra.length && `EXTRA anon-callable SECURITY DEFINER function(s): ${extra.join(', ')}\n(Postgres grants EXECUTE to PUBLIC by default; revoke it in the function's own migration.)`,
      missing.length && `missing from the anon set: ${missing.join(', ')} (grants migration not applied?)`,
      dup && 'an overload of a public RPC is also anon-callable'].filter(Boolean).join('\n'))

  const rels = catalog.relations
  const exposed = rels.filter((r) => r.anon_privs.length || r.anon_col_select || r.anon_seq)
  check(`3b  anon holds no privilege on any of the ${rels.length} relations in civic_spaces (enumerated from pg_class)`, rels.length > 0 && exposed.length === 0,
    rels.length === 0 ? 'the catalog read saw zero relations — blind read'
      : exposed.map((r) => `${r.relname} (${r.relkind}): anon holds ${[...r.anon_privs, r.anon_col_select && 'column SELECT', r.anon_seq && 'sequence'].filter(Boolean).join(', ')}`).join('\n'))
  check('3b  CONTROL: authenticated still reads at least one civic_spaces relation (a blind catalog read would pass 3b vacuously)', rels.some((r) => r.auth_select),
    'authenticated holds SELECT on nothing: wrong role/pooler, or the app is broken for every member. 3b proves nothing.')

  check('3c  pg_default_acl has no civic_spaces entry granting anything to anon or PUBLIC', catalog.default_acl.length === 0,
    `${catalog.default_acl.map((d) => `${d.role}: ${d.privilege_type} on objtype ${d.objtype} -> ${d.grantee}`).join('\n')}\nEvery new table in this schema would be anon-readable the moment it is created.`)
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
const anonFeed = anonResponses['get_public_feed:public place']

if (JWT.inform) {
  const r = await rpc('get_public_feed', feedArgs, JWT.inform)
  check('Inform viewer receives a response byte-identical to anon (D-04)', rpcState(r) === 'ok' && r.text === anonFeed?.text,
    rpcState(r) !== 'ok' ? stateDetail(r) : 'bytes differ from the anon response')
} else skip('viewer 2 (Inform, D-04): ANON_READ_JWT_INFORM', 'no test JWT')

if (JWT.nonmember) {
  const r = await rpc('get_public_feed', feedArgs, JWT.nonmember)
  check('Connected non-member receives the SAME narrow projection as anon (D-48)', rpcState(r) === 'ok' && r.text === anonFeed?.text,
    rpcState(r) !== 'ok' ? stateDetail(r) : 'bytes differ from the anon response')
} else skip('viewer 3 (Connected non-member, D-48): ANON_READ_JWT_NONMEMBER', 'no test JWT')

if (JWT.member) {
  const r = await rpc('get_public_feed', feedArgs, JWT.member)
  const rows = rpcState(r) === 'ok' ? r.json : []
  check('Connected member receives non-NULL author_user_id on every row, and some avatar (D-48)',
    rows.length > 0 && rows.every((x) => x.author_user_id != null) && rows.some((x) => x.author_avatar_url != null),
    rpcState(r) !== 'ok' ? stateDetail(r) : `${rows.length} rows; user ids non-NULL on ${rows.filter((x) => x.author_user_id != null).length}`)
} else skip('viewer 4 (Connected member, D-48): ANON_READ_JWT_MEMBER', 'no test JWT')

if (JWT.friend && FRIEND_ID && FRIEND_NAME) {
  const r = await rpc('get_public_feed', feedArgs, JWT.friend)
  const rows = rpcState(r) === 'ok' ? r.json : []
  const theirs = rows.filter((x) => x.author_display_name === FRIEND_NAME)
  const others = rows.filter((x) => x.author_display_name !== FRIEND_NAME)
  check("D-49 in ONE response: the friend's rows carry author_user_id, every other author's are NULL",
    theirs.length > 0 && others.length > 0 && theirs.every((x) => x.author_user_id === FRIEND_ID) && others.every((x) => x.author_user_id == null),
    rpcState(r) !== 'ok' ? stateDetail(r) : `friend rows ${theirs.length}, other rows ${others.length} (need at least one of each in the same feed)`)
} else skip('viewer 5 (Connected friend, D-49): ANON_READ_JWT_FRIEND + ANON_READ_FRIEND_USER_ID + ANON_READ_FRIEND_DISPLAY_NAME', 'no test JWT / friend identity')

{
  const tokens = Object.entries(JWT).filter(([, t]) => t)
  const found = []
  for (const [who, t] of tokens) {
    const r = await rpc('get_public_feed', feedArgs, t)
    for (const f of keysIn(r.json)) if (FORBIDDEN_KEYS.includes(f)) found.push(`${who}: ${f}`)
  }
  if (tokens.length) check(`no authenticated response carries ${FORBIDDEN_KEYS.join(' / ')}`, found.length === 0, found.join('\n'))
}

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
