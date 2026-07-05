import { describe, it, expect } from 'vitest'
import {
  pickRelevantAttempt,
  recomputeAttemptScore,
} from '@/lib/assessments/grading'
import type { AttemptStatus } from '@prisma/client'

type A = { status: AttemptStatus; label: string }

describe('pickRelevantAttempt', () => {
  it('returns null for no attempts', () => {
    expect(pickRelevantAttempt<A>([])).toBeNull()
  })

  it('prefers a completed attempt over an in-progress one', () => {
    const attempts: A[] = [
      { status: 'IN_PROGRESS', label: 'newest' },
      { status: 'GRADED', label: 'older-completed' },
    ]
    expect(pickRelevantAttempt(attempts)?.label).toBe('older-completed')
  })

  it('falls back to the most recent (first) when none are completed', () => {
    const attempts: A[] = [
      { status: 'IN_PROGRESS', label: 'newest' },
      { status: 'IN_PROGRESS', label: 'older' },
    ]
    expect(pickRelevantAttempt(attempts)?.label).toBe('newest')
  })
})

describe('recomputeAttemptScore', () => {
  const questions = [
    { id: 'q1', points: 2 },
    { id: 'q2', points: 3 },
    { id: 'q3', points: 5 },
  ]

  it('computes the percentage from points earned across all questions', () => {
    const earned = new Map([
      ['q1', 2], // full
      ['q2', 0], // none
      ['q3', 5], // full essay points
    ])
    // 7 / 10 -> 70
    expect(recomputeAttemptScore(questions, earned)).toBe(70)
  })

  it('treats missing entries as zero', () => {
    const earned = new Map([['q1', 2]])
    // 2 / 10 -> 20
    expect(recomputeAttemptScore(questions, earned)).toBe(20)
  })

  it('supports partial (decimal) essay points', () => {
    const earned = new Map([
      ['q1', 2],
      ['q2', 3],
      ['q3', 2.5],
    ])
    // 7.5 / 10 -> 75
    expect(recomputeAttemptScore(questions, earned)).toBe(75)
  })

  it('returns 0 when there are no points to earn', () => {
    expect(recomputeAttemptScore([], new Map())).toBe(0)
  })
})
