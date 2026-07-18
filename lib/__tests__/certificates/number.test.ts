import { describe, it, expect } from 'vitest'
import { generateCertificateNo } from '@/lib/certificates/number'

describe('generateCertificateNo', () => {
  it('matches AQA-<year>-<6 hex> and uses the given year', () => {
    const no = generateCertificateNo(new Date('2026-07-18T00:00:00Z'))
    expect(no).toMatch(/^AQA-2026-[0-9A-F]{6}$/)
  })

  it('produces distinct numbers across calls', () => {
    const a = generateCertificateNo()
    const b = generateCertificateNo()
    expect(a).not.toBe(b)
  })
})
