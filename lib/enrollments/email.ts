import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendEnrollmentApprovalEmail(params: {
  to: string
  firstName: string
  courseName: string
  tempPassword: string
}): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/login`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Your enrollment is approved — Al-Qur'an Academy",
    html: `<p>Dear ${escapeHtml(params.firstName)},</p>
<p>Your enrollment to <strong>${escapeHtml(params.courseName)}</strong> has been approved!</p>
<p>You can now log in to your student account using the following credentials:</p>
<p><strong>Username (Email):</strong> ${params.to}<br>
<strong>Temporary Password:</strong> ${escapeHtml(params.tempPassword)}</p>
<p>Please log in at <a href="${url}">${url}</a> and change your password on your first login.</p>
<p>Welcome to Al-Qur'an Academy!</p>`,
  })
  if (error) throw new Error(`Failed to send enrollment approval email: ${error.message}`)
}

export async function sendEnrollmentRejectionEmail(params: {
  to: string
  firstName: string
  courseName: string
  reason: string
}): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.to,
    subject: "Your enrollment application — Al-Qur'an Academy",
    html: `<p>Dear ${escapeHtml(params.firstName)},</p>
<p>Thank you for your interest in <strong>${escapeHtml(params.courseName)}</strong> at Al-Qur'an Academy.</p>
<p>Unfortunately, your enrollment application has been reviewed and cannot be approved at this time.</p>
<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>
<p>We encourage you to review our requirements and feel free to re-apply in the future if circumstances change.</p>
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>Best regards,<br>Al-Qur'an Academy Team</p>`,
  })
  if (error) throw new Error(`Failed to send enrollment rejection email: ${error.message}`)
}
