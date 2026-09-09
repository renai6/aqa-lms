import { describe, it, expect, vi } from 'vitest'

// isAdmin itself never touches the DB, but capabilities.ts imports `db` at
// module scope, which throws without DATABASE_URL outside a running app.
vi.mock('@/lib/db', () => ({ db: {} }))

import { isAdmin } from '@/lib/auth/capabilities'

describe('isAdmin', () => {
  it('is true for SUPER_ADMIN and ADMIN', () => {
    expect(isAdmin({ userId: 'u', role: 'SUPER_ADMIN' })).toBe(true)
    expect(isAdmin({ userId: 'u', role: 'ADMIN' })).toBe(true)
  })

  it('is false for a teacher, a student and no session', () => {
    expect(isAdmin({ userId: 'u', role: 'TEACHER' })).toBe(false)
    expect(isAdmin({ userId: 'u', role: 'STUDENT' })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})
