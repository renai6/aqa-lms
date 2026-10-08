import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { user: { findUnique: vi.fn(), update: vi.fn() } } }))
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/students/dependents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/students/dependents')>()),
  createDependent: vi.fn(),
  updateDependent: vi.fn(),
  removeDependent: vi.fn(),
}))

import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { createDependent, removeDependent, updateDependent } from '@/lib/students/dependents'
import {
  addKidAdminAction,
  removeKidAdminAction,
  updateKidAdminAction,
} from '@/app/(admin)/admin/students/actions'

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const kid = { firstName: 'Ana', lastName: 'Muloc', gender: 'FEMALE' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })
})

describe('admin kid actions', () => {
  it('adds a kid to the given parent and refreshes both student pages', async () => {
    vi.mocked(createDependent).mockResolvedValue({ ok: true, id: 'k1' })

    expect(await addKidAdminAction({ error: null }, form({ ...kid, guardianId: 'p1' }))).toEqual({ error: null, success: true })
    expect(createDependent).toHaveBeenCalledWith('p1', kid)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students/p1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students')
  })

  it('rejects a teacher', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })

    expect(await addKidAdminAction({ error: null }, form({ ...kid, guardianId: 'p1' }))).toEqual({ error: 'Forbidden' })
    expect(createDependent).not.toHaveBeenCalled()
  })

  it('edits and removes scoped to the parent named in the form', async () => {
    vi.mocked(updateDependent).mockResolvedValue({ ok: true, id: 'k1' })
    vi.mocked(removeDependent).mockResolvedValue({ ok: true, id: 'k1' })

    await updateKidAdminAction({ error: null }, form({ ...kid, guardianId: 'p1', kidId: 'k1' }))
    await removeKidAdminAction({ error: null }, form({ guardianId: 'p1', kidId: 'k1' }))

    expect(updateDependent).toHaveBeenCalledWith('p1', 'k1', kid)
    expect(removeDependent).toHaveBeenCalledWith('p1', 'k1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students/k1')
  })
})
