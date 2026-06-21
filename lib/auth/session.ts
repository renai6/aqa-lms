import { cookies, headers } from 'next/headers'
import { signToken } from './jwt'
import type { UserRole } from './types'

export async function createSession(user: { id: string; role: UserRole; email: string; mustChangePassword: boolean }) {
  const token = await signToken({ sub: user.id, role: user.role, email: user.email, mustChangePassword: user.mustChangePassword })
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

// Reads the user identity forwarded by middleware via request headers.
// Only works in server components and server actions — not in middleware or Edge routes.
export async function getSession(): Promise<{ userId: string; role: UserRole } | null> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  const role = headersList.get('x-user-role') as UserRole | null
  if (!userId || !role) return null
  return { userId, role }
}
