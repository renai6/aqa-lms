"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  paymentStatusFromType,
  paymentTypeFromStatus,
} from "@/lib/purchases/payment";
import {
  sendPurchaseApprovalEmail,
  sendPurchaseRejectionEmail,
} from "@/lib/purchases/email";
import { peso } from "@/lib/payments/balance";

type ActionState = { error: string | null; success?: boolean };

// Thrown inside the approval transaction when a purchase item's course was
// archived while the purchase sat pending, so the whole approval rolls back
// instead of enrolling the student into a course they can never see.
class ArchivedCourseError extends Error {
  constructor(public courseTitle: string) {
    super("ARCHIVED_COURSE");
  }
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Unauthorized" };
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return { ok: false as const, error: "Forbidden" };
  }
  return { ok: true as const, userId: session.userId };
}

export async function approvePurchaseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid purchase ID." };

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const purchase = await db.purchase.findUnique({
    where: { id },
    select: {
      paymentType: true,
      amountPaid: true,
      paymentProofUrl: true,
      user: { select: { id: true, email: true, firstName: true } },
      items: {
        select: {
          courseId: true,
          course: { select: { title: true, archivedAt: true } },
        },
      },
    },
  });
  if (!purchase) return { error: "Purchase not found." };

  // The approve form submits one pair of fields per course. Blank totalDue is
  // meaningful: it means "do not track this enrollment's balance", which is
  // how every enrollment behaved before balances existed.
  const entries = purchase.items.map((item) => {
    const rawTotal = formData.get(`totalDue_${item.courseId}`);
    const rawApplied = formData.get(`applied_${item.courseId}`);
    const total = typeof rawTotal === "string" ? rawTotal.trim() : "";
    const applied = typeof rawApplied === "string" ? rawApplied.trim() : "";
    return {
      courseId: item.courseId,
      totalDue: total === "" ? null : Number(total),
      applied: applied === "" ? 0 : Number(applied),
    };
  });

  if (
    entries.some(
      (e) =>
        !Number.isFinite(e.applied) ||
        e.applied < 0 ||
        (e.totalDue !== null &&
          (!Number.isFinite(e.totalDue) || e.totalDue < 0)),
    )
  ) {
    return { error: "Amounts must be zero or a positive number." };
  }

  const amountPaid = purchase.amountPaid.toNumber();
  // Compare in integer centavos, not raw floats: rounding only one side (or
  // neither) leaves amounts that are equal to the peso but never satisfy
  // `!==`, permanently blocking approval.
  const amountPaidCentavos = Math.round(amountPaid * 100);
  // Each field is rounded on its own, not the float sum: the form does the
  // same, and the two have to agree exactly or the client disables Approve on
  // a split the server would have accepted.
  const appliedTotalCentavos = entries.reduce(
    (sum, e) => sum + Math.round(e.applied * 100),
    0,
  );
  if (appliedTotalCentavos !== amountPaidCentavos) {
    const appliedTotal = appliedTotalCentavos / 100;
    return {
      error: `Applied amounts total ${peso(appliedTotal)}, but the student paid ${peso(amountPaid)}. Adjust them so they match.`,
    };
  }

  const paymentStatus = paymentStatusFromType(purchase.paymentType);

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.purchase.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          reviewedById: auth.userId,
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) throw new Error("ALREADY_PROCESSED");

      for (const item of purchase.items) {
        if (item.course.archivedAt)
          throw new ArchivedCourseError(item.course.title);

        const exists = await tx.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId: purchase.user.id,
              courseId: item.courseId,
            },
          },
          select: { id: true, removedAt: true },
        });
        const entry = entries.find((e) => e.courseId === item.courseId)!;

        let enrollmentId: string;
        if (exists && !exists.removedAt) {
          // An active enrollment already covers this course, so nothing about
          // the enrollment itself changes - its total, batch and status were
          // settled when it was created and this purchase does not restate
          // them. Only the ledger row below is still owed.
          enrollmentId = exists.id;
        } else {
          const activeBatch = await tx.batch.findFirst({
            where: { courseId: item.courseId, isActive: true },
            select: { id: true },
          });
          // A removed enrollment still owns the unique (userId, courseId)
          // slot, so it is revived in place rather than duplicated. Its
          // earlier payments stay attached and keep counting toward the
          // balance, which is why the form shows the admin what those come to
          // before they choose a total.
          const enrollment = exists
            ? await tx.enrollment.update({
                where: { id: exists.id },
                data: {
                  removedAt: null,
                  removedReason: null,
                  paymentStatus,
                  purchaseId: id,
                  batchId: activeBatch?.id ?? null,
                  totalDue: entry.totalDue,
                },
              })
            : await tx.enrollment.create({
                data: {
                  userId: purchase.user.id,
                  courseId: item.courseId,
                  paymentStatus,
                  purchaseId: id,
                  batchId: activeBatch?.id ?? null,
                  totalDue: entry.totalDue,
                },
              });
          enrollmentId = enrollment.id;
        }

        // The checkout payment enters the ledger here, so every peso received
        // for this enrollment lives in one table. The proof URL is reused
        // rather than copied, so no second file is stored.
        //
        // This runs for an already-active enrollment too. The reconcile check
        // above forces the admin to allocate every peso of `amountPaid` across
        // the items, so skipping the row would delete money the admin had no
        // way to withhold, and understate that enrollment's balance forever.
        // Zero is the one amount worth skipping: it is not money, and a
        // zero-amount row is noise in the ledger.
        if (Math.round(entry.applied * 100) > 0) {
          // Applied money means money arrived at checkout, which means a proof
          // was uploaded: a pay-later purchase has amountPaid 0, and the
          // reconcile check above forces every applied amount to 0. An empty
          // string here would enter the ledger as a payment with no evidence,
          // so an impossible state fails loudly instead.
          if (purchase.paymentProofUrl === null)
            throw new Error("MISSING_PROOF");
          await tx.payment.create({
            data: {
              enrollmentId,
              purchaseId: id,
              amount: entry.applied,
              proofUrl: purchase.paymentProofUrl,
              status: "APPROVED",
              source: "CHECKOUT",
              reviewedById: auth.userId,
              reviewedAt: new Date(),
            },
          });
        }
      }
    });
  } catch (err) {
    if (err instanceof ArchivedCourseError) {
      return {
        error: `Cannot approve: "${err.courseTitle}" has been archived. Reject this purchase or contact the student instead.`,
      };
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg === "ALREADY_PROCESSED")
      return { error: "This purchase has already been processed." };
    if (msg === "MISSING_PROOF")
      return {
        error:
          "This purchase records money received but has no proof of payment. Contact the student before approving.",
      };
    console.error("[approvePurchase] Transaction error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/purchases");

  try {
    await sendPurchaseApprovalEmail({
      to: purchase.user.email,
      firstName: purchase.user.firstName,
      courseNames: purchase.items.map((i) => i.course.title),
    });
  } catch (err) {
    console.error("[approvePurchase] Email error:", err);
    return {
      error:
        "Purchase approved but email delivery failed. Contact the student directly.",
      success: true,
    };
  }

  redirect("/admin/purchases");
}

export async function rejectPurchaseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid purchase ID." };

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

  const purchase = await db.purchase.findUnique({
    where: { id },
    select: { user: { select: { email: true, firstName: true } } },
  });
  if (!purchase) return { error: "Purchase not found." };

  let result: { count: number };
  try {
    result = await db.purchase.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "REJECTED",
        adminRemarks: reason,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[rejectPurchase] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }
  if (result.count === 0)
    return { error: "This purchase has already been processed." };

  revalidatePath("/admin/purchases");

  try {
    await sendPurchaseRejectionEmail({
      to: purchase.user.email,
      firstName: purchase.user.firstName,
      reason,
    });
  } catch (err) {
    console.error("[rejectPurchase] Email error:", err);
    return {
      error: "Purchase rejected but notification email failed.",
      success: true,
    };
  }

  redirect("/admin/purchases");
}

export async function updatePaymentStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid purchase ID." };

  const statusResult = z
    .enum(["PARTIALLY_PAID", "FULLY_PAID"])
    .safeParse(formData.get("paymentStatus"));
  if (!statusResult.success)
    return { error: "Please select a valid payment status." };
  const paymentStatus = statusResult.data;

  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const purchase = await db.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      items: { select: { courseId: true } },
      status: true,
    },
  });
  if (!purchase) return { error: "Purchase not found." };

  const paymentType = paymentTypeFromStatus(paymentStatus);

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.purchase.update({
        where: { id },
        data: { paymentType },
      });

      if (purchase.status === "APPROVED") {
        const enrollmentUpdates = purchase.items.map((item) =>
          tx.enrollment.updateMany({
            where: { userId: purchase.userId, courseId: item.courseId },
            data: { paymentStatus },
          }),
        );
        await Promise.all(enrollmentUpdates);
      }
    });
  } catch (err) {
    console.error("[updatePaymentStatus] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  revalidatePath("/admin/purchases");
  revalidatePath(`/admin/purchases/${id}`);

  return { error: null, success: true };
}
