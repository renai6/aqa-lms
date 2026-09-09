import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    subjectTeacher: { findUnique: vi.fn() },
    lesson: { findFirst: vi.fn() },
    assessment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    question: { findMany: vi.fn() },
    assessmentAttempt: { count: vi.fn() },
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
import { isAdmin } from '@/lib/auth/capabilities'
import { createAssessmentAction, updateAssessmentAction } from '@/lib/assessments/actions'

describe('isAdmin', () => {
  it('is true for SUPER_ADMIN and ADMIN', () => {
    expect(isAdmin({ userId: 'u', role: 'SUPER_ADMIN' })).toBe(true)
    expect(isAdmin({ userId: 'u', role: 'ADMIN' })).toBe(true)
  })

  it('is false for a teacher, a student and no session', () => {
    expect(isAdmin({ userId: 'u', role: 'TEACHER' })).toBe(false)
    expect(isAdmin({ userId: 'u', role: 'STUDENT' })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})

function createForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('subjectId', over.subjectId ?? 'sub-1')
  fd.set('basePath', over.basePath ?? '/admin/courses/c1/subjects/sub-1')
  fd.set('title', over.title ?? 'Quiz 1')
  fd.set('type', over.type ?? 'QUIZ')
  if (over.lessonId !== undefined) fd.set('lessonId', over.lessonId)
  return fd
}

function updateForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('id', over.id ?? 'assess-1')
  fd.set('subjectId', over.subjectId ?? 'sub-1')
  fd.set('basePath', over.basePath ?? '/admin/courses/c1/subjects/sub-1')
  fd.set('title', over.title ?? 'Quiz 1')
  fd.set('type', over.type ?? 'QUIZ')
  if (over.lessonId !== undefined) fd.set('lessonId', over.lessonId)
  return fd
}

// Action-level authorization tests for the admin-only gate boundary. These
// exercise parseLessonId through the real actions rather than in isolation,
// so a future refactor of the condition can't silently reopen the "teacher
// clears/attaches a gate" hole without a test failing.
describe('createAssessmentAction admin-only gate authoring', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a TEACHER attaching a lesson gate, and never writes', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' } as never)
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue({ subjectId: 'sub-1' } as never)

    const result = await createAssessmentAction(
      { error: null },
      createForm({ lessonId: 'lesson-1' }),
    )

    expect(result.error).toBe('Only an admin can manage a lesson gate.')
    expect(db.assessment.create).not.toHaveBeenCalled()
  })

  it('lets an ADMIN attach a lesson gate through to the write', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'lesson-1' } as never)
    vi.mocked(db.assessment.create).mockResolvedValue({ id: 'assess-new' } as never)

    await expect(
      createAssessmentAction({ error: null }, createForm({ lessonId: 'lesson-1' })),
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(db.assessment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lessonId: 'lesson-1' }) }),
    )
  })
})

describe('updateAssessmentAction admin-only gate authoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // No attempts unless a test says otherwise, so the gate-change guard is
    // out of the way of the authorization cases.
    vi.mocked(db.assessmentAttempt.count).mockResolvedValue(0 as never)
  })

  // The subtle hole: a teacher submits the edit form untouched (no lessonId
  // field at all) against an assessment an admin already gated. Without the
  // alreadyGates half of parseLessonId's condition this would sail through
  // and silently re-save the existing gate under teacher control.
  it('rejects a TEACHER editing an already-gated assessment with no lessonId field submitted, and never writes', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 't1', role: 'TEACHER' } as never)
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue({ subjectId: 'sub-1' } as never)
    vi.mocked(db.assessment.findUnique).mockResolvedValue({
      lessonId: 'lesson-1',
      subjectId: 'sub-1',
    } as never)

    const result = await updateAssessmentAction({ error: null }, updateForm())

    expect(result.error).toBe('Only an admin can manage a lesson gate.')
    expect(db.assessment.update).not.toHaveBeenCalled()
  })

  it('lets an ADMIN editing an already-gated assessment through to the write', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(db.assessment.findUnique).mockResolvedValue({
      lessonId: 'lesson-1',
      subjectId: 'sub-1',
    } as never)
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'lesson-1' } as never)
    vi.mocked(db.question.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessment.update).mockResolvedValue({} as never)

    const result = await updateAssessmentAction(
      { error: null },
      updateForm({ lessonId: 'lesson-1' }),
    )

    expect(result.success).toBe(true)
    expect(db.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lessonId: 'lesson-1' }) }),
    )
  })

  // C7: the teacher route renders no gate selector, so an admin editing there
  // submits no lessonId field at all. Treating that as "detach" would silently
  // strip the gate; it must mean "no change".
  it('keeps the existing gate when no lessonId field is submitted', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(db.assessment.findUnique).mockResolvedValue({
      lessonId: 'lesson-1',
      subjectId: 'sub-1',
    } as never)
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'lesson-1' } as never)
    vi.mocked(db.question.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessment.update).mockResolvedValue({} as never)

    const result = await updateAssessmentAction({ error: null }, updateForm())

    expect(result.success).toBe(true)
    expect(db.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lessonId: 'lesson-1' }) }),
    )
  })

  // Attaching or detaching after students have been scored moves the
  // assessment in or out of weightedSubjectGrade, shifting live grades.
  it('rejects detaching a gate that has attempts, and never writes', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(db.assessment.findUnique).mockResolvedValue({
      lessonId: 'lesson-1',
      subjectId: 'sub-1',
    } as never)
    vi.mocked(db.assessmentAttempt.count).mockResolvedValue(2 as never)

    const result = await updateAssessmentAction(
      { error: null },
      updateForm({ lessonId: '' }),
    )

    expect(result.error).toContain('has student attempts')
    expect(db.assessment.update).not.toHaveBeenCalled()
  })

  it('still allows editing an assessment with attempts when the gate is unchanged', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(db.assessment.findUnique).mockResolvedValue({
      lessonId: 'lesson-1',
      subjectId: 'sub-1',
    } as never)
    vi.mocked(db.assessmentAttempt.count).mockResolvedValue(2 as never)
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: 'lesson-1' } as never)
    vi.mocked(db.question.findMany).mockResolvedValue([] as never)
    vi.mocked(db.assessment.update).mockResolvedValue({} as never)

    const result = await updateAssessmentAction(
      { error: null },
      updateForm({ lessonId: 'lesson-1', title: 'Fixed title' }),
    )

    expect(result.success).toBe(true)
  })

  it('rejects attaching a lesson that belongs to a different subject, and never writes', async () => {
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
    vi.mocked(db.assessment.findUnique).mockResolvedValue({
      lessonId: null,
      subjectId: 'sub-1',
    } as never)
    // findFirst is scoped to { id: lessonId, subjectId: existing.subjectId };
    // a lesson belonging to a different subject never matches that filter.
    vi.mocked(db.lesson.findFirst).mockResolvedValue(null)

    const result = await updateAssessmentAction(
      { error: null },
      updateForm({ lessonId: 'other-subject-lesson' }),
    )

    expect(result.error).toBe('Invalid lesson.')
    expect(db.assessment.update).not.toHaveBeenCalled()
  })
})
