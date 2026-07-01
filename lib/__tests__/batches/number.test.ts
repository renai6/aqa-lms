import { describe, it, expect } from 'vitest'
import { nextBatchNumber } from '@/lib/batches/number'

describe('nextBatchNumber', () => {
  it('returns 34 when no batches exist for a course', () => {
    expect(nextBatchNumber(null)).toBe(34)
  })

  it('returns max + 1 when batches exist', () => {
    expect(nextBatchNumber(34)).toBe(35)
    expect(nextBatchNumber(37)).toBe(38)
  })
})
