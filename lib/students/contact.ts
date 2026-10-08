// A student with their own email is contacted directly, even when a parent
// manages them. A kid profile without an email has no contact details of its
// own: the parent who manages it is the contact. Every admin, teacher and email
// surface resolves a student's contact details through here, so that rule
// lives in one place.

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
  // Set whenever the student has a guardian, so staff still see the Kid note.
  parentName: string | null
  // True only when the email and phone shown are the guardian's.
  viaParent: boolean
}

export function contactOf(user: {
  email: string | null
  contactNumber?: string | null
  guardian?: GuardianContact | null
}): Contact {
  const g = user.guardian
  const parentName = g ? `${g.firstName} ${g.lastName}` : null
  if (!g || user.email) {
    return { email: user.email ?? '', contactNumber: user.contactNumber ?? null, parentName, viaParent: false }
  }
  return { email: g.email ?? '', contactNumber: g.contactNumber, parentName, viaParent: true }
}

export const NOTIFY_SELECT = {
  firstName: true,
  email: true,
  guardian: { select: { firstName: true, email: true } },
} as const

// One address an email about a student is sent to.
export type NotificationTarget = {
  to: string
  firstName: string
  // Set when the email goes to the guardian, so the parent knows which child it concerns.
  learnerFirstName: string | null
}

// Every address an email about this student goes to: the student's own, then
// the guardian's. A linked kid with their own login and their parent both hear
// about it; a kid without an email reaches only the parent.
export function notificationTargets(user: {
  firstName: string
  email: string | null
  guardian?: { firstName: string; email: string | null } | null
}): NotificationTarget[] {
  const targets: NotificationTarget[] = []
  if (user.email) targets.push({ to: user.email, firstName: user.firstName, learnerFirstName: null })
  if (user.guardian?.email) {
    targets.push({ to: user.guardian.email, firstName: user.guardian.firstName, learnerFirstName: user.firstName })
  }
  return targets
}
