import { describe, it, expect } from 'vitest'
import { classifyIssuer, internalUserId } from './verifyToken'

const SUPABASE_ISS = 'https://kxsdzaojfaibhuzmclfq.supabase.co/auth/v1'
const WORKOS_ISS = 'https://api.workos.com/user_management/client_x'

describe('classifyIssuer', () => {
  it('recognises the Supabase issuer', () => {
    expect(classifyIssuer(SUPABASE_ISS, SUPABASE_ISS, WORKOS_ISS)).toBe('supabase')
  })

  it('recognises the WorkOS issuer', () => {
    expect(classifyIssuer(WORKOS_ISS, SUPABASE_ISS, WORKOS_ISS)).toBe('workos')
  })

  it('refuses an issuer that is neither', () => {
    // A token signed by anyone else must not reach a verification path at all.
    expect(classifyIssuer('https://evil.example/', SUPABASE_ISS, WORKOS_ISS)).toBeNull()
    expect(classifyIssuer(undefined, SUPABASE_ISS, WORKOS_ISS)).toBeNull()
  })

  it('refuses WorkOS when no WorkOS issuer is configured', () => {
    // Absent config must not degrade into accepting anything.
    expect(classifyIssuer(WORKOS_ISS, SUPABASE_ISS, undefined)).toBeNull()
  })
})

describe('internalUserId', () => {
  it('uses sub for a Supabase token', () => {
    expect(internalUserId({ sub: '4e6dde8f-2bd0-4054-824f-4164744165ea' })).toBe(
      '4e6dde8f-2bd0-4054-824f-4164744165ea'
    )
  })

  it('uses external_id for a WorkOS token', () => {
    // 🔴 The defect this exists to prevent: WorkOS `sub` is a WorkOS id, not our uuid.
    expect(
      internalUserId({
        sub: 'user_01M14T3W1R72ZQM70KRXH4K5E8',
        external_id: '4e6dde8f-2bd0-4054-824f-4164744165ea',
      })
    ).toBe('4e6dde8f-2bd0-4054-824f-4164744165ea')
  })

  it('does not let an empty external_id shadow the sub', () => {
    expect(internalUserId({ sub: 'uuid-here', external_id: '' })).toBe('uuid-here')
  })

  it('falls back to the WorkOS sub for an unlinked account', () => {
    // Fail-closed: this id matches no row, which is the same answer RLS gives.
    expect(internalUserId({ sub: 'user_01UNLINKED' })).toBe('user_01UNLINKED')
  })

  it('returns null when the payload names nobody', () => {
    expect(internalUserId({})).toBeNull()
    expect(internalUserId({ sub: 42 as unknown as string })).toBeNull()
  })
})
