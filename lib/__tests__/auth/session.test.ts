import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHeaders = vi.hoisted(() => new Map<string, string>())

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => mockHeaders.get(k) ?? null }),
  cookies: async () => ({ set: vi.fn(), delete: vi.fn() }),
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  // Bypass request-scoped memoization so each test sees a fresh lookup.
  cache: <T>(fn: T) => fn,
}))

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

function forwardIdentity({ id, role, tokenVersion }: { id?: string; role?: string; tokenVersion?: string }) {
  mockHeaders.clear()
  if (id !== undefined) mockHeaders.set('x-user-id', id)
  if (role !== undefined) mockHeaders.set('x-user-role', role)
  if (tokenVersion !== undefined) mockHeaders.set('x-user-token-version', tokenVersion)
}

beforeEach(() => {
  vi.mocked(db.user.findUnique).mockReset()
})

describe('getSession token version enforcement', () => {
  it('returns the session when the token version matches the database', async () => {
    forwardIdentity({ id: 'u1', role: 'STUDENT', tokenVersion: '3' })
    vi.mocked(db.user.findUnique).mockResolvedValue({ tokenVersion: 3 } as never)

    expect(await getSession()).toEqual({ userId: 'u1', role: 'STUDENT' })
  })

  it('rejects a session issued before a password reset bumped the version', async () => {
    forwardIdentity({ id: 'u1', role: 'STUDENT', tokenVersion: '3' })
    vi.mocked(db.user.findUnique).mockResolvedValue({ tokenVersion: 4 } as never)

    expect(await getSession()).toBeNull()
  })

  it('rejects a session whose user no longer exists', async () => {
    forwardIdentity({ id: 'u1', role: 'STUDENT', tokenVersion: '0' })
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never)

    expect(await getSession()).toBeNull()
  })

  it('rejects when the version header is absent, rather than trusting identity alone', async () => {
    forwardIdentity({ id: 'u1', role: 'STUDENT' })

    expect(await getSession()).toBeNull()
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns null without a database hit when there is no identity', async () => {
    forwardIdentity({})

    expect(await getSession()).toBeNull()
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })
})
