'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { comparePassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { ROLE_DASHBOARDS } from '@/lib/auth/dashboards'

type LoginState = { error: string | null }

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email')
  const password = formData.get('password')
  const courseId = String(formData.get('courseId') ?? '').trim()
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { error: 'Invalid email or password.' }
  }

  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return { error: 'Invalid email or password.' }
  }

  if (!user.isActive) {
    return {
      error:
        "This account isn't active. If you just registered, check your email for a verification link; otherwise contact your administrator.",
    }
  }

  await createSession({ id: user.id, role: user.role, email: user.email, mustChangePassword: user.mustChangePassword, tokenVersion: user.tokenVersion })

  if (user.mustChangePassword) {
    redirect('/change-password')
  }
  if (user.role === 'STUDENT' && courseId) {
    redirect(`/student/checkout?ids=${courseId}`)
  }
  redirect(ROLE_DASHBOARDS[user.role])
}
