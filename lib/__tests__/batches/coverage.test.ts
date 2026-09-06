import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    lesson: { count: vi.fn() },
    batchLessonContent: { groupBy: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { getBatchContentCoverage } from '@/lib/batches/queries'

describe('getBatchContentCoverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.lesson.count).mockResolvedValue(18 as never)
    vi.mocked(db.batchLessonContent.groupBy).mockResolvedValue([] as never)
  })

  it('counts every lesson in the course', async () => {
    const coverage = await getBatchContentCoverage('c1')

    expect(coverage.totalLessons).toBe(18)
    expect(db.lesson.count).toHaveBeenCalledWith({
      where: { subject: { courseId: 'c1' } },
    })
  })

  it('maps the covered lesson count onto each batch', async () => {
    vi.mocked(db.batchLessonContent.groupBy).mockResolvedValue([
      { batchId: 'b34', _count: { _all: 18 } },
      { batchId: 'b35', _count: { _all: 3 } },
    ] as never)

    const coverage = await getBatchContentCoverage('c1')

    expect(coverage.byBatch).toEqual({ b34: 18, b35: 3 })
  })

  // upsertBatchLessonContentAction writes a row with every URL null when an
  // admin clears the fields, so a row is not by itself evidence of content.
  // Recordings are excluded on purpose: they belong to the subject, not the
  // lesson, so they say nothing about whether a lesson has materials.
  it('ignores rows whose material, video, audio and slides are all null', async () => {
    await getBatchContentCoverage('c1')

    const arg = vi.mocked(db.batchLessonContent.groupBy).mock.calls[0][0]!
    expect(arg.where).toEqual({
      batch: { courseId: 'c1' },
      OR: [
        { materialUrl: { not: null } },
        { videoUrl: { not: null } },
        { audioUrl: { not: null } },
        { pptUrl: { not: null } },
      ],
    })
  })
})
