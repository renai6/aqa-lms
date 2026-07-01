import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VerificationToken } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  db: {
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { createVerificationToken, verifyAndConsumeToken } from '@/lib/auth/tokens'

describe('createVerificationToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a DB record with the correct userId and type', async () => {
    vi.mocked(db.verificationToken.create).mockResolvedValue({} as VerificationToken)

    const token = await createVerificationToken('user-1', 'EMAIL_VERIFICATION')

    expect(typeof token).toBe('string')
    expect(token.length).toBe(64) // 32 bytes -> 64 hex chars
    expect(db.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'EMAIL_VERIFICATION',
        }),
      })
    )
  })
})

describe('verifyAndConsumeToken', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no record is found', async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue(null)
    const result = await verifyAndConsumeToken('no-token', 'EMAIL_VERIFICATION')
    expect(result).toBeNull()
  })

  it('returns null when token type does not match', async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: '1',
      userId: 'user-1',
      token: 'abc',
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
    })
    const result = await verifyAndConsumeToken('abc', 'EMAIL_VERIFICATION')
    expect(result).toBeNull()
  })

  it('returns null when token is expired', async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: '1',
      userId: 'user-1',
      token: 'abc',
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
    })
    const result = await verifyAndConsumeToken('abc', 'EMAIL_VERIFICATION')
    expect(result).toBeNull()
  })

  it('returns userId and deletes the record when valid', async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      id: '1',
      userId: 'user-1',
      token: 'abc',
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
    })
    vi.mocked(db.verificationToken.delete).mockResolvedValue({} as VerificationToken)

    const result = await verifyAndConsumeToken('abc', 'EMAIL_VERIFICATION')

    expect(result).toBe('user-1')
    expect(db.verificationToken.delete).toHaveBeenCalledWith({ where: { token: 'abc' } })
  })
})
