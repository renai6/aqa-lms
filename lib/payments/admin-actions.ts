"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { computeBalance, paymentStatusFromBalance } from "@/lib/payments/balance";
import { payableMonths } from "@/lib/payments/monthly";
import { monthKeyToDate } from "@/lib/time/manila";

type ActionState = { error: string | null };

// The admin's hand edits to an enrollment's money, made from the student page.
// "Paid" is never typed over: it stays the sum of APPROVED Payment rows, so
// money is only ever added as a ledger row and every surface that reads the
// ledger (balances, the monthly matrix, the student dashboard) stays in step.

const REMOVED = "This student is removed from the course.";

// Thrown inside a transaction to roll it back with a message for the admin.
class RefusedError extends Error {}

const ENROLLMENT_SELECT = {
  userId: true,
  courseId: true,
  enrolledAt: true,
  completedAt: true,
  removedAt: true,
  purchaseId: true,
  purchase: { select: { paymentProofUrl: true } },
  course: { select: { paymentFrequency: true } },
} satisfies Prisma.EnrollmentSelect;

async function loadEnrollment(formData: FormData): Promise<
  | { error: string }
  | {
      id: string;
      adminId: string;
      enrollment: Prisma.EnrollmentGetPayload<{ select: typeof ENROLLMENT_SELECT }>;
    }
> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")
    return { error: "Forbidden" };

  const id = formData.get("enrollmentId");
  if (typeof id !== "string" || !id)
    return { error: "Invalid enrollment ID." };

  const enrollment = await db.enrollment.findUnique({
    where: { id },
    select: ENROLLMENT_SELECT,
  });
  if (!enrollment) return { error: "Enrollment not found." };
  if (enrollment.removedAt) return { error: REMOVED };

  return { id, adminId: session.userId, enrollment };
}

// Locks the enrollment and re-reads what every write decides from, so two
// admins editing at once, or a course move mid-edit, cannot both act on a
// stale ledger.
async function lockEnrollment(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id = ${id} FOR UPDATE`;
  const current = await tx.enrollment.findUnique({
    where: { id },
    select: {
      removedAt: true,
      totalDue: true,
      payments: {
        where: { status: "APPROVED" },
        select: { amount: true, source: true },
      },
    },
  });
  if (!current || current.removedAt) throw new RefusedError(REMOVED);
  return {
    totalDue: current.totalDue?.toNumber() ?? null,
    approvedAmounts: current.payments.map((p) => p.amount.toNumber()),
    hasCheckoutPayment: current.payments.some((p) => p.source === "CHECKOUT"),
  };
}

function text(formData: FormData, name: string): string {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function revalidateSurfaces(id: string, userId: string, courseId: string) {
  revalidatePath("/admin/students");
  revalidatePath("/admin/students/" + userId);
  revalidatePath("/admin/courses/" + courseId);
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/monthly");
  revalidatePath("/student/dashboard");
  revalidatePath("/student/payments/" + id);
}

async function run(
  label: string,
  write: () => Promise<unknown>,
): Promise<ActionState> {
  try {
    await write();
  } catch (err) {
    if (err instanceof RefusedError) return { error: err.message };
    console.error(`[${label}]`, err);
    return { error: "A database error occurred. Please try again." };
  }
  return { error: null };
}

export async function logAdminPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const target = await loadEnrollment(formData);
  if ("error" in target) return { error: target.error };
  const { id, adminId, enrollment } = target;

  const amountText = text(formData, "amount");
  const amount = amountText === "" ? NaN : Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Amount must be greater than 0." };

  // Validated against the course's own billing, not a hidden form field.
  const isMonthly = enrollment.course.paymentFrequency === "MONTHLY";
  const month = text(formData, "periodMonth");
  if (isMonthly && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return { error: "Select which month this payment covers." };
  if (!isMonthly && month !== "")
    return { error: "This course is not billed monthly." };
  // A month outside the payable range would land in no matrix column at all.
  // Same bounds check as the student's form and the approve page.
  if (isMonthly && !payableMonths(enrollment, new Date()).includes(month))
    return { error: "That month is outside this enrollment's range." };

  const note = text(formData, "note");
  if (note.length > 200) return { error: "Keep the note under 200 characters." };

  const result = await run("logAdminPayment", () =>
    db.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await lockEnrollment(tx, id);

      await tx.payment.create({
        data: {
          enrollmentId: id,
          amount,
          // An admin-logged payment has no uploaded proof. The note says
          // where the money came from instead.
          proofUrl: "",
          status: "APPROVED",
          source: "ADMIN",
          reviewedById: adminId,
          reviewedAt: new Date(),
          adminRemarks: note === "" ? null : note,
          periodMonth: isMonthly ? monthKeyToDate(month) : null,
        },
      });

      // A monthly course has no single total to derive a status from, even on
      // a legacy row that still carries one, so its status stays manual.
      if (isMonthly) return;
      const paymentStatus = paymentStatusFromBalance(
        computeBalance(current.totalDue, [...current.approvedAmounts, amount]),
      );
      if (paymentStatus)
        await tx.enrollment.update({ where: { id }, data: { paymentStatus } });
    }),
  );
  if (!result.error) revalidateSurfaces(id, enrollment.userId, enrollment.courseId);
  return result;
}

export async function setTotalDueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const target = await loadEnrollment(formData);
  if ("error" in target) return { error: target.error };
  const { id, adminId, enrollment } = target;

  // A lifetime total on a monthly course would be a second ledger that never
  // grows with monthly accrual, and could disagree with the matrix.
  if (enrollment.course.paymentFrequency === "MONTHLY")
    return { error: "A monthly course is tracked month by month, not by a total." };

  // No blank: clearing a total back to untracked is not offered here.
  const totalText = text(formData, "totalDue");
  const totalDue = totalText === "" ? NaN : Number(totalText);
  if (!Number.isFinite(totalDue) || totalDue < 0)
    return { error: "Total due must be zero or a positive number." };

  const alreadyPaidText = text(formData, "alreadyPaid");
  const alreadyPaid = alreadyPaidText === "" ? 0 : Number(alreadyPaidText);
  if (!Number.isFinite(alreadyPaid) || alreadyPaid < 0)
    return { error: "Already paid must be zero or a positive number." };

  const result = await run("setTotalDue", () =>
    db.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await lockEnrollment(tx, id);

      // The catch-up row stands for the checkout money of an enrollment that
      // predates balance tracking. Only written when that money is not in the
      // ledger yet: a tracked enrollment, or an untracked one that already has
      // a CHECKOUT row, would otherwise count it twice. The form only offers
      // the field in that case; this is the gate.
      const catchUp =
        current.totalDue === null && !current.hasCheckoutPayment && alreadyPaid > 0
          ? alreadyPaid
          : null;
      if (catchUp !== null)
        await tx.payment.create({
          data: {
            enrollmentId: id,
            purchaseId: enrollment.purchaseId,
            amount: catchUp,
            proofUrl: enrollment.purchase?.paymentProofUrl ?? "",
            status: "APPROVED",
            source: "CHECKOUT",
            reviewedById: adminId,
            reviewedAt: new Date(),
          },
        });

      const amounts =
        catchUp === null
          ? current.approvedAmounts
          : [...current.approvedAmounts, catchUp];
      await tx.enrollment.update({
        where: { id },
        data: {
          totalDue,
          // Never null here: the balance is tracked from this write on.
          paymentStatus: paymentStatusFromBalance(computeBalance(totalDue, amounts))!,
        },
      });
    }),
  );
  if (!result.error) revalidateSurfaces(id, enrollment.userId, enrollment.courseId);
  return result;
}
