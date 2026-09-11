import { appUrl, escapeHtml, sendEmail } from "@/lib/email/client";
import { button, note, p, renderEmail, ul } from "@/lib/email/template";

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
    html: renderEmail({
      heading: "We received your course purchase",
      body:
        p(`Assalamualaykum ${escapeHtml(params.firstName)},`) +
        p(received) +
        button("Track its status", url) +
        p("Best regards,<br>Al-Qur'an Academy Team"),
    }),
  });
}

export async function sendPurchaseApprovalEmail(params: {
  to: string;
  firstName: string;
  courseNames: string[];
}): Promise<void> {
  const url = appUrl("/student/dashboard");
  await sendEmail({
    to: params.to,
    label: "purchase approval email",
    subject: "Your course purchase is approved - Al-Qur'an Academy",
    html: renderEmail({
      heading: "Your course purchase is approved",
      body:
        p(`Assalamualaykum ${escapeHtml(params.firstName)},`) +
        p("Your purchase has been approved. You now have access to:") +
        ul(params.courseNames.map((c) => escapeHtml(c))) +
        button("Start learning", url) +
        p("Welcome to Al-Qur'an Academy!"),
    }),
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
    html: renderEmail({
      heading: "Update on your course purchase",
      body:
        p(`Assalamualaykum ${escapeHtml(params.firstName)},`) +
        p("Unfortunately, your recent course purchase could not be approved.") +
        note(`<strong>Reason:</strong> ${escapeHtml(params.reason)}`) +
        p("You're welcome to submit a new purchase.") +
        button("Browse courses", url) +
        p("Best regards,<br>Al-Qur'an Academy Team"),
    }),
  });
}
