import type { PaymentFrequency, PaymentSource, Prisma } from "@prisma/client";
import { computeBalance, paymentStatusFromBalance } from "@/lib/payments/balance";
import { catchUpPrefill } from "@/lib/payments/catch-up";

// What changing a course's billing type does to the balances of the students
// already enrolled in it. A monthly enrollment has no total (each month is its
// own ledger) and every other enrollment has one lifetime total, so only a
// change across that line touches anyone's money.
export type BillingChange =
  | { kind: "none" }
  | { kind: "refuse"; reason: string }
  // Monthly to a one-time total: each untracked enrollment gets the fee.
  | { kind: "convert" };

export function billingChange(
  from: PaymentFrequency | null,
  to: PaymentFrequency | null,
  course: { activeEnrollments: number; tuitionFee: number | null },
): BillingChange {
  if (from === to || course.activeEnrollments === 0) return { kind: "none" };

  // Their existing payments were never filed against a month, so the matrix
  // would show every one of them as Unassigned.
  if (to === "MONTHLY")
    return {
      kind: "refuse",
      reason:
        "Students are enrolled, so this course cannot switch to monthly billing: their payments are not filed against months.",
    };

  if (from !== "MONTHLY") return { kind: "none" };

  // A yearly fee is not the whole of what a student owes, which is also why
  // the purchase approve form leaves a yearly total blank.
  if (to === "YEARLY")
    return {
      kind: "refuse",
      reason:
        "Students are enrolled, so this course cannot switch from monthly to yearly billing: there is no total to give their balances.",
    };

  if (course.tuitionFee === null)
    return {
      kind: "refuse",
      reason:
        "Set a tuition fee first. Enrolled students get it as their total when the course stops billing monthly.",
    };

  return { kind: "convert" };
}

export type ConversionEnrollment = {
  id: string;
  totalDue: number | null;
  // APPROVED rows only.
  payments: { amount: number; source: PaymentSource }[];
  purchase: {
    amountPaid: number;
    items: { courseId: string; tuitionFee: number | null }[];
  } | null;
};

export type ConversionStep = {
  enrollmentId: string;
  totalDue: number;
  // Checkout money that is not in the ledger yet, recorded as a CHECKOUT row.
  catchUp: number | null;
  paymentStatus: "FULLY_PAID" | "PARTIALLY_PAID";
};

// Pure, so the course save and a one-off repair script plan the same thing
// and the script can show the plan before writing it. Untracked enrollments
// only: one that already has a total keeps it.
export function planLumpSumConversion(
  enrollments: ConversionEnrollment[],
  course: { id: string; tuitionFee: number },
): ConversionStep[] {
  return enrollments
    .filter((e) => e.totalDue === null)
    .map((e) => {
      // The same figure the Payment dialog prefills. The purchase is split
      // by the new fee, since that is what this course costs from now on.
      const prefill = catchUpPrefill({
        totalDue: null,
        hasCheckoutPayment: e.payments.some((p) => p.source === "CHECKOUT"),
        course: { ...course, paymentFrequency: "ONE_TIME" },
        purchase: e.purchase && {
          amountPaid: e.purchase.amountPaid,
          items: e.purchase.items.map((i) =>
            i.courseId === course.id ? { ...i, tuitionFee: course.tuitionFee } : i,
          ),
        },
      });
      const owed = Number(prefill?.alreadyPaid || 0);
      const catchUp = owed > 0 ? owed : null;
      const amounts = e.payments.map((p) => p.amount);
      if (catchUp !== null) amounts.push(catchUp);
      return {
        enrollmentId: e.id,
        totalDue: course.tuitionFee,
        catchUp,
        // Never null: the balance is tracked once it has a total.
        paymentStatus: paymentStatusFromBalance(
          computeBalance(course.tuitionFee, amounts),
        )!,
      };
    });
}

// Reads the course's active enrollments inside the caller's transaction, so
// it sees the course row the caller just updated.
export async function loadConversionEnrollments(
  tx: Prisma.TransactionClient,
  courseId: string,
) {
  const rows = await tx.enrollment.findMany({
    where: { courseId, removedAt: null, totalDue: null },
    select: {
      id: true,
      totalDue: true,
      purchaseId: true,
      purchase: {
        select: {
          amountPaid: true,
          paymentProofUrl: true,
          items: {
            select: { course: { select: { id: true, tuitionFee: true } } },
          },
        },
      },
      payments: {
        where: { status: "APPROVED" },
        select: { amount: true, source: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    totalDue: r.totalDue?.toNumber() ?? null,
    purchaseId: r.purchaseId,
    proofUrl: r.purchase?.paymentProofUrl ?? "",
    payments: r.payments.map((p) => ({
      amount: p.amount.toNumber(),
      source: p.source,
    })),
    purchase: r.purchase && {
      amountPaid: r.purchase.amountPaid.toNumber(),
      items: r.purchase.items.map((i) => ({
        courseId: i.course.id,
        tuitionFee: i.course.tuitionFee?.toNumber() ?? null,
      })),
    },
  }));
}

export async function applyLumpSumConversion(
  tx: Prisma.TransactionClient,
  course: { id: string; tuitionFee: number },
  adminId: string,
): Promise<ConversionStep[]> {
  const enrollments = await loadConversionEnrollments(tx, course.id);
  const plan = planLumpSumConversion(enrollments, course);
  const byId = new Map(enrollments.map((e) => [e.id, e]));
  for (const step of plan) {
    const e = byId.get(step.enrollmentId)!;
    if (step.catchUp !== null)
      await tx.payment.create({
        data: {
          enrollmentId: e.id,
          purchaseId: e.purchaseId,
          amount: step.catchUp,
          proofUrl: e.proofUrl,
          status: "APPROVED",
          source: "CHECKOUT",
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });
    await tx.enrollment.update({
      where: { id: e.id },
      data: { totalDue: step.totalDue, paymentStatus: step.paymentStatus },
    });
  }
  return plan;
}
