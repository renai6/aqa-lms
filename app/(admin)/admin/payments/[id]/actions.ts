"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  sendPaymentApprovalEmail,
  sendPaymentRejectionEmail,
} from "@/lib/payments/email";
import { monthKeyToDate, toMonthKey } from "@/lib/time/manila";
import { payableMonths } from "@/lib/payments/monthly";

type ActionState = { error: string | null; success?: boolean };

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return { ok: false as const, error: "Forbidden" };
  }
  return { ok: true as const, userId: session.userId };
}

export async function approvePaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid payment ID." };

  const statusResult = z
    .enum(["PARTIALLY_PAID", "FULLY_PAID"])
    .safeParse(formData.get("paymentStatus"));
  if (!statusResult.success)
    return { error: "Please select the resulting payment status." };
  const paymentStatus = statusResult.data;

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const payment = await db.payment.findUnique({
    where: { id },
    select: {
      enrollmentId: true,
      enrollment: {
        select: {
          totalDue: true,
          purchaseId: true,
          enrolledAt: true,
          completedAt: true,
          removedAt: true,
          purchase: { select: { paymentProofUrl: true } },
          course: { select: { title: true, paymentFrequency: true } },
          user: { select: { email: true, firstName: true } },
          // Only whether an APPROVED CHECKOUT row already exists matters
          // here, so one row is enough to know.
          payments: {
            where: { status: "APPROVED", source: "CHECKOUT" },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!payment) return { error: "Payment not found." };

  // The form is advisory; this is the gate. Validated against the course's
  // own paymentFrequency, not a hidden form field.
  const isMonthly = payment.enrollment.course.paymentFrequency === "MONTHLY";

  // Setting totalDue and writing a catch-up row are independent decisions.
  // Setting totalDue is only offered when the enrollment has no total yet AND
  // the course is not monthly - a monthly enrollment has no single agreed
  // total by design (it accrues another month on a schedule), so a lifetime
  // total there would create a second ledger that never grows with accrual
  // while the matrix keeps reading the real per-month state. catchUpPrefill
  // hides the field for exactly this reason, but the form is only advisory:
  // this check is the actual gate against a crafted POST that supplies
  // totalDue anyway.
  // Writing a catch-up CHECKOUT row is only correct when the enrollment's
  // checkout money is not already in the ledger - which is NOT the same
  // question as whether totalDue is null (a MONTHLY/YEARLY course, or one an
  // admin cleared, can be untracked while its checkout row already exists).
  const isUntracked = payment.enrollment.totalDue === null;
  const hasCheckoutPayment = payment.enrollment.payments.length > 0;
  const rawTotal = formData.get("totalDue");
  const rawAlreadyPaid = formData.get("alreadyPaid");
  const totalText = typeof rawTotal === "string" ? rawTotal.trim() : "";
  const alreadyPaidText =
    typeof rawAlreadyPaid === "string" ? rawAlreadyPaid.trim() : "";

  const newTotalDue =
    isUntracked && !isMonthly && totalText !== "" ? Number(totalText) : null;
  const catchUpAmount =
    !hasCheckoutPayment && alreadyPaidText !== ""
      ? Number(alreadyPaidText)
      : null;

  if (
    (newTotalDue !== null &&
      (!Number.isFinite(newTotalDue) || newTotalDue < 0)) ||
    (catchUpAmount !== null &&
      (!Number.isFinite(catchUpAmount) || catchUpAmount < 0))
  ) {
    return { error: "Amounts must be zero or a positive number." };
  }

  // A blank (or zero) already-paid figure must not write a junk zero-amount
  // ledger row. Setting totalDue still works on its own either way.
  const writeCatchUp = catchUpAmount !== null && catchUpAmount > 0;

  const rawMonth = formData.get("periodMonth");
  const monthText = typeof rawMonth === "string" ? rawMonth.trim() : "";
  if (isMonthly && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthText)) {
    return { error: "Select which month this payment covers." };
  }
  if (!isMonthly && monthText !== "") {
    return { error: "This course is not billed monthly." };
  }
  if (isMonthly) {
    // Format-valid is not enough: a month outside the enrollment's payable
    // range would land in neither a matrix column nor Unassigned, since
    // buildMonthlyMatrix only creates cells for owed months and only routes
    // null periodMonth into Unassigned. Mirrors the guard in
    // lib/payments/actions.ts on the student side. payableMonths deliberately
    // does not filter out settled months, so correcting onto one still passes.
    const offered = payableMonths(
      {
        enrolledAt: payment.enrollment.enrolledAt,
        completedAt: payment.enrollment.completedAt,
        removedAt: payment.enrollment.removedAt,
      },
      new Date(),
    );
    if (!offered.includes(monthText)) {
      return { error: "That month is outside this enrollment's range." };
    }
  }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // updateMany + a PENDING filter is the concurrency guard: if another
      // admin got here first, count is 0 and nothing else in the tx runs.
      const updated = await tx.payment.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedById: auth.userId,
          reviewedAt: new Date(),
          ...(isMonthly ? { periodMonth: monthKeyToDate(monthText) } : {}),
        },
      });
      if (updated.count === 0) throw new Error("ALREADY_PROCESSED");

      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data:
          newTotalDue !== null
            ? { paymentStatus, totalDue: newTotalDue }
            : { paymentStatus },
      });

      if (writeCatchUp) {
        // One row standing for everything received before this payment, so the
        // ledger is complete from here on. purchaseId and proofUrl come from
        // the originating purchase when there is one; source alone keeps the
        // row out of the review queue either way.
        await tx.payment.create({
          data: {
            enrollmentId: payment.enrollmentId,
            purchaseId: payment.enrollment.purchaseId,
            amount: catchUpAmount,
            proofUrl: payment.enrollment.purchase?.paymentProofUrl ?? "",
            status: "APPROVED",
            source: "CHECKOUT",
            reviewedById: auth.userId,
            reviewedAt: new Date(),
            // Attributed to the Manila month of this approval rather than
            // left null, for the reason approvePurchaseAction documents:
            // unattributed money reads as arrears in the matrix.
            periodMonth: isMonthly
              ? monthKeyToDate(toMonthKey(new Date()))
              : null,
          },
        });
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ALREADY_PROCESSED")
      return { error: "This payment has already been processed." };
    console.error("[approvePayment] Transaction error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/payments");

  try {
    await sendPaymentApprovalEmail({
      to: payment.enrollment.user.email,
      firstName: payment.enrollment.user.firstName,
      courseTitle: payment.enrollment.course.title,
      paymentStatus,
    });
  } catch (err) {
    console.error("[approvePayment] Email error:", err);
    return {
      error:
        "Payment approved but email delivery failed. Contact the student directly.",
      success: true,
    };
  }

  redirect("/admin/payments");
}

// Attributing an already-approved payment to a month. Approval is a one-way
// door - `approvePaymentAction` only touches PENDING rows - so without this
// the month a payment covers could never be set or corrected after the fact,
// and every historical row plus every checkout row written before this feature
// would be stranded in the matrix's Unassigned column for good.
//
// It touches `periodMonth` and nothing else. The amount, the status and the
// enrollment's ledger are settled facts of the approval and are not reopened.
export async function assignPaymentMonthAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid payment ID." };

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const payment = await db.payment.findUnique({
    where: { id },
    select: {
      status: true,
      enrollment: {
        select: {
          enrolledAt: true,
          completedAt: true,
          removedAt: true,
          course: { select: { paymentFrequency: true } },
        },
      },
    },
  });
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "APPROVED") {
    // A pending payment gets its month from the approve form, which sets it
    // and the status together; a rejected one is not money received.
    return { error: "Only an approved payment can be assigned a month." };
  }
  if (payment.enrollment.course.paymentFrequency !== "MONTHLY") {
    return { error: "This course is not billed monthly." };
  }

  const rawMonth = formData.get("periodMonth");
  const monthText = typeof rawMonth === "string" ? rawMonth.trim() : "";
  // Clearing back to unassigned is how an admin undoes a wrong attribution
  // without having to guess a different month to park it in.
  const clearing = monthText === "";
  if (!clearing && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthText)) {
    return { error: "Select which month this payment covers." };
  }
  if (!clearing) {
    // Same bounds check as the approve path: a format-valid month outside the
    // enrollment's payable range would land in neither a matrix column nor
    // Unassigned. `payableMonths` deliberately does not filter out settled
    // months, so correcting onto one still passes.
    const offered = payableMonths(
      {
        enrolledAt: payment.enrollment.enrolledAt,
        completedAt: payment.enrollment.completedAt,
        removedAt: payment.enrollment.removedAt,
      },
      new Date(),
    );
    if (!offered.includes(monthText)) {
      return { error: "That month is outside this enrollment's range." };
    }
  }

  try {
    await db.payment.update({
      where: { id },
      data: { periodMonth: clearing ? null : monthKeyToDate(monthText) },
    });
  } catch (err) {
    console.error("[assignPaymentMonth] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${id}`);
  return { error: null, success: true };
}

export async function rejectPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid payment ID." };

  const reasonResult = z
    .string()
    .min(1, "A reason is required.")
    .safeParse(formData.get("reason"));
  if (!reasonResult.success)
    return {
      error: reasonResult.error.issues[0]?.message ?? "A reason is required.",
    };
  const reason = reasonResult.data;

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const payment = await db.payment.findUnique({
    where: { id },
    select: {
      enrollment: {
        select: {
          course: { select: { title: true } },
          user: { select: { email: true, firstName: true } },
        },
      },
    },
  });
  if (!payment) return { error: "Payment not found." };

  let result: { count: number };
  try {
    result = await db.payment.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "REJECTED",
        adminRemarks: reason,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[rejectPayment] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }
  if (result.count === 0)
    return { error: "This payment has already been processed." };

  revalidatePath("/admin/payments");

  try {
    await sendPaymentRejectionEmail({
      to: payment.enrollment.user.email,
      firstName: payment.enrollment.user.firstName,
      courseTitle: payment.enrollment.course.title,
      reason,
    });
  } catch (err) {
    console.error("[rejectPayment] Email error:", err);
    return {
      error: "Payment rejected but notification email failed.",
      success: true,
    };
  }

  redirect("/admin/payments");
}
