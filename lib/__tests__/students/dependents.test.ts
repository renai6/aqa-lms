import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import {
  createDependent,
  linkDependent,
  parseDependentForm,
  removeDependent,
  updateDependent,
} from '@/lib/students/dependents'

const ana = { firstName: 'Ana', lastName: 'Muloc', gender: 'FEMALE' as const }

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

beforeEach(() => vi.clearAllMocks())

describe('parseDependentForm', () => {
  it('trims and accepts a complete kid', () => {
    expect(parseDependentForm(form({ firstName: ' Ana ', lastName: 'Muloc', gender: 'FEMALE' }))).toEqual({
      ok: true,
      data: ana,
    })
  })

  it('requires a gender, since gender-restricted subjects hide from a null gender', () => {
    expect(parseDependentForm(form({ firstName: 'Ana', lastName: 'Muloc' }))).toEqual({
      ok: false,
      error: 'Gender is required.',
    })
  })

  it('requires a first name', () => {
    expect(parseDependentForm(form({ firstName: '  ', lastName: 'Muloc', gender: 'FEMALE' }))).toEqual({
      ok: false,
      error: 'First name is required.',
    })
  })
})

describe('createDependent', () => {
  it('creates a STUDENT with no email, owned by the guardian, as a new student', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ role: 'STUDENT', isActive: true, guardianId: null } as never)
    vi.mocked(db.user.create).mockResolvedValue({ id: 'k1' } as never)

    expect(await createDependent('p1', ana)).toEqual({ ok: true, id: 'k1' })
    expect(db.user.create).toHaveBeenCalledWith({
      data: { ...ana, role: 'STUDENT', guardianId: 'p1', studentType: 'NEW' },
      select: { id: true },
    })
  })

  it.each([
    ['a kid', { role: 'STUDENT', isActive: true, guardianId: 'p0' }],
    ['staff', { role: 'TEACHER', isActive: true, guardianId: null }],
    ['a missing account', null],
  ])('refuses %s as a guardian', async (_label, guardian) => {
    vi.mocked(db.user.findUnique).mockResolvedValue(guardian as never)

    expect(await createDependent('p1', ana)).toEqual({ ok: false, error: 'This account cannot add kids.' })
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('refuses an inactive guardian', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ role: 'STUDENT', isActive: false, guardianId: null } as never)

    expect(await createDependent('p1', ana)).toEqual({ ok: false, error: 'This account is inactive.' })
  })
})

describe('updateDependent', () => {
  it('only updates a kid of this guardian', async () => {
    vi.mocked(db.user.updateMany).mockResolvedValue({ count: 1 } as never)

    expect(await updateDependent('p1', 'k1', ana)).toEqual({ ok: true, id: 'k1' })
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: 'k1', guardianId: 'p1' }, data: ana })
  })

  it("reports another family's kid as not found", async () => {
    vi.mocked(db.user.updateMany).mockResolvedValue({ count: 0 } as never)

    expect(await updateDependent('p1', 'k9', ana)).toEqual({ ok: false, error: 'Kid not found.' })
  })
})

describe('removeDependent', () => {
  it('deletes a kid with no history', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ email: null, _count: { purchases: 0, enrollments: 0 } } as never)

    expect(await removeDependent('p1', 'k1')).toEqual({ ok: true, id: 'k1' })
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'k1', guardianId: 'p1' } }),
    )
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'k1' } })
  })

  it.each([
    [{ purchases: 1, enrollments: 0 }],
    [{ purchases: 0, enrollments: 1 }],
  ])('keeps a kid with history %o', async (_count) => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ email: null, _count } as never)

    const result = await removeDependent('p1', 'k1')
    expect(result.ok).toBe(false)
    expect(db.user.delete).not.toHaveBeenCalled()
  })

  it('refuses a kid with their own login and never deletes', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({
      email: 'kid@example.com',
      _count: { purchases: 0, enrollments: 0 },
    } as never)

    expect(await removeDependent('p1', 'k1')).toEqual({
      ok: false,
      error: 'This kid has their own login, so the profile cannot be removed.',
    })
    expect(db.user.delete).not.toHaveBeenCalled()
  })

  it('reports a delete that loses a race with a new purchase as an error, not a crash', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ email: null, _count: { purchases: 0, enrollments: 0 } } as never)
    vi.mocked(db.user.delete).mockRejectedValue(new Error('foreign key'))

    expect((await removeDependent('p1', 'k1')).ok).toBe(false)
  })
})

describe('linkDependent', () => {
  const parent = { id: 'p1', role: 'STUDENT', isActive: true, guardianId: null }
  const student = { id: 'k1', role: 'STUDENT', guardianId: null, _count: { dependents: 0 } }

  function mockUsers(guardian: unknown, kid: unknown) {
    vi.mocked(db.user.findUnique).mockImplementation((async (args: { where: { id?: string; email?: string } }) =>
      args.where.email ? guardian : kid) as never)
  }

  it('links an eligible student, looking the parent up by trimmed lowercase email', async () => {
    mockUsers(parent, student)
    vi.mocked(db.user.updateMany).mockResolvedValue({ count: 1 })

    expect(await linkDependent('k1', ' Parent@Example.com ')).toEqual({ ok: true, id: 'k1' })
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'parent@example.com' } }),
    )
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'k1', guardianId: null },
      data: { guardianId: 'p1' },
    })
  })

  const ineligible = 'No eligible parent account has that email.'
  it.each([
    ['missing', null],
    ['a teacher', { ...parent, role: 'TEACHER' }],
    ['a kid themselves', { ...parent, guardianId: 'x' }],
  ])('refuses a parent that is %s', async (_n, guardian) => {
    mockUsers(guardian, student)
    expect(await linkDependent('k1', 'p@example.com')).toEqual({ ok: false, error: ineligible })
    expect(db.user.updateMany).not.toHaveBeenCalled()
  })

  it.each([
    ['an inactive parent', parent && { ...parent, isActive: false }, student, 'That parent account is inactive.'],
    ['linking to self', { ...parent, id: 'k1' }, student, 'A student cannot be linked to their own account.'],
    ['a missing student', parent, null, 'Student not found.'],
    ['a non-student', parent, { ...student, role: 'TEACHER' }, 'Student not found.'],
    ['an already linked student', parent, { ...student, guardianId: 'p2' }, 'This student is already linked to a parent.'],
    [
      'a student with kids',
      parent,
      { ...student, _count: { dependents: 1 } },
      'This student has kids of their own, so they cannot be linked to a parent.',
    ],
  ])('refuses %s', async (_n, guardian, kid, error) => {
    mockUsers(guardian, kid)
    expect(await linkDependent('k1', 'p@example.com')).toEqual({ ok: false, error })
    expect(db.user.updateMany).not.toHaveBeenCalled()
  })

  it('reports a lost race as already linked', async () => {
    mockUsers(parent, student)
    vi.mocked(db.user.updateMany).mockResolvedValue({ count: 0 })
    expect(await linkDependent('k1', 'p@example.com')).toEqual({
      ok: false,
      error: 'This student is already linked to a parent.',
    })
  })

  it('reports a database error', async () => {
    mockUsers(parent, student)
    vi.mocked(db.user.updateMany).mockRejectedValue(new Error('boom'))
    expect((await linkDependent('k1', 'p@example.com')).ok).toBe(false)
  })
})
