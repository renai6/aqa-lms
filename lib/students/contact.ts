// A kid profile has no email or phone of its own: the parent who manages it is
// the contact. Every admin, teacher and email surface resolves a student's
// contact details through here, so that rule lives in one place.

type GuardianContact = {
  firstName: string
  lastName: string
  email: string | null
  contactNumber: string | null
}

export const GUARDIAN_CONTACT_SELECT = {
  select: { firstName: true, lastName: true, email: true, contactNumber: true },
} as const

export type Contact = {
  email: string
  contactNumber: string | null
  // Set only for a kid: the parent whose email and phone are shown instead.
  parentName: string | null
}

export function contactOf(user: {
  email: string | null
  contactNumber?: string | null
  guardian?: GuardianContact | null
}): Contact {
  const g = user.guardian
  if (!g) {
    return { email: user.email ?? '', contactNumber: user.contactNumber ?? null, parentName: null }
  }
  return { email: g.email ?? '', contactNumber: g.contactNumber, parentName: `${g.firstName} ${g.lastName}` }
}

export const NOTIFY_SELECT = {
  firstName: true,
  email: true,
  guardian: { select: { firstName: true, email: true } },
} as const

export type NotificationTarget = {
  to: string
  firstName: string
  // Set when the email is about a kid, so the parent knows which child it concerns.
  learnerFirstName: string | null
}

export function notificationTarget(user: {
  firstName: string
  email: string | null
  guardian?: { firstName: string; email: string | null } | null
}): NotificationTarget | null {
  if (user.email) return { to: user.email, firstName: user.firstName, learnerFirstName: null }
  if (user.guardian?.email) {
    return { to: user.guardian.email, firstName: user.guardian.firstName, learnerFirstName: user.firstName }
  }
  return null
}
