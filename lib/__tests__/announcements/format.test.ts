import { describe, it, expect } from 'vitest'
import { audienceSummary, formatAnnouncementDate } from '@/lib/announcements/format'

describe('audienceSummary', () => {
  it('names everyone', () => {
    expect(audienceSummary('EVERYONE', ['Ignored'])).toBe('Everyone')
  })

  it('lists up to two course titles', () => {
    expect(audienceSummary('COURSES', ['Marhala 1'])).toBe('Marhala 1')
    expect(audienceSummary('COURSES', ['Marhala 1', 'Marhala 2'])).toBe('Marhala 1, Marhala 2')
  })

  it('shortens longer lists', () => {
    expect(audienceSummary('COURSES', ['A', 'B', 'C', 'D'])).toBe('A, B +2 more')
  })

  it('says when a course audience has no courses left', () => {
    expect(audienceSummary('COURSES', [])).toBe('No courses')
  })
})

describe('formatAnnouncementDate', () => {
  // 17:30 UTC on the 14th is already the 15th in Manila.
  it('formats on the Manila calendar', () => {
    expect(formatAnnouncementDate(new Date('2026-09-14T17:30:00Z'))).toBe('Sep 15, 2026')
  })
})
