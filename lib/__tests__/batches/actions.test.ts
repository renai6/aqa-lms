import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    batchLessonContent: {
      upsert: vi.fn(),
    },
    batch: {
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
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
import { upsertBatchLessonContentAction, startNewBatchAction } from '@/lib/batches/actions'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  fd.set('batchId', 'b1')
  fd.set('lessonId', 'l1')
  fd.set('courseId', 'c1')
  fd.set('materialUrl', '')
  fd.set('videoUrl', '')
  fd.set('recordingUrl', '')
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value)
  }
  return fd
}

const initial = { error: null }
const validDriveUrl = 'https://drive.google.com/file/d/ABC123/view?usp=sharing'

describe('upsertBatchLessonContentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
  })

  it('accepts a valid Drive URL for videoUrl and recordingUrl', async () => {
    const result = await upsertBatchLessonContentAction(
      initial,
      form({ videoUrl: validDriveUrl, recordingUrl: validDriveUrl }),
    )
    expect(result.error).toBeNull()
    expect(db.batchLessonContent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ videoUrl: validDriveUrl }),
        update: expect.objectContaining({ videoUrl: validDriveUrl }),
      }),
    )
  })

  it('persists a cleared videoUrl as null in both upsert branches', async () => {
    await upsertBatchLessonContentAction(initial, form({ videoUrl: '' }))
    expect(db.batchLessonContent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ videoUrl: null }),
        update: expect.objectContaining({ videoUrl: null }),
      }),
    )
  })

  it('rejects a non-empty malformed videoUrl and does not call the db', async () => {
    const result = await upsertBatchLessonContentAction(
      initial,
      form({ videoUrl: 'https://drive.google.com/open?id=ABC123' }),
    )
    expect(result.error).toBe('Lesson Video URL must be a Google Drive file link.')
    expect(db.batchLessonContent.upsert).not.toHaveBeenCalled()
  })

  it('rejects a non-empty malformed recordingUrl and does not call the db', async () => {
    const result = await upsertBatchLessonContentAction(
      initial,
      form({ recordingUrl: 'https://drive.google.com/drive/folders/XYZ' }),
    )
    expect(result.error).toBe('Recording URL must be a Google Drive file link.')
    expect(db.batchLessonContent.upsert).not.toHaveBeenCalled()
  })

  it('accepts empty strings for videoUrl and recordingUrl (clearing works)', async () => {
    const result = await upsertBatchLessonContentAction(
      initial,
      form({ videoUrl: '', recordingUrl: '' }),
    )
    expect(result.error).toBeNull()
    expect(db.batchLessonContent.upsert).toHaveBeenCalled()
  })
})

describe('startNewBatchAction', () => {
  let tx: {
    batch: { updateMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
    course: { findUnique: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T04:00:00Z'))
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(db.batch.aggregate).mockResolvedValue({ _max: { number: 34 } } as never)
    tx = {
      batch: { updateMany: vi.fn(), create: vi.fn() },
      course: { findUnique: vi.fn().mockResolvedValue({ courseAlias: null }) },
    }
    vi.mocked(db.$transaction).mockImplementation((fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const start = () => {
    const fd = new FormData()
    fd.set('courseId', 'c1')
    return startNewBatchAction(initial, fd)
  }

  it('names the new batch from the course alias and the Manila month', async () => {
    tx.course.findUnique.mockResolvedValue({ courseAlias: 'MM01' })

    const result = await start()
    expect(result.error).toBeNull()
    expect(tx.batch.create).toHaveBeenCalledWith({
      data: { courseId: 'c1', number: 35, isActive: true, name: '0926MM01' },
    })
  })

  // Courses predating the alias field must still be able to open a batch; the
  // UI falls back to the numbered label.
  it('leaves the name null when the course has no alias', async () => {
    const result = await start()
    expect(result.error).toBeNull()
    expect(tx.batch.create).toHaveBeenCalledWith({
      data: { courseId: 'c1', number: 35, isActive: true, name: null },
    })
  })
})
