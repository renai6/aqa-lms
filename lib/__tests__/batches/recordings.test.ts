import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    batchRecording: {
      create: vi.fn(),
      delete: vi.fn(),
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
import { addBatchRecordingAction, removeBatchRecordingAction } from '@/lib/batches/actions'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  fd.set('batchId', 'b1')
  fd.set('subjectId', 's1')
  fd.set('courseId', 'c1')
  fd.set('url', validDriveUrl)
  fd.set('date', '2026-09-06')
  fd.set('title', '')
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value)
  }
  return fd
}

const initial = { error: null }
const validDriveUrl = 'https://drive.google.com/file/d/ABC123/view?usp=sharing'

describe('addBatchRecordingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
  })

  it('creates a recording scoped to the batch and subject', async () => {
    const result = await addBatchRecordingAction(initial, form({}))
    expect(result.error).toBeNull()
    expect(db.batchRecording.create).toHaveBeenCalledWith({
      data: {
        batchId: 'b1',
        subjectId: 's1',
        url: validDriveUrl,
        date: new Date('2026-09-06T00:00:00.000Z'),
        title: null,
      },
    })
  })

  // The column is @db.Date, so the stored value must be the calendar day the
  // admin typed - not that day shifted by the server's offset.
  it('stores the typed calendar day without timezone drift', async () => {
    await addBatchRecordingAction(initial, form({ date: '2026-01-01' }))
    const { data } = vi.mocked(db.batchRecording.create).mock.calls[0][0]
    expect((data.date as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('trims a supplied title', async () => {
    await addBatchRecordingAction(initial, form({ title: '  Makeup session  ' }))
    expect(db.batchRecording.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'Makeup session' }) }),
    )
  })

  it('rejects a non-Drive url and does not call the db', async () => {
    const result = await addBatchRecordingAction(
      initial,
      form({ url: 'https://drive.google.com/drive/folders/XYZ' }),
    )
    expect(result.error).toBe('Recording URL must be a Google Drive file link.')
    expect(db.batchRecording.create).not.toHaveBeenCalled()
  })

  it('rejects a missing date and does not call the db', async () => {
    const result = await addBatchRecordingAction(initial, form({ date: '' }))
    expect(result.error).toBe('Recording date is required.')
    expect(db.batchRecording.create).not.toHaveBeenCalled()
  })

  it('rejects an unparseable date and does not call the db', async () => {
    const result = await addBatchRecordingAction(initial, form({ date: '06/09/2026' }))
    expect(result.error).toBe('Recording date is required.')
    expect(db.batchRecording.create).not.toHaveBeenCalled()
  })

  it('refuses a non-admin session', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', role: 'STUDENT' } as never)
    const result = await addBatchRecordingAction(initial, form({}))
    expect(result.error).toBe('Forbidden')
    expect(db.batchRecording.create).not.toHaveBeenCalled()
  })
})

describe('removeBatchRecordingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
  })

  const removeForm = (fields: Record<string, string> = {}) => {
    const fd = new FormData()
    fd.set('recordingId', 'r1')
    fd.set('batchId', 'b1')
    fd.set('courseId', 'c1')
    for (const [key, value] of Object.entries(fields)) fd.set(key, value)
    return fd
  }

  it('deletes the recording by id', async () => {
    const result = await removeBatchRecordingAction(initial, removeForm())
    expect(result.error).toBeNull()
    expect(db.batchRecording.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
  })

  it('refuses a non-admin session', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', role: 'STUDENT' } as never)
    const result = await removeBatchRecordingAction(initial, removeForm())
    expect(result.error).toBe('Forbidden')
    expect(db.batchRecording.delete).not.toHaveBeenCalled()
  })
})
