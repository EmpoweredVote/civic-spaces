import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose'
import { Request, Response, NextFunction } from 'express'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      rawToken?: string
    }
  }
}

/**
 * 🔴 TWO ISSUERS, DELIBERATELY.
 *
 * The accounts platform cut over to WorkOS AuthKit-only login on 2026-08-28 (ev-accounts
 * decision 0002) and now mints tokens from either issuer. This middleware verified against
 * exactly one — `jwtVerify(token, JWKS, { issuer: ACCOUNTS_ISSUER })` — so every
 * WorkOS-issued member got a 401 from POST /assign, and because the frontend fires
 * assignment only when a member appears to have no spaces, they sat on "Setting up your
 * civic spaces…" while the request that would fix it was rejected.
 *
 * Each issuer keeps its own JWKS. A token is classified by its unverified `iss`, then
 * verified cryptographically against THAT issuer's keys and pinned to that issuer — the
 * classification only chooses a path, it grants nothing. An `iss` matching neither is
 * rejected without any verification attempt.
 */
const SUPABASE_ISSUER = process.env.ACCOUNTS_ISSUER
const WORKOS_ISSUER = process.env.WORKOS_ISSUER

const supabaseJwks = SUPABASE_ISSUER
  ? createRemoteJWKSet(new URL(process.env.ACCOUNTS_JWKS_URL!))
  : null
const workosJwks = process.env.WORKOS_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.WORKOS_JWKS_URL))
  : null

export type TokenIssuer = 'supabase' | 'workos'

/**
 * Which configured issuer minted this token, by its `iss` claim. Exported for tests.
 *
 * Returns null for anything unrecognised, INCLUDING a WorkOS token when no WorkOS issuer
 * is configured. Absent configuration must never degrade into accepting an unknown
 * issuer — that would turn a missing env var into an authentication bypass.
 */
export function classifyIssuer(
  iss: string | undefined,
  supabaseIssuer: string | undefined,
  workosIssuer: string | undefined
): TokenIssuer | null {
  if (!iss) return null
  if (supabaseIssuer && iss === supabaseIssuer) return 'supabase'
  if (workosIssuer && iss === workosIssuer) return 'workos'
  return null
}

/**
 * The internal user id a VERIFIED payload names.
 *
 * Supabase `sub` is the internal UUID; WorkOS `sub` is a WorkOS id (`user_01…`) and the
 * UUID travels in `external_id`. Kept identical in shape to `decodeUserId` in the
 * frontend's useAuth.ts and to civic_spaces.current_user_id() in the database — all three
 * must agree about who the caller is, or a request authenticates as one identity and
 * reads rows as another.
 *
 * An unlinked WorkOS account (no external_id) resolves to its own WorkOS sub, which
 * matches no stored row: fail-closed, and the same answer the other two layers give.
 */
export function internalUserId(payload: {
  sub?: unknown
  external_id?: unknown
}): string | null {
  const externalId = payload.external_id
  if (typeof externalId === 'string' && externalId !== '') return externalId

  const sub = payload.sub
  return typeof sub === 'string' && sub !== '' ? sub : null
}

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }

  const token = authHeader.slice(7)

  // Read `iss` without verifying, only to pick a key set. Nothing is trusted yet.
  let iss: string | undefined
  try {
    iss = decodeJwt(token).iss
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  const issuer = classifyIssuer(iss, SUPABASE_ISSUER, WORKOS_ISSUER)
  if (!issuer) {
    console.warn(`[auth] rejected token from unrecognised issuer: ${iss ?? '(none)'}`)
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  const jwks = issuer === 'workos' ? workosJwks : supabaseJwks
  const expectedIssuer = issuer === 'workos' ? WORKOS_ISSUER : SUPABASE_ISSUER
  if (!jwks || !expectedIssuer) {
    console.error(`[auth] no JWKS configured for issuer ${issuer}`)
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  try {
    // Pin the issuer we classified, so a token cannot be verified against one issuer's
    // keys while claiming another's.
    const { payload } = await jwtVerify(token, jwks, { issuer: expectedIssuer })

    const userId = internalUserId(payload)
    if (!userId) {
      console.warn(`[auth] ${issuer} token names no internal user`)
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    req.userId = userId
    req.rawToken = token
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
