#!/usr/bin/env node
/**
 * check-place-resolve.mjs — the pure check for turning a typed place into geoids.
 *
 * Run: npm run check:place-resolve                   (no network, no credential, < 1s)
 *      node scripts/check-place-resolve.mjs --live   (network, opt-in, contract drift)
 *
 * 🔴 This imports the SHIPPED src/lib/placeResolve.ts and src/lib/viewedPlace.ts, not
 * transcriptions of them. `node --experimental-strip-types` erases the type annotations
 * and runs the real source. A check that re-implements the functions it checks passes
 * while the shipped code is wrong — which is the failure class this phase was told to
 * expect. If you are tempted to paste a function in here, don't; make it importable.
 *
 * What it covers (42 assertions):
 *
 *   1–7    normalisePlaceQuery — ASVS V5 at the edge. Trim, collapse, cap, reject
 *          control characters, and the two boundaries (three characters in, 120 out).
 *   8–15   searchRowKind. 10 is the one that matters most: a SEVEN-DIGIT school
 *          district (G5420) must be unusable. 17-03-PLAN.md specified branching on
 *          geoid length alone, and live data disproves it — see below.
 *   16–20  stateFromGeoid, including the two sentinels that are not places.
 *   21–25  placeFromSearchRow and withCounty — which rows need the centroid leg, and
 *          the refusal when the two legs disagree about the state.
 *   26–29  THE REAL ROWS, from committed fixtures captured live 2026-10-26. 21–25 use
 *          synthetic input, which proves the functions behave but not that they behave
 *          on what the API actually sends.
 *   30–33  countyFromCoordinateLookup, over the real trimmed body.
 *   34–36  placeFromResolveResponse, including a body carrying matchedAddress.
 *   37–38  🔴 D-13, STRUCTURALLY. Object.keys of a result is exactly the five geoid
 *          fields. A name/label/address/matchedAddress key appearing is a FAIL. This is
 *          a key-set assertion rather than a behavioural one precisely so that adding a
 *          name field cannot pass by being "unused".
 *   39–42  viewedPlace — the round trip, the corrupt entry, and that nothing the
 *          visitor typed is anywhere in what gets stored.
 *
 * 🔴 Why searchRowKind reads the MTFCC as well as the geoid's length.
 * The plan said length only, so that this repo would not have to keep an MTFCC list in
 * agreement with ev-accounts. The reasoning is sound; the rule is wrong, because a
 * school district geoid is ALSO seven digits (state FIPS + a five-digit district code).
 * `location-search?q=portland` returns "Portland Public Schools, OR" (4110040, G5420)
 * beside the two real Portlands, and 23 of 118 rows across sixteen sample queries were
 * G5420 at seven digits. Length alone would have offered a school district as a CITY.
 * The two failure modes are not symmetric: an unknown MTFCC makes a row unselectable,
 * which is survivable; length alone makes a wrong row selectable as the wrong level,
 * which is the failure this repo has already been burned by. Assertion 10 and the
 * Portland fixture exist so that rule cannot be quietly relaxed back.
 *
 * A FAIL is a bug in the shipped modules. There is nothing else here for it to be.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  countyFromCoordinateLookup,
  normalisePlaceQuery,
  placeFromResolveResponse,
  placeFromSearchRow,
  searchRowKind,
  stateFromGeoid,
  usablePlaceRows,
  withCounty,
} from '../src/lib/placeResolve.ts'

// ── A sessionStorage the shipped module can actually use ─────────────────────
// viewedPlace.ts reads `window.sessionStorage` inside its functions and guards every
// access, so in bare Node every call would simply no-op and the round trip would be
// vacuously "fine". Standing one up means 39–42 exercise the real read/write path.
// Set before any of those functions is CALLED, which is all that is required — the
// static imports above have already been evaluated by now.

function makeStorageStub() {
  const map = new Map()
  const log = { removed: [] }
  return {
    log,
    store: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => void map.set(k, String(v)),
      removeItem: (k) => {
        log.removed.push(k)
        map.delete(k)
      },
      raw: () => map,
    },
  }
}

const stub = makeStorageStub()
globalThis.window = { sessionStorage: stub.store }

const { readViewedPlace, writeViewedPlace, VIEWED_PLACE_STORAGE_KEY } = await import(
  '../src/lib/viewedPlace.ts'
)

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

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── Fixtures ─────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', name), 'utf8'))

const ASHEVILLE = fixture('place-search-asheville.json').rows
const PORTLAND = fixture('place-search-portland.json').rows
const NO_RESULTS = fixture('place-search-no-results.json').rows
const COORDINATE_LOOKUP = fixture('coordinate-lookup-asheville.json').body
/**
 * 🔴 Read ONLY by `--live` below, deliberately.
 *
 * Captured by 17-05 for `check:place-entry` assertion 6 — the unincorporated
 * case, which needs a **G4020 county** row, the one level none of the fixtures
 * above carry. The county branch's pure behaviour is already covered here
 * (assertion 36 parses `{geo_id: '37021', mtfcc: 'G4020'}` directly), so a
 * second pure assertion over the same shape would be noise. What it would NOT
 * have without this line is a drift guard — and a browser check served from an
 * unguarded fixture is exactly the "stale fixture" row of 17-VALIDATION.md's
 * vacuous-pass table.
 */
const BUNCOMBE = fixture('place-search-buncombe.json').rows

// ── 1–7  normalisePlaceQuery ─────────────────────────────────────────────────

check(1, 'normalisePlaceQuery trims', normalisePlaceQuery('   Asheville  ') === 'Asheville')

check(
  2,
  'normalisePlaceQuery collapses internal whitespace, including a pasted newline',
  normalisePlaceQuery('Asheville,\n\t  NC') === 'Asheville, NC',
  `got ${JSON.stringify(normalisePlaceQuery('Asheville,\n\t  NC'))}`,
)

check(
  3,
  'normalisePlaceQuery REJECTS control characters — a NUL and a C1 both yield null',
  normalisePlaceQuery('Ashe\u0000ville') === null && normalisePlaceQuery('Ashe\u0085ville') === null,
)

check(
  4,
  'normalisePlaceQuery returns null below three characters, so the typeahead never fires on one letter',
  normalisePlaceQuery('A') === null && normalisePlaceQuery('As') === null && normalisePlaceQuery('  a  ') === null,
)

check(
  5,
  'exactly three characters is ACCEPTED — the minimum is not off by one',
  normalisePlaceQuery('Ash') === 'Ash',
)

{
  const paste = `${'x'.repeat(400)} and a whole pasted document`
  const out = normalisePlaceQuery(paste)
  check(
    6,
    'a 400-character paste survives TRUNCATED at 120 rather than throwing or being refused',
    typeof out === 'string' && out.length === 120,
    `got ${out === null ? 'null' : `length ${out.length}`}`,
  )
}

{
  // Inside a try, because "rather than a crash" is half of what this asserts: deleting
  // the typeof guard makes `raw.replace` throw, and a throw that took the whole run
  // down would report as a harness failure instead of as this assertion.
  let threw = null
  let out = []
  try {
    out = [normalisePlaceQuery(undefined), normalisePlaceQuery(42), normalisePlaceQuery(null), normalisePlaceQuery({})]
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err)
  }
  check(
    7,
    'a non-string input is null RATHER THAN A CRASH — the hook may be handed anything',
    threw === null && out.length === 4 && out.every((v) => v === null),
    threw === null ? `got ${JSON.stringify(out)}` : `THREW: ${threw}`,
  )
}

// ── 8–15  searchRowKind ──────────────────────────────────────────────────────

check(
  8,
  'a seven-digit G4110 incorporated place is a place',
  searchRowKind({ geo_id: '3702140', mtfcc: 'G4110' }) === 'place',
)

check(
  9,
  'a seven-digit G4120 CENSUS DESIGNATED PLACE is also a place — ev-accounts names both in one query',
  searchRowKind({ geo_id: '3714100', mtfcc: 'G4120' }) === 'place',
  'If only this is red, searchRowKind has been narrowed to G4110 and every CDP in the\n' +
    '          country has silently become unselectable.',
)

check(
  10,
  '🔴 a SEVEN-DIGIT G5420 school district is UNUSABLE — the geoid is the same length as a place FIPS',
  searchRowKind({ geo_id: '4110040', mtfcc: 'G5420' }) === 'unusable',
  'This is the live hole. "Portland Public Schools, OR" is geo_id 4110040, seven digits,\n' +
    '          and a rule that branches on length alone calls it a CITY — then keys a civic space,\n' +
    '          its banner, its officials and its Explore on a school district. Verified live\n' +
    '          2026-10-26; see scripts/fixtures/place-search-portland.json.',
)

check(11, 'a five-digit G4020 is a county', searchRowKind({ geo_id: '37021', mtfcc: 'G4020' }) === 'county')
check(12, 'a two-digit G4000 is a state', searchRowKind({ geo_id: '37', mtfcc: 'G4000' }) === 'state')

check(
  13,
  '🔴 a non-numeric geo_id is unusable EVEN WHEN its mtfcc matches its length — the sentinels collide by shape',
  searchRowKind({ geo_id: 'US', mtfcc: 'G4000' }) === 'unusable' &&
    searchRowKind({ geo_id: 'UNIFIED', mtfcc: 'G4110' }) === 'unusable' &&
    searchRowKind({ geo_id: 'US', mtfcc: 'G4110' }) === 'unusable' &&
    searchRowKind({ geo_id: null, mtfcc: undefined }) === 'unusable',
  "'US' is two characters and 'UNIFIED' is seven, so both have the LENGTH of a real geoid —\n" +
    "           'US' of a state and 'UNIFIED' of a place. Pairing each with the mtfcc that matches that\n" +
    '          length is the only input that notices the numeric test is gone; the earlier, weaker form\n' +
    "          of this assertion used {geo_id:'US', mtfcc:'G4110'}, which the mtfcc test rejects on its\n" +
    '          own and which therefore passed with the numeric test deleted. Found by a vacuity sweep.',
)

check(
  14,
  'a missing geo_id is unusable',
  searchRowKind({ mtfcc: 'G4110', label: 'somewhere' }) === 'unusable',
)

check(
  15,
  'an empty row, a null and an undefined are all unusable rather than a crash',
  searchRowKind({}) === 'unusable' &&
    searchRowKind(null) === 'unusable' &&
    searchRowKind(undefined) === 'unusable',
)

// ── 16–20  stateFromGeoid ────────────────────────────────────────────────────

check(16, "stateFromGeoid('3702140') is '37' — by FIPS construction, no lookup", stateFromGeoid('3702140') === '37')
check(17, "stateFromGeoid('37021') is '37'", stateFromGeoid('37021') === '37')
check(18, "stateFromGeoid('37') is '37'", stateFromGeoid('37') === '37')
check(19, "stateFromGeoid('US') is null — the federal literal is not a place", stateFromGeoid('US') === null)
check(
  20,
  "🔴 stateFromGeoid('UNIFIED') is null, and so is every NUMERIC geoid of a length no slice uses",
  stateFromGeoid('UNIFIED') === null &&
    stateFromGeoid('3') === null &&
    stateFromGeoid('3712345678') === null &&
    stateFromGeoid('370') === null,
  `got UNIFIED -> ${JSON.stringify(stateFromGeoid('UNIFIED'))}, '3' -> ${JSON.stringify(stateFromGeoid('3'))}, ` +
    `'3712345678' -> ${JSON.stringify(stateFromGeoid('3712345678'))}\n` +
    '          Seven characters is a place geoid LENGTH, which is why the numeric test is not optional.\n' +
    "          '3712345678' is not hypothetical: location-search returns 10-digit G4040 township MCDs,\n" +
    '          and slicing two characters off one would hand back a state FIPS for a jurisdiction that is\n' +
    "          not one of ours. The earlier form of this assertion tested only the two non-numeric\n" +
    '          sentinels, so it passed with the LENGTH test deleted. Found by a vacuity sweep.',
)

// ── 21–25  placeFromSearchRow and withCounty ─────────────────────────────────

{
  const out = placeFromSearchRow({ geo_id: '3702140', mtfcc: 'G4110' })
  check(
    21,
    'a PLACE row is complete:false and asks for the county — the gazetteer has no place→county link',
    out?.complete === false && out.needsCounty?.geoid === '3702140' && out.partial?.state === '37',
    `got ${JSON.stringify(out)}. If this says complete:true the county is simply missing downstream\n` +
      '          and NOTHING fails — a city civic space with no county tab beside it.',
  )
}

{
  const out = placeFromSearchRow({ geo_id: '37021', mtfcc: 'G4020' })
  check(
    22,
    'a COUNTY row is complete, with city null — a county-level choice is an answer, not a failure',
    out?.complete === true && out.place?.city === null && out.place?.county === '37021' && out.place?.state === '37',
    `got ${JSON.stringify(out)}`,
  )
}

{
  const out = placeFromSearchRow({ geo_id: '37', mtfcc: 'G4000' })
  check(
    23,
    'a STATE row is complete, with city AND county null',
    out?.complete === true && out.place?.city === null && out.place?.county === null && out.place?.state === '37',
    `got ${JSON.stringify(out)}`,
  )
}

check(
  24,
  "withCounty composes '3702140' + '37021' into the five values and no sixth",
  same(withCounty({ city: '3702140', state: '37' }, '37021'), {
    city: '3702140',
    county: '37021',
    state: '37',
    nation: 'US',
    unified: 'UNIFIED',
  }),
  `got ${JSON.stringify(withCounty({ city: '3702140', state: '37' }, '37021'))}`,
)

check(
  25,
  '🔴 withCounty REFUSES a county in another state, AND anything that is not county-shaped',
  withCounty({ city: '3702140', state: '37' }, '18105') === null &&
    withCounty({ city: '3702140', state: '37' }, 'nonsense') === null &&
    withCounty({ city: '3702140', state: '37' }, '37') === null &&
    withCounty({ city: '3702140', state: '37' }, '3702140') === null &&
    withCounty({ city: 'UNIFIED', state: '37' }, '37021') === null,
  `got same-state-wrong-shape '37' -> ${JSON.stringify(withCounty({ city: '3702140', state: '37' }, '37'))}, ` +
    `a PLACE geoid as the county -> ${JSON.stringify(withCounty({ city: '3702140', state: '37' }, '3702140'))}\n` +
    '          A Census place never spans a state line, so a state mismatch means one of the two legs is\n' +
    '          about somewhere else. Treasury Tracker resolving an unknown slug to Bloomington IN is the\n' +
    '          precedent: a real answer for the wrong place is worse than no answer.\n' +
    "          🔴 The last three inputs all START '37', so the state test alone waves them through. The\n" +
    '          earlier form of this assertion used only inputs the state test already caught, and so\n' +
    '          passed with the county SHAPE test deleted — a place geoid would have been stored as the\n' +
    '          county. Found by a vacuity sweep.',
)

// ── 26–29  the real rows ─────────────────────────────────────────────────────

{
  const offered = usablePlaceRows(ASHEVILLE)
  const parsed = offered.map((row) => placeFromSearchRow(row))
  const allPlaces =
    offered.length === 5 && parsed.length === 5 && parsed.every((p) => p !== null && p.complete === false)
  check(
    26,
    'every row of the REAL location-search?q=asheville response survives the filter and needs its county',
    allPlaces,
    `${offered.length} offered of ${ASHEVILLE.length}, ${parsed.filter((p) => p === null).length} unusable`,
  )
  check(
    27,
    "the first real Asheville row is geoid 3702140 — byte-identical to public/geo/37.json's",
    // Optional chaining throughout: a break that makes a place row "complete" leaves
    // `partial` undefined, and this assertion must report a FAIL rather than take the
    // whole run down before the tally prints.
    parsed[0]?.partial?.city === '3702140' && parsed[0]?.partial?.state === '37',
    `got ${JSON.stringify(parsed[0])}`,
  )
}

{
  // Run through the SHIPPED filter, inside a try, so "treats no-results as an error"
  // is a thing this assertion can actually observe. usablePlaceRows lives in
  // placeResolve.ts rather than in usePlaceSearch for exactly this reason: the hook
  // imports React and no check can reach a decision written inside it.
  let out
  let threw = null
  try {
    out = usablePlaceRows(NO_RESULTS)
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err)
  }
  check(
    28,
    '🔴 an empty response is an EMPTY LIST and not an error — "no place by that name" is an answer',
    threw === null && Array.isArray(out) && out.length === 0 && same(out, []),
    `${threw === null ? `got ${JSON.stringify(out)}` : `THREW: ${threw}`}\n` +
      '          Treating this as a failure is the Pitfall 6 shape: the geocoder family answers 200 for\n' +
      '          every miss, so "nothing found" has to be a value and never a thrown error. An unparseable\n' +
      `          body is the same answer: usablePlaceRows(null) -> ${JSON.stringify(usablePlaceRows(null))}.`,
  )
}

{
  const kinds = PORTLAND.map((row) => ({ geo_id: row.geo_id, mtfcc: row.mtfcc, kind: searchRowKind(row) }))
  const schoolDistricts = kinds.filter((k) => k.mtfcc === 'G5420')
  const offeredIds = usablePlaceRows(PORTLAND).map((row) => row.geo_id)
  check(
    29,
    '🔴 the REAL Portland rows: both seven-digit school districts are never OFFERED, both real Portlands are',
    schoolDistricts.length === 2 &&
      schoolDistricts.every((k) => k.kind === 'unusable') &&
      !offeredIds.includes('4110040') &&
      !offeredIds.includes('2312330') &&
      offeredIds.includes('2360545') &&
      offeredIds.includes('4159000'),
    `offered: [${offeredIds.join(', ')}]\n          kinds: ${JSON.stringify(kinds)}\n` +
      '          Assertion 10 makes this point with a synthetic row; this one makes it with the bytes the\n' +
      '          API actually sent on 2026-10-26, through the filter the hook actually calls — which is\n' +
      '          the difference between the rule being right and the rule being right about real traffic.',
  )
}

// ── 30–33  countyFromCoordinateLookup ────────────────────────────────────────

check(
  30,
  "the REAL coordinate-lookup body yields county '37021'",
  countyFromCoordinateLookup(COORDINATE_LOOKUP) === '37021',
  `got ${JSON.stringify(countyFromCoordinateLookup(COORDINATE_LOOKUP))}. 🔴 If this is red because the\n` +
    "          parser was pointed at locality.incorporated, that field is NULL in this body: ev-accounts\n" +
    '          loads place geofences only for PLACE_LOADED_STATES and NC is not among them. Counties are\n' +
    '          nationwide; places are not. That is the live trap, reproduced.',
)

check(31, 'an empty body yields null', countyFromCoordinateLookup({}) === null)
check(32, 'a body whose county has no geoid yields null', countyFromCoordinateLookup({ county: {} }) === null)
check(
  33,
  'a null geoid, a non-string geoid and a wrong-length geoid all yield null',
  countyFromCoordinateLookup({ county: { geoid: null } }) === null &&
    countyFromCoordinateLookup({ county: { geoid: 37021 } }) === null &&
    countyFromCoordinateLookup({ county: { geoid: '3702140' } }) === null,
)

// ── 34–36  placeFromResolveResponse ──────────────────────────────────────────

check(
  34,
  'a well-formed resolve body parses to the five values',
  same(placeFromResolveResponse({ city: '3702140', county: '37021', state: '37', nation: 'US' }), {
    city: '3702140',
    county: '37021',
    state: '37',
    nation: 'US',
    unified: 'UNIFIED',
  }),
)

check(
  35,
  'a resolve body with NO county is null — whatever its status code said',
  placeFromResolveResponse({ city: null, county: null, state: '37', nation: 'US' }) === null &&
    placeFromResolveResponse({}) === null &&
    placeFromResolveResponse(null) === null,
  'Pitfall 6: the Census Geocoder answers 200 with zero matches for every failure, including\n' +
    '          for correctly-typed real addresses TIGER does not carry. A parser that trusts res.ok\n' +
    '          reports "resolved" with every geoid undefined.',
)

{
  const body = {
    city: '3702140',
    county: '37021',
    state: '37',
    nation: 'US',
    matchedAddress: '67 HAYWOOD ST, ASHEVILLE, NC, 28801',
  }
  const out = placeFromResolveResponse(body)
  const serialised = JSON.stringify(out)
  check(
    36,
    '🔴 a body carrying matchedAddress parses, and that key is NOT carried into the result (D-13)',
    out !== null &&
      !('matchedAddress' in out) &&
      !serialised.includes('HAYWOOD') &&
      !serialised.includes('28801'),
    `got ${serialised}. D-13: the input is never echoed back. The result is built key by key for\n` +
      '          exactly this reason — a spread of the body would have passed every other assertion here.',
  )
}

// ── 37–38  D-13, structurally ────────────────────────────────────────────────

const D13_KEYS = ['city', 'county', 'state', 'nation', 'unified']
const FORBIDDEN_KEYS = ['name', 'label', 'address', 'matchedAddress', 'query', 'placeName']

{
  const resolved = withCounty({ city: '3702140', state: '37' }, '37021')
  const keys = Object.keys(resolved ?? {})
  const extra = keys.filter((k) => !D13_KEYS.includes(k))
  check(
    37,
    '🔴 D-13: Object.keys of a resolved place is EXACTLY city, county, state, nation, unified',
    same(keys.slice().sort(), D13_KEYS.slice().sort()) && extra.length === 0,
    `got [${keys.join(', ')}]${extra.length ? `; forbidden extras: ${extra.join(', ')}` : ''}\n` +
      '          D-13 says the typed input is never echoed back, and ResolvedPlace makes a name\n' +
      `          UNREPRESENTABLE so that no call site can render one by accident. Adding any of\n` +
      `          [${FORBIDDEN_KEYS.join(', ')}] is a D-13 violation even if nothing reads it yet.`,
  )
}

{
  const county = placeFromSearchRow({ geo_id: '37021', mtfcc: 'G4020' })
  const state = placeFromSearchRow({ geo_id: '37', mtfcc: 'G4000' })
  const fromBody = placeFromResolveResponse({ city: '3702140', county: '37021', state: '37', nation: 'US' })
  const every = [county?.place, state?.place, fromBody].map((p) => Object.keys(p ?? {}).sort())
  check(
    38,
    '🔴 D-13 holds on EVERY path that produces a place — the row parsers and the body parser alike',
    every.every((keys) => same(keys, D13_KEYS.slice().sort())),
    `got ${JSON.stringify(every)}. One path growing a sixth key is all it takes.`,
  )
}

// ── 39–42  viewedPlace ───────────────────────────────────────────────────────

{
  const place = withCounty({ city: '3702140', state: '37' }, '37021')
  writeViewedPlace(place)
  const back = readViewedPlace()
  check(
    39,
    'viewedPlace round trip: write then read returns the same five values',
    same(back, place),
    `wrote ${JSON.stringify(place)}, read ${JSON.stringify(back)}. If this is red in Node, the\n` +
      '          storage stub at the top of this file is not reaching window.sessionStorage.',
  )
}

{
  // What a visitor typed, and what a rejected endpoint would have echoed back.
  const TYPED = 'Asheville'
  const ADDRESS = '2 S Pack Sq, Asheville, NC 28801'
  const stored = stub.store.getItem(VIEWED_PLACE_STORAGE_KEY) ?? ''
  check(
    40,
    '🔴 what is STORED contains nothing the visitor typed — not the place name, not an address',
    stored.length > 0 &&
      !stored.includes(TYPED) &&
      !stored.includes('Asheville') &&
      !stored.includes(ADDRESS) &&
      !stored.includes('Haywood'),
    `stored: ${stored}\n          D-13's "never store it" half, as a byte check rather than a promise.`,
  )
  let storedKeys = null
  try {
    storedKeys = Object.keys(JSON.parse(stored)).sort()
  } catch {
    // Nothing was stored, or what was stored is not JSON. Either is a FAIL here, and
    // reporting it as one beats taking the run down before the tally prints.
  }
  check(
    41,
    'the stored value itself has exactly the five keys — a sixth cannot get in through this door either',
    storedKeys !== null && same(storedKeys, D13_KEYS.slice().sort()),
    `stored keys: ${storedKeys === null ? `(nothing parseable was stored: ${JSON.stringify(stored)})` : storedKeys.join(', ')}`,
  )
}

{
  stub.log.removed.length = 0
  stub.store.setItem(VIEWED_PLACE_STORAGE_KEY, '{"city":"nope","county":"37021","state":"37"}')
  const back = readViewedPlace()
  const clearedKey = stub.log.removed.includes(VIEWED_PLACE_STORAGE_KEY)
  const gone = stub.store.getItem(VIEWED_PLACE_STORAGE_KEY) === null

  stub.store.setItem(VIEWED_PLACE_STORAGE_KEY, 'not json at all {{{')
  const corruptJson = readViewedPlace()

  check(
    42,
    'a corrupt stored value reads as null and the key is removed — never a throw inside a render',
    back === null && corruptJson === null && clearedKey && gone,
    `parsed-but-invalid -> ${JSON.stringify(back)}, unparseable -> ${JSON.stringify(corruptJson)},\n` +
      `          key removed: ${clearedKey}, key gone: ${gone}`,
  )
}

// ── --live: contract drift against the real API ──────────────────────────────
/*
 * 🔴 Opt-in, and NOT part of `npm run check:place-resolve`. It needs the network, and it
 * belongs beside `check:banners` in the "run it when you touch this, and periodically"
 * category. If the live shapes differ from the fixtures that is a FINDING and this exits
 * non-zero: the research's own "valid until" note says ev-accounts' endpoint shapes move,
 * and 17-05's browser check serves these fixtures through route interception — a silently
 * stale fixture would make that check green against a contract that no longer exists.
 *
 * 🔴 PITFALL 7, which this mode is the standing temptation for. Node's fetch does not
 * enforce CORS. Everything here passing proves the SHAPES are unchanged and proves
 * NOTHING about whether a browser may make these calls. The CORS claims in
 * src/lib/placeResolve.ts were made in real Chromium from the real origin and must be
 * re-made there if they are ever re-made.
 *
 * Default origin is the dev server's proxy, which is the path the app itself uses in dev:
 *   npm run dev          (in another terminal)
 *   node scripts/check-place-resolve.mjs --live
 *   node scripts/check-place-resolve.mjs --live --origin http://localhost:5174
 */

function keyShape(value) {
  if (Array.isArray(value)) return `array[${value.length ? keyShape(value[0]) : ''}]`
  if (value === null) return 'null'
  if (typeof value !== 'object') return typeof value
  return `{${Object.keys(value).sort().join(',')}}`
}

async function live() {
  const argv = process.argv.slice(2)
  const originArg = argv.indexOf('--origin')
  const origin = originArg >= 0 ? argv[originArg + 1] : 'http://localhost:5173'
  console.log(`\n── --live: contract drift against ${origin} ──`)
  console.log('   (Node does not enforce CORS. This proves shapes, never browser reachability.)\n')

  let drift = 0
  const report = (label, expected, actual) => {
    if (expected === actual) {
      console.log(`LIVE ok    ${label}  ${actual}`)
    } else {
      drift += 1
      console.log(`LIVE DRIFT ${label}\n           fixture: ${expected}\n           live:    ${actual}`)
    }
  }

  const search = async (q) => {
    const res = await fetch(`${origin}/api/essentials/location-search?q=${encodeURIComponent(q)}&limit=8`)
    if (!res.ok) throw new Error(`location-search ${q}: HTTP ${res.status}`)
    return res.json()
  }

  try {
    report('location-search?q=asheville', keyShape(ASHEVILLE), keyShape(await search('asheville')))
    report('location-search?q=portland', keyShape(PORTLAND), keyShape(await search('portland')))
    report('location-search, no results', keyShape(NO_RESULTS), keyShape(await search('zzzqqqxnotaplace')))

    const liveBuncombe = await search('buncombe')
    report('location-search?q=buncombe', keyShape(BUNCOMBE), keyShape(liveBuncombe))
    // 🔴 Not only the SHAPE here, the ORDER. check:place-entry 6 clicks the first
    // `[role="option"]`, so a ranking change that pushed "Buncombe, IL · City" above
    // the county would leave this fixture's key shape identical and quietly turn that
    // assertion into a second CITY run — a true statement about the wrong level, which
    // is the whole family of failure this phase guards hardest against.
    report(
      'location-search?q=buncombe, first row is still the COUNTY',
      `${BUNCOMBE[0]?.geo_id} ${BUNCOMBE[0]?.mtfcc}`,
      `${liveBuncombe[0]?.geo_id} ${liveBuncombe[0]?.mtfcc}`,
    )

    const shard = await fetch(`${origin}/geo/37.json`)
    const centroid = (await shard.json()).names['3702140']
    const res = await fetch(`${origin}/api/essentials/coordinate-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: centroid.lat, lng: centroid.lon }),
    })
    if (!res.ok) throw new Error(`coordinate-lookup: HTTP ${res.status}`)
    const body = await res.json()
    report('coordinate-lookup .county', keyShape(COORDINATE_LOOKUP.county), keyShape(body.county))
    report('coordinate-lookup .locality', keyShape(COORDINATE_LOOKUP.locality), keyShape(body.locality))
    report(
      'coordinate-lookup county.geoid still parses',
      '37021',
      String(countyFromCoordinateLookup(body)),
    )
  } catch (err) {
    drift += 1
    console.log(`LIVE ERROR ${(err instanceof Error ? err.message : String(err))}`)
    console.log('           Is `npm run dev` running? Pass --origin to point at another port.')
  }

  return drift
}

// ── Result ───────────────────────────────────────────────────────────────────

let liveDrift = 0
if (process.argv.includes('--live')) liveDrift = await live()

console.log(`\n${passed} PASS, ${failed} FAIL${process.argv.includes('--live') ? `, ${liveDrift} LIVE DRIFT` : ''}`)
process.exit(failed === 0 && liveDrift === 0 ? 0 : 1)
