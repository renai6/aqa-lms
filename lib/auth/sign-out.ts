'use server'

import { clearSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export async function signOutAction() {
  await clearSession()
  redirect('/login')
}
