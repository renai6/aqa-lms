import { describe, it, expect } from 'vitest'
import { paymentStatusFromType } from '@/lib/purchases/payment'

describe('paymentStatusFromType', () => {
  it('maps FULL to FULLY_PAID', () => {
    expect(paymentStatusFromType('FULL')).toBe('FULLY_PAID')
  })
  it('maps PARTIAL to PARTIALLY_PAID', () => {
    expect(paymentStatusFromType('PARTIAL')).toBe('PARTIALLY_PAID')
  })
})
