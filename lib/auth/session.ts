import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { db } from '@/lib/db'
import { signToken } from './jwt'
import { ACTIVE_PROFILE_COOKIE } from './profile'
import type { UserRole } from './types'

type Session = { userId: string; role: UserRole }

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
  // Every login starts as the account holder, never as a kid a previous user
  // of this browser had selected.
  cookieStore.delete(ACTIVE_PROFILE_COOKIE)
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  cookieStore.delete(ACTIVE_PROFILE_COOKIE)
}

// One lookup per request no matter how many getSession() calls a render makes.
const currentTokenVersion = cache(async (userId: string): Promise<number | null> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  })
  return user?.tokenVersion ?? null
})

// Returns the logged-in account, ignoring any selected kid profile.
// Reads the user identity forwarded by middleware via request headers.
// Only works in server components and server actions — not in middleware or Edge routes.
//
// The token's tokenVersion is re-checked against the database here because
// sessions are stateless 7-day JWTs: changing a password bumps the stored
// version, stranding every session issued before the change. Middleware runs on
// the Edge and cannot reach the database, so this is the chokepoint.
export async function getAccountSession(): Promise<Session | null> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  const role = headersList.get('x-user-role') as UserRole | null
  const tokenVersion = headersList.get('x-user-token-version')
  if (!userId || !role || tokenVersion === null) return null

  if ((await currentTokenVersion(userId)) !== Number(tokenVersion)) return null

  return { userId, role }
}

// One lookup per request, like currentTokenVersion.
const activeDependentId = cache(async (guardianId: string, kidId: string): Promise<string | null> => {
  const kid = await db.user.findFirst({
    where: { id: kidId, guardianId, isActive: true, role: 'STUDENT', guardian: { isActive: true } },
    select: { id: true },
  })
  return kid?.id ?? null
})

// The learner the student portal is acting as: the kid the parent selected,
// when that kid belongs to this account and is active and the account itself
// is active, otherwise the account.
// Every student page and action reads its user from here, which is what makes
// them all work for a kid unchanged. Account-level actions (password, managing
// kids, switching) use getAccountSession instead.
//
// An invalid cookie is ignored rather than cleared: server components cannot
// write cookies, and falling back to the account is already safe.
export async function getSession(): Promise<Session | null> {
  const account = await getAccountSession()
  if (!account || account.role !== 'STUDENT') return account

  const kidId = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value
  if (!kidId) return account

  const learnerId = await activeDependentId(account.userId, kidId)
  return learnerId ? { userId: learnerId, role: 'STUDENT' } : account
}
