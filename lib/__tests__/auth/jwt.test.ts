import { describe, it, expect, beforeAll } from 'vitest'
import { signToken, verifySessionToken } from '@/lib/auth/jwt'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-characters!!'
})

describe('signToken + verifySessionToken', () => {
  it('produces a token that verifies successfully', async () => {
    const payload = { sub: 'user-1', role: 'STUDENT' as const, email: 'student@test.com' }
    const token = await signToken(payload)
    const result = await verifySessionToken(token)
    expect(result?.sub).toBe('user-1')
    expect(result?.role).toBe('STUDENT')
    expect(result?.email).toBe('student@test.com')
  })

  it('returns null for a tampered token', async () => {
    const result = await verifySessionToken('totally.invalid.token')
    expect(result).toBeNull()
  })

  it('returns null for empty string', async () => {
    const result = await verifySessionToken('')
    expect(result).toBeNull()
  })
})
