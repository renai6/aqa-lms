import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    lesson: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
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
import { deleteLessonAction } from '@/app/(admin)/admin/courses/[id]/subjects/[sid]/actions'

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('id', over.id ?? 'lesson-1')
  fd.set('subjectId', over.subjectId ?? 'subject-1')
  fd.set('courseId', over.courseId ?? 'course-1')
  return fd
}

const initial = { error: null }

// Guards Assessment.lessonId's ON DELETE SET NULL foreign key. Deleting a
// gated lesson with no guard would silently detach its assessment, turning it
// into an ordinary subject-level assessment that suddenly counts toward every
// enrolled student's subject grade at weight 1.0.
describe('deleteLessonAction gate guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ userId: 'a1', role: 'ADMIN' } as never)
  })

  it('refuses to delete a lesson that has an assessment attached', async () => {
    vi.mocked(db.lesson.findUnique).mockResolvedValue({
      assessment: { id: 'assess-1' },
    } as never)

    const result = await deleteLessonAction(initial, form())

    expect(result.error).toBe(
      'This lesson has an assessment attached. Delete or detach the assessment before deleting the lesson.',
    )
    expect(db.lesson.delete).not.toHaveBeenCalled()
  })

  it('deletes an ungated lesson', async () => {
    vi.mocked(db.lesson.findUnique).mockResolvedValue({
      assessment: null,
    } as never)
    vi.mocked(db.lesson.delete).mockResolvedValue({} as never)

    await expect(deleteLessonAction(initial, form())).rejects.toThrow('NEXT_REDIRECT')

    expect(db.lesson.delete).toHaveBeenCalledWith({ where: { id: 'lesson-1' } })
  })
})
