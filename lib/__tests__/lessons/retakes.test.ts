import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    assessment: { findFirst: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    assessmentAttempt: { findMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/auth/capabilities', () => ({
  isActiveStudent: vi.fn(),
}))

vi.mock('@/lib/lessons/queries', () => ({
  getLessonGateState: vi.fn(),
}))

// redirect does not throw here, unlike the real Next.js implementation, so
// these tests assert on db.assessmentAttempt.create instead of on thrown
// control flow. The implementation returns right after every redirect call,
// so a passing "create not called" assertion here is real evidence that
// startAttemptAction actually stops - not an artifact of an unrealistic mock.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { isActiveStudent } from '@/lib/auth/capabilities'
import { getLessonGateState } from '@/lib/lessons/queries'
import { redirect } from 'next/navigation'
import { startAttemptAction } from '@/app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions'

function startForm(): FormData {
  const fd = new FormData()
  fd.set('assessmentId', 'a1')
  fd.set('courseId', 'course1')
  fd.set('subjectId', 'sub1')
  return fd
}

const attemptPath = (attemptId: string) =>
  '/student/courses/course1/subjects/sub1/assessments/a1/attempt/' + attemptId

describe('startAttemptAction retakes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1', role: 'STUDENT' } as never)
    vi.mocked(isActiveStudent).mockResolvedValue(true)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'enr1' } as never)
    vi.mocked(db.assessmentAttempt.create).mockResolvedValue({ id: 'new-attempt' } as never)
  })

  it('creates a new attempt after a failed gate attempt', async () => {
    vi.mocked(db.assessment.findFirst).mockResolvedValue({
      id: 'a1',
      lessonId: 'l1',
      passingScore: 75,
      subject: { gender: null },
    } as never)
    vi.mocked(getLessonGateState).mockResolvedValue({ isLocked: false, hasGate: true })
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([
      { id: 'att1', status: 'GRADED', score: 20 },
    ] as never)

    const result = await startAttemptAction({ error: null }, startForm())

    expect(db.assessmentAttempt.create).toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('does NOT create a second attempt on a failed subject-level assessment', async () => {
    // This is the regression guard for the existing exam flow: lessonId is
    // null, so the one-attempt rule must still apply regardless of score.
    vi.mocked(db.assessment.findFirst).mockResolvedValue({
      id: 'a1',
      lessonId: null,
      passingScore: null,
      subject: { gender: null },
    } as never)
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([
      { id: 'att1', status: 'GRADED', score: 20 },
    ] as never)

    const result = await startAttemptAction({ error: null }, startForm())

    expect(redirect).toHaveBeenCalledWith(attemptPath('att1'))
    expect(db.assessmentAttempt.create).not.toHaveBeenCalled()
    // A subject-level assessment has no lesson to gate, so the lesson-gate
    // lookup must never run for it.
    expect(getLessonGateState).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('does not create another attempt once the gate is passed', async () => {
    vi.mocked(db.assessment.findFirst).mockResolvedValue({
      id: 'a1',
      lessonId: 'l1',
      passingScore: 75,
      subject: { gender: null },
    } as never)
    vi.mocked(getLessonGateState).mockResolvedValue({ isLocked: false, hasGate: true })
    vi.mocked(db.assessmentAttempt.findMany).mockResolvedValue([
      { id: 'att1', status: 'GRADED', score: 90 },
    ] as never)

    const result = await startAttemptAction({ error: null }, startForm())

    expect(redirect).toHaveBeenCalledWith(attemptPath('att1'))
    expect(db.assessmentAttempt.create).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
  })

  it('refuses to start a gate whose lesson is locked', async () => {
    vi.mocked(db.assessment.findFirst).mockResolvedValue({
      id: 'a1',
      lessonId: 'l1',
      passingScore: 75,
      subject: { gender: null },
    } as never)
    vi.mocked(getLessonGateState).mockResolvedValue({ isLocked: true, hasGate: true })

    const result = await startAttemptAction({ error: null }, startForm())

    expect(result.error).toBe('Assessment is not available.')
    expect(db.assessmentAttempt.create).not.toHaveBeenCalled()
    expect(db.assessmentAttempt.findMany).not.toHaveBeenCalled()
  })
})
