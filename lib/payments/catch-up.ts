import type { PaymentFrequency } from "@prisma/client";
import { allocate } from "@/lib/purchases/allocation";

// What a form offers when an admin starts tracking the balance of an
// enrollment that predates balance tracking. `alreadyPaid` is itself
// nullable: null means "do not render this field", which is the case when an
// APPROVED CHECKOUT payment already exists for the enrollment - that money is
// already in the ledger, so prefilling and re-submitting it would
// double-count it.
export type CatchUpPrefill = { totalDue: string; alreadyPaid: string | null };

// Pure, so the payment approve page and the student page prefill the same
// figures. Null when the enrollment already has a total, or when the course
// is billed monthly: a monthly enrollment has no single agreed total, so a
// lifetime ledger there would contradict the month matrix rather than
// complement it.
export function catchUpPrefill(enrollment: {
  totalDue: number | null;
  hasCheckoutPayment: boolean;
  course: {
    id: string;
    tuitionFee: number | null;
    paymentFrequency: PaymentFrequency | null;
  };
  purchase: {
    amountPaid: number;
    items: { courseId: string; tuitionFee: number | null }[];
  } | null;
}): CatchUpPrefill | null {
  const { course, purchase } = enrollment;
  if (enrollment.totalDue !== null || course.paymentFrequency === "MONTHLY")
    return null;
  return {
    // A yearly fee is not the whole of what the student owes, so it is not
    // offered as the total.
    totalDue:
      course.tuitionFee !== null && course.paymentFrequency !== "YEARLY"
        ? String(course.tuitionFee)
        : "",
    alreadyPaid: enrollment.hasCheckoutPayment
      ? null
      : purchase
        ? String(
            allocate(
              purchase.amountPaid,
              purchase.items.map((i) => i.tuitionFee),
            )[purchase.items.findIndex((i) => i.courseId === course.id)] ?? 0,
          )
        : "",
  };
}
