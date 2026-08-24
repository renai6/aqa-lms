import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendPaymentConfirmationEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "We received your payment — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>We have received your payment and proof of payment for <strong>${escapeHtml(params.courseTitle)}</strong>. Our team will review it shortly.</p>
<p>You can track its status here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(
      `Failed to send payment confirmation email: ${error.message}`,
    );
}

export async function sendPaymentApprovalEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
  paymentStatus: "PARTIALLY_PAID" | "FULLY_PAID";
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const statusLine =
    params.paymentStatus === "FULLY_PAID"
      ? "Your enrollment is now marked as fully paid. Jazakallahu khayran!"
      : "Your enrollment is still marked as partially paid, so a balance remains.";
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Your payment is approved — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Your payment for <strong>${escapeHtml(params.courseTitle)}</strong> has been approved.</p>
<p>${statusLine}</p>
<p>View your dashboard: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(`Failed to send payment approval email: ${error.message}`);
}

export async function sendPaymentRejectionEmail(params: {
  to: string;
  firstName: string;
  courseTitle: string;
  reason: string;
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Update on your payment — Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Unfortunately, your recent payment for <strong>${escapeHtml(params.courseTitle)}</strong> could not be approved.</p>
<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
<p>You're welcome to submit a new payment here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
  if (error)
    throw new Error(`Failed to send payment rejection email: ${error.message}`);
}
