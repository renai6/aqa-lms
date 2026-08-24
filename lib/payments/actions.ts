"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/uploads/image";
import { createPaymentSchema } from "@/lib/payments/schema";
import { canAddPayment } from "@/lib/payments/guards";
import { getEnrollmentForPayment } from "@/lib/payments/queries";
import { sendPaymentConfirmationEmail } from "@/lib/payments/email";

type ActionState = { error: string | null };

export async function createPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return { error: "Unauthorized" };

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, firstName: true, isActive: true },
  });
  if (!user) return { error: "Account not found." };
  if (!user.isActive) return { error: "Your account is inactive." };

  const result = createPaymentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    amount: formData.get("amount"),
  });
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Validation failed." };
  const { enrollmentId, amount } = result.data;

  // The page ran this same check, but that check is advisory: a stale tab can
  // post here long after the enrollment stopped qualifying.
  const enrollment = await getEnrollmentForPayment(
    session.userId,
    enrollmentId,
  );
  const allowed = canAddPayment(enrollment, enrollment?.payments ?? []);
  if (!allowed.ok) return { error: allowed.reason };
  // Unreachable - the guard already returned for a null enrollment. Present so
  // the compiler narrows `enrollment` for the rest of the action.
  if (!enrollment) return { error: "Enrollment not found." };

  const image = await validateImageUpload(formData.get("file"));
  if (!image.ok) return { error: image.error };

  let paymentId: string;
  try {
    const payment = await db.payment.create({
      data: {
        enrollmentId,
        amount,
        proofUrl: "", // set after upload
      },
      select: { id: true },
    });
    paymentId = payment.id;
  } catch (err) {
    console.error("[createPayment] DB error:", err);
    return { error: "A database error occurred. Please try again." };
  }

  const storagePath = `payment/${paymentId}/proof.${image.ext}`;
  // Some upload failures (e.g. a network error) come back as a thrown
  // exception rather than the `{ error }` result shape, so both are caught
  // into the same variable and handled by the one block below.
  let uploadError: unknown = null;
  try {
    const { error } = await supabaseAdmin.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET!)
      .upload(storagePath, image.buffer, {
        contentType: image.contentType,
        upsert: true,
      });
    uploadError = error;
  } catch (err) {
    uploadError = err;
  }
  if (uploadError) {
    console.error("[createPayment] Supabase error:", uploadError);
    // Leave no pending row behind that the admin could never review.
    await db.payment
      .delete({ where: { id: paymentId } })
      .catch((err) => console.error("[createPayment] Cleanup error:", err));
    return { error: "Failed to upload payment proof. Please try again." };
  }

  try {
    await db.payment.update({
      where: { id: paymentId },
      data: { proofUrl: storagePath },
    });
  } catch (err) {
    console.error("[createPayment] DB error (proof url):", err);
    return {
      error: "Payment uploaded but could not be saved. Please contact support.",
    };
  }

  try {
    await sendPaymentConfirmationEmail({
      to: user.email,
      firstName: user.firstName,
      courseTitle: enrollment.course.title,
    });
  } catch (err) {
    console.error("[createPayment] Email error:", err);
  }

  redirect("/student/dashboard?payment=1");
}
