import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = {
  questionOption: { deleteMany: vi.fn() },
  question: { deleteMany: vi.fn() },
  assessment: { deleteMany: vi.fn() },
  subjectTeacher: { deleteMany: vi.fn() },
  lesson: { deleteMany: vi.fn() },
  subject: { delete: vi.fn() },
}

vi.mock('@/lib/db', () => ({
  db: {
    assessmentAttempt: { count: vi.fn() },
    grade: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
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
import { deleteSubjectAction } from '@/app/(admin)/admin/courses/[id]/actions'

function form(): FormData {
  const fd = new FormData()
  fd.set('id', 'subject-1')
  fd.set('courseId', 'course-1')
  return fd
}

const initial = { error: null }

// Subject's children are RESTRICT foreign keys: Assessment, Grade, Lesson and
// SubjectTeacher all block the delete. Clearing only lessons left every subject
// with an assessment or an assigned teacher failing with a raw database error.
describe('deleteSubjectAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(db.assessmentAttempt.count).mockResolvedValue(0 as never)
    vi.mocked(db.grade.count).mockResolvedValue(0 as never)
    vi.mocked(db.$transaction).mockImplementation(((fn: (c: typeof tx) => unknown) =>
      fn(tx)) as never)
  })

  it('clears assessments, teachers and lessons before deleting the subject', async () => {
    await expect(deleteSubjectAction(initial, form())).rejects.toThrow('NEXT_REDIRECT')

    expect(tx.questionOption.deleteMany).toHaveBeenCalledWith({
      where: { question: { assessment: { subjectId: 'subject-1' } } },
    })
    expect(tx.question.deleteMany).toHaveBeenCalledWith({
      where: { assessment: { subjectId: 'subject-1' } },
    })
    expect(tx.assessment.deleteMany).toHaveBeenCalledWith({ where: { subjectId: 'subject-1' } })
    expect(tx.subjectTeacher.deleteMany).toHaveBeenCalledWith({ where: { subjectId: 'subject-1' } })
    expect(tx.lesson.deleteMany).toHaveBeenCalledWith({ where: { subjectId: 'subject-1' } })
    expect(tx.subject.delete).toHaveBeenCalledWith({ where: { id: 'subject-1' } })
  })

  // Assessment.lessonId is ON DELETE SET NULL, so dropping the lessons first
  // would silently detach a lesson gate instead of removing it.
  it('deletes assessments before lessons', async () => {
    await expect(deleteSubjectAction(initial, form())).rejects.toThrow('NEXT_REDIRECT')

    expect(tx.assessment.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.lesson.deleteMany.mock.invocationCallOrder[0],
    )
  })

  it('refuses to delete a subject that has student attempts', async () => {
    vi.mocked(db.assessmentAttempt.count).mockResolvedValue(3 as never)

    const result = await deleteSubjectAction(initial, form())

    expect(result.error).toBe(
      'Cannot delete this subject: it has 3 student attempts on record. Deleting it would erase that student history.',
    )
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('refuses to delete a subject that has grades', async () => {
    vi.mocked(db.grade.count).mockResolvedValue(1 as never)

    const result = await deleteSubjectAction(initial, form())

    expect(result.error).toBe(
      'Cannot delete this subject: it has 1 grade on record. Deleting it would erase that student history.',
    )
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('names both blockers when attempts and grades exist', async () => {
    vi.mocked(db.assessmentAttempt.count).mockResolvedValue(1 as never)
    vi.mocked(db.grade.count).mockResolvedValue(2 as never)

    const result = await deleteSubjectAction(initial, form())

    expect(result.error).toBe(
      'Cannot delete this subject: it has 1 student attempt and 2 grades on record. Deleting it would erase that student history.',
    )
  })
})
