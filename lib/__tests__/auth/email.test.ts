import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('resend', () => {
  const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null })
  return {
    Resend: class {
      emails = { send: sendMock }
    },
  }
})

beforeEach(() => {
  process.env.RESEND_FROM_EMAIL = 'noreply@test.com'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
})

import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/auth/email'

describe('sendVerificationEmail', () => {
  it('calls resend.emails.send without throwing', async () => {
    await expect(sendVerificationEmail('user@test.com', 'token-abc')).resolves.not.toThrow()
  })
})

describe('sendPasswordResetEmail', () => {
  it('calls resend.emails.send without throwing', async () => {
    await expect(sendPasswordResetEmail('user@test.com', 'token-xyz')).resolves.not.toThrow()
  })
})
