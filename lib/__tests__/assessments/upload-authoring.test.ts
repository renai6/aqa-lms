import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = {
  question: { create: vi.fn(), update: vi.fn() },
  questionOption: { createMany: vi.fn(), deleteMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({
  db: {
    lesson: { findFirst: vi.fn() },
    assessment: { findUnique: vi.fn(), update: vi.fn() },
    question: { findMany: vi.fn(), aggregate: vi.fn() },
    assessmentAttempt: { count: vi.fn() },
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
import {
  createQuestionAction,
  updateQuestionAction,
  updateAssessmentAction,
} from '@/lib/assessments/actions'

const FOLDER = 'https://drive.google.com/drive/folders/1FoLd-eR_9'

function questionForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('assessmentId', 'assess-1')
  fd.set('subjectId', 'sub-1')
  fd.set('basePath', '/admin/courses/c1/subjects/sub-1')
  fd.set('questionText', 'Record yourself reading the passage.')
  fd.set('type', 'FILE_UPLOAD')
  fd.set('points', '5')
  for (const [k, v] of Object.entries(over)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
  vi.mocked(db.assessmentAttempt.count).mockResolvedValue(0 as never)
  vi.mocked(db.question.aggregate).mockResolvedValue({ _max: { order: 1 } } as never)
  vi.mocked(db.$transaction).mockImplementation((async (fn: (t: typeof tx) => unknown) =>
    fn(tx)) as never)
  tx.question.create.mockResolvedValue({ id: 'q-new' })
})

describe('createQuestionAction with a file upload question', () => {
  it('writes the upload folder and no answer options', async () => {
    vi.mocked(db.assessment.findUnique).mockResolvedValue({ lessonId: null } as never)

    await expect(
      createQuestionAction(
        { error: null },
        questionForm({ uploadFolderUrl: FOLDER + '?usp=sharing' }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(tx.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'FILE_UPLOAD', uploadFolderUrl: FOLDER }),
      }),
    )
    expect(tx.questionOption.createMany).not.toHaveBeenCalled()
  })

  it('refuses a file upload without a folder link, and never writes', async () => {
    vi.mocked(db.assessment.findUnique).mockResolvedValue({ lessonId: null } as never)

    const result = await createQuestionAction({ error: null }, questionForm())

    expect(result.error).toMatch(/Google Drive folder/)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('refuses a file upload on a lesson gate, which must score instantly', async () => {
    vi.mocked(db.assessment.findUnique).mockResolvedValue({ lessonId: 'lesson-1' } as never)

    const result = await createQuestionAction(
      { error: null },
      questionForm({ uploadFolderUrl: FOLDER }),
    )

    expect(result.error).toBe(
      'A lesson gate cannot contain file upload questions, because it must score instantly.',
    )
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe('updateQuestionAction', () => {
  it('clears the upload folder when a file upload becomes an essay', async () => {
    vi.mocked(db.assessment.findUnique).mockResolvedValue({ lessonId: null } as never)

    await updateQuestionAction(
      { error: null },
      questionForm({ id: 'q1', type: 'ESSAY', uploadFolderUrl: FOLDER }),
    )

    expect(tx.question.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ESSAY', uploadFolderUrl: null }),
      }),
    )
  })
})

describe('updateAssessmentAction attaching a gate', () => {
  it('refuses while the assessment holds a file upload question', async () => {
    vi.mocked(db.assessment.findUnique).mockResolvedValue({
      lessonId: null,
      subjectId: 'sub-1',
    } as never)
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'lesson-1' } as never)
    vi.mocked(db.question.findMany).mockResolvedValue([{ order: 3 }] as never)

    const fd = new FormData()
    fd.set('id', 'assess-1')
    fd.set('subjectId', 'sub-1')
    fd.set('basePath', '/admin/courses/c1/subjects/sub-1')
    fd.set('title', 'Quiz 1')
    fd.set('type', 'QUIZ')
    fd.set('lessonId', 'lesson-1')

    const result = await updateAssessmentAction({ error: null }, fd)

    expect(db.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assessmentId: 'assess-1', type: { in: ['ESSAY', 'FILE_UPLOAD'] } },
      }),
    )
    expect(result.error).toBe(
      'Remove the essay or file upload question(s) at position 3 before this assessment can gate a lesson.',
    )
    expect(db.assessment.update).not.toHaveBeenCalled()
  })
})
