import { createRemoteJWKSet, jwtVerify } from 'jose'
import { Request, Response, NextFunction } from 'express'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      rawToken?: string
    }
  }
}

const JWKS = createRemoteJWKSet(new URL(process.env.ACCOUNTS_JWKS_URL!))

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

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.ACCOUNTS_ISSUER!,
    })
    req.userId = payload.sub
    req.rawToken = token
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
