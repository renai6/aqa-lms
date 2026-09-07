import { appUrl, escapeHtml, sendEmail } from '@/lib/email/client'

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${appUrl('/verify-email')}?token=${token}`
  await sendEmail({
    to,
    label: 'verification email',
    subject: 'Verify your email — AQA LMS',
    html: `<p>Click <a href="${url}">here</a> to verify your email. Link expires in 24 hours.</p>`,
  })
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${appUrl('/reset-password')}?token=${token}`
  await sendEmail({
    to,
    label: 'password reset email',
    subject: 'Reset your password — AQA LMS',
    html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
  })
}

export async function sendCredentialsEmail(
  to: string,
  firstName: string,
  tempPassword: string,
) {
  const loginUrl = appUrl('/login')
  await sendEmail({
    to,
    label: 'credentials email',
    subject: 'Your AQA LMS account credentials',
    html: `
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Your account has been created on the AQA Learning Management System.</p>
      <p><strong>Email:</strong> ${to}<br/>
      <strong>Temporary Password:</strong> ${escapeHtml(tempPassword)}</p>
      <p>Please <a href="${loginUrl}">log in</a> and change your password on first login.</p>
    `,
  })
}
