import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { assessment: { findMany: vi.fn() } },
}))
vi.mock('@/lib/subjects/access', () => ({ getUserGender: vi.fn() }))

import { db } from '@/lib/db'
import { getUserGender } from '@/lib/subjects/access'
import { getStudentTodoAssessments } from '@/lib/student/queries'

function row(id: string, type: 'EXAM' | 'QUIZ', attempts: Array<{ id: string }> = []) {
  return {
    id,
    title: 'Assessment ' + id,
    type,
    subjectId: 's1',
    subject: { title: 'Fiqh', courseId: 'c1', course: { title: 'Marhala 1' } },
    attempts,
  }
}

describe('getStudentTodoAssessments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserGender).mockResolvedValue('MALE')
    vi.mocked(db.assessment.findMany).mockResolvedValue([] as never)
  })

  async function where() {
    await getStudentTodoAssessments('u1')
    return vi.mocked(db.assessment.findMany).mock.calls[0][0]!.where
  }

  it('keeps only published subject-level assessments that have questions', async () => {
    expect(await where()).toMatchObject({
      isPublished: true,
      lessonId: null,
      questions: { some: {} },
    })
  })

  it('drops assessments the student has already submitted', async () => {
    expect(await where()).toMatchObject({
      attempts: { none: { userId: 'u1', status: { in: ['SUBMITTED', 'GRADED'] } } },
    })
  })

  it('requires an active enrollment in a non-archived course', async () => {
    expect(await where()).toMatchObject({
      subject: {
        course: {
          archivedAt: null,
          enrollments: { some: { userId: 'u1', removedAt: null } },
        },
      },
    })
  })

  it('hides subjects restricted to another gender', async () => {
    expect(await where()).toMatchObject({
      subject: { OR: [{ gender: null }, { gender: 'MALE' }] },
    })
  })

  it('only sees unrestricted subjects when the student has no gender on file', async () => {
    vi.mocked(getUserGender).mockResolvedValue(null)
    expect(await where()).toMatchObject({ subject: { gender: null } })
  })

  it('reads only the requesting student in-progress attempts', async () => {
    await getStudentTodoAssessments('u1')
    const arg = vi.mocked(db.assessment.findMany).mock.calls[0][0]!
    expect(arg.select!.attempts).toMatchObject({
      where: { userId: 'u1', status: 'IN_PROGRESS' },
    })
  })

  it('maps a row to what the dashboard links to', async () => {
    vi.mocked(db.assessment.findMany).mockResolvedValue([row('a1', 'EXAM')] as never)

    expect(await getStudentTodoAssessments('u1')).toEqual([
      {
        assessmentId: 'a1',
        title: 'Assessment a1',
        type: 'EXAM',
        courseId: 'c1',
        subjectId: 's1',
        subjectTitle: 'Fiqh',
        courseTitle: 'Marhala 1',
        inProgress: false,
      },
    ])
  })

  // The dashboard caps this list, so the order decides what a student sees.
  it('puts started work first, then exams, keeping query order within each', async () => {
    vi.mocked(db.assessment.findMany).mockResolvedValue([
      row('quiz-new', 'QUIZ'),
      row('exam-new', 'EXAM'),
      row('quiz-started', 'QUIZ', [{ id: 'att1' }]),
      row('quiz-old', 'QUIZ'),
      row('exam-old', 'EXAM'),
    ] as never)

    const result = await getStudentTodoAssessments('u1')

    expect(result.map(t => t.assessmentId)).toEqual([
      'quiz-started',
      'exam-new',
      'exam-old',
      'quiz-new',
      'quiz-old',
    ])
    expect(vi.mocked(db.assessment.findMany).mock.calls[0][0]!.orderBy).toEqual({
      createdAt: 'desc',
    })
  })
})
