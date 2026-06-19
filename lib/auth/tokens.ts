import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import type { TokenType } from '@/app/generated/prisma'

const TOKEN_EXPIRY_MS: Record<string, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
}

export async function createVerificationToken(userId: string, type: TokenType): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS[type])
  await db.verificationToken.create({ data: { userId, token, type, expiresAt } })
  return token
}

export async function verifyAndConsumeToken(token: string, type: TokenType): Promise<string | null> {
  const record = await db.verificationToken.findUnique({ where: { token } })
  if (!record || record.type !== type || record.expiresAt < new Date()) return null
  await db.verificationToken.delete({ where: { token } })
  return record.userId
}
