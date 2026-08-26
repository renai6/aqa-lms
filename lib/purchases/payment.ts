import type { PaymentStatus, PaymentType } from "@prisma/client";

export function paymentStatusFromType(type: PaymentType): PaymentStatus {
  return type === "FULL" ? "FULLY_PAID" : "PARTIALLY_PAID";
}

export function paymentTypeFromStatus(status: PaymentStatus): PaymentType {
  return status === "FULLY_PAID" ? "FULL" : "PARTIAL";
}

// A purchase with no proof image is one the student asked to pay for later.
// Derived rather than stored: validation forbids a zero amount on a pay-now
// purchase, so a stored flag could only ever repeat what this column already
// says, and could drift from it.
export function isPayLater(p: { paymentProofUrl: string | null }): boolean {
  return p.paymentProofUrl === null;
}
