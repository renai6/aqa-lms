import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendPurchaseConfirmationEmail(params: {
  to: string
  firstName: string
  purchaseId: string
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/purchases`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "We received your course purchase — Al-Qur'an Academy",
    html: `<p>Dear ${escapeHtml(params.firstName)},</p>
<p>We have received your course purchase and proof of payment. Our team will review it shortly.</p>
<p>You can track its status here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  })
  if (error) throw new Error(`Failed to send purchase confirmation email: ${error.message}`)
}

export async function sendPurchaseApprovalEmail(params: {
  to: string
  firstName: string
  courseNames: string[]
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard`
  const list = params.courseNames.map((c) => `<li>${escapeHtml(c)}</li>`).join('')
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Your course purchase is approved — Al-Qur'an Academy",
    html: `<p>Dear ${escapeHtml(params.firstName)},</p>
<p>Your purchase has been approved. You now have access to:</p>
<ul>${list}</ul>
<p>Log in to start learning: <a href="${url}">${url}</a></p>
<p>Welcome to Al-Qur'an Academy!</p>`,
  })
  if (error) throw new Error(`Failed to send purchase approval email: ${error.message}`)
}

export async function sendPurchaseRejectionEmail(params: {
  to: string
  firstName: string
  reason: string
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/student/courses`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Update on your course purchase — Al-Qur'an Academy",
    html: `<p>Dear ${escapeHtml(params.firstName)},</p>
<p>Unfortunately, your recent course purchase could not be approved.</p>
<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
<p>You're welcome to submit a new purchase here: <a href="${url}">${url}</a></p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  })
  if (error) throw new Error(`Failed to send purchase rejection email: ${error.message}`)
}
