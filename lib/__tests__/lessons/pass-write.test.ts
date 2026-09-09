import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    assessmentAttempt: { findFirst: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/auth/capabilities', () => ({
  isActiveStudent: vi.fn(),
}))

vi.mock('@/lib/assessments/scoring', () => ({
  scoreAttempt: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// redirect does not throw here, unlike the real Next.js implementation. This
// is only safe because submitAttemptAction now has an explicit return right
// after its redirect() call - otherwise a non-throwing mock would let
// execution silently fall through past it.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { isActiveStudent } from '@/lib/auth/capabilities'
import { scoreAttempt } from '@/lib/assessments/scoring'
import { submitAttemptAction } from '@/app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions'

function submitForm(): FormData {
  const fd = new FormData()
  fd.set('attemptId', 'att1')
  return fd
}

const tx = {
  assessmentAttempt: { updateMany: vi.fn() },
  studentAnswer: { createMany: vi.fn() },
  lessonCompletion: { upsert: vi.fn() },
}

function baseAttempt(assessmentOverrides: Record<string, unknown>) {
  return {
    id: 'att1',
    status: 'IN_PROGRESS',
    assessmentId: 'a1',
    assessment: {
      isPublished: true,
      subjectId: 'sub1',
      lessonId: null,
      passingScore: null,
      subject: { courseId: 'course1', gender: null },
      questions: [],
      ...assessmentOverrides,
    },
  }
}

describe('submitAttemptAction writes the pass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'student1', role: 'STUDENT' } as never)
    vi.mocked(isActiveStudent).mockResolvedValue(true)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'enr1' } as never)
    vi.mocked(tx.assessmentAttempt.updateMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(db.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) =>
      fn(tx)) as never)
  })

  it('upserts a LessonCompletion when a gate is passed', async () => {
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue(
      baseAttempt({ lessonId: 'l1', passingScore: 75 }) as never,
    )
    vi.mocked(scoreAttempt).mockReturnValue({
      answers: [],
      hasEssay: false,
      totalPoints: 100,
      earnedPoints: 100,
      score: 100,
      status: 'GRADED',
    } as never)

    await submitAttemptAction({ error: null }, submitForm())

    expect(tx.lessonCompletion.upsert).toHaveBeenCalledWith({
      where: { userId_lessonId: { userId: 'student1', lessonId: 'l1' } },
      create: { userId: 'student1', lessonId: 'l1' },
      update: {},
    })
  })

  it('does not write a completion when the gate is failed', async () => {
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue(
      baseAttempt({ lessonId: 'l1', passingScore: 75 }) as never,
    )
    vi.mocked(scoreAttempt).mockReturnValue({
      answers: [],
      hasEssay: false,
      totalPoints: 100,
      earnedPoints: 0,
      score: 0,
      status: 'GRADED',
    } as never)

    await submitAttemptAction({ error: null }, submitForm())

    expect(tx.lessonCompletion.upsert).not.toHaveBeenCalled()
  })

  it('does not write a completion for a subject-level assessment', async () => {
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue(
      baseAttempt({ lessonId: null, passingScore: null }) as never,
    )
    vi.mocked(scoreAttempt).mockReturnValue({
      answers: [],
      hasEssay: false,
      totalPoints: 100,
      earnedPoints: 100,
      score: 100,
      status: 'GRADED',
    } as never)

    await submitAttemptAction({ error: null }, submitForm())

    expect(tx.lessonCompletion.upsert).not.toHaveBeenCalled()
  })

  it('does not write a completion when the score is null (essay awaiting grading)', async () => {
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue(
      baseAttempt({ lessonId: 'l1', passingScore: 75 }) as never,
    )
    vi.mocked(scoreAttempt).mockReturnValue({
      answers: [],
      hasEssay: true,
      totalPoints: 100,
      earnedPoints: 0,
      score: null,
      status: 'SUBMITTED',
    } as never)

    await submitAttemptAction({ error: null }, submitForm())

    expect(tx.lessonCompletion.upsert).not.toHaveBeenCalled()
  })
})
