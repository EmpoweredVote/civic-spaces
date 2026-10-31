#!/usr/bin/env node
/**
 * check-write-access.mjs — the pure check for "may this viewer write here?".
 *
 * Run: npm run check:write-access        (no network, no credential, < 1s)
 *
 * 🔴 This imports the SHIPPED src/lib/writeAccess.ts, not a transcription of it.
 * `node --experimental-strip-types` erases the type annotations and runs the real
 * source. That matters more here than almost anywhere: the module exists so the
 * write gate is ONE function rather than an expression repeated at call sites, and
 * a check that re-implements it would be a second copy of the thing the module was
 * written to prevent. If you are tempted to paste a function in here, don't.
 *
 * What it covers (32 checks; numbers 1–18 and 19–32, with 19 used twice and 25 unused —
 * pre-existing, left unrenumbered; the count is the number of PASS lines the run prints):
 *
 *   1–11   whyNoWrite over every viewer × every slice on screen. 1 is the control
 *          case (a member writing in their own shard) and the only `null` among
 *          them; without it the other ten could all pass on a function that
 *          returns 'other-place' unconditionally.
 *   19     canWriteIn over that same table, asserting it is true EXACTLY where
 *          whyNoWrite returned null. Run as a loop so the two cannot drift.
 *   12–15  canReadConversationsIn. 13 is the Phase 16 sibling-shard read, which
 *          goes red on its own if that predicate is keyed on a slice id instead of
 *          placeKey — the regression that would otherwise ship silently.
 *   26–29  the public slice-type allowlist (PUBLIC_SLICE_TYPES) as a TypeScript list.
 *   30–32  the SAME allowlist as a literal inside get_public_slice in the 18-02 migration:
 *          30 it equals PUBLIC_SLICE_TYPES, 31 no other slice-type array in the file differs,
 *          32 the extractor throws rather than passing when the array is missing. Reads the
 *          SQL file, so adding a type to one side only is a red run.
 *   16–18  placeKey. 18 pins the one place it and compositionKey() deliberately
 *          differ: this key KEEPS the geoid for a placeless type, because it
 *          compares places and compositionKey chooses content.
 *
 * 🔴 Rows 4 and 5 differ by exactly one thing and that is the point. Both look at a
 * city with NO slice row — the common case, since rows are created on demand by
 * /assign and 15 exist in the whole product. The viewer in 4 holds a city slice
 * somewhere else, so this is somebody else's city; the viewer in 5 holds no city at
 * all (the unincorporated member — "city is null for unincorporated addresses; that
 * is an answer, not a failure"), so there is simply no slice here. An implementation
 * that collapses the two passes one of these rows and fails the other.
 *
 * A FAIL is a bug in the shipped module. There is nothing else here for it to be.
 */

import { readFileSync } from 'node:fs'
import {
  canReadConversationsIn,
  canWriteIn,
  isPublicSliceType,
  isSameJurisdiction,
  placeKey,
  PUBLIC_SLICE_TYPES,
  whyNoWrite,
} from '../src/lib/writeAccess.ts'

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

// ── The viewers ──────────────────────────────────────────────────────────────
// Named after the states in 17-SHARED.md so a failure reads as a sentence.

const CITY_A = '3702140' // Asheville, NC
const CITY_B = '1805860' // Bloomington, IN

const memberOfCityA = {
  label: 'member of city A, shard 1',
  ownedSliceIds: new Set(['slice-city-a-1']),
  ownedPlaceKeys: new Set([placeKey('city', CITY_A)]),
  isAuthenticated: true,
}

const unincorporatedMember = {
  label: 'member of county + state only (unincorporated — no city at all)',
  ownedSliceIds: new Set(['slice-county-37021', 'slice-state-37']),
  ownedPlaceKeys: new Set([placeKey('county', '37021'), placeKey('state', '37')]),
  isAuthenticated: true,
}

const memberOfFederal = {
  label: 'member of federal',
  ownedSliceIds: new Set(['slice-fed-1']),
  ownedPlaceKeys: new Set([placeKey('federal', 'US')]),
  isAuthenticated: true,
}

const signedOut = {
  label: 'signed out — no session at all',
  ownedSliceIds: new Set(),
  ownedPlaceKeys: new Set(),
  isAuthenticated: false,
}

/**
 * 🔴 Signed out while the caller still holds the last member's sets.
 *
 * Not a hypothetical: the shell keeps slices in React state and useAuth flips
 * isAuthenticated from an effect, so there is a render between a logout and the
 * sets emptying — and after a cross-tab logout there may be several. Without this
 * viewer, assertions 7 and 15 cannot fail: a signed-out viewer holding nothing is
 * refused by the membership tests anyway, so they would pass a module with no
 * session check in it at all. That is a vacuous pass, and this is the fix for it.
 */
const signedOutStaleSets = {
  label: 'signed out, caller still holding the last member\'s sets',
  ownedSliceIds: new Set(['slice-city-a-1']),
  ownedPlaceKeys: new Set([placeKey('city', CITY_A)]),
  isAuthenticated: false,
}

/**
 * 🔴 An Inform account, which D-04 says must receive exactly what a guest receives.
 * isAuthenticated is TRUE — it is technically a real account — and both sets are
 * empty, because an Inform account holds no slice_members rows. Nothing in
 * writeAccess.ts knows the word "inform"; that is what this viewer tests.
 */
const informAccount = {
  label: 'Inform tier — authenticated, holds nothing',
  ownedSliceIds: new Set(),
  ownedPlaceKeys: new Set(),
  isAuthenticated: true,
}

// ── The slices on screen ─────────────────────────────────────────────────────

const cityAShard1 = { id: 'slice-city-a-1', sliceType: 'city', geoid: CITY_A }
const cityAShard2 = { id: 'slice-city-a-2', sliceType: 'city', geoid: CITY_A }
const cityANoRow = { id: null, sliceType: 'city', geoid: CITY_A }
const cityBRow = { id: 'slice-city-b-1', sliceType: 'city', geoid: CITY_B }
const cityBNoRow = { id: null, sliceType: 'city', geoid: CITY_B }
const federalOwn = { id: 'slice-fed-1', sliceType: 'federal', geoid: 'US' }
const federalSibling = { id: 'slice-fed-2', sliceType: 'federal', geoid: 'US' }

const ctx = (viewer, viewed) => ({
  viewed,
  ownedSliceIds: viewer.ownedSliceIds,
  ownedPlaceKeys: viewer.ownedPlaceKeys,
  isAuthenticated: viewer.isAuthenticated,
})

const show = (viewed) => (viewed === null ? 'nothing on screen' : `${viewed.sliceType}|${viewed.geoid} id=${viewed.id}`)

// ── 1–11: whyNoWrite ─────────────────────────────────────────────────────────

const TABLE = [
  [1, memberOfCityA, cityAShard1, null, 'THE CONTROL CASE — a member writing in their own shard'],
  [2, memberOfCityA, cityAShard2, 'sibling-shard', 'same jurisdiction, different shard — the Phase 16 state'],
  [3, memberOfCityA, cityBRow, 'other-place', 'another city that DOES have a slice row'],
  [4, memberOfCityA, cityBNoRow, 'other-place', 'another city with no row — holds a city elsewhere'],
  [5, unincorporatedMember, cityANoRow, 'no-slice', 'no city row and holds no city anywhere'],
  [6, signedOut, null, 'signed-out', 'nothing on screen'],
  [7, signedOut, cityAShard1, 'signed-out', 'a real row they do not hold'],
  [8, informAccount, cityAShard1, 'other-place', 'D-04 BY CONSTRUCTION — no tier term produced this'],
  [10, memberOfFederal, federalOwn, null, 'a placeless type, their own row'],
  [11, memberOfFederal, federalSibling, 'sibling-shard', 'a placeless type, a different row at the same geoid'],
]

for (const [n, viewer, viewed, expected, note] of TABLE) {
  // 7 runs twice: once for a viewer holding nothing, once for one whose caller is
  // still holding the last member's sets. Only the second can tell a module that
  // checks the session from one that merely runs out of memberships to match.
  const viewers = n === 7 ? [viewer, signedOutStaleSets] : [viewer]
  const got = []
  let ok = true
  for (const v of viewers) {
    try {
      const actual = whyNoWrite(ctx(v, viewed))
      got.push(`${v.label} → ${actual === null ? 'null' : `'${actual}'`}`)
      if (actual !== expected) ok = false
    } catch (e) {
      got.push(`${v.label} → THREW ${e}`)
      ok = false
    }
  }
  check(
    n,
    `${viewer.label} → ${show(viewed)} → ${expected === null ? 'MAY WRITE' : `'${expected}'`}  (${note})`,
    ok,
    `${got.join('\n          ')}\n          expected ${expected === null ? 'null' : `'${expected}'`}`,
  )
}

// 9 — a null `viewed`, for EVERY viewer: never null, never throws.
{
  const viewers = [memberOfCityA, unincorporatedMember, memberOfFederal, signedOut, signedOutStaleSets, informAccount]
  const results = []
  let ok = true
  for (const viewer of viewers) {
    try {
      const r = whyNoWrite(ctx(viewer, null))
      results.push(`${viewer.label} → ${r === null ? 'null' : `'${r}'`}`)
      if (r === null) ok = false
    } catch (e) {
      results.push(`${viewer.label} → THREW ${e}`)
      ok = false
    }
  }
  check(
    9,
    'viewed: null, for every viewer → always a reason, never null, never throws',
    ok,
    `${results.join('\n          ')}\n          A null here means the gate FAILS OPEN with nothing on screen — the exact\n          shape of the AppShell:840 expression this module replaces.`,
  )
}

// ── 19: canWriteIn is DERIVED, over the whole table ──────────────────────────
{
  const viewers = [memberOfCityA, unincorporatedMember, memberOfFederal, signedOut, signedOutStaleSets, informAccount]
  const screens = [cityAShard1, cityAShard2, cityANoRow, cityBRow, cityBNoRow, federalOwn, federalSibling, null]
  const drifted = []
  for (const viewer of viewers) {
    for (const viewed of screens) {
      const c = ctx(viewer, viewed)
      const reason = whyNoWrite(c)
      const may = canWriteIn(c)
      if (may !== (reason === null)) {
        drifted.push(`${viewer.label} → ${show(viewed)}: whyNoWrite=${reason}, canWriteIn=${may}`)
      }
    }
  }
  check(
    19,
    `canWriteIn is true EXACTLY where whyNoWrite is null, across all ${viewers.length * screens.length} combinations`,
    drifted.length === 0,
    `${drifted.join('\n          ')}\n          The two must not be written in parallel; canWriteIn derives from whyNoWrite.`,
  )
}

// ── 12–15: canReadConversationsIn ────────────────────────────────────────────

const READ_TABLE = [
  [12, memberOfCityA, cityAShard1, true, 'their own shard'],
  [13, memberOfCityA, cityAShard2, true, '🔴 the sibling shard — Phase 16 behaviour that must not regress'],
  [14, memberOfCityA, cityBRow, false, 'another place — false until Phase 18'],
  [15, signedOut, cityAShard1, false, 'a visitor reads zero forum rows today'],
]

for (const [n, viewer, viewed, expected, note] of READ_TABLE) {
  // 15, like 7, also runs against the stale-sets visitor — otherwise it passes a
  // module with no session check in it, because an empty set refuses on its own.
  const viewers = n === 15 ? [viewer, signedOutStaleSets] : [viewer]
  const got = viewers.map((v) => `${v.label} → ${canReadConversationsIn(ctx(v, viewed))}`)
  const actual = viewers.every((v) => canReadConversationsIn(ctx(v, viewed)) === expected)
    ? expected
    : !expected
  check(
    n,
    `canReadConversationsIn: ${viewer.label} → ${show(viewed)} → ${expected}  (${note})`,
    actual === expected,
    n === 13
      ? `got ${actual}. If this is the only red, the read predicate is keyed on viewed.id instead\n          of placeKey(): posts_select_sibling_slice joins on (slice_type, geoid), so every shard\n          of a jurisdiction the viewer belongs to is readable and this would hide them.`
      : `${got.join('\n          ')}\n          expected ${expected}`,
  )
}

// ── 16–18: placeKey ──────────────────────────────────────────────────────────

check(
  16,
  'placeKey distinguishes two cities of the same level',
  placeKey('city', CITY_A) !== placeKey('city', CITY_B),
  `${placeKey('city', CITY_A)} vs ${placeKey('city', CITY_B)}`,
)

check(
  17,
  'placeKey: a null geoid is not the nation',
  placeKey('federal', 'US') !== placeKey('federal', null),
  `${placeKey('federal', 'US')} vs ${placeKey('federal', null)}`,
)

check(
  18,
  'placeKey KEEPS the geoid for a placeless type — where it and compositionKey deliberately differ',
  placeKey('federal', 'US') === 'federal|US' &&
    placeKey('federal', 'US') !== 'federal' &&
    placeKey('federal', 'US') !== placeKey('federal', '3711'),
  `got '${placeKey('federal', 'US')}'. compositionKey() collapses federal/unified/volunteer to the\n` +
    `          slice type alone, which is right for choosing Explore content and wrong for comparing\n` +
    `          places: the dev fixture gives federal the geoid '3711' and production 'US', and a key\n` +
    `          that erased that would call them the same place. Two keys, two jobs — do not merge them.`,
)

// ── isSameJurisdiction: which rows a visited place shows as the viewer's own ──
//
// 🔴 These exist because the BROWSER CHECKS CANNOT REACH THE FEDERAL CASE.
// `devMockData.ts` gives the dev id `federal.geoid = '3711'` on purpose, to keep
// compositionKey's normalisation honest, so no Playwright run can exercise the
// production shape where a member's federal row and every visited place's
// federal level are both ('federal', 'US'). 19–24 are that shape.

check(
  19,
  'isSameJurisdiction: the same level and the same geoid IS the viewer\'s own row',
  isSameJurisdiction({ sliceType: 'county', geoid: '37021' }, 'county', '37021'),
  'a member of Buncombe County looking at Buncombe County is looking at their own county',
)

check(
  20,
  'isSameJurisdiction: the same level, a DIFFERENT geoid, is not',
  !isSameJurisdiction({ sliceType: 'city', geoid: CITY_A }, 'city', CITY_B),
  `${CITY_A} vs ${CITY_B} — every member holds SOME city, which is why sliceType alone cannot decide this`,
)

check(
  21,
  'isSameJurisdiction: the same geoid at a DIFFERENT level is not',
  !isSameJurisdiction({ sliceType: 'county', geoid: '37' }, 'state', '37'),
  'geoids are only unique within a level, so the level is half the comparison',
)

check(
  22,
  'isSameJurisdiction: no row at this level is never a match',
  !isSameJurisdiction(undefined, 'city', CITY_A) && !isSameJurisdiction(null, 'city', CITY_A),
  'an unincorporated member has no city row at all; absence must not read as a match',
)

check(
  23,
  '🔴 PRODUCTION FEDERAL: the national space IS the viewer\'s own on every visit',
  isSameJurisdiction({ sliceType: 'federal', geoid: 'US' }, 'federal', 'US') &&
    isSameJurisdiction({ sliceType: 'unified', geoid: 'UNIFIED' }, 'unified', 'UNIFIED'),
  `In production a member's federal row is ('federal','US') and EVERY visited place's federal\n` +
    `          level is ('federal','US') too. There is one national space, so it is theirs wherever\n` +
    `          they are looking — and before this it rendered "You're exploring Slice — read-only"\n` +
    `          on the Federal tab of every single visit. No browser check can see this: the dev\n` +
    `          fixture's federal geoid is '3711' by design (see assertion 18).`,
)

check(
  24,
  'isSameJurisdiction is NOT placeKey membership — they differ exactly where the bug lived',
  isSameJurisdiction({ sliceType: 'county', geoid: '37021' }, 'county', '37021') &&
    placeKey('county', '37021') === placeKey('county', '37021'),
  `ownedPlaceKeys answers "does the viewer hold this jurisdiction at all", which is TRUE for a\n` +
    `          different shard of the same place — the sibling-shard question. This asks whether THIS\n` +
    `          row is the one to render. Collapsing them re-introduces the bug, so they stay apart.`,
)

// ── 26–29: the public slice-type allowlist ───────────────────────────────────
//
// 🔴 D-28: new private space types are landing in slices.slice_type, so public is an
// ALLOWLIST. 29 is the demonstration: a type the DB constraint accepts and this list
// has never heard of stays private, with no database fixture needed to show it.

check(
  26,
  'the five public types are exactly city, county, state, federal, unified',
  [...PUBLIC_SLICE_TYPES].sort().join(',') === 'city,county,federal,state,unified',
  `got ${[...PUBLIC_SLICE_TYPES].sort().join(',')}`,
)

check(27, 'volunteer is not public', !isPublicSliceType('volunteer'))

check(28, 'an unknown type is not public', !isPublicSliceType('neighborhood'))

check(
  29,
  'a type added to the DB constraint but not to this list stays private',
  !isPublicSliceType('school-board'),
  'a denylist would publish this the day it is created; this must stay an allowlist',
)

// ── 30–32: the SQL allowlist cannot drift from PUBLIC_SLICE_TYPES ────────────
//
// 🔴 The same five types are a literal array inside get_public_slice, in the 18-02
// migration. They are written twice because they have to be — one is the database's
// gate, one is the client's — and a comment saying "keep them equal" is not a guard.
// For a security allowlist across two languages that is exactly the shape that
// silently publishes a private space type. So this READS the migration and compares.
//
// It fails LOUDLY rather than passing quietly: if the function, or its array, cannot be
// found (a rename, a reformat, the file moved) that is a FAIL with the reason, never a
// vacuous pass. 32 pins that behaviour on text with no array in it.


const PUBLIC_READ_SQL = new URL(
  '../supabase/migrations/20261030000100_public_read.sql',
  import.meta.url,
)

/** SQL with `--` line comments removed, so a documented array cannot be mistaken for code. */
function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '')
}

/** Every ARRAY['a', 'b', ...] literal made only of quoted strings, as arrays of strings. */
function stringArrayLiterals(sql) {
  const out = []
  for (const m of sql.matchAll(/ARRAY\s*\[\s*((?:'[^']*'\s*,?\s*)+)\]/gi)) {
    out.push([...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]))
  }
  return out
}

/** The allowlist literal inside get_public_slice. Throws, with a reason, if it cannot be found. */
function allowlistFromFunctionBody(sql) {
  const code = stripSqlComments(sql)
  const start = code.search(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+civic_spaces\.get_public_slice\s*\(/i)
  if (start < 0) throw new Error('get_public_slice is not defined in the migration')
  const rest = code.slice(start)
  const next = rest.slice(1).search(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i)
  const body = next < 0 ? rest : rest.slice(0, next + 1)
  const arrays = stringArrayLiterals(body)
  if (arrays.length !== 1) {
    throw new Error(`expected exactly one string-array literal in get_public_slice, found ${arrays.length}`)
  }
  return arrays[0]
}

const sameSet = (a, b) => [...a].sort().join(',') === [...b].sort().join(',')

{
  const sql = readFileSync(PUBLIC_READ_SQL, 'utf8')
  let sqlList = null
  let reason = ''
  try {
    sqlList = allowlistFromFunctionBody(sql)
  } catch (e) {
    reason = e.message
  }
  check(
    30,
    'get_public_slice allowlist in SQL equals PUBLIC_SLICE_TYPES',
    sqlList !== null && sameSet(sqlList, PUBLIC_SLICE_TYPES),
    sqlList === null
      ? `could not extract the SQL allowlist: ${reason}`
      : `SQL has [${sqlList.join(', ')}], writeAccess.ts has [${[...PUBLIC_SLICE_TYPES].join(', ')}]`,
  )

  // Any OTHER literal in the file that lists slice types is a second copy of the rule.
  const known = new Set([...PUBLIC_SLICE_TYPES, 'volunteer'])
  const copies = stringArrayLiterals(stripSqlComments(sql)).filter((arr) => arr.some((t) => known.has(t)))
  check(
    31,
    'every slice-type array literal in the migration equals PUBLIC_SLICE_TYPES (and there is at least one)',
    copies.length >= 1 && copies.every((arr) => sameSet(arr, PUBLIC_SLICE_TYPES)),
    `found ${copies.length} slice-type literal(s): ${JSON.stringify(copies)}`,
  )
}

{
  let threw = false
  try {
    allowlistFromFunctionBody('CREATE OR REPLACE FUNCTION civic_spaces.get_public_slice(a text) AS $$ SELECT 1 $$;')
  } catch {
    threw = true
  }
  check(32, 'the extractor throws, rather than returning nothing, when the array is missing', threw)
}

// ── Result ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} PASS, ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
