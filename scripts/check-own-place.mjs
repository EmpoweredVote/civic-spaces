#!/usr/bin/env node
/**
 * check:own-place — the door a signed-in viewer's own place comes through.
 *
 * `ownPlaceFromAccount` (src/lib/ownPlace.ts) turns ev-accounts' `GET /api/account/me` answer
 * into the place AppShell opens read-only for a viewer who has a place but no civic spaces —
 * a basic account with an address, since ev-accounts CA_0368 (2026-11-07).
 *
 * 🔴 This imports the SHIPPED module, not a copy. What it pins:
 *   - the geoid keys it reads are the ones ev-accounts sends (`city_geoid`, `county`,
 *     `state_geoid`, `nation_geoid`) — read the wrong key and every basic account quietly
 *     falls back to the address prompt, with nothing failing;
 *   - only geoids come out: a name, a district name or any other key on the answer cannot
 *     reach a consumer;
 *   - a malformed or missing answer is "no place" (the address prompt), never a guess.
 *
 * Pure — no server, no browser. Runs in CI's "Guards (pure)" job.
 */
import { ownPlaceFromAccount } from '../src/lib/ownPlace.ts'

let passed = 0
let failed = 0

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) passed += 1
  else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n     expected ${JSON.stringify(expected)}\n     got      ${JSON.stringify(actual)}`}`)
}

/** The shape ev-accounts' toJurisdictionResponse returns, for Asheville City Hall. */
const ASHEVILLE_ME = {
  id: 'u1',
  tier: 'inform',
  display_name: 'Someone',
  location_consent: true,
  jurisdiction: {
    congressional_district: '3711',
    congressional_district_name: 'Congressional District 11',
    county: '37021',
    county_name: 'Buncombe County',
    state: 'NC',
    city: 'ASHEVILLE',
    state_geoid: '37',
    city_geoid: '3702140',
    nation_geoid: 'US',
  },
}
const ASHEVILLE = { city: '3702140', county: '37021', state: '37', nation: 'US', unified: 'UNIFIED' }

check('1  a basic account with an address yields its place', ownPlaceFromAccount(ASHEVILLE_ME), ASHEVILLE)

check(
  '2  only geoids come out — no name, tier or district name',
  Object.keys(ownPlaceFromAccount(ASHEVILLE_ME) ?? {}).sort(),
  ['city', 'county', 'nation', 'state', 'unified'],
)

check(
  '3  an unincorporated address (no city) is still a place',
  ownPlaceFromAccount({ jurisdiction: { ...ASHEVILLE_ME.jurisdiction, city_geoid: null } }),
  { ...ASHEVILLE, city: null },
)

check('4  no jurisdiction -> no place', ownPlaceFromAccount({ id: 'u1', jurisdiction: null }), null)
check('5  not an object -> no place', ownPlaceFromAccount(null), null)
check(
  '6  no state geoid -> no place',
  ownPlaceFromAccount({ jurisdiction: { ...ASHEVILLE_ME.jurisdiction, state_geoid: null } }),
  null,
)
check(
  '7  the USPS code where the geoid belongs -> no place',
  ownPlaceFromAccount({ jurisdiction: { ...ASHEVILLE_ME.jurisdiction, state_geoid: 'NC' } }),
  null,
)
check(
  '8  a city NAME where the geoid belongs -> no place',
  ownPlaceFromAccount({ jurisdiction: { ...ASHEVILLE_ME.jurisdiction, city_geoid: 'ASHEVILLE' } }),
  null,
)
check(
  '9  a non-US nation -> no place',
  ownPlaceFromAccount({ jurisdiction: { ...ASHEVILLE_ME.jurisdiction, nation_geoid: null } }),
  null,
)

console.log(`\n${passed} PASS, ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
