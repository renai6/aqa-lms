import { describe, it, expect } from 'vitest'
import { generateBatchName, batchLabel } from '@/lib/batches/name'

describe('generateBatchName', () => {
  it('joins the two-digit month and year with the course alias', () => {
    expect(generateBatchName('MM01', new Date('2026-09-15T04:00:00Z'))).toBe('0926MM01')
  })

  it('keeps a two-digit month unpadded', () => {
    expect(generateBatchName('MM01', new Date('2026-12-15T04:00:00Z'))).toBe('1226MM01')
  })

  // Vercel runs in UTC but the academy runs on Philippine time, so a batch
  // opened just after midnight in Manila must carry the new month, not the
  // previous day's UTC one.
  it('dates the batch in Asia/Manila, not UTC', () => {
    expect(generateBatchName('MM01', new Date('2026-09-30T17:30:00Z'))).toBe('1026MM01')
  })

  it('returns null when the course has no alias', () => {
    expect(generateBatchName(null, new Date('2026-09-15T04:00:00Z'))).toBeNull()
  })

  it('returns null when the alias is only whitespace', () => {
    expect(generateBatchName('   ', new Date('2026-09-15T04:00:00Z'))).toBeNull()
  })
})

describe('batchLabel', () => {
  it('uses the generated name when the batch has one', () => {
    expect(batchLabel({ name: '0926MM01', number: 34 })).toBe('0926MM01')
  })

  it('falls back to the batch number for batches with no name', () => {
    expect(batchLabel({ name: null, number: 34 })).toBe('Batch 34')
  })
})
