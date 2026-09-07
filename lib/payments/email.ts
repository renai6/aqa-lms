import { appUrl, escapeHtml, sendEmail } from "@/lib/email/client";

export async function sendPaymentConfirmationEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
}): Promise<void> {
  const url = appUrl("/student/dashboard");
  await sendEmail({
    to: params.to,
    label: "payment confirmation email",
    subject: "We received your payment — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>We have received your payment and proof of payment for <strong>${escapeHtml(params.courseTitle)}</strong>. Our team will review it shortly.</p>
<p>You can track its status here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
}

export async function sendPaymentApprovalEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
}): Promise<void> {
  const url = appUrl("/student/dashboard");
  const statusLine =
    params.paymentStatus === "FULLY_PAID"
      ? "Your enrollment is now marked as fully paid. Jazakallahu khayran!"
      : "Your enrollment is still marked as partially paid, so a balance remains.";
  await sendEmail({
    to: params.to,
    label: "payment approval email",
    subject: "Your payment is approved — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Your payment for <strong>${escapeHtml(params.courseTitle)}</strong> has been approved.</p>
<p>${statusLine}</p>
<p>View your dashboard: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
}

export async function sendPaymentRejectionEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
  reason: string;
}): Promise<void> {
  const url = appUrl("/student/dashboard");
  await sendEmail({
    to: params.to,
    label: "payment rejection email",
    subject: "Update on your payment — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Unfortunately, your recent payment for <strong>${escapeHtml(params.courseTitle)}</strong> could not be approved.</p>
<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
<p>You're welcome to submit a new payment here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
}
