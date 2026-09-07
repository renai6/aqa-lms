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
    } catch (err) {
      // The response must not vary with send failure (prevents email enumeration),
      // but swallowing this silently is how a broken mailer goes unnoticed for months.
      console.error('[forgotPassword] Email error:', err)
    }
  }
  // Always return the same state (prevents email enumeration)
  return { submitted: true }
}
