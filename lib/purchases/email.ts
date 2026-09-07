import { appUrl, escapeHtml, sendEmail } from "@/lib/email/client";

export async function sendPurchaseConfirmationEmail(params: {
  to: string;
  firstName: string;
  purchaseId: string;
  payLater: boolean;
}): Promise<void> {
  const url = appUrl("/student/dashboard");
  const received = params.payLater
    ? "We have received your enrollment request. You chose to pay later, so nothing is due yet - our team will review your request shortly."
    : "We have received your course purchase and proof of payment. Our team will review it shortly.";
  await sendEmail({
    to: params.to,
    label: "purchase confirmation email",
    subject: "We received your course purchase - Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>${received}</p>
<p>You can track its status here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
}

export async function sendPurchaseApprovalEmail(params: {
  to: string;
  firstName: string;
  courseNames: string[];
}): Promise<void> {
  const url = appUrl("/student/dashboard");
  const list = params.courseNames
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join("");
  await sendEmail({
    to: params.to,
    label: "purchase approval email",
    subject: "Your course purchase is approved - Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Your purchase has been approved. You now have access to:</p>
<ul>${list}</ul>
<p>Log in to start learning: <a href="${url}">${url}</a></p>
<p>Welcome to Al-Qur'an Academy!</p>`,
  });
}

export async function sendPurchaseRejectionEmail(params: {
  to: string;
  firstName: string;
  reason: string;
}): Promise<void> {
  const url = appUrl("/student/courses");
  await sendEmail({
    to: params.to,
    label: "purchase rejection email",
    subject: "Update on your course purchase - Al-Qur'an Academy",
    html: `<p>Assalamualaykum ${escapeHtml(params.firstName)},</p>
<p>Unfortunately, your recent course purchase could not be approved.</p>
<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
<p>You're welcome to submit a new purchase here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  });
}
