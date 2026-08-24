// The single rule for whether a student may submit an additional payment.
// The page uses it to decide whether to render, the action uses it to decide
// whether to accept - a page check alone is advisory, since a stale tab can
// post to the action directly.

import type { Balance } from "@/lib/payments/balance";

export type GuardEnrollment = {
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  course: { archivedAt: Date | null };
  balance: Balance;
};

export type GuardPayment = { status: "PENDING" | "APPROVED" | "REJECTED" };

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function canAddPayment(
  enrollment: GuardEnrollment | null,
  payments: GuardPayment[],
): GuardResult {
  if (!enrollment) return { ok: false, reason: "Enrollment not found." };
  // A tracked balance is the ledger, and it outranks `paymentStatus` - a label
  // an admin sets by hand, which can read FULLY_PAID while the ledger still
  // shows money owed. Keying off the label alone left those students unable to
  // pay the rest and with nothing on screen explaining why.
  if (isSettled(enrollment)) {
    return { ok: false, reason: "This enrollment is already fully paid." };
  }
  if (enrollment.course.archivedAt !== null) {
    return { ok: false, reason: "This course is no longer available." };
  }
  if (payments.some((p) => p.status === "PENDING")) {
    return { ok: false, reason: "You already have a payment awaiting review." };
  }
  return { ok: true };
}

// Exported so the dashboard decides which enrollments to offer an "Add
// payment" button for using the same rule the guard enforces. The two
// disagreeing is how an enrollment ends up unpayable with no explanation.
export function isSettled(enrollment: {
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  balance: Balance;
}): boolean {
  if (enrollment.balance.kind === "tracked") {
    return enrollment.balance.remaining <= 0;
  }
  return enrollment.paymentStatus === "FULLY_PAID";
}
