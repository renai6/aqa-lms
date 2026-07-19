import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { db } from '@/lib/db'
import { signToken } from './jwt'
import type { UserRole } from './types'

export async function createSession(user: {
  id: string
  role: UserRole
  email: string
  mustChangePassword: boolean
  tokenVersion: number
}) {
  const token = await signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    tokenVersion: user.tokenVersion,
  })
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

// One lookup per request no matter how many getSession() calls a render makes.
const currentTokenVersion = cache(async (userId: string): Promise<number | null> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  })
  return user?.tokenVersion ?? null
})

// Reads the user identity forwarded by middleware via request headers.
// Only works in server components and server actions — not in middleware or Edge routes.
//
// The token's tokenVersion is re-checked against the database here because
// sessions are stateless 7-day JWTs: changing a password bumps the stored
// version, stranding every session issued before the change. Middleware runs on
// the Edge and cannot reach the database, so this is the chokepoint.
export async function getSession(): Promise<{ userId: string; role: UserRole } | null> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  const role = headersList.get('x-user-role') as UserRole | null
  const tokenVersion = headersList.get('x-user-token-version')
  if (!userId || !role || tokenVersion === null) return null

  if ((await currentTokenVersion(userId)) !== Number(tokenVersion)) return null

  return { userId, role }
}
