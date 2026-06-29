import type { PaymentStatus, PaymentType } from "@prisma/client";

export function paymentStatusFromType(type: PaymentType): PaymentStatus {
  return type === "FULL" ? "FULLY_PAID" : "PARTIALLY_PAID";
}

export function paymentTypeFromStatus(status: PaymentStatus): PaymentType {
  return status === "FULLY_PAID" ? "FULL" : "PARTIAL";
}
