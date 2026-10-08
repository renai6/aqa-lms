import { describe, it, expect, vi, beforeEach } from 'vitest'

const sent = vi.hoisted(() => [] as { html: string }[])

vi.mock('@/lib/email/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/client')>()),
  sendEmail: vi.fn(async (params: { html: string }) => {
    sent.push(params)
  }),
}))

import { sendPurchaseApprovalEmail } from '@/lib/purchases/email'
import { sendPaymentRejectionEmail } from '@/lib/payments/email'

beforeEach(() => {
  sent.length = 0
  process.env.APP_URL = 'http://localhost:3000'
})

describe('kid line in transactional email', () => {
  it('names the kid when the email is about a kid', async () => {
    await sendPurchaseApprovalEmail({ to: 'p@example.com', firstName: 'Raffi', courseNames: ['Kids 1'], learnerFirstName: 'Ana' })
    expect(sent[0].html).toContain('This update is about <strong>Ana</strong>')
  })

  it('omits the line for a student acting for themselves', async () => {
    await sendPurchaseApprovalEmail({ to: 's@example.com', firstName: 'Sam', courseNames: ['Course'] })
    expect(sent[0].html).not.toContain('This update is about')
  })

  it('escapes the kid name', async () => {
    await sendPaymentRejectionEmail({
      to: 'p@example.com',
      firstName: 'Raffi',
      courseTitle: 'Kids 1',
      reason: 'Blurry proof',
      learnerFirstName: '<b>Ana</b>',
    })
    expect(sent[0].html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
    expect(sent[0].html).not.toContain('<b>Ana</b>')
  })
})
