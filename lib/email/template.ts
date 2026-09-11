/**
 * Shared HTML shell for transactional email, tinted with the marketing
 * palette from `app/globals.css` (maroon frame, gold trim, warm neutrals).
 *
 * Deliberately plain: table layout and inline styles only, because email
 * clients drop stylesheets, flexbox, and custom properties alike. Anything
 * fancier than colour and spacing belongs on the site, not in the inbox.
 */

const MAROON = '#8a1933'
const MAROON_DEEP = '#59081b'
const GOLD = '#ffba70'
const INK = '#333030'
const MUTED_FG = '#736660'
const PAGE_BG = '#f7efe7'
const ACCENT_BG = '#f7ece2'
const BORDER = '#eee2d8'

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

const BRAND = 'Al-Qur&rsquo;an Academy'

/** A body paragraph. `html` is inserted as-is, so escape any user input first. */
export function p(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${INK};">${html}</p>`
}

/** A bulleted list. Items are inserted as-is, so escape any user input first. */
export function ul(items: string[]): string {
  const rows = items
    .map(
      (item) =>
        `<li style="margin:0 0 6px;font-size:15px;line-height:1.65;color:${INK};">${item}</li>`,
    )
    .join('')
  return `<ul style="margin:0 0 14px;padding-left:20px;">${rows}</ul>`
}

/**
 * A tinted callout for the one fact the reader is looking for - a rejection
 * reason, a temporary password.
 */
export function note(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
<tr><td style="background-color:${ACCENT_BG};border-left:3px solid ${GOLD};border-radius:6px;padding:14px 16px;font-size:15px;line-height:1.65;color:${INK};">${html}</td></tr>
</table>`
}

/** The primary action. One per email, so the next step is never ambiguous. */
export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;">
<tr><td style="background-color:${MAROON};border-radius:8px;">
<a href="${url}" style="display:inline-block;padding:12px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;">${label}</a>
</td></tr>
</table>`
}

/** Wraps composed blocks in the branded frame and returns a full document. */
export function renderEmail(params: {
  /** Shown as the email's own headline, above the body. */
  heading: string
  /** Blocks built with `p`, `ul`, `note`, and `button`. */
  body: string
}): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
<tr><td style="background-color:${MAROON};border-bottom:3px solid ${GOLD};border-radius:11px 11px 0 0;padding:22px 32px;font-family:${FONT};font-size:14px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;">${BRAND}</td></tr>
<tr><td style="padding:30px 32px 16px;font-family:${FONT};">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:600;color:${MAROON_DEEP};">${params.heading}</h1>
${params.body}
</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:18px 32px;text-align:center;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED_FG};">
&copy; ${new Date().getFullYear()} ${BRAND} International. All rights reserved.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
