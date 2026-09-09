import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    enrollment: { findUnique: vi.fn() },
    lesson: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    lessonCompletion: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    assessmentAttempt: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/auth/capabilities', () => ({
  isActiveStudent: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { isActiveStudent } from '@/lib/auth/capabilities'
import {
  markLessonDoneAction,
  unmarkLessonDoneAction,
} from '@/app/(student)/student/courses/[id]/subjects/[sid]/actions'

function lessonForm(): FormData {
  const fd = new FormData()
  fd.set('lessonId', 'l2')
  fd.set('courseId', 'course1')
  fd.set('subjectId', 'sub1')
  return fd
}

// getLessonGateState (lib/lessons/queries.ts) is exercised for real here, not
// mocked out, so these tests also cover its db.lesson.findUnique short-circuit
// on a non-gated, non-sequential course as well as the guard wiring itself.
describe('manual completion is refused where a gate governs the lesson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', role: 'STUDENT' } as never)
    vi.mocked(isActiveStudent).mockResolvedValue(true)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'enr1' } as never)
  })

  it('rejects marking a locked lesson done', async () => {
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'l2' } as never)
    // getLessonGateState: sequential course, l2 blocked by an earlier unsatisfied lesson.
    vi.mocked(db.lesson.findUnique).mockResolvedValue({
      subjectId: 'sub1',
      assessment: null,
      subject: { course: { sequentialLessons: true } },
    } as never)
    vi.mocked(db.lesson.findMany).mockResolvedValue([
      {
        id: 'l1',
        order: 1,
        assessment: { id: 'a1', isPublished: true, passingScore: 70 },
      },
      { id: 'l2', order: 2, assessment: null },
    ] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([] as never)

    const result = await markLessonDoneAction({ error: null }, lessonForm())

    expect(result.error).toBe('This lesson is locked.')
    expect(db.lessonCompletion.upsert).not.toHaveBeenCalled()
  })

  it('rejects marking a gated lesson done, since passing is the only route', async () => {
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'l2' } as never)
    // getLessonGateState: non-sequential course, so isLocked is always false,
    // but l2 itself carries a published gate.
    vi.mocked(db.lesson.findUnique).mockResolvedValue({
      subjectId: 'sub1',
      assessment: { isPublished: true },
      subject: { course: { sequentialLessons: false } },
    } as never)

    const result = await markLessonDoneAction({ error: null }, lessonForm())

    expect(result.error).toBe("Pass this lesson's assessment to complete it.")
    expect(db.lessonCompletion.upsert).not.toHaveBeenCalled()
  })

  it('rejects unmarking a gated lesson, which would re-lock later lessons', async () => {
    vi.mocked(db.lesson.findUnique).mockResolvedValue({
      subjectId: 'sub1',
      assessment: { isPublished: true },
      subject: { course: { sequentialLessons: false } },
    } as never)

    const result = await unmarkLessonDoneAction({ error: null }, lessonForm())

    expect(result.error).toBe("Pass this lesson's assessment to complete it.")
    expect(db.lessonCompletion.deleteMany).not.toHaveBeenCalled()
  })
})
