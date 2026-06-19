'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { verifyAndConsumeToken } from '@/lib/auth/tokens'
import { hashPassword } from '@/lib/auth/password'
import { TokenType } from '@/app/generated/prisma'

type ResetState = { error: string | null }

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = formData.get('token') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!token) return { error: 'This reset link is invalid.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const userId = await verifyAndConsumeToken(token, TokenType.PASSWORD_RESET)
  if (!userId) return { error: 'This link is invalid or has expired.' }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  })

  redirect('/login')
}
