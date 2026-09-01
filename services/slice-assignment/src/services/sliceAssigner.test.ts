import { describe, it, expect } from 'vitest'
import { SLICE_CAPACITY, SLICE_ASSIGNMENTS } from './sliceAssigner'
import type { AccountData } from './accountsApi'

type Jurisdiction = NonNullable<AccountData['jurisdiction']>

describe('slice capacity', () => {
  it('is 6000, matching the enforce_slice_cap trigger', () => {
    // Two enforcement points must agree: this constant gates which slice the service
    // hands a member, and civic_spaces.enforce_slice_cap() rejects the insert at the
    // same number. If they drift, the service hands out a slice the database refuses.
    expect(SLICE_CAPACITY).toBe(6000)
  })
})

describe('slice assignments', () => {
  it('names each slice type exactly once', () => {
    // A duplicate would assign the member twice and double-count the slice.
    const types = SLICE_ASSIGNMENTS.map((a) => a.sliceType)
    expect(new Set(types).size).toBe(types.length)
  })

  it('returns null, never throws, for a jurisdiction missing every level', () => {
    // Levels are optional. An unincorporated address has no city; a Buncombe County, NC
    // address resolves no school district. assignUserToSlices skips a null geoid, but it
    // can only do that if reading the key produced a null instead of blowing up — a
    // thrown accessor here abandons the request AFTER earlier levels were written,
    // leaving the member with slices in the database and a 500 saying it failed.
    const empty = {} as Jurisdiction

    for (const { sliceType, geoid } of SLICE_ASSIGNMENTS) {
      expect(() => geoid(empty), `${sliceType} threw on an empty jurisdiction`).not.toThrow()
      expect(geoid(empty) ?? null, `${sliceType} did not resolve to null`).toBeNull()
    }
  })

  it('reads every geoid from a distinct jurisdiction key', () => {
    // Two slice types reading the same key would silently collapse two civic spaces
    // into one, which is the failure mode of pairing a geo_id with the wrong layer.
    const probe = {
      congressional_district: 'congressional',
      state_senate_district: 'state_senate',
      state_house_district: 'state_house',
      county: 'county',
      school_district: 'school_district',
    } as unknown as Jurisdiction

    const read = SLICE_ASSIGNMENTS.map((a) => a.geoid(probe)).filter((v): v is string => !!v)
    expect(new Set(read).size).toBe(read.length)
  })
})
