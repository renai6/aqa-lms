import { Resend } from 'resend'

/**
 * Raised when email config is missing, malformed, or rejected by the provider.
 * Distinct from a transient send failure: a deploy has to change for it to clear.
 */
export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailConfigError'
  }
}

/**
 * Reads a required env var, tolerating a value that was pasted with surrounding
 * quotes - a common way to end up with a technically-present but invalid secret.
 */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
  if (!value) {
    throw new EmailConfigError(
      `${name} is not set. Email delivery is disabled in this environment until it is.`,
    )
  }
  return value
}

let cached: Resend | null = null

function client(): Resend {
  if (!cached) cached = new Resend(requireEnv('RESEND_API_KEY'))
  return cached
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Absolute app URL for links in emails. Throws rather than emitting `undefined/...`. */
export function appUrl(path = ''): string {
  return requireEnv('APP_URL').replace(/\/+$/, '') + path
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  /** Human-readable name of the email, used to prefix failures. */
  label: string
}): Promise<void> {
  const { error } = await client().emails.send({
    from: requireEnv('RESEND_FROM_EMAIL'),
    to: params.to,
    subject: params.subject,
    html: params.html,
  })
  if (!error) return

  // Resend answers a bad credential with "API key is invalid". That is a broken
  // deploy, not a flaky send, and retrying will never clear it - so say so.
  if (/api key/i.test(error.message)) {
    throw new EmailConfigError(
      `Failed to send ${params.label}: ${error.message}. RESEND_API_KEY in this environment is wrong or revoked.`,
    )
  }
  throw new Error(`Failed to send ${params.label}: ${error.message}`)
}
