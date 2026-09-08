// The single rule for whether a student may submit an additional payment.
// The page uses it to decide whether to render, the action uses it to decide
// whether to accept - a page check alone is advisory, since a stale tab can
// post to the action directly.

import type { PaymentFrequency } from "@prisma/client";
import type { Balance } from "@/lib/payments/balance";
import type { MonthKey } from "@/lib/time/manila";

export type GuardEnrollment = {
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  course: {
    archivedAt: Date | null;
    paymentFrequency: PaymentFrequency | null;
  };
  balance: Balance;
};

export type GuardPayment = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  periodMonth: MonthKey | null;
};

export type GuardResult = { ok: true } | { ok: false; reason: string };

// `periodMonth` is the month the student is submitting for, null on a course
// that is not billed monthly.
export function canAddPayment(
  enrollment: GuardEnrollment | null,
  payments: GuardPayment[],
  periodMonth: MonthKey | null = null,
): GuardResult {
  if (!enrollment) return { ok: false, reason: "Enrollment not found." };
  // A tracked balance is the ledger, and it outranks `paymentStatus` - a label
  // an admin sets by hand, which can read FULLY_PAID while the ledger still
  // shows money owed. Keying off the label alone left those students unable to
  // pay the rest and with nothing on screen explaining why.
  if (
    isSettled({
      paymentStatus: enrollment.paymentStatus,
      balance: enrollment.balance,
      paymentFrequency: enrollment.course.paymentFrequency,
    })
  ) {
    return { ok: false, reason: "This enrollment is already fully paid." };
  }
  if (enrollment.course.archivedAt !== null) {
    return { ok: false, reason: "This course is no longer available." };
  }

  // The one-pending-payment rule exists to stop two tabs, a double-click or a
  // retried submit from creating two rows for the same money. On a monthly
  // course that money is per month, so the rule is per month too: September
  // and October are different payments with different proofs, and a student
  // catching up should not have to wait for an admin between them.
  if (enrollment.course.paymentFrequency === "MONTHLY") {
    const clash = payments.some(
      (p) => p.status === "PENDING" && p.periodMonth === periodMonth,
    );
    if (clash) {
      return {
        ok: false,
        reason: "You already have a payment for this month awaiting review.",
      };
    }
    return { ok: true };
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
  paymentFrequency: PaymentFrequency | null;
}): boolean {
  // A monthly enrollment is never settled: it accrues another month shortly.
  // It is also untracked by design, so without this it fell through to the
  // FULLY_PAID label below - which an admin is forced to choose between on
  // every approval, and choosing it locked the student out permanently.
  if (enrollment.paymentFrequency === "MONTHLY") return false;
  if (enrollment.balance.kind === "tracked") {
    return enrollment.balance.remaining <= 0;
  }
  return enrollment.paymentStatus === "FULLY_PAID";
}
