import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    course: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    lessonCompletion: { findMany: vi.fn() },
    assessmentAttempt: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { countStudentsAffectedByGating } from '@/lib/lessons/queries'

describe('countStudentsAffectedByGating', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts only students who would have a lesson locked', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      subjects: [
        {
          lessons: [
            {
              id: 'l1',
              order: 1,
              assessment: { id: 'a1', isPublished: true, passingScore: 75 },
            },
            { id: 'l2', order: 2, assessment: null },
          ],
        },
      ],
    } as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([
      { userId: 'passed' },
      { userId: 'stuck' },
    ] as never)
    // "passed" already marked lesson 1 done before gating existed.
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([
      { userId: 'passed', lessonId: 'l1' },
    ] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([] as never)

    expect(await countStudentsAffectedByGating('course1')).toBe(1)
  })

  it('returns 0 when the course has no published gates', async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      subjects: [{ lessons: [{ id: 'l1', order: 1, assessment: null }] }],
    } as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([{ userId: 'u1' }] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([] as never)

    expect(await countStudentsAffectedByGating('course1')).toBe(0)
  })
})
