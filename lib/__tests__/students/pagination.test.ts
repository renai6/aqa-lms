import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import {
  STUDENTS_PAGE_SIZE,
  getStudentsPage,
  getAllStudents,
} from '@/lib/students/queries'

// The shape `select` asks for; enrollments arrive nested under `course`.
function userRow(id: string) {
  return {
    id,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: `${id}@example.com`,
    gender: null,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    contactNumber: null,
    facebookName: null,
    facebookLink: null,
    enrollments: [],
  }
}

function mockDb({ total, rows = [] }: { total: number; rows?: string[] }) {
  vi.mocked(db.user.count).mockResolvedValue(total)
  vi.mocked(db.user.findMany).mockResolvedValue(rows.map(userRow) as never)
}

const findManyArgs = () => vi.mocked(db.user.findMany).mock.calls[0][0]!

describe('getStudentsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offsets by whole pages and takes one page worth', async () => {
    mockDb({ total: 500 })

    await getStudentsPage({}, 3)

    expect(findManyArgs().skip).toBe(STUDENTS_PAGE_SIZE * 2)
    expect(findManyArgs().take).toBe(STUDENTS_PAGE_SIZE)
  })

  it('reports the total matching the filters, not the page size', async () => {
    mockDb({ total: 743, rows: ['a', 'b'] })

    const result = await getStudentsPage({}, 1)

    expect(result.total).toBe(743)
    expect(result.students).toHaveLength(2)
  })

  it('clamps a page past the end back to the last page', async () => {
    mockDb({ total: STUDENTS_PAGE_SIZE * 2 + 1 })

    const result = await getStudentsPage({}, 999)

    expect(result.page).toBe(3)
    expect(result.pageCount).toBe(3)
    expect(findManyArgs().skip).toBe(STUDENTS_PAGE_SIZE * 2)
  })

  it('clamps a page below one back to the first page', async () => {
    mockDb({ total: 120 })

    const result = await getStudentsPage({}, 0)

    expect(result.page).toBe(1)
    expect(findManyArgs().skip).toBe(0)
  })

  it('reports one page when no students match', async () => {
    mockDb({ total: 0 })

    const result = await getStudentsPage({}, 1)

    expect(result.page).toBe(1)
    expect(result.pageCount).toBe(1)
    expect(result.students).toEqual([])
  })

  it('counts using the same filters it queries with', async () => {
    mockDb({ total: 10 })

    await getStudentsPage({ courseId: 'c1', gender: 'FEMALE' }, 1)

    const countWhere = vi.mocked(db.user.count).mock.calls[0][0]!.where
    expect(countWhere).toEqual(findManyArgs().where)
    expect(countWhere).toMatchObject({
      gender: 'FEMALE',
      enrollments: { some: { courseId: 'c1' } },
    })
  })
})

describe('getAllStudents', () => {
  beforeEach(() => vi.clearAllMocks())

  // The CSV export must never be truncated: a capped export silently hands the
  // admin a partial roster that looks complete.
  it('applies no limit or offset', async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await getAllStudents({})

    expect(findManyArgs().take).toBeUndefined()
    expect(findManyArgs().skip).toBeUndefined()
  })
})
