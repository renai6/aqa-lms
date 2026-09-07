import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  sendMock.mockReset().mockResolvedValue({ data: { id: 'email-id' }, error: null })
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.RESEND_FROM_EMAIL = 'noreply@test.com'
  process.env.APP_URL = 'https://aqaedu.com'
})

afterEach(() => {
  process.env = { ...ENV }
})

// Each test re-imports so the module-level Resend client is rebuilt from current env.
const load = () => import('@/lib/email/client')

const email = { to: 'user@test.com', subject: 'Hi', html: '<p>Hi</p>', label: 'test email' }

describe('sendEmail', () => {
  it('sends with the configured from-address', async () => {
    const { sendEmail } = await load()
    await sendEmail(email)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'noreply@test.com', to: 'user@test.com' }),
    )
  })

  it('throws EmailConfigError when the API key is missing', async () => {
    delete process.env.RESEND_API_KEY
    const { sendEmail, EmailConfigError } = await load()
    await expect(sendEmail(email)).rejects.toBeInstanceOf(EmailConfigError)
  })

  it('throws EmailConfigError when the provider rejects the key', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'API key is invalid' } })
    const { sendEmail, EmailConfigError } = await load()
    await expect(sendEmail(email)).rejects.toBeInstanceOf(EmailConfigError)
    await expect(sendEmail(email)).rejects.toThrow(/RESEND_API_KEY/)
  })

  it('throws a plain Error for an ordinary send failure', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'Recipient bounced' } })
    const { sendEmail, EmailConfigError } = await load()
    await expect(sendEmail(email)).rejects.toThrow(/Recipient bounced/)
    await expect(sendEmail(email)).rejects.not.toBeInstanceOf(EmailConfigError)
  })

  it('tolerates a key stored with surrounding quotes', async () => {
    process.env.RESEND_API_KEY = '"re_test_key"'
    const { sendEmail } = await load()
    await expect(sendEmail(email)).resolves.toBeUndefined()
  })
})

describe('appUrl', () => {
  it('joins a path onto the configured base', async () => {
    const { appUrl } = await load()
    expect(appUrl('/login')).toBe('https://aqaedu.com/login')
  })

  it('does not double a trailing slash', async () => {
    process.env.APP_URL = 'https://aqaedu.com/'
    const { appUrl } = await load()
    expect(appUrl('/login')).toBe('https://aqaedu.com/login')
  })

  it('throws rather than building an "undefined/..." link', async () => {
    delete process.env.APP_URL
    const { appUrl, EmailConfigError } = await load()
    expect(() => appUrl('/login')).toThrow(EmailConfigError)
  })
})

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', async () => {
    const { escapeHtml } = await load()
    expect(escapeHtml('<script>&"')).toBe('&lt;script&gt;&amp;"')
  })
})
