import { describe, it, expect } from 'vitest'
import { batchCoverageNote } from '@/lib/batches/coverage'

describe('batchCoverageNote', () => {
  it('warns when the destination batch has no materials at all', () => {
    expect(batchCoverageNote(0, 18)).toBe(
      'This batch has no lesson materials yet, so the student will see none until you add them.',
    )
  })

  it('reports partial coverage against the course total', () => {
    expect(batchCoverageNote(3, 18)).toBe(
      'This batch has materials for 3 of 18 lessons.',
    )
  })

  it('reports full coverage without the fraction', () => {
    expect(batchCoverageNote(18, 18)).toBe(
      'This batch has materials for all 18 lessons.',
    )
  })

  it('says nothing about a course that has no lessons', () => {
    expect(batchCoverageNote(0, 0)).toBeNull()
  })

  it('keeps the singular reading for a one-lesson course', () => {
    expect(batchCoverageNote(1, 1)).toBe('This batch has materials for its 1 lesson.')
  })
})
