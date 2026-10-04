import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    subjectTeacher: { findUnique: vi.fn() },
    batch: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/batches/drive-folder', () => ({
  listFolderRecordings: vi.fn(),
}))

import { db } from '@/lib/db'
import { listFolderRecordings } from '@/lib/batches/drive-folder'
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

  it('lists only batches with a folder or links for this subject, newest first', async () => {
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue({ subjectId: 's1' } as never)
    vi.mocked(db.batch.findMany).mockResolvedValue([])

    await getTeacherSubjectRecordings('t1', 's1')

    const args = vi.mocked(db.batch.findMany).mock.calls[0][0]!
    expect(args.where).toEqual({
      OR: [
        { recordingFolders: { some: { subjectId: 's1' } } },
        { recordings: { some: { subjectId: 's1' } } },
      ],
    })
    expect(args.orderBy).toEqual({ number: 'desc' })
    expect(args.select?.recordingFolders).toMatchObject({ where: { subjectId: 's1' } })
  })

  it("fills each batch from its folder or links, and marks a folder Drive can't list", async () => {
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue({ subjectId: 's1' } as never)
    const link = {
      id: 'r1',
      url: 'https://drive.google.com/file/d/old/view',
      date: new Date('2026-09-06T00:00:00.000Z'),
      title: 'Makeup',
    }
    vi.mocked(db.batch.findMany).mockResolvedValue([
      { id: 'b3', number: 3, name: null, isActive: true, recordingFolders: [{ folderId: 'F2' }], recordings: [link] },
      { id: 'b2', number: 2, name: null, isActive: false, recordingFolders: [], recordings: [link] },
      { id: 'b1', number: 1, name: null, isActive: false, recordingFolders: [{ folderId: 'F1' }], recordings: [] },
    ] as never)
    const video = { id: 'v', title: 'Week 1', url: 'https://drive.google.com/file/d/v/view' }
    vi.mocked(listFolderRecordings).mockImplementation(async (folderId) =>
      folderId === 'F2' ? { ok: true, recordings: [video] } : { ok: false, reason: 'not-found' },
    )

    expect(await getTeacherSubjectRecordings('t1', 's1')).toEqual([
      { id: 'b3', number: 3, name: null, isActive: true, recordings: [video] },
      {
        id: 'b2',
        number: 2,
        name: null,
        isActive: false,
        recordings: [{ id: 'r1', title: 'Makeup', url: 'https://drive.google.com/file/d/old/view' }],
      },
      { id: 'b1', number: 1, name: null, isActive: false, recordings: null },
    ])
  })
})
