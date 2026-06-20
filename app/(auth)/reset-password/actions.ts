'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { verifyAndConsumeToken } from '@/lib/auth/tokens'
import { hashPassword } from '@/lib/auth/password'
import { TokenType } from '@/app/generated/prisma/index'

type ResetState = { error: string | null }

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = formData.get('token')
  const password = formData.get('password')
  const confirm = formData.get('confirm')

  if (typeof token !== 'string' || !token) return { error: 'This reset link is invalid.' }
  if (typeof password !== 'string' || typeof confirm !== 'string' || !password || !confirm)
    return { error: 'Invalid submission.' }
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
