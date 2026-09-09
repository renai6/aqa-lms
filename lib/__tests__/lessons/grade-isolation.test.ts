import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    enrollment: { findUnique: vi.fn(), findMany: vi.fn() },
    course: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    subjectTeacher: { findUnique: vi.fn() },
    grade: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { getStudentCourse } from '@/lib/student/queries'
import { getSubjectGradebook } from '@/lib/teacher/queries'

// Narrow shape of the db.course.findUnique call we care about, so we can
// check the captured argument without reaching for @ts-expect-error (which
// only proves the expression errors under the current inferred type, not
// that the filter is actually present). `lessonId` is optional so the same
// type describes a query that has lost the filter.
type CourseFindUniqueCall = {
  select: {
    subjects: {
      select: {
        assessments: { where: { isPublished: boolean; lessonId?: null } }
      }
    }
  }
}

type SubjectFindUniqueCall = {
  select: { assessments: { where: { lessonId?: null } } }
}

type FixtureAssessment = {
  id: string
  weight: number
  lessonId: string | null
  score: number
}

// The db is mocked, so nothing applies the query's `where` for us. This fake
// obeys it, which is what makes the behavioral assertion below mean something:
// drop `lessonId: null` from the query and the gate reaches
// weightedSubjectGrade, moving the average.
function mockCourseWithAssessments(assessments: FixtureAssessment[]): void {
  vi.mocked(db.course.findUnique).mockImplementation(((args: unknown) => {
    const where = (args as CourseFindUniqueCall).select.subjects.select
      .assessments.where
    const visible =
      'lessonId' in where
        ? assessments.filter(a => a.lessonId === where.lessonId)
        : assessments
    return Promise.resolve({
      id: 'course1',
      title: 'Marhala 1',
      imageUrl: null,
      meetLink: null,
      subjects: [
        {
          id: 'subject1',
          title: 'Fiqh',
          description: null,
          order: 1,
          lessons: [],
          schedules: [],
          teachers: [],
          assessments: visible.map(a => ({
            id: a.id,
            weight: a.weight,
            attempts: [{ status: 'GRADED', score: a.score }],
          })),
        },
      ],
    })
  }) as never)
}

describe('grade isolation', () => {
  beforeEach(() => vi.clearAllMocks())

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

  // The query-shape test above proves the filter is written. This one proves it
  // works: the same student, the same subject-level exam, with a wildly
  // different gate score present in one run and absent in the other.
  it('returns the same averageScore with and without a lesson gate present', async () => {
    vi.mocked(db.enrollment.findUnique).mockResolvedValue({ id: 'e1' } as never)
    vi.mocked(db.user.findUnique).mockResolvedValue({ gender: null } as never)

    const exam: FixtureAssessment = {
      id: 'a1',
      weight: 1,
      lessonId: null,
      score: 80,
    }
    const gate: FixtureAssessment = {
      id: 'a2',
      weight: 1,
      lessonId: 'lesson1',
      score: 5,
    }

    mockCourseWithAssessments([exam])
    const withoutGate = await getStudentCourse('student1', 'course1')

    mockCourseWithAssessments([exam, gate])
    const withGate = await getStudentCourse('student1', 'course1')

    expect(withoutGate?.subjects[0].averageScore).toBe(80)
    expect(withGate?.subjects[0].averageScore).toBe(
      withoutGate?.subjects[0].averageScore,
    )
    // The gate is not merely averaged away, it is absent: the count the student
    // sees must not include it either.
    expect(withGate?.subjects[0].totalAssessments).toBe(1)
  })

  // getSubjectGradebook is the least protected of the three filters: its
  // `where` was added fresh rather than extending an existing one, and the
  // pure-computation tests in lib/__tests__/grades/ would not notice its loss.
  it('excludes lesson gates from the teacher final-grade suggestion query', async () => {
    vi.mocked(db.subjectTeacher.findUnique).mockResolvedValue({
      subjectId: 'subject1',
    } as never)
    vi.mocked(db.subject.findUnique).mockResolvedValue({
      id: 'subject1',
      title: 'Fiqh',
      courseId: 'course1',
      gender: null,
      course: { passingGrade: 75 },
      assessments: [],
    } as never)
    vi.mocked(db.enrollment.findMany).mockResolvedValue([] as never)
    vi.mocked(db.grade.findMany).mockResolvedValue([] as never)

    await getSubjectGradebook('teacher1', 'subject1')

    const call = vi.mocked(db.subject.findUnique).mock.calls[0][0] as unknown as SubjectFindUniqueCall
    expect(call.select.assessments.where).toEqual({ lessonId: null })
  })
})
