import { randomBytes } from 'crypto'

// Human-readable certificate number: AQA-<year>-<6 uppercase hex chars>.
// The 6 hex chars come from 3 random bytes. Uniqueness is enforced by the
// certificateNo @unique column; this only needs to be readable and collision
// resistant.
export function generateCertificateNo(now: Date = new Date()): string {
  const suffix = randomBytes(3).toString('hex').toUpperCase()
  return `AQA-${now.getFullYear()}-${suffix}`
}
