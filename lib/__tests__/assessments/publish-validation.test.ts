import { describe, it, expect } from 'vitest'
import { getPublishBlockers } from '@/lib/assessments/publish-validation'

describe('getPublishBlockers', () => {
  it('blocks when there are no questions', () => {
    const blockers = getPublishBlockers([])
    expect(blockers).toHaveLength(1)
    expect(blockers[0]).toMatch(/at least one question/)
  })

  it('passes for a valid MC question', () => {
    const blockers = getPublishBlockers([
      { type: 'MULTIPLE_CHOICE', options: [
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: false },
      ]},
    ])
    expect(blockers).toHaveLength(0)
  })

  it('passes for a valid TRUE_FALSE question', () => {
    const blockers = getPublishBlockers([
      { type: 'TRUE_FALSE', options: [
        { isCorrect: true },
        { isCorrect: false },
      ]},
    ])
    expect(blockers).toHaveLength(0)
  })

  it('passes for a valid ESSAY question', () => {
    const blockers = getPublishBlockers([
      { type: 'ESSAY', options: [] },
    ])
    expect(blockers).toHaveLength(0)
  })

  it('passes for a valid mix of question types', () => {
    const blockers = getPublishBlockers([
      { type: 'MULTIPLE_CHOICE', options: [{ isCorrect: true }, { isCorrect: false }] },
      { type: 'TRUE_FALSE', options: [{ isCorrect: false }, { isCorrect: true }] },
      { type: 'ESSAY', options: [] },
    ])
    expect(blockers).toHaveLength(0)
  })

  it('blocks MC with only 1 option', () => {
    const blockers = getPublishBlockers([
      { type: 'MULTIPLE_CHOICE', options: [{ isCorrect: true }] },
    ])
    expect(blockers.some(b => b.includes('2-6 options'))).toBe(true)
  })

  it('blocks MC with 7 options', () => {
    const blockers = getPublishBlockers([
      { type: 'MULTIPLE_CHOICE', options: Array(7).fill({ isCorrect: false }).map((o, i) => ({ isCorrect: i === 0 })) },
    ])
    expect(blockers.some(b => b.includes('2-6 options'))).toBe(true)
  })

  it('blocks MC with 0 correct answers', () => {
    const blockers = getPublishBlockers([
      { type: 'MULTIPLE_CHOICE', options: [{ isCorrect: false }, { isCorrect: false }] },
    ])
    expect(blockers.some(b => b.includes('exactly one correct answer'))).toBe(true)
  })

  it('blocks MC with 2 correct answers', () => {
    const blockers = getPublishBlockers([
      { type: 'MULTIPLE_CHOICE', options: [{ isCorrect: true }, { isCorrect: true }] },
    ])
    expect(blockers.some(b => b.includes('exactly one correct answer'))).toBe(true)
  })

  it('blocks TRUE_FALSE without a correct answer', () => {
    const blockers = getPublishBlockers([
      { type: 'TRUE_FALSE', options: [{ isCorrect: false }, { isCorrect: false }] },
    ])
    expect(blockers.some(b => b.includes('correct answer'))).toBe(true)
  })

  it('passes for essay-only assessment', () => {
    const blockers = getPublishBlockers([
      { type: 'ESSAY', options: [] },
      { type: 'ESSAY', options: [] },
    ])
    expect(blockers).toHaveLength(0)
  })
})

const mc = {
  type: 'MULTIPLE_CHOICE',
  options: [{ isCorrect: true }, { isCorrect: false }],
}
const essay = { type: 'ESSAY', options: [] }

describe('getPublishBlockers gate rules', () => {
  it('leaves non-gate assessments unchanged when the gate argument is omitted', () => {
    expect(getPublishBlockers([mc, essay])).toEqual([])
  })

  it('blocks a gate with no passing score', () => {
    const blockers = getPublishBlockers([mc], { isGate: true, passingScore: null })
    expect(blockers).toContain('A lesson gate must have a passing score.')
  })

  it('blocks a gate containing an essay question, naming its position', () => {
    const blockers = getPublishBlockers([mc, essay], { isGate: true, passingScore: 75 })
    expect(blockers).toContain(
      'Question 2: a lesson gate cannot contain essay questions, because it must score instantly.',
    )
  })

  it('passes a valid gate', () => {
    expect(getPublishBlockers([mc], { isGate: true, passingScore: 75 })).toEqual([])
  })

  it('still blocks an empty gate', () => {
    expect(getPublishBlockers([], { isGate: true, passingScore: 75 })).toEqual([
      'Assessment must have at least one question.',
    ])
  })
})
