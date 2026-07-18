import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { toggleStudentActiveAction } from '@/app/(admin)/admin/students/actions'

function form(userId: string): FormData {
  const fd = new FormData()
  fd.set('userId', userId)
  return fd
}

const initial = { error: null }

describe('toggleStudentActiveAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBe('Unauthorized')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('rejects a TEACHER caller', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBe('Forbidden')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('rejects a STUDENT caller', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 's9', role: 'STUDENT' })
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBe('Forbidden')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('rejects a missing userId', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
    const result = await toggleStudentActiveAction(initial, new FormData())
    expect(result.error).toBe('Invalid student ID.')
  })

  it('returns not found for an unknown id', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    const result = await toggleStudentActiveAction(initial, form('ghost'))
    expect(result.error).toBe('Student not found.')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('refuses to touch a non-student target', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
    vi.mocked(db.user.findUnique).mockResolvedValue({
      isActive: true,
      role: 'ADMIN',
    } as never)
    const result = await toggleStudentActiveAction(initial, form('a2'))
    expect(result.error).toBe('Forbidden.')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('deactivates an active student', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
    vi.mocked(db.user.findUnique).mockResolvedValue({
      isActive: true,
      role: 'STUDENT',
    } as never)
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBeNull()
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { isActive: false },
    })
  })

  it('reactivates a deactivated student', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'SUPER_ADMIN' })
    vi.mocked(db.user.findUnique).mockResolvedValue({
      isActive: false,
      role: 'STUDENT',
    } as never)
    const result = await toggleStudentActiveAction(initial, form('s1'))
    expect(result.error).toBeNull()
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { isActive: true },
    })
  })
})
