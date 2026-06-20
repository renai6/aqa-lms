'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'

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

  await db.user.update({
    where: { id: session.userId },
    data: { passwordHash, mustChangePassword: false },
  })

  const DASHBOARDS: Record<string, string> = {
    SUPER_ADMIN: '/admin/dashboard',
    ADMIN: '/admin/dashboard',
    TEACHER: '/teacher/dashboard',
    STUDENT: '/student/dashboard',
  }
  redirect(DASHBOARDS[session.role] ?? '/login')
}
