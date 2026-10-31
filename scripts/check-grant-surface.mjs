#!/usr/bin/env node
/**
 * check-grant-surface.mjs — does the `public` schema still expose only what we meant?
 *
 * Run: SUPABASE_DB_URL=postgres://... npm run check:grants
 *
 * 🔴 The migrations are not the grant surface, the catalog is. Twelve views in `public`
 * belong to this app and `anon` holds all seven privileges on every one of them — not
 * from any GRANT in this repo, but from Supabase's default privileges, which hand anon
 * everything on anything created in `public`. A repo that never says GRANT can still
 * have a wide-open surface, and nothing in git will ever show it. Read the catalog.
 *
 * Two halves, deliberately not redundant:
 *
 *   CATALOG (1-5)  psql against SUPABASE_DB_URL, diffed against
 *                  scripts/fixtures/grant-surface.json. Grants are read with
 *                  has_table_privilege() for all seven privileges, because
 *                  information_schema.table_privileges goes silently blank for a
 *                  pooler / non-owner role and a blank reads as "anon holds nothing".
 *     1  every public view is either ours or a known foreign one. An UNKNOWN view
 *        FAILS: this is an allowlist, never a denylist, because a view added tomorrow
 *        inherits anon's defaults and this guard exists to catch exactly that.
 *     2  anon holds no privilege on any view we own. Reads the LIVE catalog — the
 *        fixture's own grants.anon is the pre-migration record, and comparing it to
 *        itself would be permanently green.
 *     3  CONTROL: authenticated still holds SELECT on every view we own. This is what
 *        makes a blind catalog read fail loudly instead of letting 2 pass vacuously,
 *        and it catches an over-revoke that would break the app for every member.
 *     4  security_invoker is on for every view we own. Off silently bypasses RLS.
 *     5  no view we own has gained or lost a column against the fixture.
 *
 *   HTTP (6)       anon GET /rest/v1/<view>?select=*&limit=1 for each of the twelve.
 *                  Fails on a ROW. Passes on 200-with-[], 404, or a 401/403 whose body
 *                  carries SQLSTATE 42501 (insufficient_privilege) — so a dead, rotated
 *                  or malformed key (also 401, but PGRST301 / Invalid API key) cannot
 *                  read as success. No specific status is demanded beyond that: a REVOKE
 *                  may move the refusal from the table to the view without changing 42501,
 *                  and a guard that goes red the day the fix lands gets switched off.
 *                  This is the half that reflects PostgREST's schema cache.
 *
 * What it cannot prove without SUPABASE_DB_URL: everything in the catalog half. Without
 * it the guard still runs the HTTP half, lists the catalog half as NOT RUN, and exits 2 — a vacuous
 * pass is the failure this refuses to commit. The HTTP half alone cannot see a grant:
 * today anon holds the grant but no RLS policy and no `civic_spaces` USAGE, so rows do
 * not come back anyway. A service-role key cannot stand in: PostgREST executes no
 * arbitrary SQL and does not expose pg_catalog.
 *
 * Needs `psql` on PATH. No npm dependency, on purpose.
 *
 * Credentials for the HTTP half (the publishable key, never a secret): VITE_SUPABASE_URL
 * and VITE_SUPABASE_ANON_KEY from the environment, else from .env.local.
 *
 * Exit codes: 0 clean; 1 any assertion failed (even when the catalog half could not run —
 * a live exposure never reports as merely incomplete); 2 clean but INCOMPLETE.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/grant-surface.json'), 'utf8'))

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function check(n, label, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`PASS ${String(n).padStart(2)}  ${label}`)
  } else {
    failed += 1
    console.log(`FAIL ${String(n).padStart(2)}  ${label}${detail === undefined ? '' : `\n          ${detail}`}`)
  }
}

// ── Catalog: the query, the fetch, the parse — three separate things ─────────

// The Task 1 baseline query, wrapped so psql returns ONE json document. That avoids
// parsing Postgres array literals out of text output, which is ambiguous.
//
// 🔴 Grants come from has_table_privilege(), NOT information_schema.table_privileges.
// The latter only shows a grant when the connecting role is a member of the grantee or
// the grantor; through a pooler or a read-only/non-owner role it returns nothing, and
// "nothing" would read as "anon holds nothing" — a green light on a wide-open surface.
// has_table_privilege() answers for any caller. Assertion 3 (authenticated still holds
// SELECT) is the control that makes a blind read fail loudly anyway.
const CATALOG_SQL = `
SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.view_name), '[]'::json) FROM (
SELECT c.relname AS view_name,
       pg_get_userbyid(c.relowner) AS owner,
       COALESCE((SELECT option_value FROM pg_options_to_table(c.reloptions)
                 WHERE option_name = 'security_invoker'), 'off') AS security_invoker,
       (SELECT array_agg(a.attname ORDER BY a.attnum)
          FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
       (SELECT COALESCE(array_agg(p ORDER BY p), ARRAY[]::text[])
          FROM unnest(ARRAY['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']) p
         WHERE has_table_privilege('anon', c.oid, p)) AS anon_privs,
       (SELECT COALESCE(array_agg(p ORDER BY p), ARRAY[]::text[])
          FROM unnest(ARRAY['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']) p
         WHERE has_table_privilege('authenticated', c.oid, p)) AS auth_privs
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
) t;`

/** Execution only. Returns psql's stdout; throws if psql is missing or the query fails. */
function fetchCatalogText(dbUrl) {
  return execFileSync('psql', [dbUrl, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', CATALOG_SQL], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  })
}

/**
 * Parsing only — no I/O. psql text -> { name: { owner, securityInvoker, columns, anon } }.
 * A NULL array (no grants at all) becomes [] — that is "holds nothing", not "unknown".
 * security_invoker is stored as the string 'on' / 'true'; anything else is off.
 */
function parseCatalog(text) {
  const rows = JSON.parse(text.trim())
  const live = {}
  for (const r of rows) {
    live[r.view_name] = {
      owner: r.owner,
      securityInvoker: r.security_invoker === 'on' || r.security_invoker === 'true',
      columns: r.columns ?? [],
      anon: r.anon_privs ?? [],
      authenticated: r.auth_privs ?? [],
    }
  }
  return live
}

// ── HTTP credentials ─────────────────────────────────────────────────────────

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

function httpCreds() {
  let url = process.env.VITE_SUPABASE_URL
  let key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    const f = readEnvLocal() // only read when the environment does not already answer
    url = url || f.VITE_SUPABASE_URL
    key = key || f.VITE_SUPABASE_ANON_KEY
  }
  return { url, key }
}

const ours = fixture.ownedByUs
const known = new Set([...ours, ...fixture.foreign])

// ── 1-5: the catalog ─────────────────────────────────────────────────────────

const CATALOG_ASSERTIONS = 5
let skipReason = null
const dbUrl = process.env.SUPABASE_DB_URL
let live = null
if (!dbUrl) {
  skipReason = 'SUPABASE_DB_URL is unset'
} else {
  try {
    live = parseCatalog(fetchCatalogText(dbUrl))
  } catch (e) {
    // Never echo e.message: psql errors can quote the connection string.
    if (e.code === 'ENOENT') skipReason = 'psql is not on PATH'
    else if (e instanceof SyntaxError) skipReason = 'psql ran but its output was not the expected JSON'
    else skipReason = 'psql could not connect or the catalog query failed'
  }
  if (live && Object.keys(live).length === 0) {
    skipReason = 'the catalog query returned zero views'
    live = null
  }
}

if (live) {
  const unknown = Object.keys(live).filter((n) => !known.has(n))
  check(1, 'every public view is either ours or a known foreign one', unknown.length === 0,
    `unrecognised: ${unknown.join(', ')}\n          A new view in public inherits anon's default privileges. Classify it in the fixture\n          (ownedByUs or foreign) only after deciding what anon may do with it.`)

  const exposed = ours.filter((n) => (live[n]?.anon ?? []).length > 0)
  const missing = ours.filter((n) => !live[n])
  check(2, 'anon holds no privilege on any view this app owns', exposed.length === 0 && missing.length === 0,
    [
      ...exposed.map((n) => `${n}: anon holds ${live[n].anon.join(', ')}`),
      ...missing.map((n) => `${n}: not in the live catalog`),
    ].join('\n          '))

  // THE CONTROL CASE, like check-write-access.mjs assertion 1. Without it, assertion 2
  // could pass because the connecting role cannot see grants at all. `authenticated`
  // must still SELECT every view, or the app is broken for every member; a read that
  // reports false for everyone fails HERE, loudly, instead of passing 2 silently.
  const lostSelect = ours.filter((n) => !(live[n]?.authenticated ?? []).includes('SELECT'))
  check(3, 'CONTROL: authenticated still holds SELECT on every view this app owns', lostSelect.length === 0,
    `authenticated lacks SELECT on: ${lostSelect.join(', ')}\n          Either the catalog read is blind (wrong role / pooler — assertion 2 above proves nothing)\n          or a revoke went too far and the app is broken for every member.`)

  const invokerOff = ours.filter((n) => live[n]?.securityInvoker !== true)
  check(4, 'security_invoker is on for every view this app owns', invokerOff.length === 0,
    `off or missing: ${invokerOff.join(', ')}`)

  const drifted = ours.filter((n) => JSON.stringify(live[n]?.columns) !== JSON.stringify(fixture.views[n].columns))
  check(5, 'no view this app owns has gained or lost a column', drifted.length === 0,
    drifted.map((n) => `${n}: live [${(live[n]?.columns ?? ['<absent>']).join(',')}] vs baseline [${fixture.views[n].columns.join(',')}]`).join('\n          '))
} else {
  console.log(`SKIP   1-${CATALOG_ASSERTIONS}  catalog half NOT RUN (${skipReason})`)
}

// ── 6: the HTTP half — runs with or without the catalog ──────────────────────

/**
 * Pure verdict on one response. Pass = no row AND the refusal is the right KIND.
 * 401/403 must carry SQLSTATE 42501 (insufficient_privilege); a dead, rotated or
 * malformed key also answers 401 (PGRST301 / "Invalid API key") and must NOT read as
 * success — Supabase disabled the legacy keys on 2026-09-09 and that looked exactly
 * like this. 42501 does not change when a REVOKE moves the refusal from the underlying
 * table to the view. 404 (PGRST205) and 200-with-[] also pass; no other status does.
 */
function judge(status, body) {
  let parsed
  try { parsed = JSON.parse(body) } catch { parsed = undefined }
  if (status === 200) {
    if (Array.isArray(parsed) && parsed.length === 0) return { ok: true, why: 'empty array' }
    return { ok: false, why: 'a ROW (or an unreadable body) came back' }
  }
  if (status === 401 || status === 403) {
    return parsed?.code === '42501'
      ? { ok: true, why: 'privilege refusal 42501' }
      : { ok: false, why: `refused, but not as a privilege refusal (code ${parsed?.code ?? 'none'}) — dead key?` }
  }
  if (status === 404) return { ok: true, why: 'not exposed' }
  return { ok: false, why: 'unexpected status' }
}

const { url, key } = httpCreds()
if (!url || !key) {
  check(6, 'anon is refused every view this app owns (HTTP)', false,
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found in the environment or .env.local')
} else {
  const bad = []
  for (const name of ours) {
    let v
    let status
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${name}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      status = res.status
      v = judge(status, await res.text())
    } catch {
      status = 'network error'
      v = { ok: false, why: 'request could not be made' } // cannot show it is safe
    }
    console.log(`      ${v.ok ? 'ok' : '!!'} ${name} -> HTTP ${status} (${v.why})`)
    if (!v.ok) bad.push(`${name} (${status}: ${v.why})`)
  }
  check(6, `anon is refused, with no row, by all ${ours.length} views this app owns (HTTP)`, bad.length === 0,
    bad.join('\n          '))
}

// ── Result ───────────────────────────────────────────────────────────────────
// A failure is a failure: exit 1 even when the catalog half could not run. Exit 2 is
// reserved for a run that found nothing wrong but did not look everywhere.

if (skipReason) {
  console.log(`\n${passed} PASS, ${failed} FAIL, ${CATALOG_ASSERTIONS} NOT RUN — INCOMPLETE: this is not a clean result`)
  console.log(`SKIP — no reachable project; this guard proves nothing\n          reason: ${skipReason}`)
  process.exit(failed > 0 ? 1 : 2)
}
console.log(`\n${passed} PASS, ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
