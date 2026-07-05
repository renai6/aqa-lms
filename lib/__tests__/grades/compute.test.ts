import { describe, it, expect } from 'vitest'
import { weightedSubjectGrade } from '@/lib/grades/compute'

describe('weightedSubjectGrade', () => {
  it('returns null when no assessment has a score', () => {
    expect(weightedSubjectGrade([])).toBeNull()
    expect(
      weightedSubjectGrade([
        { weight: 1, score: null },
        { weight: 2, score: null },
      ]),
    ).toBeNull()
  })

  it('averages equally when weights are equal', () => {
    const result = weightedSubjectGrade([
      { weight: 1, score: 80 },
      { weight: 1, score: 100 },
    ])
    expect(result).toBe(90)
  })

  it('weights assessments by their weight', () => {
    // 80 at weight 1, 100 at weight 3 -> (80 + 300) / 4 = 95
    const result = weightedSubjectGrade([
      { weight: 1, score: 80 },
      { weight: 3, score: 100 },
    ])
    expect(result).toBe(95)
  })

  it('excludes assessments with no score and does not count their weight', () => {
    // Only the scored assessment counts: 70 at weight 5 -> 70
    const result = weightedSubjectGrade([
      { weight: 5, score: 70 },
      { weight: 5, score: null },
    ])
    expect(result).toBe(70)
  })

  it('handles a mix of scored and unscored with unequal weights', () => {
    // 60@2 and 90@1 count (weight 3 for the null is ignored) -> (120 + 90) / 3 = 70
    const result = weightedSubjectGrade([
      { weight: 2, score: 60 },
      { weight: 1, score: 90 },
      { weight: 3, score: null },
    ])
    expect(result).toBe(70)
  })
})
