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
          purchase: { select: { paymentProofUrl: true } },
          course: { select: { title: true } },
          user: { select: { email: true, firstName: true } },
        },
      },
    },
  });
  if (!payment) return { error: "Payment not found." };

  // Only offered when the enrollment has no total yet. Every enrollment that
  // predates balance tracking is in that state, and this is how it converts
  // to the ledger model, one student at a time, with no bulk migration.
  const isUntracked = payment.enrollment.totalDue === null;
  const rawTotal = formData.get("totalDue");
  const rawAlreadyPaid = formData.get("alreadyPaid");
  const totalText = typeof rawTotal === "string" ? rawTotal.trim() : "";
  const alreadyPaidText =
    typeof rawAlreadyPaid === "string" ? rawAlreadyPaid.trim() : "";

  const catchUp =
    isUntracked && totalText !== ""
      ? {
          totalDue: Number(totalText),
          alreadyPaid: alreadyPaidText === "" ? 0 : Number(alreadyPaidText),
        }
      : null;

  if (
    catchUp &&
    (!Number.isFinite(catchUp.totalDue) ||
      catchUp.totalDue < 0 ||
      !Number.isFinite(catchUp.alreadyPaid) ||
      catchUp.alreadyPaid < 0)
  ) {
    return { error: "Amounts must be zero or a positive number." };
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
        },
      });
      if (updated.count === 0) throw new Error("ALREADY_PROCESSED");

      await tx.enrollment.update({
        where: { id: payment.enrollmentId },
        data: catchUp
          ? { paymentStatus, totalDue: catchUp.totalDue }
          : { paymentStatus },
      });

      if (catchUp) {
        // One row standing for everything received before this payment, so the
        // ledger is complete from here on. purchaseId and proofUrl come from
        // the originating purchase when there is one; source alone keeps the
        // row out of the review queue either way.
        await tx.payment.create({
          data: {
            enrollmentId: payment.enrollmentId,
            purchaseId: payment.enrollment.purchaseId,
            amount: catchUp.alreadyPaid,
            proofUrl: payment.enrollment.purchase?.paymentProofUrl ?? "",
            status: "APPROVED",
            source: "CHECKOUT",
            reviewedById: auth.userId,
            reviewedAt: new Date(),
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
