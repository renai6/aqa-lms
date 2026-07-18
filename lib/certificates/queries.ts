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
  const [course, enrollment] = await Promise.all([
    db.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        passingGrade: true,
        subjects: {
          where: subjectGenderFilter(userGender),
          select: { id: true, units: true },
        },
      },
    }),
    db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { paymentStatus: true },
    }),
  ])
  if (!course) return null

  const fullyPaid = enrollment?.paymentStatus === 'FULLY_PAID'

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
    eligibility: certificateEligibility(inputs, course.passingGrade, fullyPaid),
  }
}
