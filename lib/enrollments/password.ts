import { randomBytes } from 'crypto'

export function generateTempPassword(): string {
  return randomBytes(16).toString('base64url').slice(0, 12)
}
