import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    subject: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    lessonCompletion: { findMany: vi.fn() },
    batchLessonContent: { findMany: vi.fn() },
    batchRecording: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { getStudentSubject } from '@/lib/student/queries'

describe('getStudentSubject gating', () => {
  beforeEach(() => vi.clearAllMocks())

  const subject = {
    id: 'sub1',
    courseId: 'course1',
    title: 'Arabic',
    description: null,
    gender: null,
    course: { title: 'Marhala 1', sequentialLessons: true },
    schedules: [],
    lessons: [
      { id: 'l1', title: 'Alphabet', description: null, order: 1 },
      { id: 'l2', title: 'Vowels', description: null, order: 2 },
    ],
    assessments: [
      {
        id: 'a1',
        title: 'Alphabet Check',
        type: 'QUIZ',
        durationMins: null,
        passingScore: 75,
        lessonId: 'l1',
        _count: { questions: 3 },
        attempts: [{ id: 'at1', status: 'GRADED', score: 20 }],
      },
    ],
  }

  it('locks lesson 2 and strips its media URLs from the payload', async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue(subject as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      id: 'e1',
      batchId: 'b1',
    } as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.batchLessonContent.findMany).mockResolvedValue([
      {
        lessonId: 'l2',
        materialUrl: 'https://drive.google.com/secret',
        videoUrl: 'https://drive.google.com/video',
        audioUrl: null,
        pptUrl: null,
      },
    ] as never)
    vi.mocked(db.batchRecording.findMany).mockResolvedValue([] as never)

    const result = await getStudentSubject('student1', 'sub1')

    const l2 = result!.lessons.find(l => l.id === 'l2')!
    expect(l2.isLocked).toBe(true)
    // The real leak would be here, not in the UI: a hidden row whose Drive
    // links are still in the server-rendered payload is readable from source.
    expect(l2.materialUrl).toBeNull()
    expect(l2.videoUrl).toBeNull()
    expect(l2.assessment).toBeNull()
    expect(l2.lockedReason).toBe('Pass the Lesson 1 quiz to unlock.')
  })

  it('leaves the gating lesson itself open', async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue(subject as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'e1', batchId: null } as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.batchLessonContent.findMany).mockResolvedValue([] as never)
    vi.mocked(db.batchRecording.findMany).mockResolvedValue([] as never)

    const result = await getStudentSubject('student1', 'sub1')

    const l1 = result!.lessons.find(l => l.id === 'l1')!
    expect(l1.isLocked).toBe(false)
    expect(l1.assessment?.id).toBe('a1')
    // Gates live inside their lesson, not in the flat subject-level list.
    expect(result!.assessments).toEqual([])
  })
})
