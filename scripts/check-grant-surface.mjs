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
 *   CATALOG (1-4)  psql against SUPABASE_DB_URL, diffed against
 *                  scripts/fixtures/grant-surface.json.
 *     1  every public view is either ours or a known foreign one. An UNKNOWN view
 *        FAILS: this is an allowlist, never a denylist, because a view added tomorrow
 *        inherits anon's defaults and this guard exists to catch exactly that.
 *     2  anon holds no privilege on any view we own. Reads the LIVE catalog — the
 *        fixture's own grants.anon is the pre-migration record, and comparing it to
 *        itself would be permanently green.
 *     3  security_invoker is on for every view we own. Off silently bypasses RLS.
 *     4  no view we own has gained or lost a column against the fixture.
 *
 *   HTTP (5)       anon GET /rest/v1/<view>?select=*&limit=1 for each of the twelve.
 *                  The only failure is a response that contains a ROW. 401, 403, 404 and
 *                  200-with-[] all pass; a specific status is not asserted, because
 *                  revoking the grant may change why a request is refused without
 *                  changing the outcome, and a guard that goes red the day the fix lands
 *                  gets switched off. This is the half that reflects PostgREST's cache.
 *
 * What it cannot prove without SUPABASE_DB_URL: everything in the catalog half. Without
 * it the guard still runs the HTTP half, then prints SKIP and exits NON-ZERO — a vacuous
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
 * Exit codes: 0 clean, 1 an assertion failed, 2 the catalog half could not run.
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
const CATALOG_SQL = `
SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.view_name), '[]'::json) FROM (
SELECT c.relname AS view_name,
       pg_get_userbyid(c.relowner) AS owner,
       COALESCE((SELECT option_value FROM pg_options_to_table(c.reloptions)
                 WHERE option_name = 'security_invoker'), 'off') AS security_invoker,
       (SELECT array_agg(a.attname ORDER BY a.attnum)
          FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
       (SELECT array_agg(DISTINCT tp.privilege_type ORDER BY tp.privilege_type)
          FROM information_schema.table_privileges tp
         WHERE tp.table_schema = 'public' AND tp.table_name = c.relname AND tp.grantee = 'anon') AS anon_privs,
       (SELECT array_agg(DISTINCT tp.privilege_type ORDER BY tp.privilege_type)
          FROM information_schema.table_privileges tp
         WHERE tp.table_schema = 'public' AND tp.table_name = c.relname AND tp.grantee = 'authenticated') AS auth_privs
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

// ── 1-4: the catalog ─────────────────────────────────────────────────────────

let skipReason = null
const dbUrl = process.env.SUPABASE_DB_URL
let live = null
if (!dbUrl) {
  skipReason = 'SUPABASE_DB_URL is unset; the catalog half (1-4) cannot run.'
} else {
  try {
    live = parseCatalog(fetchCatalogText(dbUrl))
  } catch (e) {
    // Never echo e.message: psql errors can quote the connection string.
    skipReason = `the catalog query failed (${e.code === 'ENOENT' ? 'psql not found on PATH' : 'psql or its output was unusable'}).`
  }
  if (live && Object.keys(live).length === 0) {
    skipReason = 'the catalog query returned zero views.'
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

  const invokerOff = ours.filter((n) => live[n]?.securityInvoker !== true)
  check(3, 'security_invoker is on for every view this app owns', invokerOff.length === 0,
    `off or missing: ${invokerOff.join(', ')}`)

  const drifted = ours.filter((n) => JSON.stringify(live[n]?.columns) !== JSON.stringify(fixture.views[n].columns))
  check(4, 'no view this app owns has gained or lost a column', drifted.length === 0,
    drifted.map((n) => `${n}: live [${(live[n]?.columns ?? ['<absent>']).join(',')}] vs baseline [${fixture.views[n].columns.join(',')}]`).join('\n          '))
}

// ── 5: the HTTP half — runs with or without the catalog ──────────────────────

const { url, key } = httpCreds()
if (!url || !key) {
  check(5, 'anon receives no row from any view this app owns (HTTP)', false,
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found in the environment or .env.local')
} else {
  const rowsSeen = []
  for (const name of ours) {
    let status
    let hasRow
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${name}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      status = res.status
      let parsed
      try { parsed = JSON.parse(await res.text()) } catch { parsed = undefined }
      hasRow = res.ok && Array.isArray(parsed) && parsed.length > 0
    } catch {
      status = 'network error'
      hasRow = true // cannot show it is safe, so it is not a pass
    }
    console.log(`      ${hasRow ? '!!' : 'ok'} ${name} -> HTTP ${status}`)
    if (hasRow) rowsSeen.push(`${name} (${status})`)
  }
  check(5, `anon receives no row from any of the ${ours.length} views this app owns (HTTP)`, rowsSeen.length === 0,
    `a row came back, or the request could not be made: ${rowsSeen.join(', ')}`)
}

// ── Result ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} PASS, ${failed} FAIL`)
if (skipReason) {
  console.log(`SKIP — no reachable project; this guard proves nothing\n          ${skipReason}`)
  process.exit(2)
}
process.exit(failed === 0 ? 0 : 1)
