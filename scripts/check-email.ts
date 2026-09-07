/**
 * Verifies email configuration against the Resend API.
 *
 *   pnpm check:email                    # validate config in .env
 *   pnpm check:email --to=me@you.com    # also send a real test email
 *
 * To check production, run it with production values in the environment:
 *   RESEND_API_KEY=... RESEND_FROM_EMAIL=... APP_URL=... pnpm check:email
 */
import 'dotenv/config'

type Domain = {
  name: string
  status: string
  capabilities?: { sending?: string }
}

const problems: string[] = []

function env(name: string): string | undefined {
  return process.env[name]?.trim().replace(/^["']|["']$/g, '')
}

function fail(message: string) {
  problems.push(message)
  console.error(`  FAIL  ${message}`)
}

function pass(message: string) {
  console.log(`  ok    ${message}`)
}

async function main() {
  const to = process.argv.find((a) => a.startsWith('--to='))?.slice('--to='.length)

  const apiKey = env('RESEND_API_KEY')
  const from = env('RESEND_FROM_EMAIL')
  const appUrl = env('APP_URL')

  console.log('Email configuration')

  if (!apiKey) fail('RESEND_API_KEY is not set')
  else pass(`RESEND_API_KEY is set (${apiKey.slice(0, 7)}…)`)

  if (!from) fail('RESEND_FROM_EMAIL is not set')
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from.replace(/^.*<|>$/g, '')))
    fail(`RESEND_FROM_EMAIL is not a valid address: ${from}`)
  else pass(`RESEND_FROM_EMAIL is ${from}`)

  if (!appUrl) fail('APP_URL is not set (email links would be broken)')
  else if (/localhost|127\.0\.0\.1/.test(appUrl))
    console.log(`  warn  APP_URL is ${appUrl} - fine locally, broken in production`)
  else pass(`APP_URL is ${appUrl}`)

  if (!apiKey) return report()

  console.log('\nProvider')
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const body = (await res.text()).slice(0, 200)
    // Resend answers a bad credential with 400 "API key is invalid", not 401.
    if (/api key/i.test(body) || res.status === 401 || res.status === 403) {
      fail(
        `Resend rejected the API key (HTTP ${res.status}): ${body}\n` +
          `        Set a valid RESEND_API_KEY in this environment and redeploy.`,
      )
    } else {
      fail(`Resend returned HTTP ${res.status}: ${body}`)
    }
    return report()
  }
  pass('API key accepted by Resend')

  const domains: Domain[] = (await res.json()).data ?? []
  const fromDomain = from?.replace(/^.*<|>$/g, '').split('@')[1]
  const match = domains.find((d) => d.name === fromDomain)

  if (!fromDomain) {
    // already reported above
  } else if (!match) {
    fail(
      `${fromDomain} is not registered in this Resend account. ` +
        `Available: ${domains.map((d) => d.name).join(', ') || 'none'}`,
    )
  } else if (match.status !== 'verified') {
    fail(`${fromDomain} is registered but status is "${match.status}", not "verified"`)
  } else if (match.capabilities?.sending !== 'enabled') {
    fail(`${fromDomain} is verified but sending is "${match.capabilities?.sending}"`)
  } else {
    pass(`${fromDomain} is verified and sending is enabled`)
  }

  if (to && problems.length === 0) {
    console.log('\nTest send')
    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'AQA LMS email configuration test',
        html: `<p>Email delivery is working. Sent by <code>pnpm check:email</code>.</p>`,
      }),
    })
    const body = await send.text()
    if (send.ok) pass(`test email accepted for ${to} (${body.slice(0, 120)})`)
    else fail(`test send failed (HTTP ${send.status}): ${body.slice(0, 200)}`)
  }

  report()
}

function report() {
  console.log('')
  if (problems.length > 0) {
    console.error(`${problems.length} problem(s) found. Email will not be delivered.`)
    process.exit(1)
  }
  console.log('Email configuration is valid.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
