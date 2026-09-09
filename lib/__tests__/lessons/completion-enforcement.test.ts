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

// The refusal tests above prove the guards block what they should. On their
// own they cannot catch an inverted condition that blocks everything - a
// suite of only-negative assertions passes just as well whether the guard is
// correct or over-broad. These prove the ordinary, ungated path still works.
describe('manual completion still succeeds where no gate governs the lesson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', role: 'STUDENT' } as never)
    vi.mocked(isActiveStudent).mockResolvedValue(true)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'enr1' } as never)
  })

  it('marks an ungated lesson done on a non-sequential course', async () => {
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'l2' } as never)
    vi.mocked(db.lesson.findUnique).mockResolvedValue({
      subjectId: 'sub1',
      assessment: null,
      subject: { course: { sequentialLessons: false } },
    } as never)
    vi.mocked(db.lessonCompletion.upsert).mockResolvedValue({} as never)

    const result = await markLessonDoneAction({ error: null }, lessonForm())

    expect(result.error).toBeNull()
    expect(db.lessonCompletion.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: 'u1', lessonId: 'l2' } },
      create: { userId: 'u1', lessonId: 'l2' },
      update: {},
    })
  })

  it('unmarks the same ungated lesson', async () => {
    vi.mocked(db.lesson.findUnique).mockResolvedValue({
      subjectId: 'sub1',
      assessment: null,
      subject: { course: { sequentialLessons: false } },
    } as never)
    vi.mocked(db.lessonCompletion.deleteMany).mockResolvedValue({ count: 1 } as never)

    const result = await unmarkLessonDoneAction({ error: null }, lessonForm())

    expect(result.error).toBeNull()
    expect(db.lessonCompletion.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', lessonId: 'l2' },
    })
  })

  it('marks an ungated, unlocked lesson done on a sequential course', async () => {
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'l2' } as never)
    // Sequential mode is on, but neither lesson in the subject carries a gate,
    // so nothing is unsatisfied and nothing should end up locked.
    vi.mocked(db.lesson.findUnique).mockResolvedValue({
      subjectId: 'sub1',
      assessment: null,
      subject: { course: { sequentialLessons: true } },
    } as never)
    vi.mocked(db.lesson.findMany).mockResolvedValue([
      { id: 'l1', order: 1, assessment: null },
      { id: 'l2', order: 2, assessment: null },
    ] as never)
    vi.mocked(db.lessonCompletion.findMany).mockResolvedValue([] as never)
    vi.mocked(db.lessonCompletion.upsert).mockResolvedValue({} as never)

    const result = await markLessonDoneAction({ error: null }, lessonForm())

    expect(result.error).toBeNull()
    expect(db.lessonCompletion.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: 'u1', lessonId: 'l2' } },
      create: { userId: 'u1', lessonId: 'l2' },
      update: {},
    })
    // No lesson in the subject has an assessment, so the query 2 fix's
    // empty-array guard should skip this round-trip entirely.
    expect(db.assessmentAttempt.findMany).not.toHaveBeenCalled()
  })
})
