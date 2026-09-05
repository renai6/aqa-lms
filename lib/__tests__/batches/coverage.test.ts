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

  // upsertBatchLessonContentAction writes a row with all three URLs null when
  // an admin clears the fields, so a row is not by itself evidence of content.
  it('ignores rows whose material, recording and video are all null', async () => {
    await getBatchContentCoverage('c1')

    const arg = vi.mocked(db.batchLessonContent.groupBy).mock.calls[0][0]!
    expect(arg.where).toEqual({
      batch: { courseId: 'c1' },
      OR: [
        { materialUrl: { not: null } },
        { recordingUrl: { not: null } },
        { videoUrl: { not: null } },
      ],
    })
  })
})
