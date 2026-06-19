import { SignJWT, jwtVerify } from 'jose'
import type { SessionPayload } from './types'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
