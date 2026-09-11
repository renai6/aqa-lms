import { appUrl, escapeHtml, sendEmail } from '@/lib/email/client'
import { button, note, p, renderEmail } from '@/lib/email/template'

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${appUrl('/verify-email')}?token=${token}`
  await sendEmail({
    to,
    label: 'verification email',
    subject: 'Verify your email — AQA LMS',
    html: renderEmail({
      heading: 'Verify your email',
      body:
        p('Confirm this address to finish setting up your account.') +
        button('Verify my email', url) +
        p('This link expires in 24 hours.'),
    }),
  })
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${appUrl('/reset-password')}?token=${token}`
  await sendEmail({
    to,
    label: 'password reset email',
    subject: 'Reset your password — AQA LMS',
    html: renderEmail({
      heading: 'Reset your password',
      body:
        p('Choose a new password for your account.') +
        button('Reset my password', url) +
        p(
          'This link expires in 1 hour. If you did not request it, you can safely ignore this email.',
        ),
    }),
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
    html: renderEmail({
      heading: `Hi ${escapeHtml(firstName)}, your account is ready`,
      body:
        p(
          'An account has been created for you on the AQA Learning Management System.',
        ) +
        note(
          `<strong>Email:</strong> ${escapeHtml(to)}<br/><strong>Temporary password:</strong> ${escapeHtml(tempPassword)}`,
        ) +
        button('Log in', loginUrl) +
        p('Please change your password on first login.'),
    }),
  })
}
