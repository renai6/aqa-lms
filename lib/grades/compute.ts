export type WeightedGradeItem = { weight: number; score: number | null }

// Weighted average of assessment scores by Assessment.weight.
// Assessments with no score yet (unattempted or awaiting essay grading) are
// excluded, and their weight is not counted, so the result reflects the work
// graded so far. Returns null when no assessment has a score.
// Used for both the student-facing subject average and the teacher's final-grade
// suggestion, so the two numbers always agree.
export function weightedSubjectGrade(
  items: WeightedGradeItem[],
): number | null {
  let weightSum = 0
  let weightedTotal = 0
  for (const { weight, score } of items) {
    if (score == null) continue
    weightSum += weight
    weightedTotal += weight * score
  }
  return weightSum > 0 ? weightedTotal / weightSum : null
}

export type WeightedCourseItem = { units: number; finalGrade: number }

// Weighted average of subject final grades by Subject.units.
// Returns null when there are no items or the total units is 0.
export function weightedCourseGrade(
  items: WeightedCourseItem[],
): number | null {
  let unitSum = 0
  let weightedTotal = 0
  for (const { units, finalGrade } of items) {
    unitSum += units
    weightedTotal += units * finalGrade
  }
  return unitSum > 0 ? weightedTotal / unitSum : null
}
