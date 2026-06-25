import type { PaymentStatus, PaymentType } from '@prisma/client'

export function paymentStatusFromType(type: PaymentType): PaymentStatus {
  return type === 'FULL' ? 'FULLY_PAID' : 'PARTIALLY_PAID'
}
