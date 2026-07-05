import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    subjectTeacher: {
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { canManageSubject } from '@/lib/auth/capabilities'

describe('canManageSubject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false for no session', async () => {
    expect(await canManageSubject(null, 'sub-1')).toBe(false)
    expect(db.subjectTeacher.findUnique).not.toHaveBeenCalled()
  })

  it('allows ADMIN and SUPER_ADMIN without a DB lookup', async () => {
    expect(
      await canManageSubject({ userId: 'a', role: 'ADMIN' }, 'sub-1'),
    ).toBe(true)
    expect(
      await canManageSubject({ userId: 'a', role: 'SUPER_ADMIN' }, 'sub-1'),
    ).toBe(true)
    expect(db.subjectTeacher.findUnique).not.toHaveBeenCalled()
  })

  it('allows a TEACHER assigned to the subject', async () => {
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue({
      subjectId: 'sub-1',
    } as never)
    expect(
      await canManageSubject({ userId: 't1', role: 'TEACHER' }, 'sub-1'),
    ).toBe(true)
    expect(db.subjectTeacher.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { subjectId_userId: { subjectId: 'sub-1', userId: 't1' } },
      }),
    )
  })

  it('denies a TEACHER not assigned to the subject', async () => {
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue(null)
    expect(
      await canManageSubject({ userId: 't1', role: 'TEACHER' }, 'sub-9'),
    ).toBe(false)
  })

  it('denies a STUDENT', async () => {
    expect(
      await canManageSubject({ userId: 's1', role: 'STUDENT' }, 'sub-1'),
    ).toBe(false)
    expect(db.subjectTeacher.findUnique).not.toHaveBeenCalled()
  })
})
