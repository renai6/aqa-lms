import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = {
  assessmentAttempt: { updateMany: vi.fn(), update: vi.fn() },
  studentAnswer: { createMany: vi.fn(), update: vi.fn() },
  lessonCompletion: { upsert: vi.fn() },
}

vi.mock('@/lib/db', () => ({
  db: {
    assessmentAttempt: { findFirst: vi.fn(), findUnique: vi.fn() },
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
  canManageSubject: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { isActiveStudent, canManageSubject } from '@/lib/auth/capabilities'
import { submitAttemptAction } from '@/app/(student)/student/courses/[id]/subjects/[sid]/assessments/actions'
import { finalizeAttemptGradingAction } from '@/lib/teacher/actions'

const FILE = 'https://drive.google.com/file/d/1AbC-dEf_23/view?usp=drive_link'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.$transaction).mockImplementation((async (fn: (t: typeof tx) => unknown) =>
    fn(tx)) as never)
})

describe('submitAttemptAction with a file upload question', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ userId: 's1', role: 'STUDENT' } as never)
    vi.mocked(isActiveStudent).mockResolvedValue(true)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'e1' } as never)
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue({
      id: 'att1',
      status: 'IN_PROGRESS',
      assessmentId: 'a1',
      assessment: {
        isPublished: true,
        subjectId: 'sub1',
        lessonId: null,
        passingScore: null,
        subject: { courseId: 'course1', gender: null },
        questions: [{ id: 'q1', type: 'FILE_UPLOAD', points: 5, options: [] }],
      },
    } as never)
    tx.assessmentAttempt.updateMany.mockResolvedValue({ count: 1 })
  })

  function submitForm(answer: string): FormData {
    const fd = new FormData()
    fd.set('attemptId', 'att1')
    fd.set('answer_q1', answer)
    return fd
  }

  it('refuses a link that is not a Drive file, and records nothing', async () => {
    const result = await submitAttemptAction({ error: null }, submitForm('my-video.mp4'))

    expect(result.error).toMatch(/^Question 1: /)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('stores the Drive file link as the answer, awaiting grading', async () => {
    await expect(
      submitAttemptAction({ error: null }, submitForm(FILE)),
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(tx.assessmentAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED', score: null }),
      }),
    )
    expect(tx.studentAnswer.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ questionId: 'q1', answer: FILE, pointsEarned: null }),
      ],
    })
  })
})

describe('finalizeAttemptGradingAction with a file upload question', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' } as never)
    vi.mocked(canManageSubject).mockResolvedValue(true)
    vi.mocked(db.assessmentAttempt.findUnique).mockResolvedValue({
      id: 'att1',
      status: 'SUBMITTED',
      assessmentId: 'a1',
      assessment: {
        subjectId: 'sub1',
        questions: [
          { id: 'q1', type: 'MULTIPLE_CHOICE', points: 5 },
          { id: 'q2', type: 'FILE_UPLOAD', points: 5 },
        ],
      },
      answers: [
        { id: 'ans1', questionId: 'q1', pointsEarned: 5 },
        { id: 'ans2', questionId: 'q2', pointsEarned: null },
      ],
    } as never)
  })

  function gradeForm(fields: Record<string, string>): FormData {
    const fd = new FormData()
    fd.set('attemptId', 'att1')
    fd.set('subjectId', 'sub1')
    fd.set('basePath', '/teacher/subjects/sub1')
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    return fd
  }

  it('requires the upload to be scored before finalizing', async () => {
    const result = await finalizeAttemptGradingAction({ error: null }, gradeForm({}))

    expect(result.error).toMatch(/score every/i)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('writes the teacher points for the upload and the recomputed score', async () => {
    await expect(
      finalizeAttemptGradingAction(
        { error: null },
        gradeForm({ points_q2: '3', feedback_q2: 'Clear audio.' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(tx.studentAnswer.update).toHaveBeenCalledWith({
      where: { id: 'ans2' },
      data: { pointsEarned: 3, feedback: 'Clear audio.' },
    })
    expect(tx.assessmentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ score: 80, status: 'GRADED' }),
      }),
    )
  })
})
