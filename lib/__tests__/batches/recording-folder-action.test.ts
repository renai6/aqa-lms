import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    batchRecordingFolder: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/batches/drive-folder', () => ({
  listFolderRecordings: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { listFolderRecordings } from '@/lib/batches/drive-folder'
import { setBatchRecordingFolderAction } from '@/lib/batches/actions'

const initial = { error: null }
const folderUrl = 'https://drive.google.com/drive/folders/F1?usp=sharing'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  fd.set('batchId', 'b1')
  fd.set('subjectId', 's1')
  fd.set('courseId', 'c1')
  fd.set('folderUrl', folderUrl)
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value)
  }
  return fd
}

describe('setBatchRecordingFolderAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(listFolderRecordings).mockResolvedValue({ ok: true, recordings: [] })
  })

  it('saves the folder id for the batch and subject', async () => {
    const result = await setBatchRecordingFolderAction(initial, form({}))

    expect(result).toEqual({ error: null, success: true })
    expect(listFolderRecordings).toHaveBeenCalledWith('F1')
    expect(db.batchRecordingFolder.upsert).toHaveBeenCalledWith({
      where: { batchId_subjectId: { batchId: 'b1', subjectId: 's1' } },
      create: { batchId: 'b1', subjectId: 's1', folderId: 'F1' },
      update: { folderId: 'F1' },
    })
  })

  it('clears the folder when the link is emptied', async () => {
    const result = await setBatchRecordingFolderAction(initial, form({ folderUrl: '  ' }))

    expect(result.error).toBeNull()
    expect(db.batchRecordingFolder.deleteMany).toHaveBeenCalledWith({
      where: { batchId: 'b1', subjectId: 's1' },
    })
    expect(db.batchRecordingFolder.upsert).not.toHaveBeenCalled()
  })

  it('rejects a link that is not a Drive folder', async () => {
    const result = await setBatchRecordingFolderAction(
      initial,
      form({ folderUrl: 'https://drive.google.com/file/d/ABC/view' }),
    )

    expect(result.error).toMatch(/folder link/)
    expect(db.batchRecordingFolder.upsert).not.toHaveBeenCalled()
  })

  it('refuses a folder Drive cannot open, pointing at the sharing setting', async () => {
    vi.mocked(listFolderRecordings).mockResolvedValue({ ok: false, reason: 'not-found' })

    const result = await setBatchRecordingFolderAction(initial, form({}))

    expect(result.error).toMatch(/Anyone with the link/)
    expect(db.batchRecordingFolder.upsert).not.toHaveBeenCalled()
  })

  it('refuses to save while Drive is unreachable', async () => {
    vi.mocked(listFolderRecordings).mockResolvedValue({ ok: false, reason: 'unavailable' })

    const result = await setBatchRecordingFolderAction(initial, form({}))

    expect(result.error).toMatch(/could not be reached/)
    expect(db.batchRecordingFolder.upsert).not.toHaveBeenCalled()
  })

  it('rejects a non-admin', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', role: 'STUDENT' } as never)

    const result = await setBatchRecordingFolderAction(initial, form({}))

    expect(result.error).toBe('Forbidden')
    expect(listFolderRecordings).not.toHaveBeenCalled()
  })
})
