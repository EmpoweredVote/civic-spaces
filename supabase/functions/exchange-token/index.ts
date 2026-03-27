import { createRemoteJWKSet, jwtVerify, SignJWT } from 'https://deno.land/x/jose@v5.2.0/index.ts'

const ACCOUNTS_JWKS_URL = Deno.env.get('ACCOUNTS_JWKS_URL')!
const ACCOUNTS_ISSUER = Deno.env.get('ACCOUNTS_ISSUER')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET')!

const JWKS = createRemoteJWKSet(new URL(ACCOUNTS_JWKS_URL))

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing authorization header' }, { status: 401 })
  }

  const accountsToken = authHeader.slice(7)

  try {
    const { payload } = await jwtVerify(accountsToken, JWKS, {
      issuer: ACCOUNTS_ISSUER,
    })

    const sub = payload.sub!
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 3600 // 1 hour

    const jwtSecret = new TextEncoder().encode(SUPABASE_JWT_SECRET)

    const accessToken = await new SignJWT({
      sub,
      role: 'authenticated',
      iss: `${SUPABASE_URL}/auth/v1`,
      aud: 'authenticated',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(jwtSecret)

    return Response.json(
      { access_token: accessToken, expires_at: exp },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (err) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }
})
