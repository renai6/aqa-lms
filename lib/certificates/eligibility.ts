import { weightedCourseGrade } from '@/lib/grades/compute'

export type SubjectGradeInput = { units: number; finalGrade: number | null }

export type CertificateEligibility = {
  eligible: boolean
  allGraded: boolean
  fullyPaid: boolean
  courseGrade: number | null
  passingGrade: number
  gradedCount: number
  totalSubjects: number
}

// Pure eligibility check. A student may download a course certificate when the
// course is fully paid AND every subject has a final grade AND the units-weighted
// average of those grades meets the course passing grade.
export function certificateEligibility(
  subjects: SubjectGradeInput[],
  passingGrade: number,
  fullyPaid: boolean,
): CertificateEligibility {
  const totalSubjects = subjects.length
  const gradedCount = subjects.filter((s) => s.finalGrade != null).length
  const allGraded = totalSubjects > 0 && gradedCount === totalSubjects

  const courseGrade = weightedCourseGrade(
    subjects
      .filter((s): s is { units: number; finalGrade: number } => s.finalGrade != null)
      .map((s) => ({ units: s.units, finalGrade: s.finalGrade })),
  )

  const eligible =
    fullyPaid && allGraded && courseGrade != null && courseGrade >= passingGrade

  return { eligible, allGraded, fullyPaid, courseGrade, passingGrade, gradedCount, totalSubjects }
}
