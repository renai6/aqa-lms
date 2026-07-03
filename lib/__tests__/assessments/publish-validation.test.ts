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
