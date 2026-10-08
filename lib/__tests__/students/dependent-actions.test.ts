import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { user: { findFirst: vi.fn() } } }))
vi.mock('@/lib/auth/session', () => ({ getAccountSession: vi.fn() }))
vi.mock('@/lib/auth/profile', () => ({ setActiveProfile: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))
vi.mock('@/lib/students/dependents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/students/dependents')>()),
  createDependent: vi.fn(),
  updateDependent: vi.fn(),
  removeDependent: vi.fn(),
}))

import { db } from '@/lib/db'
import { getAccountSession } from '@/lib/auth/session'
import { setActiveProfile } from '@/lib/auth/profile'
import { createDependent, removeDependent, updateDependent } from '@/lib/students/dependents'
import {
  addKidAction,
  removeKidAction,
  switchProfileAction,
  updateKidAction,
} from '@/lib/students/dependent-actions'

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const kid = { firstName: 'Ana', lastName: 'Muloc', gender: 'FEMALE' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAccountSession).mockResolvedValue({ userId: 'p1', role: 'STUDENT' })
})

describe('switchProfileAction', () => {
  it('selects an active kid of this account and goes to the dashboard', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: 'k1' } as never)

    await expect(switchProfileAction(form({ kidId: 'k1' }))).rejects.toThrow('NEXT_REDIRECT /student/dashboard')
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'k1', guardianId: 'p1', isActive: true, role: 'STUDENT', guardian: { isActive: true } },
      select: { id: true },
    })
    expect(setActiveProfile).toHaveBeenCalledWith('k1')
  })

  it("refuses another family's kid by switching back to the account", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null as never)

    await expect(switchProfileAction(form({ kidId: 'k9' }))).rejects.toThrow('NEXT_REDIRECT')
    expect(setActiveProfile).toHaveBeenCalledWith(null)
  })

  it('switches back to the account holder on an empty kidId', async () => {
    await expect(switchProfileAction(form({ kidId: '' }))).rejects.toThrow('NEXT_REDIRECT /student/dashboard')
    expect(setActiveProfile).toHaveBeenCalledWith(null)
    expect(db.user.findFirst).not.toHaveBeenCalled()
  })

  it('sends a non-student to login', async () => {
    vi.mocked(getAccountSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' })

    await expect(switchProfileAction(form({ kidId: 'k1' }))).rejects.toThrow('NEXT_REDIRECT /login')
    expect(setActiveProfile).not.toHaveBeenCalled()
  })
})

describe('addKidAction', () => {
  it('creates the kid under the logged-in account, selects it, and opens the catalog', async () => {
    vi.mocked(createDependent).mockResolvedValue({ ok: true, id: 'k1' })

    await expect(addKidAction({ error: null }, form(kid))).rejects.toThrow('NEXT_REDIRECT /student/courses')
    expect(createDependent).toHaveBeenCalledWith('p1', kid)
    expect(setActiveProfile).toHaveBeenCalledWith('k1')
  })

  it('returns a validation error without creating anything', async () => {
    const result = await addKidAction({ error: null }, form({ firstName: 'Ana', lastName: 'Muloc' }))

    expect(result).toEqual({ error: 'Gender is required.' })
    expect(createDependent).not.toHaveBeenCalled()
  })

  it('rejects staff', async () => {
    vi.mocked(getAccountSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })

    expect(await addKidAction({ error: null }, form(kid))).toEqual({ error: 'Unauthorized' })
  })
})

describe('updateKidAction and removeKidAction', () => {
  it('scopes an edit to the logged-in account', async () => {
    vi.mocked(updateDependent).mockResolvedValue({ ok: true, id: 'k1' })

    expect(await updateKidAction({ error: null }, form({ ...kid, kidId: 'k1' }))).toEqual({ error: null, success: true })
    expect(updateDependent).toHaveBeenCalledWith('p1', 'k1', kid)
  })

  it('scopes a removal to the logged-in account and passes its refusal through', async () => {
    vi.mocked(removeDependent).mockResolvedValue({ ok: false, error: 'has history' })

    expect(await removeKidAction({ error: null }, form({ kidId: 'k1' }))).toEqual({ error: 'has history' })
    expect(removeDependent).toHaveBeenCalledWith('p1', 'k1')
  })
})
