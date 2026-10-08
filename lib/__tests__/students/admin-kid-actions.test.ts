import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { user: { findUnique: vi.fn(), update: vi.fn() } } }))
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/students/dependents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/students/dependents')>()),
  createDependent: vi.fn(),
  updateDependent: vi.fn(),
  removeDependent: vi.fn(),
  linkDependent: vi.fn(),
  findEligibleGuardian: vi.fn(),
  unlinkDependent: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import {
  createDependent,
  findEligibleGuardian,
  linkDependent,
  removeDependent,
  unlinkDependent,
  updateDependent,
} from '@/lib/students/dependents'
import {
  addKidAdminAction,
  findParentForLinkAdminAction,
  linkToParentAdminAction,
  removeKidAdminAction,
  unlinkFromParentAdminAction,
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

describe('linkToParentAdminAction', () => {
  const run = (f: Record<string, string>) => linkToParentAdminAction({ error: null }, form(f))

  it('rejects a teacher', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })
    expect(await run({ kidId: 'k1', parentEmail: 'p@example.com' })).toEqual({ error: 'Forbidden' })
    expect(linkDependent).not.toHaveBeenCalled()
  })

  it('links the student, names the parent and refreshes both pages', async () => {
    vi.mocked(linkDependent).mockResolvedValue({ ok: true, id: 'k1' })
    vi.mocked(db.user.findUnique).mockResolvedValue({
      guardianId: 'p1',
      guardian: { firstName: 'Raffi', lastName: 'Muloc' },
    } as never)

    expect(await run({ kidId: 'k1', parentEmail: 'p@example.com' })).toEqual({
      error: null,
      success: true,
      parentName: 'Raffi Muloc',
    })
    expect(linkDependent).toHaveBeenCalledWith('k1', 'p@example.com')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students/p1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students/k1')
  })

  it('returns the rule error', async () => {
    vi.mocked(linkDependent).mockResolvedValue({ ok: false, error: 'Student not found.' })
    expect(await run({ kidId: 'k1', parentEmail: 'p@example.com' })).toEqual({ error: 'Student not found.' })
  })

  it('requires an email', async () => {
    expect(await run({ kidId: 'k1', parentEmail: '  ' })).toEqual({ error: "Enter the parent's email." })
    expect(linkDependent).not.toHaveBeenCalled()
  })
})

describe('findParentForLinkAdminAction', () => {
  const run = (f: Record<string, string>) => findParentForLinkAdminAction({ error: null }, form(f))
  const match = { id: 'p1', name: 'Raffi Muloc', email: 'p@example.com' }

  it('rejects a teacher', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })
    expect(await run({ kidId: 'k1', parentEmail: 'p@example.com' })).toEqual({ error: 'Forbidden' })
    expect(findEligibleGuardian).not.toHaveBeenCalled()
  })

  it('returns the matched parent without linking', async () => {
    vi.mocked(findEligibleGuardian).mockResolvedValue({ ok: true, parent: match })

    expect(await run({ kidId: 'k1', parentEmail: ' p@example.com ' })).toEqual({ error: null, parent: match })
    expect(findEligibleGuardian).toHaveBeenCalledWith('k1', 'p@example.com')
    expect(linkDependent).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns the eligibility error', async () => {
    vi.mocked(findEligibleGuardian).mockResolvedValue({ ok: false, error: 'That parent account is inactive.' })
    expect(await run({ kidId: 'k1', parentEmail: 'p@example.com' })).toEqual({
      error: 'That parent account is inactive.',
    })
  })

  it('requires an email', async () => {
    expect(await run({ kidId: 'k1', parentEmail: '  ' })).toEqual({ error: "Enter the parent's email." })
    expect(findEligibleGuardian).not.toHaveBeenCalled()
  })
})

describe('unlinkFromParentAdminAction', () => {
  const run = (f: Record<string, string>) => unlinkFromParentAdminAction({ error: null }, form(f))

  it('rejects a teacher', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' })
    expect(await run({ kidId: 'k1' })).toEqual({ error: 'Forbidden' })
    expect(unlinkDependent).not.toHaveBeenCalled()
  })

  it("unlinks the student and refreshes the old parent's page, the student's and the list", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ guardianId: 'p1' } as never)
    vi.mocked(unlinkDependent).mockResolvedValue({ ok: true, id: 'k1' })

    expect(await run({ kidId: 'k1' })).toEqual({ error: null, success: true })
    expect(unlinkDependent).toHaveBeenCalledWith('k1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students/p1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students/k1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/students')
  })

  it('returns the rule error and refreshes nothing', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ guardianId: 'p1' } as never)
    vi.mocked(unlinkDependent).mockResolvedValue({
      ok: false,
      error: 'Only a student with their own login can be unlinked from a parent.',
    })

    expect(await run({ kidId: 'k1' })).toEqual({
      error: 'Only a student with their own login can be unlinked from a parent.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
