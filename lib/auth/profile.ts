import { cookies } from 'next/headers'

// Which kid profile a parent is currently studying as. Not signed: getSession
// only honours it after checking in the database that the kid belongs to the
// logged-in account, so a forged value can only resolve to the account itself.
export const ACTIVE_PROFILE_COOKIE = 'active_profile'

export async function setActiveProfile(kidId: string | null) {
  const cookieStore = await cookies()
  if (!kidId) {
    cookieStore.delete(ACTIVE_PROFILE_COOKIE)
    return
  }
  cookieStore.set(ACTIVE_PROFILE_COOKIE, kidId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}
