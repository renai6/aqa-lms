import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    subject: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    lessonCompletion: { findMany: vi.fn() },
    batchLessonContent: { findMany: vi.fn() },
    batchRecordingFolder: { findUnique: vi.fn() },
    batchRecording: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/batches/drive-folder', () => ({
  listFolderRecordings: vi.fn(),
}))

import { db } from '@/lib/db'
import { listFolderRecordings } from '@/lib/batches/drive-folder'
import { getStudentSubject } from '@/lib/student/queries'

const subject = {
  id: 'sub1',
  courseId: 'course1',
  title: 'Arabic',
  description: null,
  gender: null,
  course: { title: 'Marhala 1', sequentialLessons: false },
  schedules: [],
  lessons: [],
  assessments: [],
}

const link = {
  id: 'r1',
  url: 'https://drive.google.com/file/d/old/view',
  date: new Date('2026-09-06T00:00:00.000Z'),
  title: null,
}

const video = { id: 'v1', title: 'Week 1', url: 'https://drive.google.com/file/d/v1/view' }

describe('getStudentSubject recordings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.subject.findUnique).mockResolvedValue(subject as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'e1', batchId: 'b1' } as never)
    vi.mocked(db.batchRecording.findMany).mockResolvedValue([link] as never)
  })

  it("prefers the batch's folder over its individual links", async () => {
    vi.mocked(db.batchRecordingFolder.findUnique).mockResolvedValue({ folderId: 'F1' } as never)
    vi.mocked(listFolderRecordings).mockResolvedValue({ ok: true, recordings: [video] })

    const result = await getStudentSubject('student1', 'sub1')

    expect(db.batchRecordingFolder.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { batchId_subjectId: { batchId: 'b1', subjectId: 'sub1' } },
      }),
    )
    expect(listFolderRecordings).toHaveBeenCalledWith('F1')
    expect(result!.recordings).toEqual([video])
  })

  // Subjects move to folders one at a time, so one without a folder must keep
  // showing the links students can watch today.
  it('falls back to the individual links while the subject has no folder', async () => {
    vi.mocked(db.batchRecordingFolder.findUnique).mockResolvedValue(null)

    const result = await getStudentSubject('student1', 'sub1')

    expect(db.batchRecording.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { batchId: 'b1', subjectId: 'sub1' } }),
    )
    expect(result!.recordings).toEqual([
      { id: 'r1', title: 'Sun, Sep 6, 2026', url: 'https://drive.google.com/file/d/old/view' },
    ])
    expect(listFolderRecordings).not.toHaveBeenCalled()
  })

  // An unreadable folder must not pass for an empty one, or students are told
  // there are no recordings when there are.
  it('marks recordings as unavailable when Drive cannot list the folder', async () => {
    vi.mocked(db.batchRecordingFolder.findUnique).mockResolvedValue({ folderId: 'F1' } as never)
    vi.mocked(listFolderRecordings).mockResolvedValue({ ok: false, reason: 'unavailable' })

    const result = await getStudentSubject('student1', 'sub1')

    expect(result!.recordings).toBeNull()
  })
})
