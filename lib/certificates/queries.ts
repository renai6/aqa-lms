import { db } from '@/lib/db'
import { getUserGender } from '@/lib/subjects/access'
import { subjectGenderFilter } from '@/lib/subjects/visibility'
import {
  certificateEligibility,
  type CertificateEligibility,
  type SubjectGradeInput,
} from '@/lib/certificates/eligibility'

// Eligibility for a single course, plus its title (for the certificate page).
// Returns null when the course does not exist. Uses the gender filter so a
// subject restricted to the other gender is never counted.
export async function getCertificateEligibility(
  userId: string,
  courseId: string,
): Promise<{ courseTitle: string; eligibility: CertificateEligibility } | null> {
  const userGender = await getUserGender(userId)
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      title: true,
      passingGrade: true,
      subjects: {
        where: subjectGenderFilter(userGender),
        select: { id: true, units: true },
      },
    },
  })
  if (!course) return null

  const subjectIds = course.subjects.map((s) => s.id)
  const grades =
    subjectIds.length > 0
      ? await db.grade.findMany({
          where: { userId, subjectId: { in: subjectIds } },
          select: { subjectId: true, finalGrade: true },
        })
      : []
  const gradeMap = new Map(grades.map((g) => [g.subjectId, g.finalGrade]))

  const inputs: SubjectGradeInput[] = course.subjects.map((s) => ({
    units: s.units,
    finalGrade: gradeMap.get(s.id) ?? null,
  }))

  return {
    courseTitle: course.title,
    eligibility: certificateEligibility(inputs, course.passingGrade),
  }
}

export type CertificateListItem = {
  courseId: string
  courseTitle: string
} & CertificateEligibility

// One row per enrolled course that has at least one visible subject. Loads all
// enrollments and the student's grades in two queries, then computes per course.
export async function getStudentCertificates(
  userId: string,
): Promise<CertificateListItem[]> {
  const userGender = await getUserGender(userId)
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: 'desc' },
    select: {
      courseId: true,
      course: {
        select: {
          title: true,
          passingGrade: true,
          subjects: {
            where: subjectGenderFilter(userGender),
            select: { id: true, units: true },
          },
        },
      },
    },
  })

  const allSubjectIds = enrollments.flatMap((e) => e.course.subjects.map((s) => s.id))
  const grades =
    allSubjectIds.length > 0
      ? await db.grade.findMany({
          where: { userId, subjectId: { in: allSubjectIds } },
          select: { subjectId: true, finalGrade: true },
        })
      : []
  const gradeMap = new Map(grades.map((g) => [g.subjectId, g.finalGrade]))

  return enrollments
    .filter((e) => e.course.subjects.length > 0)
    .map((e) => {
      const inputs: SubjectGradeInput[] = e.course.subjects.map((s) => ({
        units: s.units,
        finalGrade: gradeMap.get(s.id) ?? null,
      }))
      return {
        courseId: e.courseId,
        courseTitle: e.course.title,
        ...certificateEligibility(inputs, e.course.passingGrade),
      }
    })
}
