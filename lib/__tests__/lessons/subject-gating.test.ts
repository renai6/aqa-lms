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

  it('locks lesson 2, strips all four media fields, and keeps lesson 1 media intact', async () => {
    vi.mocked(db.subject.findUnique).mockResolvedValue(subject as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({
      id: 'e1',
      batchId: 'b1',
    } as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    // Both lessons get real, distinct URLs on every field so a leak in any
    // one of the four (not just materialUrl/videoUrl) would show up here,
    // and so l1's untouched values prove the strip is scoped to the lock.
    vi.mocked(db.batchLessonContent.findMany).mockResolvedValue([
      {
        lessonId: 'l1',
        materialUrl: 'https://drive.google.com/l1-material',
        videoUrl: 'https://drive.google.com/l1-video',
        audioUrl: 'https://drive.google.com/l1-audio',
        pptUrl: 'https://drive.google.com/l1-ppt',
      },
      {
        lessonId: 'l2',
        materialUrl: 'https://drive.google.com/l2-material',
        videoUrl: 'https://drive.google.com/l2-video',
        audioUrl: 'https://drive.google.com/l2-audio',
        pptUrl: 'https://drive.google.com/l2-ppt',
      },
    ] as never)
    vi.mocked(db.batchRecording.findMany).mockResolvedValue([] as never)

    const result = await getStudentSubject('student1', 'sub1')

    const l1 = result!.lessons.find(l => l.id === 'l1')!
    const l2 = result!.lessons.find(l => l.id === 'l2')!

    expect(l2.isLocked).toBe(true)
    // The real leak would be here, not in the UI: a hidden row whose Drive
    // links are still in the server-rendered payload is readable from source.
    expect(l2.materialUrl).toBeNull()
    expect(l2.videoUrl).toBeNull()
    expect(l2.audioUrl).toBeNull()
    expect(l2.pptUrl).toBeNull()
    expect(l2.assessment).toBeNull()
    expect(l2.lockedReason).toBe('Pass the Lesson 1 quiz to unlock.')

    // An unlocked lesson must keep its real media, or a regression that
    // strips content unconditionally would stay green.
    expect(l1.isLocked).toBe(false)
    expect(l1.materialUrl).toBe('https://drive.google.com/l1-material')
    expect(l1.videoUrl).toBe('https://drive.google.com/l1-video')
    expect(l1.audioUrl).toBe('https://drive.google.com/l1-audio')
    expect(l1.pptUrl).toBe('https://drive.google.com/l1-ppt')
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

  it('picks the best-scored attempt for a lesson gate, not the most recent', async () => {
    // Attempts are query-ordered most-recent-first. The student failed, then
    // retook and passed: the failing attempt is more recent. pickRelevantAttempt
    // would surface the failure; pickBestAttempt must surface the 90. If the
    // two pickers were ever swapped at the toStudentAssessment branch, this is
    // the only thing that would catch it - the earlier tests use a single
    // attempt, for which both pickers agree.
    const passedAfterFailing = {
      ...subject,
      assessments: [
        {
          ...subject.assessments[0],
          attempts: [
            { id: 'at2', status: 'GRADED', score: 20 },
            { id: 'at1', status: 'GRADED', score: 90 },
          ],
        },
      ],
    }
    vi.mocked(db.subject.findUnique).mockResolvedValue(passedAfterFailing as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'e1', batchId: null } as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.batchLessonContent.findMany).mockResolvedValue([] as never)
    vi.mocked(db.batchRecording.findMany).mockResolvedValue([] as never)

    const result = await getStudentSubject('student1', 'sub1')

    const l1 = result!.lessons.find(l => l.id === 'l1')!
    const l2 = result!.lessons.find(l => l.id === 'l2')!
    expect(l1.assessment?.attempt?.score).toBe(90)
    expect(l2.isLocked).toBe(false)
  })
})
