// The single rule for whether a student may submit an additional payment.
// The page uses it to decide whether to render, the action uses it to decide
// whether to accept - a page check alone is advisory, since a stale tab can
// post to the action directly.
export type GuardEnrollment = {
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
  course: { archivedAt: Date | null };
};

export type GuardPayment = { status: "PENDING" | "APPROVED" | "REJECTED" };

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function canAddPayment(
  enrollment: GuardEnrollment | null,
  payments: GuardPayment[],
): GuardResult {
  if (!enrollment) return { ok: false, reason: "Enrollment not found." };
  if (enrollment.paymentStatus === "FULLY_PAID") {
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
