import { describe, it, expect } from 'vitest'
import { certificateEligibility } from '@/lib/certificates/eligibility'

describe('certificateEligibility', () => {
  it('is not eligible when there are no subjects', () => {
    const r = certificateEligibility([], 75, true)
    expect(r.eligible).toBe(false)
    expect(r.allGraded).toBe(false)
    expect(r.courseGrade).toBeNull()
    expect(r.totalSubjects).toBe(0)
  })

  it('is not eligible when a subject is ungraded', () => {
    const r = certificateEligibility(
      [
        { units: 1, finalGrade: 90 },
        { units: 1, finalGrade: null },
      ],
      75,
      true,
    )
    expect(r.allGraded).toBe(false)
    expect(r.gradedCount).toBe(1)
    expect(r.eligible).toBe(false)
  })

  it('is not eligible when the weighted average is below passing', () => {
    // 60 and 70 at equal units -> 65 < 75
    const r = certificateEligibility(
      [
        { units: 1, finalGrade: 60 },
        { units: 1, finalGrade: 70 },
      ],
      75,
      true,
    )
    expect(r.allGraded).toBe(true)
    expect(r.courseGrade).toBe(65)
    expect(r.eligible).toBe(false)
  })

  it('is not eligible when graded and passing but not fully paid', () => {
    // 70 at 1 unit, 90 at 3 units -> 85 >= 75, but payment is incomplete
    const r = certificateEligibility(
      [
        { units: 1, finalGrade: 70 },
        { units: 3, finalGrade: 90 },
      ],
      75,
      false,
    )
    expect(r.allGraded).toBe(true)
    expect(r.courseGrade).toBe(85)
    expect(r.fullyPaid).toBe(false)
    expect(r.eligible).toBe(false)
  })

  it('is eligible when fully paid, all graded, and the weighted average meets passing', () => {
    // 70 at 1 unit, 90 at 3 units -> 85 >= 75
    const r = certificateEligibility(
      [
        { units: 1, finalGrade: 70 },
        { units: 3, finalGrade: 90 },
      ],
      75,
      true,
    )
    expect(r.allGraded).toBe(true)
    expect(r.courseGrade).toBe(85)
    expect(r.fullyPaid).toBe(true)
    expect(r.eligible).toBe(true)
  })

  it('respects a custom passing grade', () => {
    const r = certificateEligibility([{ units: 1, finalGrade: 80 }], 90, true)
    expect(r.passingGrade).toBe(90)
    expect(r.eligible).toBe(false)
  })
})
