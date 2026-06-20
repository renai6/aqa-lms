'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession, createSession } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'
import type { UserRole } from '@/lib/auth/types'
import { ROLE_DASHBOARDS } from '@/lib/auth/dashboards'

type ActionState = { error: string | null }

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session) return { error: 'Session expired. Please log in again.' }

  const raw = {
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { password } = result.data
  const passwordHash = await hashPassword(password)

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  })
  if (!user) return { error: 'User not found.' }

  await db.user.update({
    where: { id: session.userId },
    data: { passwordHash, mustChangePassword: false },
  })

  await createSession({ id: session.userId, role: session.role as UserRole, email: user.email, mustChangePassword: false })

  redirect(ROLE_DASHBOARDS[session.role as UserRole] ?? '/login')
}
