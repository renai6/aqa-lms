import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    subjectTeacher: { findUnique: vi.fn() },
    batch: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { getTeacherSubjectRecordings } from '@/lib/teacher/queries'

describe('getTeacherSubjectRecordings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for a subject the teacher is not assigned to', async () => {
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue(null)

    expect(await getTeacherSubjectRecordings('t1', 's1')).toBeNull()
    expect(db.batch.findMany).not.toHaveBeenCalled()
  })

  it("lists only batches holding this subject's recordings, newest first", async () => {
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue({ subjectId: 's1' } as never)
    vi.mocked(db.batch.findMany).mockResolvedValue([])

    await getTeacherSubjectRecordings('t1', 's1')

    const args = vi.mocked(db.batch.findMany).mock.calls[0][0]!
    expect(args.where).toEqual({ recordings: { some: { subjectId: 's1' } } })
    expect(args.orderBy).toEqual({ number: 'desc' })
    expect(args.select?.recordings).toMatchObject({
      where: { subjectId: 's1' },
      orderBy: { date: 'desc' },
    })
  })
})
