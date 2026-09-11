// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// The page pulls in the take-mode form, which reaches the server actions and
// therefore the db client; review mode never renders it.
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/student/queries', () => ({ getStudentAttempt: vi.fn() }))

import { getSession } from '@/lib/auth/session'
import { getStudentAttempt } from '@/lib/student/queries'
import AttemptPage from '@/app/(student)/student/courses/[id]/subjects/[sid]/assessments/[aid]/attempt/[attemptId]/page'
import type { StudentAttempt } from '@/lib/student/queries'

// A submitted attempt with a single essay question. Overrides let each test
// flip just the grading state.
function attempt(overrides: Partial<StudentAttempt>, question: Record<string, unknown>) {
  return {
    id: 'at1',
    status: 'GRADED',
    score: 0,
    startedAt: new Date('2026-01-01'),
    submittedAt: new Date('2026-01-01'),
    assessmentId: 'a1',
    assessmentTitle: 'Quiz',
    type: 'QUIZ',
    durationMins: null,
    passingScore: null,
    courseId: 'c1',
    subjectId: 'sub1',
    subjectTitle: 'Subject 1',
    isGate: false,
    passed: false,
    ...overrides,
    questions: [
      {
        id: 'q1',
        questionText: 'Did you know?',
        type: 'ESSAY',
        points: 1,
        order: 0,
        mediaType: null,
        mediaUrl: null,
        options: [],
        answer: 'Yes I know',
        isCorrect: null,
        pointsEarned: null,
        feedback: null,
        ...question,
      },
    ],
  } as unknown as StudentAttempt
}

async function renderPage() {
  const ui = await AttemptPage({
    params: Promise.resolve({ id: 'c1', sid: 'sub1', aid: 'a1', attemptId: 'at1' }),
  })
  render(ui)
}

describe('attempt review - essay grading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'u1' } as never)
  })

  it('shows the awarded points and the teacher feedback once graded', async () => {
    vi.mocked(getStudentAttempt).mockResolvedValue(
      attempt({}, { pointsEarned: 0, feedback: 'good' }),
    )

    await renderPage()

    expect(screen.getByText('0 / 1')).toBeInTheDocument()
    expect(screen.queryByText('Awaiting grading')).not.toBeInTheDocument()
    expect(screen.getByText('good')).toBeInTheDocument()
  })

  it('still says awaiting grading while the essay is ungraded', async () => {
    vi.mocked(getStudentAttempt).mockResolvedValue(
      attempt({ status: 'SUBMITTED', score: null }, { pointsEarned: null }),
    )

    await renderPage()

    expect(screen.getAllByText('Awaiting grading').length).toBeGreaterThan(0)
    expect(screen.getByText('— / 1')).toBeInTheDocument()
  })
})
