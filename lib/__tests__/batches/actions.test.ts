import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    batchLessonContent: {
      upsert: vi.fn(),
    },
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
import { upsertBatchLessonContentAction } from '@/lib/batches/actions'

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
    expect(db.batchLessonContent.upsert).toHaveBeenCalled()
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
