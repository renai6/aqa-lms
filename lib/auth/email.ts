import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: 'Verify your email — AQA LMS',
    html: `<p>Click <a href="${url}">here</a> to verify your email. Link expires in 24 hours.</p>`,
  })
  if (error) throw new Error(`Failed to send verification email: ${error.message}`)
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: 'Reset your password — AQA LMS',
    html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
  })
  if (error) throw new Error(`Failed to send password reset email: ${error.message}`)
}

export async function sendCredentialsEmail(
  to: string,
  firstName: string,
  tempPassword: string,
) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: 'Your AQA LMS account credentials',
    html: `
      <p>Hi ${firstName},</p>
      <p>Your account has been created on the AQA Learning Management System.</p>
      <p><strong>Email:</strong> ${to}<br/>
      <strong>Temporary Password:</strong> ${tempPassword}</p>
      <p>Please <a href="${loginUrl}">log in</a> and change your password on first login.</p>
    `,
  })
  if (error) throw new Error(`Failed to send credentials email: ${error.message}`)
}
