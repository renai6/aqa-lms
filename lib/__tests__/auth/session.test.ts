const mockHeaders = vi.hoisted(() => new Map<string, string>())
const cookieJar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => mockHeaders.get(k) ?? null }),
  cookies: async () => ({
    get: (k: string) => (cookieJar.values.has(k) ? { value: cookieJar.values.get(k)! } : undefined),
    set: cookieJar.set,
    delete: cookieJar.delete,
  }),
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  // Bypass request-scoped memoization so each test sees a fresh lookup.
  cache: <T>(fn: T) => fn,
}))

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: vi.fn(), findFirst: vi.fn() } },
}))

import { db } from '@/lib/db'
import { clearSession, createSession, getAccountSession, getSession } from '@/lib/auth/session'

function forwardIdentity({ id, role, tokenVersion }: { id?: string; role?: string; tokenVersion?: string }) {
  mockHeaders.clear()
  if (id !== undefined) mockHeaders.set('x-user-id', id)
  if (role !== undefined) mockHeaders.set('x-user-role', role)
  if (tokenVersion !== undefined) mockHeaders.set('x-user-token-version', tokenVersion)
}

beforeEach(() => {
  vi.mocked(db.user.findUnique).mockReset()
  vi.mocked(db.user.findFirst).mockReset()
  cookieJar.values.clear()
  cookieJar.set.mockReset()
  cookieJar.delete.mockReset()
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long'
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

describe('getSession active kid profile', () => {
  function asStudent() {
    forwardIdentity({ id: 'u1', role: 'STUDENT', tokenVersion: '3' })
    vi.mocked(db.user.findUnique).mockResolvedValue({ tokenVersion: 3 } as never)
  }

  it('resolves to the kid when the cookie names an active kid of this account', async () => {
    asStudent()
    cookieJar.values.set('active_profile', 'k1')
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: 'k1' } as never)

    expect(await getSession()).toEqual({ userId: 'k1', role: 'STUDENT' })
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'k1', guardianId: 'u1', isActive: true },
      select: { id: true },
    })
  })

  it('falls back to the account for a kid that is not theirs, inactive, or gone', async () => {
    asStudent()
    cookieJar.values.set('active_profile', 'someone-elses-kid')
    vi.mocked(db.user.findFirst).mockResolvedValue(null as never)

    expect(await getSession()).toEqual({ userId: 'u1', role: 'STUDENT' })
  })

  it('is the account when no profile is selected, without an extra lookup', async () => {
    asStudent()

    expect(await getSession()).toEqual({ userId: 'u1', role: 'STUDENT' })
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it('ignores the cookie for staff', async () => {
    forwardIdentity({ id: 'a1', role: 'ADMIN', tokenVersion: '0' })
    vi.mocked(db.user.findUnique).mockResolvedValue({ tokenVersion: 0 } as never)
    cookieJar.values.set('active_profile', 'k1')

    expect(await getSession()).toEqual({ userId: 'a1', role: 'ADMIN' })
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it('rejects a stale token even while a kid is selected', async () => {
    forwardIdentity({ id: 'u1', role: 'STUDENT', tokenVersion: '3' })
    vi.mocked(db.user.findUnique).mockResolvedValue({ tokenVersion: 4 } as never)
    cookieJar.values.set('active_profile', 'k1')

    expect(await getSession()).toBeNull()
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it('getAccountSession ignores the selected kid', async () => {
    asStudent()
    cookieJar.values.set('active_profile', 'k1')
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: 'k1' } as never)

    expect(await getAccountSession()).toEqual({ userId: 'u1', role: 'STUDENT' })
  })
})

describe('profile cookie lifecycle', () => {
  it('a new login starts as the account holder', async () => {
    await createSession({ id: 'u2', role: 'STUDENT', email: 'b@example.com', mustChangePassword: false, tokenVersion: 0 })
    expect(cookieJar.delete).toHaveBeenCalledWith('active_profile')
  })

  it('signing out forgets the selected kid', async () => {
    await clearSession()
    expect(cookieJar.delete).toHaveBeenCalledWith('session')
    expect(cookieJar.delete).toHaveBeenCalledWith('active_profile')
  })
})
