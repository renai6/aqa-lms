import { appUrl, escapeHtml, sendEmail } from "@/lib/email/client";
import { button, note, p, renderEmail } from "@/lib/email/template";

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
    html: renderEmail({
      heading: "We received your payment",
      body:
        p(`Assalamualaykum ${escapeHtml(params.firstName)},`) +
        p(
          `We have received your payment and proof of payment for <strong>${escapeHtml(params.courseTitle)}</strong>. Our team will review it shortly.`,
        ) +
        button("Track its status", url) +
        p("Best regards,<br>Al-Qur'an Academy Team"),
    }),
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
    html: renderEmail({
      heading: "Your payment is approved",
      body:
        p(`Assalamualaykum ${escapeHtml(params.firstName)},`) +
        p(
          `Your payment for <strong>${escapeHtml(params.courseTitle)}</strong> has been approved.`,
        ) +
        p(statusLine) +
        button("View your dashboard", url) +
        p("Best regards,<br>Al-Qur'an Academy Team"),
    }),
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
    html: renderEmail({
      heading: "Update on your payment",
      body:
        p(`Assalamualaykum ${escapeHtml(params.firstName)},`) +
        p(
          `Unfortunately, your recent payment for <strong>${escapeHtml(params.courseTitle)}</strong> could not be approved.`,
        ) +
        note(`<strong>Reason:</strong> ${escapeHtml(params.reason)}`) +
        p("You're welcome to submit a new payment.") +
        button("Submit a new payment", url) +
        p("Best regards,<br>Al-Qur'an Academy Team"),
    }),
  });
}
