'use server'

import { db } from '@/lib/db'
import { createVerificationToken } from '@/lib/auth/tokens'
import { sendPasswordResetEmail } from '@/lib/auth/email'
import { TokenType } from '@prisma/client'

type ForgotState = { submitted: boolean }

export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = formData.get('email')
  if (typeof email !== 'string' || !email) return { submitted: true }

  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })

  if (user) {
    const token = await createVerificationToken(user.id, TokenType.PASSWORD_RESET)
    try {
      await sendPasswordResetEmail(email.trim().toLowerCase(), token)
    } catch {
      // Swallow so the response is always the same regardless of email existence or send failure
    }
  }
  // Always return the same state (prevents email enumeration)
  return { submitted: true }
}
