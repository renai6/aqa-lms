import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    enrollment: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { getStudentCourse } from '@/lib/student/queries'

// Narrow shape of the db.course.findUnique call we care about, so we can
// check the captured argument without reaching for @ts-expect-error (which
// only proves the expression errors under the current inferred type, not
// that the filter is actually present).
type CourseFindUniqueCall = {
  select: {
    subjects: {
      select: {
        assessments: { where: { isPublished: boolean; lessonId: null } }
      }
    }
  }
}

describe('grade isolation', () => {
  it('excludes lesson gates from the subject average query', async () => {
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'e1' } as never)
    vi.mocked(db.course.findUnique).mockResolvedValue({
      id: 'course1',
      title: 'Marhala 1',
      imageUrl: null,
      meetLink: null,
      subjects: [],
    } as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)

    await getStudentCourse('student1', 'course1')

    // Asserting on the query is the point: a gate must never reach
    // weightedSubjectGrade, or every student's grade shifts silently.
    const call = vi.mocked(db.course.findUnique).mock.calls[0][0] as unknown as CourseFindUniqueCall
    const assessmentWhere = call.select.subjects.select.assessments.where
    expect(assessmentWhere).toEqual({ isPublished: true, lessonId: null })
  })
})
