import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword } from '@/lib/auth/password'

describe('hashPassword', () => {
  it('returns a string different from the input', async () => {
    const hash = await hashPassword('secret123')
    expect(hash).not.toBe('secret123')
    expect(typeof hash).toBe('string')
  })

  it('produces different hashes for the same input (salt)', async () => {
    const a = await hashPassword('secret123')
    const b = await hashPassword('secret123')
    expect(a).not.toBe(b)
  })
})

describe('comparePassword', () => {
  it('returns true when password matches hash', async () => {
    const hash = await hashPassword('secret123')
    expect(await comparePassword('secret123', hash)).toBe(true)
  })

  it('returns false when password does not match hash', async () => {
    const hash = await hashPassword('secret123')
    expect(await comparePassword('wrongpassword', hash)).toBe(false)
  })
})
