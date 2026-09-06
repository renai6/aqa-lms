import { describe, it, expect } from 'vitest'
import { formatRecordingDate, recordingLabel } from '@/lib/batches/recording-date'

describe('formatRecordingDate', () => {
  // The column is @db.Date, so Prisma hands back UTC midnight. Formatting in
  // local time would render Sep 6 as Sep 5 for anyone behind UTC.
  it('renders the stored calendar day, not the local one', () => {
    expect(formatRecordingDate(new Date('2026-09-06T00:00:00.000Z'))).toBe('Sun, Sep 6, 2026')
  })

  it('renders a January 1 without slipping into the previous year', () => {
    expect(formatRecordingDate(new Date('2026-01-01T00:00:00.000Z'))).toBe('Thu, Jan 1, 2026')
  })
})

describe('recordingLabel', () => {
  const date = new Date('2026-09-06T00:00:00.000Z')

  it('prefers the title when one is set', () => {
    expect(recordingLabel({ title: 'Makeup session', date })).toBe('Makeup session')
  })

  it('falls back to the formatted date when the title is null', () => {
    expect(recordingLabel({ title: null, date })).toBe('Sun, Sep 6, 2026')
  })

  it('falls back to the formatted date when the title is blank', () => {
    expect(recordingLabel({ title: '   ', date })).toBe('Sun, Sep 6, 2026')
  })
})
