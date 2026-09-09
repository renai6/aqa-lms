import { describe, it, expect } from 'vitest'
import {
  isLessonSatisfied,
  computeLockedLessons,
  type GatingLesson,
} from '@/lib/lessons/gating'

function lesson(over: Partial<GatingLesson> & { id: string; order: number }): GatingLesson {
  return { isCompleted: false, assessment: null, ...over }
}

const gate = (over: Partial<NonNullable<GatingLesson['assessment']>> = {}) => ({
  isPublished: true,
  passingScore: 75,
  attemptScores: [] as (number | null)[],
  ...over,
})

describe('isLessonSatisfied', () => {
  it('is satisfied when the lesson has no assessment', () => {
    expect(isLessonSatisfied(lesson({ id: 'l1', order: 1 }))).toBe(true)
  })

  it('is satisfied when the gate is unpublished', () => {
    const l = lesson({ id: 'l1', order: 1, assessment: gate({ isPublished: false }) })
    expect(isLessonSatisfied(l)).toBe(true)
  })

  it('is satisfied when the gate has no passing score', () => {
    const l = lesson({ id: 'l1', order: 1, assessment: gate({ passingScore: null }) })
    expect(isLessonSatisfied(l)).toBe(true)
  })

  it('is satisfied by an existing completion, which is the grandfather clause', () => {
    const l = lesson({ id: 'l1', order: 1, isCompleted: true, assessment: gate() })
    expect(isLessonSatisfied(l)).toBe(true)
  })

  it('is satisfied by an attempt at or above the passing score', () => {
    const l = lesson({ id: 'l1', order: 1, assessment: gate({ attemptScores: [40, 75] }) })
    expect(isLessonSatisfied(l)).toBe(true)
  })

  it('is not satisfied by attempts below the passing score', () => {
    const l = lesson({ id: 'l1', order: 1, assessment: gate({ attemptScores: [40, 74.9, null] }) })
    expect(isLessonSatisfied(l)).toBe(false)
  })
})

describe('computeLockedLessons', () => {
  const failed = lesson({ id: 'l2', order: 2, assessment: gate({ attemptScores: [10] }) })

  it('locks nothing when sequentialLessons is off', () => {
    const lessons = [lesson({ id: 'l1', order: 1 }), failed, lesson({ id: 'l3', order: 3 })]
    expect(computeLockedLessons(lessons, false).size).toBe(0)
  })

  it('never locks the first lesson', () => {
    const lessons = [lesson({ id: 'l1', order: 1, assessment: gate() })]
    expect(computeLockedLessons(lessons, true).has('l1')).toBe(false)
  })

  it('leaves the blocking lesson itself open so its quiz can be taken', () => {
    const lessons = [lesson({ id: 'l1', order: 1 }), failed, lesson({ id: 'l3', order: 3 })]
    const locked = computeLockedLessons(lessons, true)
    expect(locked.has('l2')).toBe(false)
    expect(locked.get('l3')).toBe('l2')
  })

  it('locks every lesson after the first unsatisfied one', () => {
    const lessons = [
      lesson({ id: 'l1', order: 1 }),
      failed,
      lesson({ id: 'l3', order: 3 }),
      lesson({ id: 'l4', order: 4, assessment: gate({ attemptScores: [100] }) }),
    ]
    const locked = computeLockedLessons(lessons, true)
    expect([...locked.keys()].sort()).toEqual(['l3', 'l4'])
  })

  it('lets ungated lessons between gates stay open', () => {
    const lessons = [
      lesson({ id: 'l1', order: 1, assessment: gate({ attemptScores: [90] }) }),
      lesson({ id: 'l2', order: 2 }),
      lesson({ id: 'l3', order: 3 }),
    ]
    expect(computeLockedLessons(lessons, true).size).toBe(0)
  })

  it('orders by order, not by array position', () => {
    const lessons = [lesson({ id: 'l3', order: 3 }), failed, lesson({ id: 'l1', order: 1 })]
    const locked = computeLockedLessons(lessons, true)
    expect(locked.has('l1')).toBe(false)
    expect(locked.get('l3')).toBe('l2')
  })
})
