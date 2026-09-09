import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    assessmentAttempt: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { getStudentAttempt } from '@/lib/student/queries'

// Two options, only 'b' is correct - lets a test assert "the key is visible"
// (some option true) vs "the key is hidden" (every option null) unambiguously.
function baseAttempt(assessmentOverrides: Record<string, unknown>, score: number | null) {
  return {
    id: 'at1',
    status: 'GRADED',
    score,
    startedAt: new Date('2026-01-01'),
    submittedAt: new Date('2026-01-01'),
    assessmentId: 'a1',
    assessment: {
      title: 'Quiz',
      type: 'QUIZ',
      durationMins: null,
      passingScore: 75,
      subjectId: 'sub1',
      lessonId: null,
      subject: { title: 'Subject 1', courseId: 'course1', gender: null },
      questions: [
        {
          id: 'q1',
          questionText: 'What is 2+2?',
          type: 'MULTIPLE_CHOICE',
          points: 1,
          order: 0,
          mediaType: null,
          mediaUrl: null,
          options: [
            { id: 'o1', label: '3', value: 'a', isCorrect: false },
            { id: 'o2', label: '4', value: 'b', isCorrect: true },
          ],
        },
      ],
      ...assessmentOverrides,
    },
    answers: [{ questionId: 'q1', answer: 'a', isCorrect: false, pointsEarned: 0 }],
  }
}

describe('getStudentAttempt answer key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'enr1' } as never)
  })

  it('withholds the correct answers on a failed gate', async () => {
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue(
      baseAttempt({ lessonId: 'l1', passingScore: 75 }, 20) as never,
    )

    const attempt = await getStudentAttempt('student1', 'at1')

    expect(attempt!.isGate).toBe(true)
    expect(attempt!.passed).toBe(false)
    // Unlimited retakes plus a visible answer key is pass-by-memorisation.
    expect(attempt!.questions[0].options.every(o => o.isCorrect === null)).toBe(true)
  })

  it('reveals the key on a passed gate', async () => {
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue(
      baseAttempt({ lessonId: 'l1', passingScore: 75 }, 90) as never,
    )

    const attempt = await getStudentAttempt('student1', 'at1')

    expect(attempt!.isGate).toBe(true)
    expect(attempt!.passed).toBe(true)
    expect(attempt!.questions[0].options.some(o => o.isCorrect === true)).toBe(true)
  })

  it('reveals the key on a failed subject-level assessment, as today', async () => {
    vi.mocked(db.assessmentAttempt.findFirst).mockResolvedValue(
      baseAttempt({ lessonId: null, passingScore: 75 }, 20) as never,
    )

    const attempt = await getStudentAttempt('student1', 'at1')

    expect(attempt!.isGate).toBe(false)
    expect(attempt!.questions[0].options.some(o => o.isCorrect === true)).toBe(true)
  })
})
