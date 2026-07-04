import { describe, it, expect } from 'vitest'
import { scoreOneAnswer, scoreAttempt, type ScorableQuestion } from '@/lib/assessments/scoring'

const mc: ScorableQuestion = {
  id: 'q1',
  type: 'MULTIPLE_CHOICE',
  points: 2,
  options: [
    { value: 'Paris', isCorrect: true },
    { value: 'London', isCorrect: false },
    { value: 'Rome', isCorrect: false },
  ],
}

const tf: ScorableQuestion = {
  id: 'q2',
  type: 'TRUE_FALSE',
  points: 1,
  options: [
    { value: 'true', isCorrect: false },
    { value: 'false', isCorrect: true },
  ],
}

const essay: ScorableQuestion = {
  id: 'q3',
  type: 'ESSAY',
  points: 5,
  options: [],
}

describe('scoreOneAnswer', () => {
  it('scores a correct MC answer', () => {
    expect(scoreOneAnswer(mc, 'Paris')).toEqual({ isCorrect: true, pointsEarned: 2 })
  })

  it('scores an incorrect MC answer', () => {
    expect(scoreOneAnswer(mc, 'London')).toEqual({ isCorrect: false, pointsEarned: 0 })
  })

  it('scores an unanswered MC as incorrect', () => {
    expect(scoreOneAnswer(mc, '')).toEqual({ isCorrect: false, pointsEarned: 0 })
  })

  it('scores a correct TRUE_FALSE answer', () => {
    expect(scoreOneAnswer(tf, 'false')).toEqual({ isCorrect: true, pointsEarned: 1 })
  })

  it('leaves an essay ungraded', () => {
    expect(scoreOneAnswer(essay, 'a long thoughtful answer')).toEqual({
      isCorrect: null,
      pointsEarned: null,
    })
  })
})

describe('scoreAttempt', () => {
  it('fully grades an all-objective attempt', () => {
    const result = scoreAttempt(
      [mc, tf],
      [
        { questionId: 'q1', answer: 'Paris' },
        { questionId: 'q2', answer: 'true' },
      ],
    )
    expect(result.hasEssay).toBe(false)
    expect(result.totalPoints).toBe(3)
    expect(result.earnedPoints).toBe(2)
    expect(result.score).toBeCloseTo((2 / 3) * 100)
    expect(result.status).toBe('GRADED')
  })

  it('awards 100% for all-correct objective attempt', () => {
    const result = scoreAttempt(
      [mc, tf],
      [
        { questionId: 'q1', answer: 'Paris' },
        { questionId: 'q2', answer: 'false' },
      ],
    )
    expect(result.score).toBe(100)
    expect(result.status).toBe('GRADED')
  })

  it('leaves score null and status SUBMITTED when an essay is present', () => {
    const result = scoreAttempt(
      [mc, essay],
      [
        { questionId: 'q1', answer: 'Paris' },
        { questionId: 'q3', answer: 'my essay' },
      ],
    )
    expect(result.hasEssay).toBe(true)
    expect(result.score).toBeNull()
    expect(result.status).toBe('SUBMITTED')
    // Objective answers are still scored underneath.
    const mcAnswer = result.answers.find(a => a.questionId === 'q1')
    expect(mcAnswer?.pointsEarned).toBe(2)
    const essayAnswer = result.answers.find(a => a.questionId === 'q3')
    expect(essayAnswer?.pointsEarned).toBeNull()
    expect(essayAnswer?.isCorrect).toBeNull()
  })

  it('records missing answers as empty and incorrect', () => {
    const result = scoreAttempt([mc, tf], [{ questionId: 'q1', answer: 'Paris' }])
    const tfAnswer = result.answers.find(a => a.questionId === 'q2')
    expect(tfAnswer?.answer).toBe('')
    expect(tfAnswer?.isCorrect).toBe(false)
    expect(tfAnswer?.pointsEarned).toBe(0)
  })

  it('handles a zero-point total without dividing by zero', () => {
    const zero: ScorableQuestion = { ...mc, points: 0, id: 'q0' }
    const result = scoreAttempt([zero], [{ questionId: 'q0', answer: 'Paris' }])
    expect(result.score).toBe(0)
  })
})
