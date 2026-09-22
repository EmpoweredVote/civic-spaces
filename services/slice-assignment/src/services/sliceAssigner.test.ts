import { describe, it, expect } from 'vitest'
import { SLICE_CAPACITY, SLICE_ASSIGNMENTS } from './sliceAssigner'
import type { AccountData } from './accountsApi'

type Jurisdiction = NonNullable<AccountData['jurisdiction']>

/**
 * Plano, TX — every level present.
 *
 * The district keys are here on purpose: they are what the assigner used to key slices
 * on, so a test that only supplied the new keys could not tell a correct mapping from
 * one that silently read nothing.
 */
const PLANO = {
  congressional_district: '4832',
  state_senate_district: '48008',
  state_house_district: '48070',
  county: '48085',
  school_district: '4835100',
  city_geoid: '4858016',
  state_geoid: '48',
  nation_geoid: 'US',
} as unknown as Jurisdiction

/** Arden, NC — unincorporated, and outside any school district boundary we hold. */
const ARDEN = {
  ...PLANO,
  county: '37021',
  state_geoid: '37',
  city_geoid: null,
  school_district: null,
} as unknown as Jurisdiction

function mapOf(j: Jurisdiction): Record<string, string | null> {
  return Object.fromEntries(SLICE_ASSIGNMENTS.map((a) => [a.sliceType, a.geoid(j)]))
}

describe('slice capacity', () => {
  it('is 6000, matching the enforce_slice_cap trigger', () => {
    // Two enforcement points must agree: this constant gates which slice the service
    // hands a member, and civic_spaces.enforce_slice_cap() rejects the insert at the
    // same number. If they drift, the service hands out a slice the database refuses.
    expect(SLICE_CAPACITY).toBe(6000)
  })
})

describe('slice assignment mapping', () => {
  it('maps a member onto governments, not districts', () => {
    expect(mapOf(PLANO)).toEqual({
      federal: 'US',
      state: '48',
      county: '48085',
      city: '4858016',
    })
  })

  it('never assigns on a congressional or legislative district', () => {
    // The defect this whole change exists to fix: `federal` was keyed on the member's
    // congressional district and `state` on their state senate district, so two
    // neighbours on opposite sides of a district line could not talk to each other
    // about the state they both live in.
    const geoids = Object.values(mapOf(PLANO))
    expect(geoids).not.toContain('4832')
    expect(geoids).not.toContain('48008')
    expect(geoids).not.toContain('48070')
    expect(geoids).not.toContain('4835100')
  })

  it('yields null for a level the jurisdiction lacks, rather than throwing', () => {
    // Arden, NC is unincorporated: no G4110 place covers it. Four spaces, not a crash.
    expect(mapOf(ARDEN).city).toBeNull()
    expect(mapOf(ARDEN).county).toBe('37021')
  })

  it('reads the geoid keys, not the geocoded name keys that sit beside them', () => {
    // 🔴 /api/account/me carries BOTH. `state` is the USPS code and `city` is a place
    // NAME -- 'NC' and 'ASHEVILLE' in production -- while the geoids live under
    // *_geoid. Both are truthy strings, so reading the wrong pair sails past the null
    // guard in assignUserToSlices and keys a slice on 'NC'.
    const decoy = {
      county: '37021',
      state: 'NC',
      city: 'ASHEVILLE',
      nation: 'United States',
      state_geoid: '37',
      city_geoid: '3702140',
      nation_geoid: 'US',
    } as unknown as Jurisdiction

    expect(mapOf(decoy)).toEqual({
      federal: 'US',
      state: '37',
      county: '37021',
      city: '3702140',
    })
  })
})

describe('slice assignment invariants', () => {
  it('names each slice type exactly once', () => {
    // A duplicate would assign the member twice and double-count the slice.
    const types = SLICE_ASSIGNMENTS.map((a) => a.sliceType)
    expect(new Set(types).size).toBe(types.length)
  })

  it('returns null, never throws, for a jurisdiction missing every level', () => {
    // assignUserToSlices skips a null geoid, but it can only do that if reading the key
    // produced a null instead of blowing up — a thrown accessor abandons the request
    // AFTER earlier levels were written, leaving the member with slices in the database
    // and a 500 saying it failed.
    const empty = {} as Jurisdiction

    for (const { sliceType, geoid } of SLICE_ASSIGNMENTS) {
      expect(() => geoid(empty), `${sliceType} threw on an empty jurisdiction`).not.toThrow()
      expect(geoid(empty) ?? null, `${sliceType} did not resolve to null`).toBeNull()
    }
  })

  it('reads every geoid from a distinct jurisdiction key', () => {
    // Two slice types reading the same key would silently collapse two civic spaces
    // into one.
    const read = SLICE_ASSIGNMENTS.map((a) => a.geoid(PLANO)).filter((v): v is string => !!v)
    expect(new Set(read).size).toBe(read.length)
  })
})
